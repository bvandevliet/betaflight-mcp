# Betaflight 4.5 Filter Tuning Masterclass
https://www.youtube.com/watch?v=E3s5XYk3M74

**Video purpose:** Comprehensive guide to filter tuning in Betaflight 4.5 — the foundational step before PID and rate tuning.

---

## Blackbox Setup

- **[00:00:58]** Logging device: set to onboard flash or SD card
- **[00:01:21]** Minimum logging rate: 1 kHz; ideal is **1.6–2 kHz** (sufficient detail without filling storage too fast)
- **[00:02:14]** In BF 4.5, raw gyro data is always logged regardless of debug mode
- **[00:03:00]** Use **frequency vs. throttle view** in Blackbox Explorer (overlay → analyzer → frequency vs. throttle)

---

## Gyro Low Pass Filters

- **[00:05:34]** Gyro LPF1: disabled by default — leave it off
- **[00:05:56]** Gyro LPF2: primarily an **anti-aliasing filter**; default 500 Hz is too low — raise to **1 kHz** via the gyro filter multiplier slider
- **[00:07:00]** If gyro rate equals PID loop rate (e.g. 8K/8K), LPF2 can be safely disabled

---

## RPM Filters

- **[00:07:28]** Motor noise is the primary noise source; typically starts ~100 Hz and rises with throttle
- **[00:08:08]** Harmonics visible at 2×, 3× fundamental RPM
- **[00:08:56]** **RPM filter crossfading** (since BF 4.3): fade filters in between min Hz and min + fade range — tune based on where motor noise becomes apparent in the log
- **[00:10:25]** **Q value**: higher = tighter notch, less delay. Default is 500; push towards ~1000 while checking filtered gyro for motor noise bleed-through

### RPM Filter Dimming (new in BF 4.5)

- **[00:12:30]** Adjust per-harmonic filter strength via `set rpm_filter_weights` in CLI
- **[00:12:56]** Tri-blade props: suggested `100, 0, 80` (no noise at 2× harmonic)
- **[00:13:31]** Bi-blade props: start with `100, 80, 0` or `100, 50, 0` depending on harmonic energy
- *Goal: reduce filter weights as much as possible without motor noise appearing in filtered gyro*

---

## Dynamic Notch Filters

- **[00:14:19]** Targets **frame resonances** — visible as vertical stripes in blackbox logs
- **[00:15:30]** Number of dynamic notches needed = number of visible vertical stripes (usually 1)
- **[00:15:48]** **If your frame is quiet with no vertical stripes — disable the dynamic notch entirely** to eliminate unnecessary delay
- **[00:16:32]** Min frequency: set ~25 Hz below the resonance, but **never below 150 Hz** (ideally ≥200 Hz)
- **[00:17:06]** Max frequency: less critical; default ~600 Hz is fine; can be narrowed for better resolution
- **[00:17:42]** Q factor: increase until frame noise starts escaping the notch, then back off — **don't exceed ~1000**

---

## D-Term Low Pass Filters

Two approaches:

| | **Karate tune (default)** | **AOS tune** |
|---|---|---|
| Filters | Two PT1 filters | Single dynamic biquad |
| Delay | Slightly more | Slightly less |
| Motor noise rejection | Good | Better, especially at high throttle |
| Ease of tuning | Easier (slider-based) | More complex (manual CLI) |
| Best for | Noisier/less optimised builds | Cleaner builds, better prop wash handling |

- **[00:22:58]** Karate tuning: nudge `dterm_lpf_multiplier` up in 0.05–0.1 steps until motors sound rough, then back off
- **[00:23:22]** AOS tuning: disable profile-dependent filter settings; set `dterm_lpf1` to `80, 110, BIQUAD`; tune min cutoff (zero throttle) then max cutoff (full throttle) separately
- **[00:24:15]** **Dynamic curve expo**: controls how cutoff frequency scales with throttle. Values >5 are more aggressive at low throttle — push as high as possible without mid-throttle oscillations

---

## Yaw Low Pass Filter

- **[00:25:27]** Yaw responds slower than pitch/roll (torque-based, not thrust-based) — filter delay is less critical on this axis
- **[00:26:02]** Reducing yaw noise provides headroom for tighter pitch/roll tuning (motor thermals)
- **[00:26:22]** For maximum yaw responsiveness: try disabling it and verify no issues in logs

---

## Conclusion

Filter tuning in BF 4.5 follows a clear hierarchy: raise gyro LPF2 → configure RPM filters with appropriate Q and weights → set dynamic notch only if frame resonance exists → tune D-term LPF using either the Karate or AOS approach. The overarching principle throughout is **minimise delay while ensuring noise doesn't reach the filtered gyro signal** — verified via blackbox logs at each step. PID and rate tuning videos follow as subsequent parts of the series.