# Betaflight 4.4 Tuning Guide (Step-by-Step)

## Overview

This video provides a **complete tuning guide for Betaflight 4.4**, demonstrated on a small **2-inch 1S digital FPV quad** instead of the typical 5-inch freestyle drone. The guide walks through the **entire tuning workflow**—from pre-tuning checks to filter configuration, PID balance, master multiplier tuning, and feedforward optimization—using blackbox logging and analysis tools. The goal is to achieve **responsive, stable flight with minimal latency and oscillation**.

---

## Pre-Tuning Setup

### [00:01:53] Pre-Tuning Checklist
Before tuning, confirm the quad is properly configured:

- Running **Betaflight 4.3 or 4.4**
- **Blackbox logging enabled**
- **Bidirectional DShot enabled**
- ESC firmware such as:
  - BLHeli32  
  - AM32  
  - Bluejay
- Correct **radio preset** applied
- Optional but useful: **Betaflight OSD configured** for adjusting PIDs without reconnecting to a computer

---

## Betaflight Configuration

### [00:03:02] Basic Setup in Betaflight Configurator
Key settings to verify:

**Motors tab**
- Enable **Bidirectional DShot**

**Blackbox settings**
- Logging device: *Onboard flash*
- Logging rate: **2 kHz**
- Debug mode: **Gyro Scaled**

Also erase old logs to ensure clean tuning data.

---

### [00:04:16] Apply Radio Preset
Using the **Presets tab**:

1. Search for your radio system (e.g., **ExpressLRS**).
2. Select the correct:
   - Packet rate (e.g., **250 Hz**)
   - Flight style preset (e.g., **HD Freestyle**)
   - Receiver type (SPI or serial)
   - Battery telemetry (e.g., **single-cell values**)

This automatically configures **RC smoothing and feedforward filtering**.

---

# Tuning Workflow Overview

### [00:05:44] The Betaflight Tuning Sequence
The recommended process:

1. **Filter tuning**
2. **PD balance tuning**
3. **Master multiplier tuning**
4. **Feedforward tuning**
5. Final fine-tuning adjustments

Angle mode is used initially because it **disables feedforward**, simplifying PID analysis.

---

# Filter Tuning

## [00:07:26] Collecting Logs for Filter Analysis

Perform a flight with **full throttle pumps**:

- Increase throttle to **100%**
- Drop to **0%**
- Repeat multiple times

This captures **noise across the full throttle range**, which is necessary for accurate filtering.

Avoid flights where throttle remains constant.

---

## [00:08:13] Extracting Blackbox Logs

Steps:

1. Connect quad to Betaflight Configurator
2. Open **Blackbox tab**
3. Enable **Mass Storage Device mode**
4. Copy log files to your computer

Recommended analysis tool: **Blackbox Explorer**.

---

## [00:09:01] Analyzing Noise (Frequency vs Throttle)

In Blackbox Explorer:

- Select **Gyro Scaled → Roll**
- Use **Frequency vs Throttle** view

Key observations:

- Motor noise appears as a **diagonal sweep**
- Frequency increases with throttle
- Bright areas indicate **higher vibration energy**

Horizontal lines usually indicate **crashes or impacts** and should be trimmed from logs.

---

## [00:11:46] Filter Strategy

Typical Betaflight defaults include multiple filters, but most quads **do not need that many**.

Recommended setup:

- **Disable gyro low-pass filters**
- Use **only one D-term filter**
- Keep:
  - **RPM filtering**
  - **Dynamic notch filtering**

This reduces **signal delay** and improves control responsiveness.

---

## [00:12:30] Choosing Filter Cutoffs

Goal: place the filter cutoff **between flight motion and motor noise**.

Typical ranges:

| Signal Type | Frequency |
|---|---|
| Flight motion / propwash | up to ~50–70 Hz |
| Motor noise | above that range |

Set the cutoff **as high as possible without letting motor noise through**, minimizing control latency.

---

## [00:13:57] Recommended Filter Configuration

In **PID Tuning → Filter Settings**:

- Disable **Gyro Lowpass 1**
- Disable **D-term Lowpass 2**
- Set **D-term Lowpass 1 → Biquad**
- Example cutoff values for small quads:
  - **Min: 100 Hz**
  - **Max: 125 Hz**
- Leave **Yaw low-pass filter enabled**

---

# PID Tuning

## Understanding P and D Terms

### [00:15:23] Suspension Analogy

PID tuning is compared to **car suspension**:

| Term | Analogy | Function |
|---|---|---|
| **P Term** | Spring | Returns quad to correct position |
| **D Term** | Shock absorber | Dampens oscillation |

