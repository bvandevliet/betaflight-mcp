# Betaflight 4.5 PID Tuning Masterclass – Video Summary
https://www.youtube.com/watch?v=1oYoVE4xu1U

**Topic:** Step-by-step PID tuning guide for Betaflight 4.5, structured from basic to advanced. Assumes filters are already tuned (covered in part 1).

---

## PID Controller Theory

**[00:01:03]** Overview of the PID controller:
- **Setpoint** (stick position) minus **gyro** = PID error
- **P term** – acts like a spring; pushes back against error proportionally
- **D term** – acts like a shock absorber; resists rate of change of gyro, suppresses oscillations
- **I term** – integrates error over time; corrects persistent systematic offsets
- **Feed forward** – reacts to stick velocity directly; eliminates tracking delay on fast moves

**[00:04:13]** Key insight: P/D *ratio* matters more than absolute values. Tuning order: D → P → I → Feed Forward.

---

## Tuning Flights Setup

**[00:06:38]** Practical guidance:
- Do sharp stick inputs; **hold the stick** – never let it snap back freely
- Tune in **angle mode** for cleaner, more controlled inputs
- Set `pidsum_limit` and `pidsum_limit_yaw` to 1000 via CLI for maximum PID authority

---

## Master Multiplier

**[00:08:15]** Start here – sets overall PID gain volume:
- Begin around **0.5**, increase gradually
- Watch for: motor warmth, audible oscillations/trilling = too high
- Plateau in improvement = approaching optimum
- **Disable Dynamic Damping** (set to 0) before tuning master
- High-KV/powerful motors require *lower* master multiplier; faster motor response compensates

---

## Dynamic Idle

**[00:13:07]** Critical for prop wash reduction, especially on smaller quads or steep-pitch props:
- Higher RPM needed for smaller props and steeper pitch (tip speed / blade stall considerations)
- Use provided table as reference; interpolate for intermediate prop sizes

---

## TPA (Throttle PID Attenuation)

**[00:14:00]**
- Reduces D gains (and optionally P) at high throttle to prevent high-throttle oscillations
- **TPA rate** = attenuation at full throttle (default 65 → PIDs at 35% at max throttle)
- **TPA breakpoint** = throttle level where attenuation begins (1000–2000 scale)
- Set breakpoint just below where oscillations appear; increase rate until resolved
- Set TPA mode to `PD` if both P and D oscillate at high throttle

---

## PD Balance

**[00:15:23]** Finding optimal P/D ratio:
- Disable feed forward and I gains first; keep Dynamic Damping off
- Start P&I slider at ~0.5, increment by ~0.125; listen for audible oscillations
- Analyse with **PID Toolbox step response**:
  - Too low → slow, drifting response
  - Optimal → fast rise to 1.0, minimal overshoot, flat thereafter (matches the **red reference curve**)
  - Too high → sustained oscillations post-move
- Roll and pitch may need different slider values; use the **pitch tracking slider** to adjust pitch P independently

---

## I Term Tuning

**[00:20:57]**
- Wider tuning window than PD; defaults are reasonable for typical 5" builds
- Increase I gain slider until quad feels precise and locked-in; back off when slow wobbles appear on fast moves
- **I term relax** – prevents I term wind-up during fast moves; increase cutoff (30–40) for responsive/racing quads, decrease for slow builds
- **I term windup** – suppresses accumulation when motors near saturation; default 85% is sensible
- **Anti-gravity** – boosts I term during rapid throttle changes (default 8×); reduce if throttle-change wobbles appear; tune P component separately via `set anti_gravity_p_gain`; adjust cutoff Hz for very small/large quads
- **I term rotation / Absolute control** – not recommended; testing shows no measurable benefit for freestyle

---

## Feed Forward

**[00:28:19]** Apply radio link preset first (Presets tab → search your link, e.g. ExpressLRS 250Hz):
- Start stick response slider at ~0.5, increase gradually
- Too low → gyro lags set point throughout move
- Too high → gyro overshoots and bounces back at move end
- Correct → gyro tracks set point closely with minimal lag; motors briefly max out then return cleanly

**[00:32:35]** Feed forward sub-settings:
- **FF Boost** (default 15) – adds acceleration-based component; increase if gyro lags at move *start*, decrease if gyro leads set point at start
- **Max rate limit** (default 90) – cuts FF as sticks approach max deflection, preventing overshoot; increase to 92–95 for responsive quads to tighten move entry

---

## Dynamic Damping

**[00:35:14]**
- Dynamically boosts D term on sharp moves while keeping it lower during normal flight
- **Dynamic Damping Advanced must always be set to 0** – it incorrectly mixes setpoint into the D term
- Tune gain (default 37) using blackbox with debug mode `D_MIN`: D should sit at base during normal flight, boost moderately on moderate moves, max out on sharpest moves
- **Use case 1:** Allow higher FF gains – boost D on fast moves to tame FF-induced overshoot
- **Use case 2:** Reduce motor heating – lower base D, raise Dynamic Damping so D_max equals previous static D value

---

## Miscellaneous Settings

**[00:39:38]**
- **Throttle boost** – adds throttle based on stick acceleration; increase if throttle response feels sluggish
- **Motor output limit** – cap motor drive for voltage mismatches (e.g. 4S motors on 6S → 66%, 3S on 4S → 75%)
- **Vbat sag compensation** – normalises performance across battery discharge; use with caution as it masks battery depletion
- **Thrust linearization** – boosts low-throttle motor drive; useful for tiny whoops on 48kHz+ ESCs; default 20% is generally appropriate

---

## Conclusion

A complete tuning sequence runs: **master multiplier → PD balance → I term → feed forward → dynamic damping**. For a quick-and-dirty tune on a standard 5" freestyle build, adjusting the master multiplier alone may suffice. The next video in the series covers rates tuning for stick feel refinement.