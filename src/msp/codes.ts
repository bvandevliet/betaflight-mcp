// MSP command code constants
// Sources: Betaflight MSPCodes.js and MSPv2 extensions

export const MspCodes = {
  // MSPv1 commands
  MSP_API_VERSION: 1,
  MSP_FC_VARIANT: 2,
  MSP_FC_VERSION: 3,
  MSP_BOARD_INFO: 4,
  MSP_BUILD_INFO: 5,

  MSP_INAV_PID: 6,
  MSP_INAV_PID_SET: 7,

  MSP_STATUS: 101,
  MSP_RAW_IMU: 102,
  MSP_SERVO: 103,
  MSP_MOTOR: 104,
  MSP_RC: 105,
  MSP_RAW_GPS: 106,
  MSP_COMP_GPS: 107,
  MSP_ATTITUDE: 108,
  MSP_ALTITUDE: 109,
  MSP_ANALOG: 110,
  MSP_RC_TUNING: 111,
  MSP_PID: 112,
  MSP_ARMING_CONFIG: 116,
  MSP_LOOP_TIME: 118,
  MSP_RX_CONFIG: 144,
  MSP_FEATURE: 36,
  MSP_FEATURE_SET: 37,
  MSP_BOARD_ALIGNMENT: 38,
  MSP_CURRENT_METER_CONFIG: 40,
  MSP_MIXER: 42,
  MSP_RX_MAP: 64,
  MSP_RX_MAP_SET: 65,
  MSP_CF_SERIAL: 54,
  MSP_SET_CF_SERIAL: 55,
  MSP_BATTERY_CONFIG: 32,

  // Status extended
  MSP_STATUS_EX: 150,

  // Battery state (MSP2 compatible via MSPv1 code 130)
  MSP_BATTERY_STATE: 130,

  // Motor telemetry
  MSP_MOTOR_TELEMETRY: 139,

  // Tasks
  MSP_TASKS: 241,

  // Profile selection
  MSP_SELECT_SETTING: 47,

  // Reboot
  MSP_SET_REBOOT: 68,

  // Dataflash (blackbox onboard storage)
  MSP_DATAFLASH_SUMMARY: 70,
  MSP_DATAFLASH_ERASE: 72,

  // Calibration commands
  MSP_ACC_CALIBRATION: 205,
  MSP_MAG_CALIBRATION: 206,

  // MSPv2 commands
  MSP2_COMMON_TZ: 0x1001,
  MSP2_COMMON_SET_TZ: 0x1002,
  MSP2_MCU_INFO: 0x300c,
} as const;

export type MspCode = (typeof MspCodes)[keyof typeof MspCodes];

export const MSP_V2_THRESHOLD = 255;