Incorrect balance results in:

- **Too much P:** oscillation and bounce
- **Too much D:** slow, sluggish response

Goal: achieve **optimal PD balance**.

---

# PD Balance Tuning

### [00:17:56] Flight Method

Use **Angle mode**.

Perform rapid stick inputs:

- Fast **left/right rolls**
- Fast **forward/back pitch**

Each test flight:

- ~20 seconds
- Adjust PID sliders between flights
- Capture multiple logs

---

### [00:18:48] Disable I-Term During PD Tuning

In **Expert Mode**:

- Set **Drift/Wobble slider → 0**

This isolates **P and D effects** during analysis.

---

### [00:19:17] Adjusting Sliders via OSD

Instead of reconnecting to a computer:

1. Disarm quad
2. Open **Betaflight OSD menu**
3. Navigate to **Simplified Tuning**
4. Adjust:
   - **P&I gains**
   - **Master multiplier**

---

## [00:20:17] Step Response Analysis

Using **PID Toolbox**, evaluate step responses.

Indicators:

### Underdamped (Too Much P)
- Large overshoot
- Oscillations

### Overdamped (Too Much D)
- Slow rise
- Sluggish response

### Ideal Response
- Smooth rise to **1.0**
- Minimal overshoot
- No oscillation

Example optimal value found in the video:

- **P&I slider = 0.4**
- **D slider = 1.0**

Maintain a consistent **PD ratio**.

---

# Master Multiplier

### [00:22:33] What It Does

The **master multiplier controls overall PID strength**.

Higher values:

- Faster quad response
- More locked-in flight feel

Lower values:

- Softer response
- Slower control reaction

---

### [00:23:33] Slider Limit Workaround

If the multiplier reaches the maximum:

1. **Double P&I slider**
2. **Double D slider**
3. **Halve master multiplier**

This keeps the same PD ratio while allowing further tuning.

---

# Feedforward Tuning

## [00:25:35] What Feedforward Does

Feedforward predicts movement based on **stick speed**.

Benefits:

- Reduces delay between **stick input and quad movement**
- Creates **extremely responsive flight feel**
- Especially important for **acro and racing**

---

## [00:26:18] Feedforward Test Flight

Switch to **Acro mode**.

Perform:

- Rapid **roll and pitch oscillations**
- Multiple flights with different feedforward values

Analyze **setpoint vs gyro delay**.

---

## [00:27:00] Finding the Correct Value

Observations from logs:

- Increasing feedforward reduces input delay.
- Gains diminish after a certain value.

Example result:

- **Feedforward slider ≈ 1.5**

Too much feedforward can cause:

- RC jitter amplification
- Overshoot during sharp stick inputs

---

# Key Tuning Principles

### Important Takeaways

- **Filtering first** ensures clean signals for PID tuning.
- **PD balance determines stability and responsiveness.**
- **Master multiplier controls overall control strength.**
- **Feedforward reduces stick latency.**

Each stage builds on the previous one.

---

# Additional Configuration Tips

## Dynamic Idle

### [00:28:42] Preventing Motor Stall

Dynamic Idle prevents motor stall during:

- Flips and rolls
- Propwash recovery

Especially important for:

- Smaller quads
- Steep-pitch props

### Formula for Setting Dynamic Idle

```
RPM = 15000 / prop_diameter_inches
dynamic_idle_value = RPM / 100
```

Examples:

- **5" props:**
  - RPM = 15000 / 5 = 3000
  - Value: **30**

- **2" props:**
  - RPM = 15000 / 2 = 7500
  - Value: **75**

---

## RC Smoothing

### [00:30:09] Setpoint Filtering Configuration

RC Smoothing controls how stick inputs are filtered before reaching the PID controller.

Recommended approach:

- Set setpoint cutoffs to **Auto**
- Tune via **Auto Factor** slider

Effect of Auto Factor:

- **Higher Auto Factor** → smoother, cinematic feel
- **Lower Auto Factor** → sharper, race-oriented feel

Note:

- Radio link preset (applied earlier) may already configure this appropriately.
- Check current settings before adjusting.

---

# Conclusion

This tuning workflow for **Betaflight 4.4** provides a systematic approach to achieving optimal flight performance:

1. Prepare the quad with correct firmware and logging.
2. Tune **filters** to remove noise while minimizing latency.
3. Find the correct **PD balance** for stable control.
4. Increase **master multiplier** to maximize responsiveness.
5. Adjust **feedforward** to eliminate stick-input delay.

When performed correctly, the result is a quad that feels **precise, responsive, and stable**, with minimal oscillation and excellent stick tracking.
