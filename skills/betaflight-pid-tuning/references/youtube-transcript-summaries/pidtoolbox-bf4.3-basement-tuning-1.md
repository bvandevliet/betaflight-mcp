# Betaflight 4.3 Slider Tuning with PID Toolbox
https://www.youtube.com/watch?v=cUzNuMVxkBM

**Overview:** A walkthrough of a systematic PID tuning methodology using Betaflight 4.3's slider system combined with PID Toolbox blackbox analysis. The process isolates each variable in sequence: P/D balance → I term → overall gain.

---

## Setup & Isolation Strategy

- [00:00:14] Before any test flights, neutralise confounding variables:
  - Feed forward → 0
  - Dynamic damping (D-max) → 0
  - I term → 0
- This ensures each parameter is evaluated independently.

---

## Step 1: P/D Balance

- [00:00:45] Use the **damping slider** to sweep D gain while P stays fixed
- Starting point for 5-inch: **0.6**, incrementing by **0.2** (0.6 → 0.8 → 1.0 → 1.2 → 1.4 → 1.6)
- [00:03:05] Target: the point where overshoot just disappears — overdamping beyond that adds no benefit
- Optimal for this build: **damping 1.0** (P/D ratio 45:30)

---

## Step 2: I Term Tuning

- [00:04:07] Re-enable I term; use **larger steps of 0.3** (effects are subtle)
- Sweep: 0.3 → 0.6 → 0.9 → 1.2 → 1.5
- [00:06:01] Look for the point just before overshoot re-emerges (I summing with P)
- Optimal for this build: **I slider 0.6**

---

## Step 3: Master Gain

- [00:06:25] With balances locked, raise the **master multiplier** in steps of 0.2, starting at 1.2
- [00:07:55] The step response curve shape stays constant — only **latency decreases**
- [00:08:07] Response plateaus around step 4–5; diminishing returns beyond that
- Roll and pitch can be set independently if weight distribution differs

---

## Spectral Health Check

- [00:09:15] In the spectral analyser, watch for emerging peaks between **40–70 Hz** as gains rise — early sign of PID oscillation
- Noise floor targets:
  - **Gyro:** below −30 dB
  - **D term:** below −10 dB (above 0 dB risks flyaway or motor heat)
- [00:10:47] Counter-intuitive: **more filtering = lower max achievable gain**, due to filter-induced phase delay

---

## Conclusion

Tune in order — P/D balance, then I balance, then master gain — isolating each variable before moving to the next. Once balances are dialled, gain scaling is clean and predictable. Yaw tuning and feed forward optimisation are deferred to future videos.