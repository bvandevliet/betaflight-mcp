import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { MspCodes } from '../msp/codes.js';
import { requireSession } from '../state.js';

// Raw slider values as stored in the FC.
// PID gain sliders are stored as uint8 (slider_float × 100), e.g. 1.2 → 120.
// Filter frequency fields are stored as uint16 Hz values.
// Layout mirrors MSPHelper.js readPidSliderSettings / readDtermFilterSliderSettings /
// readGyroFilterSliderSettings (MSP_GET_SIMPLIFIED_TUNING, code 140).
interface RawSliders {
  // PID section (offsets 0–16)
  pids_mode: number;           // 0 = off, 1 = roll+pitch, 2 = roll+pitch+yaw
  master_multiplier: number;   // slider × 100
  roll_pitch_ratio: number;
  i_gain: number;
  d_gain: number;
  pi_gain: number;
  dmax_gain: number;
  feedforward_gain: number;
  pitch_pi_gain: number;
  // D-term filter section (offsets 17–34)
  dterm_filter: number;
  dterm_filter_multiplier: number;
  dterm_lowpass_hz: number;
  dterm_lowpass2_hz: number;
  dterm_lowpass_dyn_min_hz: number;
  dterm_lowpass_dyn_max_hz: number;
  // Gyro filter section (offsets 35–52)
  gyro_filter: number;
  gyro_filter_multiplier: number;
  gyro_lowpass_hz: number;
  gyro_lowpass2_hz: number;
  gyro_lowpass_dyn_min_hz: number;
  gyro_lowpass_dyn_max_hz: number;
}

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

function parseResponse(buf: Buffer): RawSliders {
  // PID section: 9 × uint8 + 2 × uint32_reserved = 17 bytes
  const pids_mode            = readU8(buf, 0);
  const master_multiplier    = readU8(buf, 1);
  const roll_pitch_ratio     = readU8(buf, 2);
  const i_gain               = readU8(buf, 3);
  const d_gain               = readU8(buf, 4);
  const pi_gain              = readU8(buf, 5);
  const dmax_gain            = readU8(buf, 6);
  const feedforward_gain     = readU8(buf, 7);
  const pitch_pi_gain        = readU8(buf, 8);
  // offsets 9–16: 2 × reserved uint32

  // D-term filter section: 2 × uint8 + 4 × uint16 + 2 × uint32_reserved = 18 bytes
  const dterm_filter                = readU8(buf, 17);
  const dterm_filter_multiplier     = readU8(buf, 18);
  const dterm_lowpass_hz            = readU16LE(buf, 19);
  const dterm_lowpass2_hz           = readU16LE(buf, 21);
  const dterm_lowpass_dyn_min_hz    = readU16LE(buf, 23);
  const dterm_lowpass_dyn_max_hz    = readU16LE(buf, 25);
  // offsets 27–34: 2 × reserved uint32

  // Gyro filter section: same layout, starts at offset 35
  const gyro_filter                 = readU8(buf, 35);
  const gyro_filter_multiplier      = readU8(buf, 36);
  const gyro_lowpass_hz             = readU16LE(buf, 37);
  const gyro_lowpass2_hz            = readU16LE(buf, 39);
  const gyro_lowpass_dyn_min_hz     = readU16LE(buf, 41);
  const gyro_lowpass_dyn_max_hz     = readU16LE(buf, 43);
  // offsets 45–52: 2 × reserved uint32

  return {
    pids_mode, master_multiplier, roll_pitch_ratio,
    i_gain, d_gain, pi_gain, dmax_gain, feedforward_gain, pitch_pi_gain,
    dterm_filter, dterm_filter_multiplier,
    dterm_lowpass_hz, dterm_lowpass2_hz, dterm_lowpass_dyn_min_hz, dterm_lowpass_dyn_max_hz,
    gyro_filter, gyro_filter_multiplier,
    gyro_lowpass_hz, gyro_lowpass2_hz, gyro_lowpass_dyn_min_hz, gyro_lowpass_dyn_max_hz,
  };
}

