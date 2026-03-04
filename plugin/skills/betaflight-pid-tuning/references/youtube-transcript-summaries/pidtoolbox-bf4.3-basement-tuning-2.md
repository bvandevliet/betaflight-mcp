# Betaflight Basement Tuning with Angle Mode
https://www.youtube.com/watch?v=sqT4MACi3d8

**Overview:** This video demonstrates that Betaflight's "PID Toolbox" basement tuning method can be performed in angle/auto-level mode rather than requiring acro mode, making it far more practical for confined spaces.

---

## Setup

**[00:00:31]** Test platform: Airblade Transformer 4" with naked GoPro, tuned in Betaflight 4.3.

**[00:01:16]** Prerequisites for angle mode use:
- Enable accelerometer in Betaflight
- Calibrate it on a level surface

**[00:01:31]** Initial PID tab configuration:
- Feed forward → 0
- Dynamic damping → 0
- Drift/wobble slider → 0.3
- Angle strength → 100

---

## Tuning Sequence

**[00:01:58]** Four-stage process:
1. PD balance (damping slider)
2. Master multiplier (overall gain)
3. Feed forward (acro mode only)
4. I-term

---

## Angle Mode Validity Confirmed

**[00:02:50]** Step response comparison shows acro vs. angle mode traces are **effectively identical** — angle mode does not distort tuning results.

---

## PD Balance Tests

**[00:03:30]** D slider swept from 0.6 → 1.4. Optimal range: 1.2–1.4. **Conservative pick: 1.2** to preserve headroom for higher gains later.

---

## Master Multiplier Tests

**[00:04:32]** Increasing gain shifts step response curves progressively earlier. No feedback oscillation detected in traces or spectral analyzer.

**[00:06:00]** 50 Hz ripple observed in gyro traced back to **Crossfire 50 Hz RC link artifact** — not PID instability.

**[00:07:46]** Pitch ~30% slower than roll → compensated by:
- Master multiplier: 1.8
- Pitch-to-roll ratio: 1.2

---

## Feed Forward (Acro Mode Required)

**[00:08:07]** Feed forward must be tested in acro mode — angle mode doesn't produce equivalent output traces in BF 4.3.

**[00:10:12]** Latency measurements:
- No feed forward: **~16 ms**
- FF = 0.5: **~7 ms** (parallel gyro/setpoint relationship preserved ✓)
- FF = 1.0: near-zero lag, slight overshoot beginning to appear

**[00:11:51]** RC smoothing set to 15 Hz cutoff (smooth HD footage) — feed forward recovers the ~15 ms of added latency, netting a gain overall.

---

## I-Term After Feed Forward

**[00:13:01]** With setpoint–gyro lag near zero, I-term windup risk drops sharply. Settled on **1.2**, with room to go higher. Higher I-term particularly beneficial for racing (cornering).

---

## Conclusion

**[00:13:33]** Most basement tuning tests can now be done in **angle mode** — safer in confined spaces, same results. Feed forward remains the exception and still requires acro mode.