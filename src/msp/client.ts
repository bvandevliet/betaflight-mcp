import type { SerialTransport } from '../transport/serial.js';
import type { PendingRequest } from '../types/betaflight.js';
import { encodeMsp } from './protocol.js';
import { MspFrameParser } from './protocol.js';

const REQUEST_TIMEOUT_MS = 5000;

export class MspClient {
  private pending = new Map<number, PendingRequest>();
  private parser: MspFrameParser;
  private dataListener: (chunk: Buffer) => void;

  constructor(private transport: SerialTransport) {
    this.parser = new MspFrameParser();
    this.parser.onFrame = (code, payload) => {
      const req = this.pending.get(code);
      if (req) {
        clearTimeout(req.timer);
        this.pending.delete(code);
        req.resolve(payload);
      }
    };
    this.dataListener = (chunk: Buffer) => {
      this.parser.feed(chunk);
    };
    this.transport.addDataListener(this.dataListener);
  }

  request(code: number, payload?: Buffer): Promise<Buffer> {
    return new Promise<Buffer>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(code);
        reject(new Error(`MSP request timed out for code ${code}`));
      }, REQUEST_TIMEOUT_MS);

      this.pending.set(code, { resolve, reject, timer });

      const frame = encodeMsp(code, payload);
      this.transport.write(frame).catch((err: unknown) => {
        clearTimeout(timer);
        this.pending.delete(code);
        reject(err instanceof Error ? err : new Error(String(err)));
      });
    });
  }

  destroy(): void {
    this.transport.removeDataListener(this.dataListener);
    for (const [, req] of this.pending) {
      clearTimeout(req.timer);
      req.reject(new Error('MSP client destroyed'));
    }
    this.pending.clear();
  }
}