// Encodes the full 53-byte payload for MSP_SET_SIMPLIFIED_TUNING (141).
// Mirrors MSPHelper.crunchSimplifiedTuning() — all three sections must be
// present so the FC writes the simplified_* variables into pgCopy (working
// config), making them visible to cli_save.
function encodeFullPayload(s: RawSliders): Buffer {
  const buf = Buffer.alloc(53);
  let o = 0;

  // PID section (17 bytes): 9 × uint8 + 2 × uint32 reserved
  buf.writeUInt8(s.pids_mode, o++);
  buf.writeUInt8(s.master_multiplier, o++);
  buf.writeUInt8(s.roll_pitch_ratio, o++);
  buf.writeUInt8(s.i_gain, o++);
  buf.writeUInt8(s.d_gain, o++);
  buf.writeUInt8(s.pi_gain, o++);
  buf.writeUInt8(s.dmax_gain, o++);
  buf.writeUInt8(s.feedforward_gain, o++);
  buf.writeUInt8(s.pitch_pi_gain, o++);
  buf.writeUInt32LE(0, o); o += 4; // reserved
  buf.writeUInt32LE(0, o); o += 4; // reserved  (o = 17)

  // D-term filter section (18 bytes)
  buf.writeUInt8(s.dterm_filter, o++);
  buf.writeUInt8(s.dterm_filter_multiplier, o++);
  buf.writeUInt16LE(s.dterm_lowpass_hz, o); o += 2;
  buf.writeUInt16LE(s.dterm_lowpass2_hz, o); o += 2;
  buf.writeUInt16LE(s.dterm_lowpass_dyn_min_hz, o); o += 2;
  buf.writeUInt16LE(s.dterm_lowpass_dyn_max_hz, o); o += 2;
  buf.writeUInt32LE(0, o); o += 4; // reserved
  buf.writeUInt32LE(0, o); o += 4; // reserved  (o = 35)

  // Gyro filter section (18 bytes)
  buf.writeUInt8(s.gyro_filter, o++);
  buf.writeUInt8(s.gyro_filter_multiplier, o++);
  buf.writeUInt16LE(s.gyro_lowpass_hz, o); o += 2;
  buf.writeUInt16LE(s.gyro_lowpass2_hz, o); o += 2;
  buf.writeUInt16LE(s.gyro_lowpass_dyn_min_hz, o); o += 2;
  buf.writeUInt16LE(s.gyro_lowpass_dyn_max_hz, o); o += 2;
  buf.writeUInt32LE(0, o); o += 4; // reserved
  buf.writeUInt32LE(0, o);         // reserved  (o = 53)

  return buf;
}

// Encodes the 18-byte gyro filter section for MSP_CALCULATE_SIMPLIFIED_GYRO (143).
function encodeGyroFilterSection(s: RawSliders): Buffer {
  const buf = Buffer.alloc(18);
  let o = 0;
  buf.writeUInt8(s.gyro_filter, o++);
  buf.writeUInt8(s.gyro_filter_multiplier, o++);
  buf.writeUInt16LE(s.gyro_lowpass_hz, o); o += 2;
  buf.writeUInt16LE(s.gyro_lowpass2_hz, o); o += 2;
  buf.writeUInt16LE(s.gyro_lowpass_dyn_min_hz, o); o += 2;
  buf.writeUInt16LE(s.gyro_lowpass_dyn_max_hz, o); o += 2;
  buf.writeUInt32LE(0, o); o += 4; // reserved
  buf.writeUInt32LE(0, o);         // reserved
  return buf;
}

