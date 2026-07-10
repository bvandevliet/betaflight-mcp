# ADRC CLI Variable Reference

Complete list of `pid_type` and every `adrc_*` CLI variable, as implemented in the
`betaflight/betaflight#15400` branch (danusha2345/ADRC-betaflight fixes merged in). None of these
exist in any official Betaflight release — see `SKILL.md` for the build-detection check to run
before assuming any of this is present on a connected FC.

All `adrc_*` variables are **profile-specific** (`PG_PID_PROFILE`) — they live per PID profile,
same as `p_roll`/`i_roll`/etc., and show up in `diff`/`dump`.

## Control law

| Variable | Type | Range | Default | Description |
| --- | --- | --- | --- | --- |
| `pid_type` | lookup | `CLASSIC`, `ADRC` | `CLASSIC` | Selects the rate control law for the active profile. Classic PID is untouched and byte-identical regardless of this setting on other profiles. |
| `adrc_wc_roll` / `_pitch` / `_yaw` | uint16 | 5–300 | 60 / 60 / 60 | Controller (virtual PD) bandwidth ωc per axis. `kp = wc²`, `kd = 2·wc`. Master responsiveness knob — its practical ceiling is set by gyro-noise amplification (`kp = wc²` amplifies whatever noise reaches the ESO), not by loop stability. |
| `adrc_wo_roll` / `_pitch` / `_yaw` | uint16 | 10–600 | 100 / 100 / 80 | Extended State Observer bandwidth ωo per axis. Community rule of thumb: `wo ≈ 3–5× wc`. Yaw defaults lower than roll/pitch. |
| `adrc_b0_roll` / `_pitch` / `_yaw` | uint16 | 100–65535 | 2000 / 2000 / 2000 | Control-input gain estimate per axis — how much rotational acceleration one unit of output produces. Scales with motor KV × thrust ÷ mass. Under-estimating causes instability; over-estimating is comparatively harmless (softer response). No repurposed-slider ceiling here (unlike danusha2345's fork, which repurposes the legacy uint8 `D` field and needs a separate `adrc_b0_scale` multiplier to get past 255) — this is a full uint16 field, so if you see a community tune quoting `adrc_b0_scale`, multiply their D-cell value by their scale to get the equivalent `adrc_b0` here. |

## Pre-ESO filtering and throttle scaling

| Variable | Type | Range | Default | Description |
| --- | --- | --- | --- | --- |
| `adrc_gyro_lpf_hz` | uint16 | 0–`LPF_MAX_HZ` | 150 | Low-pass cutoff applied to the ESO's gyro input only (not per-axis). Classic PID's D-term has its own dedicated filter stage on top of the shared base gyro filter; ADRC's whole control law has no equivalent, and `kp = wc²` makes it more noise-sensitive than classic's linear D-gain. `0` = disabled (exact pass-through) — this is a genuine feature, not a bug, following the usual Betaflight "0 = off" convention. Does not affect the shared dynamic notch / RPM filtering, which still runs upstream of both control laws identically. |
| `adrc_hover_throttle` | uint8 | 5–100 | 35 (%) | Throttle % at hover. `b0` is scaled by `(throttle / adrc_hover_throttle)²` above hover (clamped by `adrc_b0_scale_max` below) — motor authority roughly scales with throttle², so a hover-tuned `b0` needs scaling away from hover. **Has no relationship to `adrc_liftoff_throttle` below** — see the Liftoff Gate section. |
| `adrc_b0_scale_max` | uint8 | 1–50 | 9 | Ceiling on the throttle-scaled `b0` multiplier. Scaling is never applied below 1× (i.e. never scales `b0` down, only up, above hover). |

## Liftoff gate

The ESO's `z2` update includes a `b0·u` feedback term that assumes "commanding `u` produces
roughly `b0·u` real angular acceleration." That's false while the craft is ground-constrained (or
hand-held, or props off) — motors can spin at any command but produce no real rotational response.
Without a gate, the observer misattributes the "missing" response to a phantom disturbance and
winds `z3` up, which then unwinds violently at liftoff. This is a permanent architectural
requirement of any b0-modeling ESO, not a training-wheels feature for an immature implementation —
classic PID has no equivalent failure mode because it has no plant model to be wrong about.

