# Betaflight 4.5 PID Tuning Workflow
https://www.youtube.com/watch?v=4lZ8BY_9KBs

**Overview:** A professional PID tuning service provider walks through their refined tuning workflow applicable to Betaflight 4.5, drawing on experience from 546+ client drones. The core message: hardware quality issues precede any software tuning, and iterative filter/PID assessment runs in parallel rather than sequentially.

---

## Pre-Flight: Initial Log Assessment

**[00:01:01] Start with a steady hover log**
- Avoids unsafe requests (e.g., full throttle ramps on heavy cinema lifters)
- 99% of major issues are detectable in a hover log alone

**[00:02:43] Why hover specifically:**
- Replicable — changes in the power spectrum are attributable to tuning, not flight style
- At constant RPM, motor noise appears as **discrete peaks** (easy to isolate)
- Electrical noise appears as **elevated broadband noise** — clearly distinguishable from mechanical vibration
- Aggressive flight inherently raises broadband noise, obscuring the baseline

**[00:03:58] Hardware quality is the root cause most often**
- Many all-in-one FC boards (especially cine whoops) ship with gyro/electrical defects
- Clients frequently receive 2–3 replacement boards; shops know but continue selling
- Beginners misattribute hardware noise to PID settings and seek filter solutions instead

---

## Filter Philosophy

**[00:06:18] What "good" looks like in a noise profile:**
- **Only motor vibration** — narrowband by nature
- Any broadband noise indicates an electrical or mechanical issue, not a tuning problem

**[00:07:14] Filter types:**
- **Low-pass filters:** Wide frequency range, moderate attenuation — necessary but high-delay cost
- **Notch filters (RPM, dynamic, static):** Narrowband, high attenuation — all use the same underlying code; difference is how they *center* the notch

**[00:07:53] Key insight:** If a drone is electrically sound, RPM filters alone should suffice. Low-pass filters are still needed for residual broadband noise, especially since D-term amplifies it.

**[00:05:23] Filter and PID tuning run in parallel**, not sequentially — each PID test yields new noise profile data worth assessing.

---

## PID Tuning Sequence (PID Toolbox Workflow)

**[00:09:49] Setup before testing:**
- Zero out dynamic damping slider
- Set I-term drift/wobble slider to 0.1–0.2
- Feed forward has no effect in angle mode (BF 4.5) — no need to zero it
- Adjust master multiplier from default based on power-to-weight and rotational inertia

**[00:11:54] Step 1 — Optimal P:D ratio**
- Use the damping slider, hold all others constant
- Avoids conflating I-term movement when using the PI slider

**[00:12:16] Step 2 — Roll-to-pitch latency**
- Assess using pitch tracking/damping slider
- Pitch commonly lags due to frame geometry and weight distribution
- Know when to stop — excessive pitch gains to compensate for high rotational inertia are counterproductive

**[00:13:24] Step 3 — Master multiplier**
- Increase until near **latency plateau** (use step response latency estimate + cross-correlation lag)
- Watch for: excessive D-term noise or PID feedback oscillation
- *This is where most tuners make errors* — misreading the data leads to gains being too high or too low

**[00:14:04] Step 4 — I-term and feed forward**
- Wide tuning windows; experience-driven defaults often sufficient
- Feed forward for lifters: **0.5–1.0** → reduces end-to-end latency by ~6–12 ms
- Above 1.0 with Crossfire 50 Hz disrupts the optimal P:D ratio
- **BF 4.5 caveat:** Feed forward set in the PID tab is inactive in angle mode, so I-term assessed during wobble tests won't reflect how feed forward subsequently reduces tracking error in rate mode — they are interdependent

---

## Conclusion

The workflow prioritises hardware verification before any software intervention, treats hover logs as diagnostic tools, runs filter and PID assessment concurrently, and follows a specific slider order (damping → pitch correction → master → I-term/FF). Betaflight 4.5 changes are mostly confined to angle/horizon mode behaviour and RPM filter weights — the core PID/filter logic is unchanged.