// Encodes the 18-byte dterm filter section for MSP_CALCULATE_SIMPLIFIED_DTERM (144).
function encodeDtermFilterSection(s: RawSliders): Buffer {
  const buf = Buffer.alloc(18);
  let o = 0;
  buf.writeUInt8(s.dterm_filter, o++);
  buf.writeUInt8(s.dterm_filter_multiplier, o++);
  buf.writeUInt16LE(s.dterm_lowpass_hz, o); o += 2;
  buf.writeUInt16LE(s.dterm_lowpass2_hz, o); o += 2;
  buf.writeUInt16LE(s.dterm_lowpass_dyn_min_hz, o); o += 2;
  buf.writeUInt16LE(s.dterm_lowpass_dyn_max_hz, o); o += 2;
  buf.writeUInt32LE(0, o); o += 4; // reserved
  buf.writeUInt32LE(0, o);         // reserved
  return buf;
}

// Parses the 18-byte gyro/dterm filter response from MSP 143 / 144.
// The FC echoes the slider values and fills in the computed Hz values.
function parseFilterSectionResponse(buf: Buffer, offset: number = 0) {
  return {
    filter:              readU8(buf, offset + 0),
    filter_multiplier:   readU8(buf, offset + 1),
    lowpass_hz:          readU16LE(buf, offset + 2),
    lowpass2_hz:         readU16LE(buf, offset + 4),
    lowpass_dyn_min_hz:  readU16LE(buf, offset + 6),
    lowpass_dyn_max_hz:  readU16LE(buf, offset + 8),
  };
}

// Convert raw uint8 gain values back to float slider positions for display.
function toDisplay(s: RawSliders) {
  return {
    pids_mode:               s.pids_mode,
    master:                  s.master_multiplier       / 100,
    roll_pitch_ratio:        s.roll_pitch_ratio        / 100,
    i_gain:                  s.i_gain                  / 100,
    d_gain:                  s.d_gain                  / 100,
    pi_gain:                 s.pi_gain                 / 100,
    dmax_gain:               s.dmax_gain               / 100,
    feedforward:             s.feedforward_gain        / 100,
    pitch_pi:                s.pitch_pi_gain           / 100,
    dterm_filter:            s.dterm_filter            === 1,
    dterm_filter_multiplier: s.dterm_filter_multiplier / 100,
    gyro_filter:             s.gyro_filter             === 1,
    gyro_filter_multiplier:  s.gyro_filter_multiplier  / 100,
  };
}

function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

function errorResult(err: unknown) {
  return textResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
}