| Variable | Type | Range | Default | Description |
| --- | --- | --- | --- | --- |
| `adrc_liftoff_throttle` | uint8 | 1–100 | 40 (%) | Throttle % that alone confirms liftoff (opens the gate, so `b0·u` feedback starts being trusted). **No built-in relationship to `adrc_hover_throttle`** — they answer different questions ("how sure am I this throttle means I'm off the ground" vs. "where do I actually hover"). Set this a bit *above* the craft's actual hover throttle, not equal to it. |
| `adrc_liftoff_gyro_dps` | uint8 | 1–255 | 20 (°/s) | Sustained rotation (any axis) that alone confirms liftoff — the toss-launch path, opens the gate almost instantly on a hand-launched craft even at zero throttle. |
| `adrc_liftoff_hold_ms` | uint16 | 0–5000 | 25 | How long the rotation above `adrc_liftoff_gyro_dps` must sustain before it counts as liftoff. |
| `adrc_liftoff_idle_throttle` | uint8 | 0–100 | 5 (%) | Throttle % the craft must drop below before the gate can re-arm (close again, ready to protect the next ground-idle period). Keep below both `adrc_liftoff_throttle` and the craft's actual hover throttle. |
| `adrc_liftoff_idle_hold_ms` | uint16 | 0–10000 | 500 | How long idle-throttle-and-stillness (gyro also below `adrc_liftoff_gyro_dps`) must sustain to re-arm. The gyro condition matters: a mid-air throttle chop (dive, split-S) reads idle on throttle alone while airmode keeps the craft responding — re-arming there would blind the ESO to its own `b0·u` feedback mid-flight. |

## Disturbance-estimate decay

| Variable | Type | Range | Default | Description |
| --- | --- | --- | --- | --- |
| `adrc_sigma_decay` | uint8 | 0–100 | 3 (×0.1 = 0.3/s) | `z3` leaky-decay rate while **airborne** (gate open). A mild leak (τ ≈ 3s) bleeds a transient disturbance bump toward zero instead of holding it indefinitely. `0` = classic pure integrator. |
| `adrc_gated_z3_decay` | uint16 | 0–2000 | 200 (×0.1 = 20.0/s) | `z3` decay rate while the gate is **closed** (grounded) — always meant to be faster than `adrc_sigma_decay`, so `z3` can't quietly wind up during a long armed-idle period even without ever crossing the liftoff-gate rotation threshold. Confirmed on a props-off bench test: without this, yaw `z3` wound to ~80% of its clamp before any stick input, just from sitting armed at idle. |

## Tracking differentiator

| Variable | Type | Range | Default | Description |
| --- | --- | --- | --- | --- |
| `adrc_td_hz` | uint16 | 0–`LPF_MAX_HZ` | 0 (disabled) | Smooths the setpoint feeding the control law's P term before it drives the ESO — does not touch the ESO's own gyro-tracking error (`errorEso` still compares `z1` against the real filtered gyro directly). `0` = bypass, setpoint fed straight through with zero added lag. **Not part of danusha2345's fork** — independently ported from a third ADRC implementation ([SeverinBitterli/betaflight](https://github.com/SeverinBitterli/betaflight/tree/ADRC-Implementation)); off by default, unvalidated, left opt-in for testers. Danusha2345's own view: worth trying, but tune `wc`/`wo`/`b0` first — TD smooths what's already there, it can't add bandwidth that isn't.

## Blackbox debug channels

```
set debug_mode = ADRC
```

| Channel | Content |
| --- | --- |
| [0]–[2] | roll `z1`, `z2`, `z3` (`z3` ÷ 16 to fit int16) |
| [3]–[5] | pitch `z1`, `z2`, `z3` (`z3` ÷ 16) |
| [6] | yaw `z3` (÷ 16) |
| [7] | throttle-scaled `b0` multiplier ×100, sign-tagged by the liftoff gate (positive = airborne, negative = grounded/gated) |

Blackbox headers also log `pid_type` and every `adrc_*` tunable on every flight, so a log is
self-describing — `grep -a "^H " file.bbl` on the raw file shows them without needing to decode,
including `pid_type:1` for ADRC vs `pid_type:0` for classic.
