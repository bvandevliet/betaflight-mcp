# Betaflight 4.3 PID Tuning with PID Toolbox

## Overview

This video explains a **systematic workflow for tuning FPV drone PID settings using the Betaflight 4.3 slider system together with PID Toolbox**. The method isolates variables step-by-step: first finding the correct **P–D balance**, then **I-term strength**, and finally the **overall PID gain multiplier**. Blackbox logs are analyzed using **step response curves and spectral analysis** to determine optimal settings while avoiding oscillations.

---

## 1. Preparing for P–D Balance Testing

[00:00:14]

The first step is to isolate the **P–D relationship** by removing other influences.

Key preparation steps:

* **Set Feed Forward to 0** (removes stick input effects).
* **Disable Dynamic Damping** (prevents dynamic D-term influence).
* **Set I-term to 0** (avoids overshoot caused by integrator).

Purpose:

* Ensure the response observed in logs is **only influenced by P and D**.

---

## 2. Adjusting the Damping Slider (P–D Balance)

[00:00:45]

The **damping slider** changes the relationship between P and D:

* Increasing damping:

  * **D-term increases**
  * **P-term remains constant**

Test procedure for a typical **5-inch quad**:

* Start around **0.6**
* Increase in **0.2 increments**:

  * 0.6
  * 0.8
  * 1.0
  * 1.2
  * 1.4
  * 1.6

Goal:

* Identify the setting where **overshoot disappears without excessive damping**.

---

## 3. Performing Test Inputs Safely

[00:01:22]

Test method used:

* Arm the quad and manually move it along **roll and pitch axes**.
* Apply **strong stick inputs** to generate measurable responses.

Safety and control settings:

* Use **line-of-sight rate profile**
* Max rate ≈ **200°/s**
* Linear rate curve

Purpose:

* Provide **clear step response data** without risking instability.

---

## 4. Analyzing Logs in PID Toolbox

[00:02:15]

Workflow in PID Toolbox:

1. Load blackbox logs.
2. **Trim start/end sections** to remove accidental movements.
3. Open the **Step Response Tool**.
4. Run analysis across all tests.

If graphs show offset:

* Apply **Y-correction**.

---

## 5. Choosing the Optimal P–D Balance

[00:03:05]

When comparing response curves:

* Low damping → **overshoot**
* Moderate damping → **clean response**
* High damping → **over-damped sluggish response**

Selection rule:

* Choose the point where **overshoot disappears but responsiveness remains high**.

Example result:

* **Damping = 1.0 (test #3)**
* Corresponding gains: approximately **P=45, D=30**

This becomes the **baseline P–D balance**.

---

# Tuning the I-Term (PI Balance)

## 6. Running I-Term Tests

[00:04:03]

I-term effects are subtle, so **larger increments** are required.

Recommended steps for a 5-inch quad:

* Start **0.3**
* Increase in **0.3 increments**:

  * 0.3
  * 0.6
  * 0.9
  * 1.2
  * 1.5

Reason:

* Small increments may be **hidden by noise** in the data.

---

## 7. Evaluating Step Response for I-Term

[00:05:44]

Observations from curves:

* Low I-term → stable but weak correction
* Moderate I-term → improved system stability
* High I-term → **overshoot appears again**

Example result:

* **I-term ≈ 0.6** chosen as optimal.

Interpretation:

* At higher values, **I begins combining with P to push the system into overshoot**.

---

# Tuning Overall PID Gain

## 8. Using the Master Multiplier

[00:06:25]

Once P–D and PI balance are set, the **master multiplier** scales all gains proportionally.

Test procedure:

* Start from **1.0**
* Increase by **0.2 increments**:

  * 1.2
  * 1.4
  * 1.6
  * 1.8
  * 2.0

Expected behavior:

* **Curve shape stays the same**
* **Response timing improves (lower latency)**

---

## 9. Selecting the Optimal Gain Level

[00:07:32]

Key indicator:

* **Latency improvement begins to plateau**.

Observation:

* Gains beyond **test #4 (~1.8 multiplier)** provide little improvement.

Final choice:

* **Gain level ≈ #4**

Notes:

* Some pilots may choose slightly lower for **safety margin**.
* Roll and pitch may differ depending on **weight distribution**.

---

# Detecting Oscillations and Noise

## 10. Spectral Analysis Checks

[00:09:04]

Use the **Spectral Analyzer** to detect oscillations.

Warning signs:

* A peak appearing between **40–70 Hz**
* Audible **“trilling” motor sound**

If a peak grows with increasing gain:

* It indicates **control loop oscillation**.

---

## 11. Noise Threshold Guidelines

[00:10:00]

Recommended limits:

Gyro noise floor:

* **Below −30 dB**

D-term signal:

* Ideally **below −10 dB**

Risks if exceeded:

* Hot motors
* Instability
* Possible **flyaway events**

---

## 12. Filtering vs Oscillation Tradeoff

[00:10:37]

Important relationship:

More filtering → **more filter delay**

Consequences:

* Increased delay can cause **earlier oscillation**
* Limits how high gains can be pushed

Implication:

* **Excess filtering can reduce achievable PID performance**.

---

# Final Notes

## 13. Yaw Tuning

[00:11:16]

Yaw tuning was **not covered** in this video.

Current approach:

* Yaw gains can simply scale with the **master multiplier**.

Future work:

* Dedicated method for **optimizing yaw P and I**.

---

## 14. Restoring Feed Forward and Stick Feel

[00:11:52]

After tuning PID:

* Feed Forward can be restored (default **1.0 recommended**).
* Adjust:

  * **Stick response**
  * **Jitter reduction**
  * **Smoothness**

These primarily affect **pilot feel**, not stabilization.

---

# Conclusion

The video presents a **data-driven PID tuning workflow for Betaflight 4.3**:

1. **Find P–D balance** using the damping slider.
2. **Tune I-term strength** via PI balance tests.
3. **Scale gains** with the master multiplier.
4. **Verify stability** using spectral analysis and noise levels.

This structured approach allows pilots to achieve **optimal responsiveness with minimal oscillation**, using **objective blackbox data instead of trial-and-error tuning**.
