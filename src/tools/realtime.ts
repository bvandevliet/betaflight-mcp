import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { MspCodes } from '../msp/codes.js';
import { requireSession } from '../state.js';
import type {
  FcStatus,
  FcAttitude,
  FcAltitude,
  FcAnalog,
  FcBatteryState,
  FcRawImu,
  FcRcChannels,
  FcMotorValues,
  FcGpsData,
} from '../types/betaflight.js';

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

function readI16LE(buf: Buffer, offset: number): number {
  const val = readU16LE(buf, offset);
  return val >= 0x8000 ? val - 0x10000 : val;
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

function readI32LE(buf: Buffer, offset: number): number {
  const val = readU32LE(buf, offset);
  return val >= 0x80000000 ? val - 0x100000000 : val;
}

function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

function errorResult(err: unknown) {
  return textResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
}

export function registerRealtimeTools(server: McpServer): void {
  server.registerTool(
    'get_status',
    { description: 'Get flight controller status: cycle time, I2C errors, active sensors, mode flags, and active profile.' },
    async () => {
      try {
        const session = requireSession();
        const release = await session.lock();
        try {
          const buf = await session.mspClient.request(MspCodes.MSP_STATUS);
          const status: FcStatus = {
            cycleTime: readU16LE(buf, 0),
            i2cErrors: readU16LE(buf, 2),
            sensors: readU16LE(buf, 4),
            mode: readU32LE(buf, 6),
            profile: readU8(buf, 10),
          };
          return textResult(JSON.stringify(status, null, 2));
        } finally {
          release();
        }
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'get_raw_imu',
    { description: 'Get raw IMU sensor data: accelerometer (G), gyroscope (°/s), and magnetometer values.' },
    async () => {
      try {
        const session = requireSession();
        const release = await session.lock();
        try {
          const buf = await session.mspClient.request(MspCodes.MSP_RAW_IMU);
          const imu: FcRawImu = {
            accX: readI16LE(buf, 0) / 2048,
            accY: readI16LE(buf, 2) / 2048,
            accZ: readI16LE(buf, 4) / 2048,
            gyroX: (readI16LE(buf, 6) * 4) / 16.4,
            gyroY: (readI16LE(buf, 8) * 4) / 16.4,
            gyroZ: (readI16LE(buf, 10) * 4) / 16.4,
            magX: readI16LE(buf, 12),
            magY: readI16LE(buf, 14),
            magZ: readI16LE(buf, 16),
          };
          return textResult(JSON.stringify(imu, null, 2));
        } finally {
          release();
        }
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'get_attitude',
    { description: 'Get current attitude: roll (°), pitch (°), and yaw (°) from the flight controller.' },
    async () => {
      try {
        const session = requireSession();
        const release = await session.lock();
        try {
          const buf = await session.mspClient.request(MspCodes.MSP_ATTITUDE);
          const attitude: FcAttitude = {
            roll: readI16LE(buf, 0) / 10,
            pitch: readI16LE(buf, 2) / 10,
            yaw: readI16LE(buf, 4),
          };
          return textResult(JSON.stringify(attitude, null, 2));
        } finally {
          release();
        }
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'get_altitude',
    { description: 'Get current altitude (meters) and variometer (cm/s) from the barometer.' },
    async () => {
      try {
        const session = requireSession();
        const release = await session.lock();
        try {
          const buf = await session.mspClient.request(MspCodes.MSP_ALTITUDE);
          const altitude: FcAltitude = {
            altitudeMeters: readI32LE(buf, 0) / 100,
            variometerCmPerSec: readI16LE(buf, 4),
          };
          return textResult(JSON.stringify(altitude, null, 2));
        } finally {
          release();
        }
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'get_battery',
    { description: 'Get battery analog data: voltage (V), mAh drawn, RSSI, and current (A).' },
    async () => {
      try {
        const session = requireSession();
        const release = await session.lock();
        try {
          const buf = await session.mspClient.request(MspCodes.MSP_ANALOG);
          const analog: FcAnalog = {
            voltage: readU8(buf, 0) / 10,
            mAhDrawn: readU16LE(buf, 1),
            rssi: readU16LE(buf, 3),
            amperage: readI16LE(buf, 5) / 100,
          };
          return textResult(JSON.stringify(analog, null, 2));
        } finally {
          release();
        }
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'get_battery_state',
    { description: 'Get detailed battery state: cell count, capacity, voltage, current draw, and state code.' },
    async () => {
      try {
        const session = requireSession();
        const release = await session.lock();
        try {
          const buf = await session.mspClient.request(MspCodes.MSP_BATTERY_STATE);
          const state: FcBatteryState = {
            cellCount: readU8(buf, 0),
            capacityMah: readU16LE(buf, 1),
            voltage: readU8(buf, 3) / 10,
            mAhDrawn: readU16LE(buf, 4),
            amperage: readU16LE(buf, 6) / 100,
            batteryState: readU8(buf, 8),
            voltagePrecise: readU16LE(buf, 9) / 100,
          };
          return textResult(JSON.stringify(state, null, 2));
        } finally {
          release();
        }
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'get_rc_channels',
    { description: 'Get current RC channel values (microseconds). Returns all active channels.' },
    async () => {
      try {
        const session = requireSession();
        const release = await session.lock();
        try {
          const buf = await session.mspClient.request(MspCodes.MSP_RC);
          const channelCount = Math.floor(buf.length / 2);
          const channels: number[] = [];
          for (let i = 0; i < channelCount; i++) {
            channels.push(readU16LE(buf, i * 2));
          }
          const rc: FcRcChannels = { channels };
          return textResult(JSON.stringify(rc, null, 2));
        } finally {
          release();
        }
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'get_motor_values',
    { description: 'Get current motor output values (microseconds). Returns all active motor outputs.' },
    async () => {
      try {
        const session = requireSession();
        const release = await session.lock();
        try {
          const buf = await session.mspClient.request(MspCodes.MSP_MOTOR);
          const motorCount = Math.floor(buf.length / 2);
          const motors: number[] = [];
          for (let i = 0; i < motorCount; i++) {
            motors.push(readU16LE(buf, i * 2));
          }
          const mv: FcMotorValues = { motors };
          return textResult(JSON.stringify(mv, null, 2));
        } finally {
          release();
        }
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'get_gps_data',
    { description: 'Get GPS data: fix status, satellite count, latitude/longitude (°), altitude (m), and ground speed (cm/s).' },
    async () => {
      try {
        const session = requireSession();
        const release = await session.lock();
        try {
          const buf = await session.mspClient.request(MspCodes.MSP_RAW_GPS);
          const gps: FcGpsData = {
            fix: readU8(buf, 0),
            satellites: readU8(buf, 1),
            latitudeDeg: readI32LE(buf, 2) / 1e7,
            longitudeDeg: readI32LE(buf, 6) / 1e7,
            altitudeMeters: readU16LE(buf, 10),
            speedCmPerSec: readU16LE(buf, 12),
          };
          return textResult(JSON.stringify(gps, null, 2));
        } finally {
          release();
        }
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
