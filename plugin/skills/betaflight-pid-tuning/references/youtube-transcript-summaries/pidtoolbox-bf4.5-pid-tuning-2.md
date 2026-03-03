# Betaflight Rapid PID Tune Using PID Toolbox
https://www.youtube.com/watch?v=ehvQm8Rqrzk

**Overview:** A practical walkthrough of tuning a 5" FPV drone using Betaflight 4.5 and PID Toolbox, covering filter optimisation followed by a structured three-step PID tuning sequence — all achievable within one or two battery packs.

---

## Setup & Preparation

**[00:00:00]** Prerequisites and initial configuration:
- Use **angle mode** with a dedicated tuning rate profile (150 centre sensitivity / 150 max rate → linear rate curve)
- Reduce angle limit to **30°** for manageable indoor/outdoor testing
- Set blackbox debug mode to **FFT_FRQ** (Betaflight 4.5+; pre-filtered gyro is always logged, so `GYRO_SCALED` is no longer needed)
- Use an **auto wobble script** on EdgeTX/OpenTX to automate stick inputs consistently

---

## Filter Optimisation

### Steady Hover Analysis

**[00:01:29]** Perform a 30–40 second steady hover and analyse the spectrum in PID Toolbox:
- Plot pre- and post-filtered gyro in the spectral analyser
- Overlay **RPM harmonics** to distinguish motor noise from resonance peaks
- Findings on this build: strong 1st and 3rd harmonics, a resonance peak between 1st and 2nd harmonics, negligible 2nd harmonic

### Filter Adjustments

**[00:04:34]** Changes made based on hover analysis:
- **Disable gyro lowpass 1** (turn off LPF1, not LPF2)
- **Increase dynamic notch count to 3** to address the roll resonance peak
- **Raise dynamic notch minimum frequency to 150 Hz** and tighten the range to constrain notch placement
- **Raise RPM filter Q factor from 500 → 1000** via CLI (`set rpm_filter_q = 1000`) — significant filter delay saving
- **Reduce RPM filter weights** for the 2nd harmonic: `set rpm_filter_weights = 100,25,100` — full weight on 1st and 3rd, reduced on 2nd where little noise was present

**[00:07:09]** Result: gyro filter delay reduced to **~2.0 ms** and trending lower after further adjustments.

---

## PID Tuning — Three-Step Process

### Slider Preparation

**[00:08:19]** Before flying, configure the simplified tuning sliders:
- **Stick response (feedforward) → 0** (eliminate FF influence during testing)
- **Dynamic damping → off** (keep D-max and D values static)
- **I term → reduced** (avoid confusing I-term overshoot with insufficient D)
- **Pitch damping → 0.9** (match roll, removing default asymmetry for initial tests)
- **Master multiplier** → start at ~0.8–1.0 for a typical 5"; drop to 0.7–0.8 for high-powered rigs

---

### Step 1 — PD Balance (Damping Slider)

**[00:09:00]** Vary the **damping slider** across four runs: `0.6 → 0.8 → 1.0 → 1.2`

**[00:13:21]** Step response results:
- 0.6 (red): clear overshoot
- 0.8 (orange): improved
- 1.0 (yellow): well-damped ✓
- 1.2 (green): over-damped

**Decision:** Use **1.0** — erring towards slightly more D improves **propwash performance**.

---

### Step 2 — Master Multiplier

**[00:14:52]** Vary master multiplier: `0.6 → 0.8 → 1.0 → 1.2 → 1.4 → 1.6`

**Metric: latency** (use cross-correlation latency in PID Toolbox for accuracy)

**[00:15:34]** Results:
- Clear latency drop as master increases, then plateau
- **1.6**: obvious oscillations in step response — discard
- **1.4**: ripple visible — discard
- **1.2**: slight ripple, acceptable upper bound

**Decision:** Set master multiplier to **1.2**.

> **Why master before I term?** Higher master multiplier collapses the P error between setpoint and gyro, reducing opportunity for I-term windup — making the subsequent I-term tests cleaner.

---

### Step 3 — PI Balance (I Term)

**[00:17:03]** Vary PI tracking slider: `0.5 → 1.0 → 1.5 → 2.0`

**[00:17:43]** Results: **no measurable difference** across all values on this lightweight build — the low all-up weight means P error is minimal and I term has nothing to accumulate.

**Decision:** Set **I term back to 1.0**, feedforward back to **1.0**, tune complete.

---

## Conclusion

A full filter and PID tune is achievable in one pack using a systematic hover-first approach. The core sequence is:

1. **Characterise noise** via steady hover → adjust filters to minimise delay while addressing resonance
2. **Optimise PD ratio** via damping slider sweeps → target minimal overshoot without over-damping
3. **Find P gain ceiling** via master multiplier sweeps → use latency as the primary metric, stop before oscillation
4. **Validate I term** → on light 5" builds it rarely requires adjustment

Final PIDs and filter settings are reviewed at **[00:18:20]**.