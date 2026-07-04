# Using Angle Mode for PID Toolbox Basement Tuning

## Overview

The video explains how to perform **Betaflight PID tuning using the “PID Toolbox basement tuning method” while flying in Angle (auto-level) mode instead of Acro mode**. This makes tuning much easier in confined spaces. The presenter demonstrates the process on a **4-inch Airblade Transformer quad**, showing how to tune **P/D balance, overall gains, feedforward, and I-term** using blackbox data and step-response analysis.

---

## [00:00:00] Problem With Traditional Basement Tuning

* A common complaint about **PID Toolbox basement tuning** is that it normally requires **Acro (rate) mode**, which is difficult to fly indoors or in tight spaces.
* The video demonstrates that **Angle mode (auto-level)** works just as well for most tests.
* This significantly reduces the risk of crashes during indoor tuning.

---

# Test Setup and Example Quad

## [00:00:31] Hardware Used

* Quad: **Airblade Transformer 4-inch**
* Category: Similar to lightweight **long-range quads** like the Flywoo Explorer.
* Configuration includes:

  * A **naked GoPro**
  * Total weight slightly above the typical **250 g target**.

## [00:01:03] Key Observation

* During tuning in **Betaflight 4.3**, the author observed **surprisingly strong performance improvements from feedforward tuning**.

---

# Preparing Betaflight for Angle Mode Tuning

## [00:01:16] Enable Accelerometer

To use Angle mode:

1. Enable the **accelerometer** in Betaflight.
2. Place the quad on a **level surface**.
3. Use **“Calibrate Accelerometer”** in the Setup tab.

---

# Initial PID Setup for Basement Tests

## [00:01:31] PID Tab Configuration

Before running tests:

* **Feedforward:** set to `0`
* **Dynamic damping:** set to `0`
* **Drift wobble slider:** ~`0.3`
* **Angle strength:** set to `100`

Purpose of test stages:

1. Tune **D-term ratio (damping slider)**
2. Tune **master gain multiplier**
3. Add **feedforward**
4. Tune **I-term**

Key insight:

* Adding feedforward first **reduces setpoint-gyro lag**, allowing **higher I-term values without windup issues**.

---

# Verifying Angle Mode Works for Step Tests

## [00:02:50] Step Response Comparison

* The author compares **step response traces** from:

  * **Acro mode**
  * **Angle mode**

Result:

* The curves are **virtually identical**.

**Conclusion:**
Angle mode produces **equivalent tuning results**, making basement testing much safer and easier.

---

# Step 1 — P/D Balance (Damping Slider)

## [00:03:28] D-Term Sweep

Test series increases D-term via damping slider:

Values tested:

* `0.6`
* `0.8`
* `1.0`
* `1.2`
* `1.4`

Observations:

* Increasing D reduces peak oscillations in the step response.
* Best range identified: **1.2 – 1.4**

Final choice:

* **1.2** (slightly conservative to avoid noise or oscillation).

---

# Step 2 — Master Gain Multiplier

## [00:04:28] Increasing Overall Gains

As gains increase:

* **Step response latency decreases**
* Output tracks commands more quickly.

Evaluation methods:

* Inspect **step response traces**
* Check **gyro traces**
* Examine **spectral analyzer** for oscillations.

Result:

* No true feedback oscillations detected.

---

# Identifying False Oscillation Signals

## [00:05:58] 50 Hz Artifact

Low-frequency signals around **50 Hz** appear in the data.

Cause:

* **Crossfire receiver running at 50 Hz**
* Imperfect **RC smoothing** leaves remnants of square-wave input.

Important takeaway:

* This is **not a PID oscillation**, but **receiver signal artifacts**.

---

# Axis Latency Matching

## [00:07:22] Roll vs Pitch Response

Latency comparison example:

* Roll: ~22 ms
* Pitch: ~29 ms

Pitch responds **~30% slower**.

Solution:

* Increase **pitch gain relative to roll**.

Final adjustment:

* Master multiplier: **~1.8**
* Pitch-to-roll ratio: **1.2**

Goal:

* Equalize **response latency between axes**.

---

# Step 3 — Feedforward Tuning

## [00:08:07] Feedforward Testing

Feedforward tests must be done in **Acro mode**.

Tested values:

* `0`
* `0.5`
* `1.0`

Evaluation method:

* Measure **latency between setpoint and gyro traces**.

---

## [00:10:10] Feedforward Results

### Without Feedforward

* Lag: **~16 ms**

### Feedforward = 0.5

* Lag reduced to **~7 ms**
* Maintains **parallel setpoint/gyro tracking**

### Feedforward = 1.0

* Lag nearly eliminated
* Slight acceleration differences appear but tracking remains excellent.

Important concept:

* **Good P/D balance produces parallel gyro and setpoint curves.**
* Too much feedforward causes **output to accelerate faster than input**.

---

# Feedforward vs RC Smoothing

## [00:11:37] Compensation Effect

The pilot uses heavy **RC smoothing (15 Hz cutoff)**.

Effect:

* Adds **~12 ms control delay**

Feedforward compensates:

* Recovers **~15 ms responsiveness**

Result:

* Smooth input **without sacrificing responsiveness**.

---

# Step 4 — I-Term Tuning

## [00:12:53] Increasing I-Term

Once feedforward minimizes setpoint lag:

* **I-term can be increased significantly**
* Lower lag prevents **I-term windup**

Final value used:

* **I-term ≈ 1.2**

Higher values are possible, especially useful for:

* **Racing quads**
* Improved **cornering stability**

---

# Final Settings and Outcome

## [00:13:31] Final Configuration

Final tuning includes:

* Optimized **P/D balance**
* Increased **master gain**
* Feedforward around **1.0**
* Higher **I-term**

Main result:

* The quad tracks inputs **extremely closely with minimal delay**.

---

# Key Takeaways

* **Angle mode works for most PID Toolbox basement tuning tests**, making indoor tuning far safer.
* Proper **P/D balance produces parallel setpoint and gyro curves**, indicating correct dynamic response.
* **Feedforward dramatically reduces control latency**, often by more than 50%.
* Once lag is minimized, **I-term can be increased without instability**.
* RC smoothing delays can be offset using feedforward.

---

# Conclusion

The video demonstrates that **PID Toolbox basement tuning can largely be performed in Angle mode**, simplifying indoor testing. Through systematic tuning—P/D balance, gain scaling, feedforward optimization, and I-term adjustment—the quad achieves **extremely tight setpoint tracking with minimal latency**, proving that even lightweight long-range quads can achieve highly precise control with proper tuning.
