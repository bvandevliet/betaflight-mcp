# Arming Disable Flags

Reference for diagnosing "won't arm" reports. Read `get_arming_disable_flags` first — it returns
the live bitmask decoded to flag names — then look up each flag below rather than guessing.

Source of truth: `armingDisableFlags_e` in
[`src/main/fc/runtime_config.h`](https://github.com/betaflight/betaflight/blob/master/src/main/fc/runtime_config.h)
(the enum comment notes flags are "listed in order of criticalness" — the beeper reports the most
critical active flag first) and the set/unset call sites in `src/main/fc/core.c::updateArmingStatus()`.
The MCP server's own `ARMING_DISABLE_FLAGS` array (`src/generated/armingFlags.ts`) is generated
directly from this enum by bit position, so flag names returned by the tool always match this table
for whatever firmware build is connected — re-run `pnpm generate` after a firmware jump if a name
looks unfamiliar.

| Flag | Cause | Fix |
|------|-------|-----|
| `NO_GYRO` | Gyro failed to initialize at boot (bad solder joint, dead sensor, wrong `gyro_hardware` selection) | Reflash/reboot; check `status` for the detected gyro; if genuinely absent, it's a hardware fault — see `mcu-usb-drivers.md` if this coincides with connection issues |
| `FAILSAFE` | FC is in a post-failsafe-landed state (Stage 2 `DROP`/`AUTO-LAND` completed) | Disarm the arm switch fully, then re-arm — this is the `NOT_DISARMED` interlock after a failsafe landing, not a persistent block |
| `RX_FAILSAFE` | No valid receiver data right now (RXLOSS) — link genuinely down, TX off, or bind lost | Check TX is on and bound; verify `get_rc_channels` shows live data; not fixable by any FC setting if the link truly is down |
| `NOT_DISARMED` | Arm switch was already ON when RX signal came back (protects against auto-arm-on-reconnect) | Flip the arm switch OFF, then back ON |
| `BOXFAILSAFE` | The failsafe test mode switch (`STAGE1`/`STAGE2` in `failsafe_switch_mode`) is currently active | Turn off the failsafe test switch |
| `RUNAWAY_TAKEOFF` | Runaway Takeoff Prevention tripped (motors spun up without stick input matching gyro response) — persists until disarm | Check `runaway_takeoff_prevention` config and mechanical issues (stuck motor, prop damage) if this trips unexpectedly; otherwise just disarm/rearm |
| `CRASH_DETECTED` | Crash recovery detected an impact | Disarm and inspect the craft before re-arming |
| `THROTTLE` | Throttle stick is not at minimum (below `min_check`) | Lower throttle to idle before arming — standard safety interlock, never disable |
| `ANGLE` | Craft is not upright, and `BOXCRASHFLIP` is not active — the FC checks orientation before allowing arm | Set the craft upright; if this is a turtle-mode re-arm, activate the crash-flip switch first (see `small_angle` note in SKILL.md — a related but distinct check) |
| `BOOT_GRACE_TIME` | `powerOnArmingGraceTime` hasn't elapsed since power-on (short mandatory delay, plus DSHOT streaming commands must be ready) | Wait a couple seconds after power-up before arming |
| `NOPREARM` | A `BOXPREARM` mode is configured but not currently active | Activate the pre-arm switch first, then the arm switch |
| `LOAD` | CPU load exceeded `cpuLatePercentageLimit` (scheduler running too many late tasks) | Reduce PID loop rate, disable unused features/OSD elements, or check for a runaway task — see `get_task_statistics` |
| `CALIBRATING` | Gyro or accelerometer calibration is in progress | Wait for calibration to finish (keep the craft still) |
| `CLI` | The CLI port was exited without a reboot | Reboot the FC (this is the tool's own `cli_save`/`cli_defaults` path, or a manual `exit`+no-reboot from Configurator) |
| `CMS_MENU` | The OSD/CMS menu is currently open on a stick-based display | Exit the OSD menu |
| `BST` | Legacy flag (Black Sheep Telemetry) — not currently set anywhere in mainline firmware; if seen, likely a very old build or a vendor fork | Reflash current firmware |
| `MSP` | An MSP client explicitly disabled arming over the link (`MSP_SET_ARMING_DISABLED`) — used by simulators/sim-link tools | Check what MSP client is connected (e.g. a flight simulator) and whether it intends to hold arming disabled |
| `GPS` | GPS Rescue is configured but no fix yet (and craft has never armed this session) | Wait for a GPS fix, or set `gps_rescue_allow_arming_without_fix` (rescue itself won't work until a fix is acquired) |
| `RESC` | The GPS Rescue mode switch is currently active while disarmed | Turn off the GPS Rescue switch before arming |
| `DSHOT_TELEM` | DSHOT bidirectional telemetry is enabled but one or more ESCs aren't reporting it | Check ESC firmware supports bidir DSHOT, wiring, and that `dshot_bidir` matches the ESCs actually connected |
| `REBOOT_REQUIRED` | A setting was changed that only takes effect after reboot (e.g. certain resource/DMA/feature changes) | `cli_save` or `reboot_flight_controller` |
| `DSHOT_BITBANG` | DSHOT bitbang mode failed to initialize correctly | Check `dshot_bitbang`/`dshot_bitbang_timer` config against the target's supported timers |
| `ACC_CALIBRATION` | Accelerometer needs calibration (required for angle/horizon modes, GPS Rescue) | Run `calibrate_accelerometer` (craft level and stationary) |
| `MOTOR_PROTOCOL` | The configured motor protocol isn't enabled/available on this build/target | Check `motor_pwm_protocol` is supported by the target and ESCs |
| `CRASHFLIP` | Crash-flip (turtle mode) is active in manual re-arm mode and hasn't been manually disarmed since the last flip | Disarm manually once (this is `crashflip_auto_rearm = OFF` behavior — set it `ON` if auto re-arm after flip-over is wanted) |
| `ALTHOLD` | The altitude-hold mode switch is active while disarmed | Turn off the alt-hold switch before arming |
| `POSHOLD` | The position-hold mode switch is active while disarmed | Turn off the pos-hold switch before arming |
| `ARM_SWITCH` | Catch-all: some other flag above was active while the arm switch was already on — this flag itself is a symptom, not a root cause | **Always resolve the other reported flag(s) first** — `ARM_SWITCH` clears once nothing else blocks arming and the switch is cycled off/on |

## Reading multiple simultaneous flags

`get_arming_disable_flags` can return several flags at once. Work through them in the table order
above (roughly the firmware's own criticality order) rather than picking one at random — `ARM_SWITCH`
in particular is almost always accompanied by at least one other flag and should be treated as noise
once the real cause is identified.

## Common pitfalls

- **`THROTTLE` reported when the stick looks at idle**: check `min_check` — a receiver with wander,
  reversed channel, or wrong `rxrange` can sit just above the threshold. Read `get_rc_channels`
  and compare the raw value against `min_check`, don't eyeball the transmitter's on-screen bar.
- **`GPS`/`RESC` confusion**: `GPS` blocks arming outright (no fix yet); `RESC` only blocks arming
  while the rescue switch is physically on. Seeing `RESC` alone with the switch off usually means
  the mode range itself is misconfigured (see `get_aux_config`) rather than a fix problem.
- **`REBOOT_REQUIRED` after a `set` that "should" apply immediately**: not all CLI variables are
  hot-appliable; some require `cli_save`'s reboot regardless of when the flag first appears.
- **`ARM_SWITCH` never clearing**: means the underlying flag is still active — re-check
  `get_arming_disable_flags` after fixing the suspected cause rather than assuming a single fix
  resolved everything; several flags can compound.
