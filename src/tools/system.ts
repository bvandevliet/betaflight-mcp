import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { MspCodes } from '../msp/codes.js';
import { requireSession } from '../state.js';
import type { FcStatusEx, FcDataflashSummary, FcBatteryState, FcGpsData } from '../types/betaflight.js';

// Arming disable flag names ordered by bit position (Betaflight 4.x)
const ARMING_DISABLE_FLAGS = [
  'NOGYRO', 'FAILSAFE', 'RX_FAILSAFE', 'BAD_RX_RECOVERY', 'BOXFAILSAFE',
  'RUNAWAY_TAKEOFF', 'CRASH_DETECTED', 'THROTTLE', 'ANGLE', 'BOOT_GRACE_TIME',
  'NOPREARM', 'LOAD', 'CALIB', 'CLI', 'CMS_MENU', 'OSD_MENU', 'BST', 'MSP',
  'PARALYZE', 'GPS', 'RESC', 'RPMFILTER', 'REBOOT_REQUIRED', 'DSHOT_BITBANG',
  'ACC_CALIBRATION', 'MOTOR_PROTOCOL', 'ARM_SWITCH',
] as const;

function readU8(buf: Buffer, offset: number): number {
  const b = buf[offset];
  if (b === undefined) throw new Error(`Buffer underflow at offset ${offset}`);
  return b;
}

function readU16LE(buf: Buffer, offset: number): number {
  const lo = buf[offset];
  const hi = buf[offset + 1];
  if (lo === undefined || hi === undefined) throw new Error(`Buffer underflow at offset ${offset}`);
  return lo | (hi << 8);
}

function readU32LE(buf: Buffer, offset: number): number {
  const b0 = buf[offset];
  const b1 = buf[offset + 1];
  const b2 = buf[offset + 2];
  const b3 = buf[offset + 3];
  if (b0 === undefined || b1 === undefined || b2 === undefined || b3 === undefined) {
    throw new Error(`Buffer underflow at offset ${offset}`);
  }
  return (b0 | (b1 << 8) | (b2 << 16) | (b3 << 24)) >>> 0;
}

function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

function errorResult(err: unknown) {
  return textResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
}

// Parse MSP_STATUS_EX payload.
// Layout: cycleTime U16, i2cErrors U16, activeSensors U16, mode U32, profile U8,
//         cpuLoad U16, numProfiles U8, rateProfileIndex U8,
//         armingDisableCount U8, armingDisableFlags U32
function parseStatusEx(buf: Buffer): FcStatusEx {
  return {
    cycleTime: readU16LE(buf, 0),
    i2cErrors: readU16LE(buf, 2),
    activeSensors: readU16LE(buf, 4),
    mode: readU32LE(buf, 6),
    pidProfileIndex: readU8(buf, 10),
    cpuLoad: readU16LE(buf, 11),
    numProfiles: readU8(buf, 13),
    rateProfileIndex: readU8(buf, 14),
    // byte 15 = armingDisableCount (number of valid bits); skip it
    armingDisableFlags: readU32LE(buf, 16),
  };
}

