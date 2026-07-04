# Betaflight 4.5 PID Tuning Workflow (PID Toolbox)

## Overview

The video explains an updated **PID and filter tuning workflow for Betaflight 4.5** using **PID Toolbox** and Blackbox logs. Although Betaflight 4.5 introduces improvements, the **core PID and filtering concepts remain mostly unchanged**, so the existing tuning process still applies. The presenter shares a refined workflow based on tuning **546+ drones**, mostly heavy-lift cinematic rigs, emphasizing **starting with diagnostic hover logs, identifying noise sources, optimizing filters, and then performing structured PID tuning using sliders and step-response analysis**.

---

## [00:00:00] Betaflight 4.5 and PID Tuning

* Betaflight 4.5 introduces improvements but **no major changes to PID or filter systems**.
* The **main difference** noted is **RPM filter weighting adjustments**.
* Existing **PID Toolbox tuning workflows still apply**.
* The presenter’s method is based on **years of refinement and tuning hundreds of drones**.

---

# Step 1 — Start With a Simple Hover Log

## [00:01:01] Why the First Log Should Be a Steady Hover

The process always begins with a **simple steady hover Blackbox log** using the drone’s current settings.

### Reasons:

1. **Unknown initial state**

   * Pilots have different drone sizes, experience levels, and issues.
   * A hover log reveals the **true condition of the system**.

2. **Most problems are visible in hover**

   * About **99% of major issues appear even in simple logs**.
   * Aggressive flight is often unnecessary for diagnosing problems.

3. **Repeatability**

   * Hover tests are **consistent and comparable**.
   * Makes it easier to isolate changes in the power spectrum.

4. **Detect electrical or gyro issues**

   * Hover makes it easy to distinguish:

     * **Motor vibration** (discrete frequency peaks)
     * **Electrical noise** (broadband noise)

---

# Diagnosing Noise Sources

## [00:03:00] Identifying Motor vs Electrical Noise

Hover logs help distinguish noise types:

### Motor vibration

* Appears as **narrow frequency peaks**
* Visible as **straight bands in spectrograms**
* Caused by constant RPM during hover

### Electrical noise

* Appears as **broadband noise across frequencies**
* Often caused by:

  * poor flight controllers
  * AIO boards
  * electrical interference

Important observation:

* Many **cinewhoops and AIO flight controllers have electrical/gyro quality issues**.
* Pilots often try solving these with **PID adjustments instead of fixing hardware problems**.

---

# Step 2 — Initial Filter Setup

## [00:04:33] Tentative Filter Optimization

Filters are **not finalized first**; instead they are **refined throughout tuning**.

Reasons:

* PID tuning **changes gyro and D-term behavior**.
* Noise profiles evolve during tuning.
* Therefore filters should be **continuously reassessed**.

### Wobble tests provide useful data

During PID wobble tests:

* motors move between **10–60% throttle**
* allows evaluation of **motor noise and filter performance**

---

# Understanding Betaflight Filters

## [00:06:18] Two Fundamental Filter Types

### 1. Low-pass filters

* Reduce **wide frequency ranges**
* Moderate attenuation
* Introduce **more delay**

### 2. Notch filters

* Target **specific narrow frequencies**
* Strong attenuation
* Much more precise

Key concept:

> Ideally, drones only produce **motor vibration**, which is narrow-band noise.

Therefore:

* **Notch filters (especially RPM filtering)** should handle most noise.

### Betaflight filter types

All are essentially **notch filters with different tracking methods**:

* RPM filters
* Dynamic notches
* Static notches

Low-pass filters are still needed because:

* **small broadband noise always exists**
* **D-term amplifies noise**

Goal:

* **Minimize filter delay while removing noise**.

---

# Step 3 — Begin PID Tuning

## [00:09:14] Transition to PID Tuning

After basic filter optimization:

* Start **PID tuning using PID Toolbox**.
* Use **angle mode wobble tests**.

---

# Betaflight 4.5 Angle Mode Changes

## [00:09:49] Angle Mode Behavior

Betaflight 4.5 changed **Angle and Horizon mode significantly**.

Important notes:

* Default angle mode usually works.
* **Rates now affect angle mode behavior**.
* If angle mode feels soft:

  * use a **linear rate curve**.

---

# Initial Slider Setup

## [00:10:17] Starting Conditions

Before tests:

* **Dynamic damping slider → 0**
* **I-term drift/wobble slider → 0.1–0.2**
* **Feedforward → ignored** (inactive in angle mode)

Feedforward does not affect PID tuning in angle mode because:

* angle mode uses **its own feedforward system**.

---

# Master Multiplier Starting Point

## [00:10:42]

Default **master multiplier = 1.0** is not always correct.

Examples:

* **3–5 inch drones** may be **overtuned at 1.0**
* Some rigs are **very undertuned**

Starting value should consider:

* **power-to-weight ratio**
* **rotational inertia**

---

# PID Slider Tuning Order

## [00:11:50] Step 1 — Tune P:D Ratio (Damping Slider)

* Adjust **damping slider first**.
* Determines **optimal P to D ratio**.

Reason:

* Avoids unintentionally altering **I-term**.

---

## [00:12:16] Step 2 — Correct Roll vs Pitch Latency

Adjust **pitch tracking / pitch damping slider**.

Goal:

* Match **roll and pitch response latency**.

Important considerations:

* Pitch often **lags due to weight distribution**.
* Caused by **rotational inertia around pitch axis**.

Frame design heavily influences this.

---

## [00:13:24] Step 3 — Increase Master Multiplier

Gradually increase until:

* **latency improvements plateau**, or
* negative effects appear.

Monitor using:

* **step response latency**
* **cross-correlation lag**

Stop if observing:

* excessive **D-term noise**
* **PID feedback oscillations**

Common mistake:

* Misinterpreting the data and setting **master multiplier too high or too low**.

---

# Final PID Parameters

## [00:14:04] Feedforward and I-Term

These parameters typically need **minimal fine tuning**.

### Feedforward

Purpose:

* reduce **end-to-end control latency**

Recommended values:

* **0.5–1.0 for heavy-lift drones**

Effect:

* reduces latency by roughly **6–12 ms**

Warning:

* Using **Crossfire 50 Hz** links:

  * feedforward >1.0 may disrupt **P:D ratio balance**.

---

## [00:15:01] I-Term

* Has a **wide tuning window**
* Often works well without much adjustment.

Important interaction:

* **Feedforward reduces error**.
* Reduced error means **I-term accumulates less**.

Therefore:

* feedforward and I-term **must be considered together**.

---

# Key Takeaways

### Most tuning problems are not PID related

Many issues come from:

* **hardware quality**
* **electrical noise**
* **poor flight controllers**

### Start simple

Always begin with:

* **hover Blackbox logs**

### Filter and PID tuning should happen together

Noise profiles change during tuning.

### Focus on latency improvements

Key optimization goal:

* **minimize delay while maintaining stability**

---

# Conclusion

The presented workflow emphasizes **diagnostics before tuning**, starting with **hover logs to detect hardware or noise issues**, followed by **iterative filter adjustments and structured PID tuning using PID Toolbox sliders**. By prioritizing **P:D ratio tuning, roll-pitch latency alignment, and controlled gain increases**, the method achieves **low latency and stable flight performance**, while avoiding common mistakes caused by misinterpreting noise or relying on PID changes to fix hardware problems.
