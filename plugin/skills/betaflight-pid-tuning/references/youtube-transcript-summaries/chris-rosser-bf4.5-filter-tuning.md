# Betaflight 4.5 Tuning Masterclass — Filters Explained

## Overview

This video introduces **filter tuning in Betaflight 4.5**, the foundation of achieving a well-tuned FPV quadcopter. It explains how to use **Blackbox logs** to identify noise sources and configure filtering systems—such as **gyro low-pass filters, RPM filters, dynamic notch filters, and D-term filters**—to reduce noise while minimizing latency. The goal is to remove motor and frame vibration without delaying useful flight signals.

---

# Blackbox Logging Setup

## [00:00:51] Why Blackbox Logs Matter

* Blackbox logging helps analyze **gyro noise and vibrations** for accurate filter tuning.
* Not required for all tuning steps but **highly recommended for advanced tuning**.

## [00:01:09] Recommended Logging Settings

* Logging device:

  * **Onboard flash** or **SD card**
* Minimum logging rate: **1 kHz**

  * Shows frequencies up to **500 Hz**
* Ideal logging rate:

  * **1.6 kHz or 2 kHz**
  * Captures signals up to **800–1000 Hz**
  * Avoid **4 kHz or 8 kHz** since logs fill too quickly.

## [00:02:30] Opening Logs

Steps:

1. Open **Blackbox tab** in Betaflight Configurator.
2. Click **Activate Mass Storage Mode**.
3. Open logs using **Blackbox Explorer**.

## [00:03:00] Key Visualization for Filter Tuning

Use:

* **Frequency vs Throttle analyzer**
* Overlay **raw gyro data**

This graph reveals:

* Motor noise patterns
* Frame resonances
* Noise behavior across throttle levels.

---

# Filter Configuration Overview

## [00:04:09] Filters Covered

The tutorial focuses on modern filters used in Betaflight:

1. **Gyro Low Pass Filters**
2. **RPM Filters**
3. **Dynamic Notch Filters**
4. **D-Term Low Pass Filters**
5. **Yaw Low Pass Filter**

Excluded:

* Static **gyro notch filters**
* Static **D-term notch filters** (mostly obsolete).

---

# Gyro Low Pass Filters

## [00:05:33] Gyro Low Pass 1

* **Disabled by default**
* Not needed on most modern builds.
* Recommended: **leave disabled**

## [00:05:56] Gyro Low Pass 2 (Anti-Aliasing Filter)

Purpose:

* Prevent **aliasing** when **gyro rate > PID loop rate**

Example:

* 8k gyro / 4k PID loop.

Default cutoff:

* **500 Hz (too low)**

Recommended change:

* Increase to **1000 Hz**

Steps:

* Move **gyro filter multiplier slider fully right**

### [00:06:57] When to Disable

If:

* **Gyro rate = PID loop rate**

Examples:

* 8k / 8k
* 3.6k / 3.6k

Then:

* **Gyro LPF2 can be disabled**

---

# RPM Filtering (Motor Noise)

## [00:07:28] Main Noise Source

Most quad noise comes from **motor vibrations**.

Characteristics:

* Starts around **100 Hz**
* Increases with throttle.

Motor noise includes:

* **Fundamental frequency**
* **Harmonics** (multiples of RPM).

Example (tri-blade props):

* Strong fundamental
* Weak second harmonic
* Visible third harmonic.

---

## [00:08:56] RPM Filter Crossfading

RPM filters gradually activate over a frequency range.

Default:

* Minimum: **100 Hz**
* Fade range: **50 Hz**

Meaning:

* Filters ramp from **100 → 150 Hz**

Optimization approach:

* Adjust fade range based on where noise appears in logs.

Example:

* Fade **100 → 200 Hz** if noise grows later.

Guidelines:

* **Large quads:** start filtering earlier.
* **Small quads:** start filtering later.

---

## [00:10:25] RPM Filter Q Value

Defines **notch sharpness**.

* Higher Q = tighter filter
* Tighter filter = **less delay**

Default:

* **Q = 500**

Suggested tuning:

* Increase gradually up to **~1000**
* Stop when motor noise begins leaking through.

Method:

* Compare **raw vs filtered gyro signals**.

---

## [00:11:40] Propeller Influence on Harmonics

### Bi-blade props

Noise often appears at:

* 1× fundamental
* **2× harmonic**
* 3× or 4× possible.

### Tri-blade props

Typical pattern:

* Strong **1× harmonic**
* Minimal **2×**
* Some **3× harmonic**

---

## [00:12:30] RPM Filter Dimming (New in 4.5)

Allows adjusting **strength of each harmonic filter**.

Example (tri-blade props):

```
set rpm_filter_weights = 100,0,80
```

