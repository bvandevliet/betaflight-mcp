# ADRC Testing Notes and Known Caveats

Practical findings from bench and flight testing this implementation. Read this before a pilot's
first ADRC flight, and again if they report something that "feels wrong" — several apparent
problems here are expected ADRC behavior, not bugs, and telling a pilot to re-tune away from an
expected characteristic wastes their time.

## Props-off bench testing runs hotter than classic PID — expected

Hand-tilting a craft with props off to sanity-check ADRC before a real flight will produce
noticeably higher motor commands (and real, measurable extra current draw / motor warmth) than
the same hand-tilt test under classic PID. Measured on matched-intensity tests (same craft, same
tilt vigor): motor commands exceeded half of max output roughly **60× more often** under ADRC than
classic PID, and current draw was **6–11× higher**.

**Why**: ADRC's control gains (`kp = wc²`, `kd = 2·wc`) are high-bandwidth by design and give full,
uncapped corrective authority to any tracking error — this is necessary so a real flight
snap/flip gets full authority (the per-term P/D clamps that used to cap this were removed for
exactly that reason; see `adrc-theory-and-fixes.md`). With props off there's no real thrust to
correct against, so the correction just fights an unloaded motor for as long as the disturbance
continues, instead of a brief spike. In real flight, the same authority is doing real aerodynamic
work rather than spinning against nothing.

**What to tell a pilot**: keep props-off hand-tilt sanity checks brief (a few seconds), and don't
extrapolate motor warmth from a props-off test to real flight risk — it's a different regime, not
evidence of a bad tune or a dangerous craft.

## `pid_at_min_throttle = OFF` trade-off

`OFF` disables the controller entirely below the arming throttle threshold — sticks/tilts produce
*zero* motor response until throttle is raised, which reads as "the sticks don't work" on a bench
test, then the controller wakes with a step once throttle crosses the threshold. The default `ON`
is safe under ADRC specifically because the liftoff gate already provides ground protection (this
was not always true historically — early ADRC implementations without a liftoff gate needed `OFF`
as their only ground-safety mechanism). Only recommend `OFF` if the pilot specifically wants that
behavior and understands the trade-off; don't default to suggesting it as a bench-testing
convenience the way older ADRC guidance sometimes did.

## `dshot_bidir = ON` — known gyro-freeze risk on at least one board

Observed on an STM32F7X2-based board (SpeedyBee F7 Mini V2): hard gyro freezes (thousands of
identical consecutive gyro samples, momentarily uncontrollable) with `dshot_bidir = ON`. If a
pilot reports the craft "acting possessed" or flying erratically in a way that doesn't map to any
tuning parameter, check `dshot_bidir` and suggest `set dshot_bidir = OFF` as a diagnostic step
(loses the RPM filter; dynamic notch still works). This is a board/firmware-base interaction, not
something fixed by any ADRC tunable — don't chase it as a tuning problem. Root cause not yet fixed
upstream as of this writing.

**How to actually detect it in a blackbox log** (rather than guessing from the symptom alone): a
genuine freeze shows as **hundreds to thousands** of bit-identical consecutive `gyroADC` samples.
Short runs of a handful of identical samples during a calm, low-rotation-rate hover are normal
integer quantization, not a freeze — don't over-read a handful of repeated values as evidence of
this bug.

## `adrc_hover_throttle` vs `adrc_liftoff_throttle` — check both, they answer different questions

These are unrelated in code and easy to conflate:

- `adrc_hover_throttle` calibrates the *magnitude* of the throttle-scaled `b0` model — "where do I
  actually hover."
- `adrc_liftoff_throttle` decides *whether* the liftoff gate trusts `b0·u` feedback at all — "how
  sure am I this throttle means I'm off the ground."

**Concretely useful check**: measure a craft's actual steady-hover throttle from a blackbox log
(a few seconds of level hover, average `rcCommand[3]`, convert to %) and compare against both
settings. If actual hover is well below `adrc_hover_throttle` (e.g. real hover at 22% vs. the
default 35%), the throttle-scaled-`b0` mechanism may never activate during gentle flying — worth
correcting before it matters on a punch-out or aggressive maneuver, even if it hasn't caused a
visible problem yet in gentle testing. Separately, verify `adrc_liftoff_throttle` sits comfortably
*above* the real hover throttle (not equal to it) and `adrc_liftoff_idle_throttle` sits
comfortably *below* it.

## Diagnosing "sluggish" or "wobbly" reports — don't jump straight to raising `wc`

A pilot reporting the craft feels "less locked in" or "sluggish" than classic PID could mean
several distinct things, and re-tuning blind risks fixing the wrong one:

1. **`wc` genuinely too low for the craft** — the classic signature is a slow, smooth, laggy
   approach to setpoint *without* oscillation. Community experience (a 65mm whoop) confirms
   raising `wc` relative to `wo` cures a genuinely floaty/sluggish feel. The practical ceiling
   announces itself as a stuttering/singing noise on throttle-up (gyro-noise amplification) — stop
   one notch below that.
2. **`b0` mismatched to the craft** — too low shows as idle twitching/limit-cycle behavior; too
   high shows as weak, mushy response. The shipped default (2000) is a 5"-freestyle number; a
   smaller/punchier craft's true system gain can be substantially higher (a 65mm whoop needed
   ~3200 in community testing).
3. **`adrc_hover_throttle` mismatch** — see above; if a craft hovers well below the configured
   value, `b0` gets throttle-scaled up too late above hover, softening response earlier than it
   should.
4. **Angle-mode outer-loop interaction, not the ADRC rate loop at all** — the angle-mode leveling
   code runs identically regardless of `pid_type`, but a *different* rate-loop bandwidth (which
   `wc`/`wo` directly control) can still make that same fixed-gain outer loop interact
   differently. If the reported "wobble" is actually short bursts of alternating-sign ringing
   tied precisely to moments of active stick input — not a continuous background wobble while
   holding still — that's a distinguishable signature from plain bandwidth starvation, and worth
   confirming via a `debug_mode = ADRC` blackbox log (channels 0–2 give roll `z1`/`z2`/`z3`
   directly) before concluding it's a `wc`/`wo` problem versus an outer/inner loop bandwidth
   separation issue.

**Recommended order**: (1) confirm `adrc_hover_throttle` matches actual measured hover throttle,
(2) check `adrc_b0` isn't obviously mismatched to the craft class (compare against the table in
`adrc-theory-and-fixes.md`), (3) get a `debug_mode = ADRC` log and look at whether the
error/oscillation is continuous (points to `wc`) or stick-triggered bursts (points to
outer-loop interaction or `wo`), (4) only then sweep `wc`. The tracking differentiator
(`adrc_td_hz`) is a plausible last-mile smoothing tool but shouldn't be reached for before the
above — it smooths the setpoint feeding the control law, it cannot add bandwidth that isn't there.

## Efficiency (current draw) vs. classic PID — genuinely unmeasured

Two opposing effects are both real and neither has been measured head-to-head for equivalent real
flight: `kp = wc²` amplifies sensor noise into extra corrective motor activity (a real efficiency
cost if `wc`/`adrc_gyro_lpf_hz` aren't well matched), versus disturbance rejection potentially
requiring less total corrective effort over a flight than PID's react-after-the-fact cycle (a
potential efficiency win, unconfirmed). Don't assert either direction as settled fact. If a pilot
wants to actually compare, blackbox logs `energyCumulative` (mAh) per flight — fly matched
maneuvers on both `pid_type`s with the same battery/craft and compare consumption for equivalent
flight time and aggression.