export function registerSystemTools(server: McpServer): void {
  // ── Reboot ────────────────────────────────────────────────────────────────

  server.registerTool(
    'reboot_flight_controller',
    {
      description:
        'Reboot the flight controller. The connection will be closed as the FC restarts. ' +
        'Use reconnect_flight_controller (or connect_flight_controller) afterwards.',
    },
    async () => {
      try {
        const { cliClient } = requireSession();
        const result = await cliClient.execCommandAndDisconnect('reboot');
        return textResult(
          `${result}\n\nFlight controller is rebooting. Use reconnect_flight_controller to restore the connection.`,
        );
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  // ── Calibration ───────────────────────────────────────────────────────────

  server.registerTool(
    'calibrate_accelerometer',
    {
      description:
        'Calibrate the accelerometer. Place the flight controller level and stationary before calling this. ' +
        'Note: call this before any CLI tools in the same session (MSP cannot be used after CLI mode is entered).',
    },
    async () => {
      try {
        const session = requireSession();
        const release = await session.lock();
        try {
          await session.mspClient.request(MspCodes.MSP_ACC_CALIBRATION);
          return textResult('Accelerometer calibration started. Keep the FC level and still for several seconds.');
        } finally {
          release();
        }
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'calibrate_magnetometer',
    {
      description:
        'Calibrate the magnetometer (compass). Rotate the flight controller through all orientations when prompted. ' +
        'Note: call this before any CLI tools in the same session (MSP cannot be used after CLI mode is entered).',
    },
    async () => {
      try {
        const session = requireSession();
        const release = await session.lock();
        try {
          await session.mspClient.request(MspCodes.MSP_MAG_CALIBRATION);
          return textResult('Magnetometer calibration started. Rotate the FC through all axes for ~30 seconds.');
        } finally {
          release();
        }
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  // ── Dataflash (blackbox) ──────────────────────────────────────────────────

  server.registerTool(
    'get_dataflash_summary',
    {
      description:
        'Get onboard blackbox flash storage summary: ready state, total size, and used size. ' +
        'Note: call this before any CLI tools in the same session.',
    },
    async () => {
      try {
        const session = requireSession();
        const release = await session.lock();
        try {
          const buf = await session.mspClient.request(MspCodes.MSP_DATAFLASH_SUMMARY);
          const flags = readU8(buf, 0);
          const summary: FcDataflashSummary = {
            isReady: (flags & 0x01) !== 0,
            isFull: (flags & 0x02) !== 0,
            sectors: readU32LE(buf, 1),
            totalSize: readU32LE(buf, 5),
            usedSize: readU32LE(buf, 9),
          };
          return textResult(JSON.stringify(summary, null, 2));
        } finally {
          release();
        }
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'erase_blackbox_logs',
    {
      description:
        'Erase all blackbox logs stored in onboard flash memory. ' +
        'This is irreversible and can take up to 30 seconds. ' +
        'Note: call this before any CLI tools in the same session.',
    },
    async () => {
      try {
        const session = requireSession();
        const release = await session.lock();
        try {
          // Erase can take up to 30 s; use a 60 s timeout
          await session.mspClient.request(MspCodes.MSP_DATAFLASH_ERASE, undefined, 60_000);
          return textResult('Blackbox flash erased successfully.');
        } finally {
          release();
        }
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  // ── Arming ────────────────────────────────────────────────────────────────

  server.registerTool(
    'get_arming_disable_flags',
    {
      description:
        'Get the flags explaining why the flight controller is refusing to arm. ' +
        'Returns a list of active arming-disable conditions. An empty list means the FC is ready to arm. ' +
        'Note: call this before any CLI tools in the same session.',
    },
    async () => {
      try {
        const session = requireSession();
        const release = await session.lock();
        try {
          const buf = await session.mspClient.request(MspCodes.MSP_STATUS_EX);
          const status = parseStatusEx(buf);
          const activeFlags: string[] = [];
          for (let bit = 0; bit < ARMING_DISABLE_FLAGS.length; bit++) {
            if ((status.armingDisableFlags & (1 << bit)) !== 0) {
              const name = ARMING_DISABLE_FLAGS[bit];
              if (name !== undefined) activeFlags.push(name);
            }
          }
          if (activeFlags.length === 0) {
            return textResult('No arming disable flags active — FC is ready to arm.');
          }
          return textResult(`Arming disabled by:\n${activeFlags.map((f) => `  • ${f}`).join('\n')}`);
        } finally {
          release();
        }
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  // ── Profile management ────────────────────────────────────────────────────

  server.registerTool(
    'get_current_profile',
    {
      description: 'Get the currently active PID profile index and rate profile index.',
    },
    async () => {
      try {
        const { cliClient } = requireSession();
        const profileOut = await cliClient.execCommand('profile');
        const rateOut = await cliClient.execCommand('rateprofile');
        const pidMatch = profileOut.match(/\d+/);
        const rateMatch = rateOut.match(/\d+/);
        if (!pidMatch || !rateMatch) {
          return textResult(
            `Unexpected CLI output.\nprofile: ${profileOut}\nrateprofile: ${rateOut}`,
          );
        }
        return textResult(
          JSON.stringify(
            {
              pidProfileIndex: parseInt(pidMatch[0], 10),
              rateProfileIndex: parseInt(rateMatch[0], 10),
            },
            null,
            2,
          ),
        );
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'set_pid_profile',
    {
      description:
        'Switch the active PID profile (0-indexed). Call cli_save afterwards to persist the change.',
      inputSchema: {
        index: z.number().int().min(0).max(5).describe('PID profile index (0-based, typically 0–2)'),
      },
    },
    async ({ index }) => {
      try {
        const { cliClient } = requireSession();
        const result = await cliClient.execCommand(`profile ${index}`);
        return textResult(result || `Switched to PID profile ${index}. Call cli_save to persist.`);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'set_rate_profile',
    {
      description:
        'Switch the active rate profile (0-indexed). Call cli_save afterwards to persist the change.',
      inputSchema: {
        index: z.number().int().min(0).max(5).describe('Rate profile index (0-based, typically 0–5)'),
      },
    },
    async ({ index }) => {
      try {
        const { cliClient } = requireSession();
        const result = await cliClient.execCommand(`rateprofile ${index}`);
        return textResult(result || `Switched to rate profile ${index}. Call cli_save to persist.`);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'copy_pid_profile',
    {
      description:
        'Copy a PID profile to another slot. Switches to the source profile then copies it to the destination. ' +
        'Call cli_save afterwards to persist.',
      inputSchema: {
        source: z.number().int().min(0).max(5).describe('Source PID profile index (0-based)'),
        destination: z.number().int().min(0).max(5).describe('Destination PID profile index (0-based)'),
      },
    },
    async ({ source, destination }) => {
      try {
        const { cliClient } = requireSession();
        await cliClient.execCommand(`profile ${source}`);
        const result = await cliClient.execCommand(`copy profile ${destination}`);
        return textResult(
          result || `Copied PID profile ${source} → ${destination}. Call cli_save to persist.`,
        );
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  // ── Preflight check ───────────────────────────────────────────────────────

  server.registerTool(
    'preflight_check',
    {
      description:
        'Run a comprehensive preflight safety check: arming readiness, battery voltage, GPS lock status, and CPU load. ' +
        'Note: call this before any CLI tools in the same session (uses MSP).',
    },
    async () => {
      const lines: string[] = ['=== Preflight Check ==='];
      let overallPass = true;

      try {
        const session = requireSession();

        // 1. Arming disable flags + CPU load + profiles
        {
          const release = await session.lock();
          let status: FcStatusEx;
          try {
            const buf = await session.mspClient.request(MspCodes.MSP_STATUS_EX);
            status = parseStatusEx(buf);
          } finally {
            release();
          }

          const activeFlags: string[] = [];
          for (let bit = 0; bit < ARMING_DISABLE_FLAGS.length; bit++) {
            if ((status.armingDisableFlags & (1 << bit)) !== 0) {
              const name = ARMING_DISABLE_FLAGS[bit];
              if (name !== undefined) activeFlags.push(name);
            }
          }

          if (activeFlags.length === 0) {
            lines.push('[PASS] Arming: ready to arm');
          } else {
            overallPass = false;
            lines.push(`[FAIL] Arming disabled: ${activeFlags.join(', ')}`);
          }

          lines.push(`[INFO] PID profile: ${status.pidProfileIndex}  Rate profile: ${status.rateProfileIndex}`);

          const cpuPct = status.cpuLoad / 10;
          const cpuStatus = cpuPct > 30 ? '[WARN]' : '[INFO]';
          lines.push(`${cpuStatus} CPU load: ${cpuPct.toFixed(1)}%`);
        }

        // 2. Battery state
        {
          const release = await session.lock();
          let battery: FcBatteryState;
          try {
            const buf = await session.mspClient.request(MspCodes.MSP_BATTERY_STATE);
            battery = {
              cellCount: readU8(buf, 0),
              capacityMah: readU16LE(buf, 1),
              voltage: readU8(buf, 3) / 10,
              mAhDrawn: readU16LE(buf, 4),
              amperage: readU16LE(buf, 6) / 100,
              batteryState: readU8(buf, 8),
              voltagePrecise: readU16LE(buf, 9) / 100,
            };
          } finally {
            release();
          }

          const stateLabels = ['OK', 'WARNING', 'CRITICAL', 'NOT_PRESENT', 'INIT'];
          const stateLabel = stateLabels[battery.batteryState] ?? `UNKNOWN(${battery.batteryState})`;
          const battPass = battery.batteryState === 0 || battery.batteryState === 3;
          if (!battPass) overallPass = false;
          lines.push(
            `[${battPass ? 'PASS' : 'FAIL'}] Battery: ${battery.voltagePrecise.toFixed(2)} V  ` +
              `${battery.cellCount}S  state=${stateLabel}  used=${battery.mAhDrawn} mAh`,
          );
        }

        // 3. GPS
        {
          const release = await session.lock();
          let gps: FcGpsData;
          try {
            const buf = await session.mspClient.request(MspCodes.MSP_RAW_GPS);
            gps = {
              fix: readU8(buf, 0),
              satellites: readU8(buf, 1),
              latitudeDeg: 0,
              longitudeDeg: 0,
              altitudeMeters: 0,
              speedCmPerSec: 0,
            };
          } finally {
            release();
          }

          if (gps.fix === 0) {
            lines.push(`[WARN] GPS: no fix  sats=${gps.satellites}`);
          } else {
            lines.push(`[PASS] GPS: fix=${gps.fix}  sats=${gps.satellites}`);
          }
        }

        lines.push('');
        lines.push(overallPass ? '✓ PREFLIGHT PASSED' : '✗ PREFLIGHT FAILED — resolve issues before arming');
        return textResult(lines.join('\n'));
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
