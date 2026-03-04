# Betaflight 4.4 Tuning Guide — Summary
https://www.youtube.com/watch?v=sNAV4gx_gBY

**Overview:** Step-by-step tuning walkthrough for Betaflight 4.4, demonstrated on a 2" 1S digital micro quad (Nano Fly 20). The process applies universally to any quad size.

---

## Pre-Tuning Checklist
**[00:01:53]**
- Betaflight 4.3 or 4.4 installed
- Blackbox logging functional (onboard flash or serial)
- **Bidirectional DSHOT enabled** (BL32 / AM32 / BlueJay ESC firmware)
- Correct radio preset applied
- Betaflight OSD configured (optional but recommended for in-field adjustments)

---

## Pre-Flight Configuration
**[00:02:57]**
- Verify bidir DSHOT in Motors tab
- Blackbox: set to onboard flash, **2 kHz**, debug mode `GYRO_SCALED`
- Apply radio link preset (e.g. ELRS 250 Hz, freestyle HD, SPI receiver) — this configures RC smoothing and feedforward filtering automatically

---

## Tuning Process Overview
**[00:05:44]**
1. Filter tuning
2. PD balance + master multiplier (iterative)
3. Feedforward (Acro mode only)
4. Final tips: dynamic idle, RC smoothing

---

## Filter Tuning
**[00:05:44]**
- Fly throttle pumps 0–100% in angle mode; log with `GYRO_SCALED`
- Analyse in **Blackbox Explorer**: frequency vs. throttle plot reveals motor noise sweep
- **Target config for most quads:**
  - Gyro LPF1: **disabled**
  - Dterm LPF2: **disabled**
  - Dterm LPF1: **Biquad**, dynamic, min ~100 Hz / max ~125 Hz (adjust ±10% per build)
  - Yaw LPF: leave enabled (~100 Hz); no meaningful delay penalty on the slow yaw axis
- RPM filtering + dynamic notch remain active — they handle motor/frame resonances specifically

---

## PD Balance & Master Multiplier
**[00:15:26]**

**Analogy:** P = spring (returns to setpoint), D = damper (absorbs overshoot). The *ratio* matters, not absolute values.

**Process:**
- Set **I-gain slider to 0** temporarily (isolates P and D response)
- Fly 20s angle-mode wobbles (roll + pitch), vary **P&I slider** while keeping D slider fixed at 1.0
- Analyse **step response in PID Toolbox**
- Target: trace rises to 1.0 with minimal overshoot and no oscillation
- Example result: P&I = 0.4, D = 1.0 → **D:P ratio = 2.5×** — maintain this ratio when scaling

**Master multiplier:**
- Increase from 1.0 → 2.0+ while holding PD ratio constant
- Higher = stiffer, faster response without changing shape
- **Slider headroom trick:** if master hits 2.0 ceiling, double both P&I and D sliders, reset master to 1.0 — equivalent point, new headroom gained

---

## Feedforward
**[00:24:58]**
- Fly fast wobbles in **Acro mode**; log at multiple FF slider values
- In PID Toolbox: compare setpoint (red) vs. gyro (black) delay
- Increase FF until delay approaches zero — **law of diminishing returns applies**
- Too much FF amplifies RC link jitter and causes overshoot on sharp inputs
- Practical ceiling: when motors saturate at 100% on sharp moves, further FF gain is pointless

---

## Final Tips

### Dynamic Idle
**[00:28:42]**
- Prevents motor stall during flips/rolls and in propwash
- Formula: `RPM = 15000 / prop_diameter_inches`, then `dynamic_idle_value = RPM / 100`
  - 5" → 3000 RPM → **value: 30**
  - 2" → 7500 RPM → **value: 75**

### RC Smoothing
**[00:30:09]**
- Set setpoint cutoffs to **Auto**, tune via **Auto Factor**
- Higher Auto Factor = smoother cinematic feel; lower = sharper race feel
- Radio link preset may already configure this appropriately

---

## Conclusion

The tuning sequence — filters → PD balance → master multiplier → feedforward — is quad-agnostic. Values differ by size, but the method and tooling (Blackbox Explorer, PID Toolbox) are identical whether tuning a 1S whoop or a 13" beast class.