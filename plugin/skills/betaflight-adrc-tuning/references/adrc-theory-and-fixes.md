# ADRC Theory, Origins, and the Robustness Fixes

## The control law

ADRC (Active Disturbance Rejection Control) replaces the setpoint/error-driven PID loop with a
model-based one. Per axis, a second-order linear **Extended State Observer (ESO)** maintains three
running estimates from the filtered gyro reading and the previous control output:

- **z1** — estimated rotation rate (tracks the gyro)
- **z2** — estimated rate-of-change of rotation (a D-like term)
- **z3** — estimated lumped disturbance (an I-like term: motor/prop mismatch, wind, payload
  imbalance, CG offset — anything the model doesn't otherwise account for)

The control output is a virtual PD law: `u = (kp·(setpoint − z1) − kd·z2 − z3) / b0`, where
`kp = wc²` and `kd = 2·wc`. `b0` divides out the control-input gain estimate. Output is logged into
the standard P/I/D blackbox fields for mixer/tooling compatibility, but the values don't carry
their classic-PID meaning — they're the ADRC control law's raw terms, not PID gains times error.

**Why this can need less per-craft tuning than PID in principle**: instead of reacting to error
after the fact, the ESO actively models and cancels the disturbance term (`z3`), which is what
gives ADRC its "disturbance rejection" character — flying through wind, prop damage, or a
lopsided payload without the pilot or a re-tune compensating for it. This is real (see flight
evidence below), but it is not free of tuning — `wc`/`wo`/`b0` are genuinely craft-dependent, and a
badly-matched `b0` in particular causes real instability, not just a soft feel.

## Origins — three independent implementations

1. **[Boyyt357/ADRC-betaflight](https://github.com/Boyyt357/ADRC-betaflight)** — original
   proof-of-concept. Repurposed the legacy P/I/D CLI cells as Control Bandwidth / Observer
   Bandwidth / System Gain. No liftoff protection, no anti-windup — the raw ESO + virtual PD math
   core, faithful to LADRC theory (Gao 2003 bandwidth parameterization).
2. **[danusha2345/ADRC-betaflight](https://github.com/danusha2345/ADRC-betaflight)** — a fork
   adding a long series of independent robustness fixes on top of the PoC (see below), validated
   by real flight testers across several airframes (5" freestyle, 65mm whoop, 2" cinewhoop). This
   is the canonical source for ongoing flight-test reports, community tuning data, and deep
   fix-by-fix rationale — its `README.md` and `ADRC_FIXES.md` go well beyond what's summarized
   here.
3. **This implementation** (`betaflight/betaflight#15400`, not yet merged) ports danusha2345's
   fixes into a dedicated, opt-in module (`src/main/flight/adrc.c`/`.h`) selected per-profile via
   `pid_type`, rather than danusha2345's inline-in-`pid.c` repurposed-slider approach. Dedicated
   `uint16_t` fields replace the repurposed P/I/D cells, and a dedicated pre-ESO gyro filter plus
   an optional tracking differentiator (from a fourth source, SeverinBitterli's independent
   implementation) were added on top.

## The robustness fixes (why each one exists)

These all originated as danusha2345's fork fixes and are present in this implementation
(mechanism names as implemented here, not the fork's field names):

- **Liftoff gate** (`adrc_liftoff_*`) — see `adrc-cli-reference.md` for the full mechanism. Root
  cause: the ESO's `b0·u` feedback term assumes real thrust response, which is false while
  ground-constrained. Confirmed by blackbox analysis of real takeoffs: the "takeoff bounce" every
  early ADRC build exhibited traces directly to `z3` winding toward `-b0·u` while grounded, then
  unwinding violently at liftoff.
- **Gated z3 decay** (`adrc_gated_z3_decay`) — the liftoff gate alone only zeroes the `b0·u` term
  in `z2`'s update; it does nothing to stop `z3` itself leaking upward from a small sustained
  `errorEso` bias (sensor cal residual, filter phase lag) — its steady-state gain
  (`beta3/decayRate`) is enormous. A faster decay rate while grounded prevents this without a
  reset discontinuity.
- **Throttle-scaled b0** (`adrc_hover_throttle`, `adrc_b0_scale_max`) — motor authority roughly
  scales with throttle² (thrust ~ RPM² ~ throttle²), so a `b0` tuned at hover is wrong away from
  it. Scaled only *up* from hover — scaling down would make `1/b0` huge and inject extreme output
  at low throttle.
- **Anti-windup on z3, not on z2/P/D** — `z3` is the only ESO state with integrator memory (a
  leaky integrator of the observer error), so it's the only one that needs an authority-derived
  clamp (`|I| = |z3/b0|` capped at `pidSumLimit`). An earlier revision of this port also clamped
  `z2` and the individual P/D terms, mirroring classic PID's windup protections — this was
  **removed** after real hover-flight data (see Known Real-World Findings below) showed `z2`
  routinely exceeds what that clamp allowed during completely ordinary flying, and the per-term
  P/D clamps cut mid-maneuver drive several-fold versus the community-validated tunes. `z2` has no
  integrator memory to wind up — it's servo'd back toward the measurement every iteration by its
  own `-beta2·errorEso` term — so it only needs a generous *physical* divergence bound, not an
  authority-derived one.
- **Dedicated pre-ESO gyro low-pass** (`adrc_gyro_lpf_hz`) — not part of danusha2345's fork (their
  code feeds the raw gyro reading directly into the observer's error term); added here because
  `kp = wc²` makes the whole control law considerably more sensitive to noise than classic PID's
  linear D-gain is, and classic's own dedicated D-term filter stage has no ADRC equivalent
  otherwise.
- **Mid-air profile-switch re-seed** — switching `pid_type` into `ADRC` from a `CLASSIC` profile
  mid-flight re-seeds the ESO's `z1` (and the pre-ESO filter state) from the current gyro reading,
  so the handover has no kick from arm-time-stale observer state. Does *not* fire on an in-flight
  CLI/adjustment-range save that leaves `pid_type` unchanged — that would needlessly discard the
  `z3` disturbance/trim estimate.
- **Tracking differentiator** (`adrc_td_hz`) — see the CLI reference. The one mechanism here that
  is *not* from danusha2345's fork.

## Community tuning data points (from danusha2345/ADRC-betaflight, `ADRC_FIXES.md`)

Useful as a starting-point sanity check when a craft's tune looks wildly off from these, though
`b0` especially is airframe-specific and should never be copied verbatim:

| Craft | `wc` / `wo` / `b0` (this implementation's equivalent fields) | Notes |
| --- | --- | --- |
| 5" freestyle, 2300 kV, 4S (community round-2 sweep) | 60 / 100 / 2000 | The shipped defaults here. Practical `wc` ceiling was set by gyro-noise amplification, not stability. |
| 5" freestyle, 1750 kV, 4S | 30 / 100 / 2000 | Re-tuned after a motor swap; blackbox-refined by comparing takeoff traces across candidate tunes. |
| 65mm whoop, 30000 kV, 1S | 33 / 65 / 3200 | Needed much higher `b0` (small, punchy motors) than a 5" — this is the craft class where `b0` maxing out the fork's repurposed-slider ceiling motivated the scale-multiplier fix (not needed here — this implementation's `adrc_b0` is a full uint16). |
| 2" cinewhoop (SeverinBitterli's independent implementation) | — | Independently reached the same degree-2 3-state LADRC core; confirmed stable hover and working angle mode. |

## Known real-world findings (from this project's own flight/bench testing, not danusha2345's)

- **Props-off bench testing runs measurably hotter than classic PID for the same hand disturbance
  — expected, not a bug.** See `adrc-testing-notes.md` for the full mechanism and measured data.
- **z2 routinely exceeds the old (now-removed) authority-derived clamp during ordinary flight.** A
  calm hover with "some wobbling" on a 5" (SpeedyBee F7 Mini V2) hit `z2` = ±9,600 — above the old
  ~8,300 ceiling — direct confirmation that clamp was too tight for normal flying, not just a
  theoretical snap/flip concern.
- **A "sluggish"/"less locked-in" feel in angle mode after a successful hover** prompted two
  hypotheses worth distinguishing before re-tuning blind: (1) `wc` genuinely too low for the craft
  (danusha2345's community experience: this exact symptom on a 65mm whoop was cured by raising
  `wc` relative to `wo`), vs. (2) short bursts of alternating-sign ringing tied to active stick
  input (not a continuous background lag) — which points more toward an angle-outer-loop / rate
  loop bandwidth interaction than a simple "increase wc" fix. Both `wc` and `b0` are still the
  first things to check; `adrc_hover_throttle` matching the craft's *actual* hover throttle is a
  prerequisite check (see `adrc-testing-notes.md`) before concluding anything about `wc`.

## Where to go deeper

- [danusha2345/ADRC-betaflight `README.md`](https://github.com/danusha2345/ADRC-betaflight/blob/master/README.md) — the community tuning procedure, worked examples, and prebuilt firmware.
- [danusha2345/ADRC-betaflight `ADRC_FIXES.md`](https://github.com/danusha2345/ADRC-betaflight/blob/master/ADRC_FIXES.md) — fix-by-fix rationale and the full real-world flight-test log, commit by commit.
- [Issue #1 — call for flight testers](https://github.com/danusha2345/ADRC-betaflight/issues/1) — ongoing community reports.
- [betaflight/betaflight#15400](https://github.com/betaflight/betaflight/pull/15400) — this implementation's upstream tracking PR.
