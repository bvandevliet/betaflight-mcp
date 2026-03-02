// Shared interfaces for Betaflight MCP server

export interface SerialPortInfo {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  pnpId?: string;
  locationId?: string;
  productId?: string;
  vendorId?: string;
}

export interface PendingRequest {
  resolve: (payload: Buffer) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface FcStatus {
  cycleTime: number;
  i2cErrors: number;
  sensors: number;
  mode: number;
  profile: number;
}

export interface FcAttitude {
  roll: number;
  pitch: number;
  yaw: number;
}

export interface FcAltitude {
  altitudeMeters: number;
  variometerCmPerSec: number;
}

export interface FcAnalog {
  voltage: number;
  mAhDrawn: number;
  rssi: number;
  amperage: number;
}

export interface FcBatteryState {
  cellCount: number;
  capacityMah: number;
  voltage: number;
  mAhDrawn: number;
  amperage: number;
  batteryState: number;
  voltagePrecise: number;
}

export interface FcRawImu {
  accX: number;
  accY: number;
  accZ: number;
  gyroX: number;
  gyroY: number;
  gyroZ: number;
  magX: number;
  magY: number;
  magZ: number;
}

export interface FcRcChannels {
  channels: number[];
}

export interface FcMotorValues {
  motors: number[];
}

export interface FcGpsData {
  fix: number;
  satellites: number;
  latitudeDeg: number;
  longitudeDeg: number;
  altitudeMeters: number;
  speedCmPerSec: number;
}
