# Rapid Betaflight PID Tuning with PID Toolbox (1–2 Battery Packs)

This video demonstrates a **fast, practical workflow for tuning Betaflight PID settings using PID Toolbox**, designed to produce significant flight performance improvements in **one or two battery packs**. The process combines **blackbox logging, spectral analysis, and automated wobble tests** to tune filters and optimize PID relationships systematically.

---

# 1. Initial Setup for Rapid Testing

## [00:00:00] Preparing Betaflight and Radio

Key configuration steps before tuning:

* Use **Angle Mode** for easier controlled testing.
* Set **Angle Limit to 30°** to prevent aggressive motion during wobble tests.
* Create a **linear rate profile**:

  * Center sensitivity: **150**
  * Max rate: **150**
* Linear rates make motion predictable and allow testing **even in small spaces**.
* Filters start **fully stock**.

A radio script called **Auto Wobble** is used to generate consistent oscillations automatically during tests.

---

# 2. Baseline Hover Test and Noise Analysis

## [00:01:29] Perform a 30–40s Steady Hover

Purpose of the hover test:

* Capture **clean spectral data without pilot inputs**
* Detect:

  * Motor noise
  * Frame resonances
  * Electrical or gyro issues

Blackbox configuration:

* Debug mode: **FFT_FRQ**
* Allows visibility into **dynamic notch filter activity**.

---

# 3. Spectral Analysis in PID Toolbox

## [00:03:01] Identify Noise Sources

Steps:

1. Load the hover log.
2. Use **Spectral Analyzer**.
3. Plot:

   * **Pre-filter gyro**
   * **Post-filter gyro**
4. Overlay **RPM harmonics**.

Observations from example log:

* **Strong first motor harmonic**
* **Third harmonic present**
* **Minimal second harmonic**
* **Resonance peak between harmonics**

Interpretation:

* Motor filtering works well.
* Frame resonance requires **dynamic notch filtering**.

---

# 4. Optimizing Filters

## [00:04:34] Reduce Unnecessary Filtering

Goal: **minimum filtering required for stability**.

Adjustments made:

* Disable **Gyro Lowpass 1** (keep Lowpass 2).
* Increase **Dynamic Notch count to 3**.
* Reduce RPM filter impact on weak harmonic.

CLI change:

```
set rpm_filter_weights = 100,25,100
save
```

Meaning:

* 1st harmonic: full filtering
* 2nd harmonic: reduced filtering
* 3rd harmonic: full filtering

Result: **lower filter delay while maintaining noise suppression**.

---

# 5. Verify Filter Improvements

## [00:06:18] Second Hover Test

Comparison reveals:

* Resonance peaks significantly reduced.
* D-term noise clearer in logs.

Indicators of resonance:

* Spikes in **D-term plots**
* Thickening of **motor command signals**

After adjustments:

* Dynamic notch filters effectively suppress resonance.

---

# 6. Further Filter Delay Optimization

## [00:07:09] Lower Gyro Delay

Goal: **reduce filter latency below ~2 ms**.

Additional changes:

* Increase **dynamic notch minimum frequency to 150 Hz**
* Narrow notch operating range
* Increase notch width (Q adjustments)

CLI improvement:

```
set rpm_filter_q = 1000
```

Effect:

* Reduces filter delay while maintaining RPM noise rejection.

---

# 7. PID Tuning Strategy

## [00:08:21] Three-Step Tuning Framework

PID tuning follows three optimization steps:

1. **PD Balance**
2. **Master Multiplier**
3. **PI Balance**

Key metrics used:

* **Step response overshoot**
* **Response latency**

---

# 8. Step 1 — PD Ratio Optimization

## [00:09:00] Damping Slider Tests

Test parameters:

* Damping values tested:
  **0.6 → 0.8 → 1.0 → 1.2**

Additional preparation:

* Disable feedforward.
* Disable dynamic damping.
* Reduce I-term temporarily.

Auto wobble generates consistent motion while logs are recorded.

### Results (Step Response)

## [00:13:14]

Observations:

* Overshoot decreases as damping increases.
* **1.2 becomes overdamped**.
* Best options:

  * **0.8**
  * **1.0**

Final choice:

**Damping = 1.0**

Reason:

* Slightly higher D improves **propwash handling**.

---

# 9. Step 2 — Master Multiplier

## [00:15:03]

Purpose:

Adjust **overall PID strength**.

Tests performed:

* Master values:

  * 0.6
  * 0.8
  * 1.0
  * 1.2
  * 1.4
  * 1.6

Evaluation metric:

**Latency using cross-correlation analysis.**

### Observations

## [00:16:10]

* Latency decreases as master increases.
* At higher values oscillations begin:

  * **1.6 clearly oscillates**
  * **1.4 shows ripple**

Final selection:

**Master Multiplier = 1.2**

Provides low latency without oscillation.

---

# 10. Step 3 — PI Ratio

## [00:17:01]

Purpose:

Ensure I-term does not cause:

* Windup
* Overshoot

Tests:

* I-term multiplier from **0.5 → 2.0**

### Result

No visible differences in step responses.

Reason:

* Small, lightweight drone
* Low accumulated PID error

Final setting:

**I-term = 1.0 (default)**

Feedforward restored to **1.0**.

---

# 11. Final PID and Filter Configuration

## [00:18:20]

Final setup includes:

**Filter adjustments**

* Gyro Lowpass 1 disabled
* Dynamic notch count: **3**
* Dynamic notch min freq: **150 Hz**
* RPM filter weights: **100 / 25 / 100**
* RPM filter Q increased

**PID tuning results**

* Damping: **1.0**
* Master multiplier: **1.2**
* I-term: **1.0**
* Feedforward: **1.0**

---

# Key Takeaways

* **A simple hover log can reveal critical resonance issues.**
* **Spectral analysis helps determine exactly which filters are needed.**
* PID tuning should follow a structured order:

  1. PD balance
  2. Master multiplier
  3. PI balance
* **Step response analysis** is the most reliable tuning metric.
* With this workflow, a well-performing tune can be achieved **within 1–2 battery packs**.

---

**Conclusion:**
Efficient Betaflight tuning relies on **data-driven adjustments rather than trial-and-error**. By combining spectral noise analysis, auto wobble testing, and step-response evaluation, pilots can quickly optimize filters and PID behavior to achieve responsive, stable flight performance.
