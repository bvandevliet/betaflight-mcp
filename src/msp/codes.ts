// MSP command code constants.
// Verified against upstream:
// https://github.com/betaflight/betaflight-configurator/blob/master/src/js/msp/MSPCodes.js

export const MspCodes = {
  // ── API & identity ────────────────────────────────────────────────────────
  MSP_API_VERSION:              1,
  MSP_FC_VARIANT:               2,
  MSP_FC_VERSION:               3,
  MSP_BOARD_INFO:               4,
  MSP_BUILD_INFO:               5,

  // ── Arming ────────────────────────────────────────────────────────────────
  MSP_ARMING_DISABLE:          99,  // read arming-disable flags (replaces STATUS_EX flags field)
  MSP_ARMING_CONFIG:           61,
  MSP_SET_ARMING_CONFIG:       62,

  // ── Configuration read ────────────────────────────────────────────────────
  MSP_BATTERY_CONFIG:          32,
  MSP_FEATURE_CONFIG:          36,
  MSP_BOARD_ALIGNMENT_CONFIG:  38,
  MSP_CURRENT_METER_CONFIG:    40,
  MSP_MIXER_CONFIG:            42,
  MSP_RX_CONFIG:               44,
  MSP_CF_SERIAL_CONFIG:        54,
  MSP_RX_MAP:                  64,
  MSP_LOOP_TIME:               73,
  MSP_RC_TUNING:              111,
  MSP_PID:                    112,

  // ── Configuration write ───────────────────────────────────────────────────
  MSP_SET_FEATURE_CONFIG:      37,
  MSP_SET_BOARD_ALIGNMENT_CONFIG: 39,
  MSP_SET_CURRENT_METER_CONFIG: 41,
  MSP_SET_MIXER_CONFIG:        43,
  MSP_SET_RX_CONFIG:           45,
  MSP_SET_CF_SERIAL_CONFIG:    55,
  MSP_SET_RX_MAP:              65,
  MSP_SET_REBOOT:              68,
  MSP_SET_PID:                202,
  MSP_SET_RC_TUNING:          204,
  MSP_EEPROM_WRITE:           250,

  // ── Dataflash / blackbox ──────────────────────────────────────────────────
  MSP_DATAFLASH_SUMMARY:       70,
  MSP_DATAFLASH_ERASE:         72,

  // ── Real-time telemetry ───────────────────────────────────────────────────
  MSP_STATUS:                 101,
  MSP_RAW_IMU:                102,
  MSP_SERVO:                  103,
  MSP_MOTOR:                  104,
  MSP_RC:                     105,
  MSP_RAW_GPS:                106,
  MSP_COMP_GPS:               107,
  MSP_ATTITUDE:               108,
  MSP_ALTITUDE:               109,
  MSP_ANALOG:                 110,
  MSP_STATUS_EX:              150,

  // ── Battery / power ───────────────────────────────────────────────────────
  MSP_VOLTAGE_METERS:         128,
  MSP_CURRENT_METERS:         129,
  MSP_BATTERY_STATE:          130,
  MSP_MOTOR_CONFIG:           131,

  // ── Motor telemetry ───────────────────────────────────────────────────────
  MSP_MOTOR_TELEMETRY:        139,

  // ── Profiles ──────────────────────────────────────────────────────────────
  MSP_SELECT_SETTING:         210,  // switch active PID/rate profile (0-indexed)
  MSP_COPY_PROFILE:           183,

  // ── Calibration ───────────────────────────────────────────────────────────
  MSP_ACC_CALIBRATION:        205,
  MSP_MAG_CALIBRATION:        206,

  // ── GPS ───────────────────────────────────────────────────────────────────
  MSP_GPS_CONFIG:             132,
  MSP_COMPASS_CONFIG:         133,
  MSP_GPS_RESCUE:             135,

  // ── MSPv2 Betaflight-specific ─────────────────────────────────────────────
  MSP2_SEND_DSHOT_COMMAND:    0x3003,
  MSP2_GET_VTX_DEVICE_STATUS: 0x3004,
  MSP2_MCU_INFO:              0x300c,
  MSP2_GYRO_SENSOR:           0x300d,
} as const;

export type MspCode = (typeof MspCodes)[keyof typeof MspCodes];

export const MSP_V2_THRESHOLD = 255;
