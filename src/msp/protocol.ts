import { MSP_V2_THRESHOLD } from './codes.js';

// CRC8-DVB-S2 polynomial 0xD5
function crc8DvbS2(data: number[]): number {
  let crc = 0;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      if (crc & 0x80) {
        crc = ((crc << 1) ^ 0xd5) & 0xff;
      } else {
        crc = (crc << 1) & 0xff;
      }
    }
  }
  return crc;
}

export function encodeMspV1(code: number, payload: Buffer = Buffer.alloc(0)): Buffer {
  const length = payload.length;
  let crc = length ^ code;
  for (let i = 0; i < payload.length; i++) {
    const b = payload[i];
    if (b === undefined) continue;
    crc ^= b;
  }
  const frame = Buffer.allocUnsafe(6 + length);
  frame[0] = 0x24; // '$'
  frame[1] = 0x4d; // 'M'
  frame[2] = 0x3c; // '<'
  frame[3] = length;
  frame[4] = code;
  payload.copy(frame, 5);
  frame[5 + length] = crc & 0xff;
  return frame;
}

export function encodeMspV2(code: number, payload: Buffer = Buffer.alloc(0)): Buffer {
  const size = payload.length;
  const flag = 0x00;
  const fnLo = code & 0xff;
  const fnHi = (code >> 8) & 0xff;
  const sizeLo = size & 0xff;
  const sizeHi = (size >> 8) & 0xff;

  const crcData = [flag, fnLo, fnHi, sizeLo, sizeHi];
  for (let i = 0; i < payload.length; i++) {
    const b = payload[i];
    if (b === undefined) continue;
    crcData.push(b);
  }
  const crc = crc8DvbS2(crcData);

  const frame = Buffer.allocUnsafe(9 + size);
  frame[0] = 0x24; // '$'
  frame[1] = 0x58; // 'X'
  frame[2] = 0x3c; // '<'
  frame[3] = flag;
  frame[4] = fnLo;
  frame[5] = fnHi;
  frame[6] = sizeLo;
  frame[7] = sizeHi;
  payload.copy(frame, 8);
  frame[8 + size] = crc;
  return frame;
}

export function encodeMsp(code: number, payload: Buffer = Buffer.alloc(0)): Buffer {
  if (code > MSP_V2_THRESHOLD) {
    return encodeMspV2(code, payload);
  }
  return encodeMspV1(code, payload);
}

type FrameCallback = (code: number, payload: Buffer, version: 1 | 2) => void;

const enum ParserState {
  IDLE = 0,
  V1_PREAMBLE_M,
  V1_DIRECTION,
  V1_LENGTH,
  V1_CODE,
  V1_PAYLOAD,
  V1_CRC,
  V2_PREAMBLE_X,
  V2_FLAG,
  V2_FN_LO,
  V2_FN_HI,
  V2_SIZE_LO,
  V2_SIZE_HI,
  V2_PAYLOAD,
  V2_CRC,
}

export class MspFrameParser {
  private state: ParserState = ParserState.IDLE;
  private v1Length = 0;
  private v1Code = 0;
  private v1Payload: number[] = [];
  private v2Code = 0;
  private v2Size = 0;
  private v2SizeLo = 0;
  private v2SizeHi = 0;
  private v2FnLo = 0;
  private v2FnHi = 0;
  private v2Payload: number[] = [];
  private v2Crc: number[] = [];

  onFrame: FrameCallback = () => {
    /* default no-op */
  };

  feed(chunk: Buffer): void {
    for (let i = 0; i < chunk.length; i++) {
      const byte = chunk[i];
      if (byte === undefined) continue;
      this.processByte(byte);
    }
  }

  private processByte(byte: number): void {
    switch (this.state) {
      case ParserState.IDLE:
        if (byte === 0x24 /* '$' */) {
          this.state = ParserState.V1_PREAMBLE_M;
        }
        break;

      case ParserState.V1_PREAMBLE_M:
        if (byte === 0x4d /* 'M' */) {
          this.state = ParserState.V1_DIRECTION;
        } else if (byte === 0x58 /* 'X' */) {
          this.state = ParserState.V2_FLAG;
        } else {
          this.state = ParserState.IDLE;
        }
        break;

      case ParserState.V1_DIRECTION:
        // Only handle '>' response or '!' error
        if (byte === 0x3e /* '>' */ || byte === 0x21 /* '!' */) {
          this.state = ParserState.V1_LENGTH;
        } else {
          this.state = ParserState.IDLE;
        }
        break;

      case ParserState.V1_LENGTH:
        this.v1Length = byte;
        this.v1Payload = [];
        this.state = ParserState.V1_CODE;
        break;

      case ParserState.V1_CODE:
        this.v1Code = byte;
        if (this.v1Length === 0) {
          this.state = ParserState.V1_CRC;
        } else {
          this.state = ParserState.V1_PAYLOAD;
        }
        break;

      case ParserState.V1_PAYLOAD:
        this.v1Payload.push(byte);
        if (this.v1Payload.length >= this.v1Length) {
          this.state = ParserState.V1_CRC;
        }
        break;

      case ParserState.V1_CRC: {
        let expected = this.v1Length ^ this.v1Code;
        for (const b of this.v1Payload) {
          expected ^= b;
        }
        if ((expected & 0xff) === byte) {
          this.onFrame(this.v1Code, Buffer.from(this.v1Payload), 1);
        } else {
          process.stderr.write(`[msp] V1 CRC mismatch for code ${this.v1Code}\n`);
        }
        this.state = ParserState.IDLE;
        break;
      }

      // MSPv2
      case ParserState.V2_FLAG:
        this.v2Crc = [byte]; // flag byte seeds CRC
        this.state = ParserState.V2_FN_LO;
        break;

      case ParserState.V2_FN_LO:
        this.v2FnLo = byte;
        this.v2Crc.push(byte);
        this.state = ParserState.V2_FN_HI;
        break;

      case ParserState.V2_FN_HI:
        this.v2FnHi = byte;
        this.v2Crc.push(byte);
        this.v2Code = this.v2FnLo | (this.v2FnHi << 8);
        this.state = ParserState.V2_SIZE_LO;
        break;

      case ParserState.V2_SIZE_LO:
        this.v2SizeLo = byte;
        this.v2Crc.push(byte);
        this.state = ParserState.V2_SIZE_HI;
        break;

      case ParserState.V2_SIZE_HI:
        this.v2SizeHi = byte;
        this.v2Crc.push(byte);
        this.v2Size = this.v2SizeLo | (this.v2SizeHi << 8);
        this.v2Payload = [];
        if (this.v2Size === 0) {
          this.state = ParserState.V2_CRC;
        } else {
          this.state = ParserState.V2_PAYLOAD;
        }
        break;

      case ParserState.V2_PAYLOAD:
        this.v2Payload.push(byte);
        this.v2Crc.push(byte);
        if (this.v2Payload.length >= this.v2Size) {
          this.state = ParserState.V2_CRC;
        }
        break;

      case ParserState.V2_CRC: {
        const expected = crc8DvbS2(this.v2Crc);
        if (expected === byte) {
          this.onFrame(this.v2Code, Buffer.from(this.v2Payload), 2);
        } else {
          process.stderr.write(`[msp] V2 CRC mismatch for code ${this.v2Code}\n`);
        }
        this.state = ParserState.IDLE;
        break;
      }
    }
  }
}