Meaning:

* Full strength on first harmonic
* Disable second harmonic
* Reduce third harmonic

Example (bi-blade start point):

```
100,100,80
```

Goal:

* Reduce filtering where unnecessary to **minimize delay**.

---

# Dynamic Notch Filter (Frame Resonance)

## [00:14:13] Identifying Frame Resonance

In logs:

* Appears as **vertical stripes**
* Same frequency across throttle levels.

Typical frequencies:

* **>100 Hz**

Possible causes below 100 Hz:

* Loose antenna
* GoPro mount
* Flexible components.

---

## [00:15:05] Number of Dynamic Notches

Equal to the number of visible resonance stripes.

Typical:

* **1 notch**

Large frames may need:

* **2–3**

---

## [00:15:30] When to Disable

If logs show **no vertical resonance stripes**, the filter does nothing and only adds delay.

Example:

* Very rigid frames (e.g., AOS builds).

Recommendation:

* **Disable dynamic notch** if not needed.

---

## [00:16:19] Dynamic Notch Frequency Range

Set:

Minimum:

* Slightly **below resonance**
* Preferably **>150 Hz**

Example:

* Resonance at **225 Hz**
* Set minimum ≈ **200 Hz**

Maximum:

* Less critical
* Default ≈ **600 Hz**

Can reduce if resonance range is narrow.

---

## [00:17:42] Dynamic Notch Q Factor

Higher Q:

* Narrower notch
* Less delay

Recommended:

* Increase until noise escapes
* Usually **≤1000**

---

# D-Term Low Pass Filters

## [00:18:49] Why D-Term Needs Strong Filtering

D-term amplifies noise:

* Noise gain increases **with frequency**
* High-frequency noise can cause **motor overheating or oscillations**

D-term filters remove remaining noise after RPM/dynamic notch filtering.

---

# Two D-Term Filtering Approaches

## [00:19:20] 1. Default “Karate” Tune

Uses:

* **Two PT1 filters**

Advantages:

* Balanced
* More forgiving
* Easier to tune.

Tuning method:

* Increase **D-term filter multiplier** slowly
* Stop when:

  * Motors become hot
  * Oscillations appear.

---

## [00:19:31] 2. AOS Tune

Uses:

* **Single dynamic biquad filter**

Advantages:

* Less delay
* Better motor noise rejection
* Better prop-wash handling.

Disadvantages:

* Harder to tune.

---

## [00:23:20] How to Enable AOS Tune

Steps:

1. Disable **profile dependent filter settings**
2. Set:

```
dterm lowpass = biquad
```

3. Configure:

* Minimum cutoff (zero throttle)
* Maximum cutoff (full throttle)

---

## [00:23:42] Tuning AOS Filters

Procedure:

1. Increase **minimum cutoff**
2. Stop when oscillations appear at **zero throttle**
3. Reduce slightly.

Then:

4. Increase **maximum cutoff**
5. Stop when oscillations appear at **full throttle**
6. Reduce slightly.

Goal:

* Minimum delay across throttle range.

---

## [00:24:11] Dynamic Curve Expo

Controls how filter frequency changes with throttle.

Default:

* **5 (linear)**

Higher values:

* Increase cutoff earlier at low throttle
* Reduce delay in common flight ranges.

Tuning approach:

* Increase until **mid-throttle oscillations** appear
* Then reduce slightly.

---

# Yaw Low Pass Filter

## [00:25:27] Why Yaw Has a Separate Filter

Yaw response is slower because:

* Controlled by **motor torque**
* Not by thrust direction changes.

Therefore:

* **Filter delay matters less**

Benefits:

* Reduces yaw noise
* Gives more motor headroom for pitch/roll tuning.

Optional:

* Can disable for **maximum yaw responsiveness**.

---

# Key Tuning Strategy

## [00:26:34] Step-by-Step Filter Workflow

1. Configure **gyro filters**
2. Tune **RPM filters**
3. Address **frame resonance (dynamic notch)**
4. Tune **D-term filtering**
5. Optionally adjust **yaw filter**

Primary goals:

* Remove motor noise
* Remove frame resonance
* **Minimize filter delay**
* Preserve signals under **~90 Hz** (actual flight movements).

---

# Conclusion

Effective Betaflight filtering requires balancing **noise removal and latency**. The recommended workflow:

* Use **Blackbox logs** to identify noise sources.
* Let **RPM filters remove motor noise**.
* Use **dynamic notch filters for frame resonance** only when needed.
* Optimize **D-term filtering** to control remaining noise while preserving flight responsiveness.

When properly tuned, filters enable **clean gyro data**, allowing higher PID gains and delivering a **stable, responsive quadcopter flight experience**.