export function registerSliderTools(server: McpServer): void {
  server.registerTool(
    'get_pid_sliders',
    {
      description:
        'Get the current Betaflight simplified filter and tuning slider values. ' +
        'Returns float positions (1.0 = default/100%) matching the slider controls in ' +
        'Betaflight Configurator. pids_mode 0 = disabled, 1 = roll+pitch, 2 = roll+pitch+yaw.',
    },
    async () => {
      try {
        const session = requireSession();
        const release = await session.lock();
        try {
          await session.cliClient.exitCli();
          const buf = await session.mspClient.request(MspCodes.MSP_GET_SIMPLIFIED_TUNING);
          return textResult(JSON.stringify(toDisplay(parseResponse(buf)), null, 2));
        } finally {
          release();
        }
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'set_pid_sliders',
    {
      description:
        'Set Betaflight simplified filter and tuning slider values. Provide only the sliders you want to change; ' +
        'all others keep their current values. The FC recalculates actual PID gains immediately via MSP ' +
        '(equivalent to moving sliders in Configurator). ' +
        'Call cli_save afterwards to persist to EEPROM. ' +
        'If pids_mode is currently 0 (disabled), it is automatically enabled (set to 1) unless you specify otherwise.',
      inputSchema: {
        pids_mode: z.number().int().min(0).max(2).optional()
          .describe('Simplified tuning mode: 0 = off, 1 = roll+pitch only, 2 = roll+pitch+yaw.'),
        master: z.number().min(0).max(2).optional()
          .describe('Master multiplier (0.0–2.0). Scales all PID gains proportionally. 1.0 = default.'),
        roll_pitch_ratio: z.number().min(0).max(2).optional()
          .describe('Roll/Pitch ratio (0.0–2.0). Adjusts pitch gains relative to roll. 1.0 = equal.'),
        i_gain: z.number().min(0).max(2).optional()
          .describe('I-term gain (0.0–2.0). Controls integral strength (drift/wobble correction). 1.0 = default.'),
        d_gain: z.number().min(0).max(2).optional()
          .describe('D-term / Damping gain (0.0–2.0). Controls the P:D balance. 1.0 = default.'),
        pi_gain: z.number().min(0).max(2).optional()
          .describe('PI gain (0.0–2.0). Scales P and I together relative to D. 1.0 = default.'),
        dmax_gain: z.number().min(0).max(2).optional()
          .describe('D Max gain (0.0–2.0). Scales d_max values. 1.0 = default.'),
        feedforward: z.number().min(0).max(2).optional()
          .describe('Feedforward gain (0.0–2.0). Controls feedforward strength. 1.0 = default.'),
        pitch_pi: z.number().min(0).max(2).optional()
          .describe('Pitch PI gain (0.0–2.0). Additional pitch-axis PI adjustment for roll/pitch latency matching.'),
        gyro_filter: z.boolean().optional()
          .describe('Enable simplified gyro filter slider. When true, the gyro_filter_multiplier controls gyro LPF cutoffs.'),
        gyro_filter_multiplier: z.number().min(0.1).max(2).optional()
          .describe('Gyro filter multiplier (0.1–2.0). Scales gyro lowpass cutoff frequencies. 1.0 = default. Firmware minimum is 0.1 (raw 10).'),
        dterm_filter: z.boolean().optional()
          .describe('Enable simplified D-term filter slider. When true, the dterm_filter_multiplier controls D-term LPF cutoffs.'),
        dterm_filter_multiplier: z.number().min(0.1).max(2).optional()
          .describe('D-term filter multiplier (0.1–2.0). Scales D-term lowpass cutoff frequencies. 1.0 = default. Firmware minimum is 0.1 (raw 10).'),
      },
    },
    async (args) => {
      try {
        const session = requireSession();
        const release = await session.lock();
        try {
          // 1. Exit CLI mode if active — the FC ignores MSP frames while in CLI mode.
          await session.cliClient.exitCli();

          // 2. Read current FC slider state (needed for the full payload and pass-through values).
          const buf = await session.mspClient.request(MspCodes.MSP_GET_SIMPLIFIED_TUNING);
          const current = parseResponse(buf);

          // 2b. Build updated state: copy current, apply caller's changes.
          const updated: RawSliders = { ...current };

          // Enable simplified tuning if it was off and the caller did not specify a mode.
          updated.pids_mode = args.pids_mode !== undefined
            ? args.pids_mode
            : (current.pids_mode === 0 ? 1 : current.pids_mode);

          if (args.master           !== undefined) updated.master_multiplier  = Math.round(args.master           * 100);
          if (args.roll_pitch_ratio !== undefined) updated.roll_pitch_ratio   = Math.round(args.roll_pitch_ratio * 100);
          if (args.i_gain           !== undefined) updated.i_gain             = Math.round(args.i_gain           * 100);
          if (args.d_gain           !== undefined) updated.d_gain             = Math.round(args.d_gain           * 100);
          if (args.pi_gain          !== undefined) updated.pi_gain            = Math.round(args.pi_gain          * 100);
          if (args.dmax_gain        !== undefined) updated.dmax_gain          = Math.round(args.dmax_gain        * 100);
          if (args.feedforward      !== undefined) updated.feedforward_gain   = Math.round(args.feedforward      * 100);
          if (args.pitch_pi         !== undefined) updated.pitch_pi_gain      = Math.round(args.pitch_pi         * 100);
          if (args.gyro_filter      !== undefined) updated.gyro_filter        = args.gyro_filter ? 1 : 0;
          if (args.gyro_filter_multiplier !== undefined) updated.gyro_filter_multiplier = Math.round(args.gyro_filter_multiplier * 100);
          if (args.dterm_filter     !== undefined) updated.dterm_filter       = args.dterm_filter ? 1 : 0;
          if (args.dterm_filter_multiplier !== undefined) updated.dterm_filter_multiplier = Math.round(args.dterm_filter_multiplier * 100);

          // 3. Optionally recompute gyro filter Hz values via MSP 143 — only when gyro filter sliders changed
          //    AND the FC has at least one gyro LPF active (non-zero Hz). Configurator mirrors this
          //    check: it disables the gyro slider when all Hz values are 0 (filters fully disabled).
          //    Sending MSP 143 when Hz values are all zero causes the FC to not respond (→ timeout).
          const gyroFilterActive =
            updated.gyro_lowpass_hz !== 0 ||
            updated.gyro_lowpass2_hz !== 0 ||
            updated.gyro_lowpass_dyn_min_hz !== 0;
          if ((args.gyro_filter !== undefined || args.gyro_filter_multiplier !== undefined) && gyroFilterActive) {
            const gyroFilterResp = await session.mspClient.request(
              MspCodes.MSP_CALCULATE_SIMPLIFIED_GYRO,
              encodeGyroFilterSection(updated),
            );
            const gyroComputed = parseFilterSectionResponse(gyroFilterResp);
            updated.gyro_filter             = gyroComputed.filter;
            updated.gyro_filter_multiplier  = gyroComputed.filter_multiplier;
            updated.gyro_lowpass_hz         = gyroComputed.lowpass_hz;
            updated.gyro_lowpass2_hz        = gyroComputed.lowpass2_hz;
            updated.gyro_lowpass_dyn_min_hz = gyroComputed.lowpass_dyn_min_hz;
            updated.gyro_lowpass_dyn_max_hz = gyroComputed.lowpass_dyn_max_hz;
          }

          // 4. Compute D-term filter Hz values via MSP 144 — same guard as gyro.
          const dtermFilterActive =
            updated.dterm_lowpass_hz !== 0 ||
            updated.dterm_lowpass2_hz !== 0 ||
            updated.dterm_lowpass_dyn_min_hz !== 0;
          if ((args.dterm_filter !== undefined || args.dterm_filter_multiplier !== undefined) && dtermFilterActive) {
            const dtermFilterResp = await session.mspClient.request(
              MspCodes.MSP_CALCULATE_SIMPLIFIED_DTERM,
              encodeDtermFilterSection(updated),
            );
            const dtermComputed = parseFilterSectionResponse(dtermFilterResp);
            updated.dterm_filter             = dtermComputed.filter;
            updated.dterm_filter_multiplier  = dtermComputed.filter_multiplier;
            updated.dterm_lowpass_hz         = dtermComputed.lowpass_hz;
            updated.dterm_lowpass2_hz        = dtermComputed.lowpass2_hz;
            updated.dterm_lowpass_dyn_min_hz = dtermComputed.lowpass_dyn_min_hz;
            updated.dterm_lowpass_dyn_max_hz = dtermComputed.lowpass_dyn_max_hz;
          }

          // 5. Write simplified_* into pgCopy and recompute all gains via MSP 141.
          //    The FC reads the full 53-byte payload (simplified_* control vars + filter Hz),
          //    then calls applySimplifiedTuning() internally — computing PID gains, gyro filter
          //    Hz, and dterm filter Hz in one step. Without this, cli_save would persist the
          //    computed p/i/d values but simplified_* would revert to EEPROM defaults on reboot.
          await session.mspClient.request(MspCodes.MSP_SET_SIMPLIFIED_TUNING, encodeFullPayload(updated));

          return textResult(
            `Sliders applied. Call cli_save to persist.\n\n` +
            `Current slider values:\n${JSON.stringify(toDisplay(updated), null, 2)}`,
          );
        } finally {
          release();
        }
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
