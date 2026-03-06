import type { SerialTransport } from '../transport/serial.js';

const CLI_PROMPT = '# ';
const CLI_ENTER_TIMEOUT_MS = 5000;
const CLI_CMD_TIMEOUT_MS = 10000;
const CLI_DUMP_TIMEOUT_MS = 15000;

export type MutexRelease = () => void;
export type Mutex = () => Promise<MutexRelease>;

export function createMutex(): Mutex {
  let _queue: Promise<void> = Promise.resolve();
  return async () => {
    let release!: MutexRelease;
    const prev = _queue;
    _queue = new Promise<void>((r) => {
      release = r;
    });
    await prev;
    return release;
  };
}

export class CliClient {
  private inCli = false;
  private buffer = '';
  private dataListener: (chunk: Buffer) => void;

  constructor(
    private transport: SerialTransport,
    private lock: Mutex,
  ) {
    this.dataListener = (chunk: Buffer) => {
      this.buffer += chunk.toString('latin1');
    };
    this.transport.addDataListener(this.dataListener);
  }

  private waitForPrompt(timeoutMs: number): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const accumulated = () => this.buffer;

      const check = () => {
        if (this.buffer.includes(CLI_PROMPT)) {
          resolve(this.buffer);
          return;
        }
      };

      // Poll every 10ms
      const interval = setInterval(() => {
        if (accumulated().includes(CLI_PROMPT)) {
          clearInterval(interval);
          clearTimeout(timer);
          resolve(this.buffer);
        }
      }, 10);

      const timer = setTimeout(() => {
        clearInterval(interval);
        reject(new Error(`CLI prompt not received within ${timeoutMs}ms. Buffer: ${JSON.stringify(this.buffer.slice(-200))}`));
      }, timeoutMs);

      // Immediate check
      check();
    });
  }

  private async _enterCli(): Promise<void> {
    if (this.inCli) return;

    this.buffer = '';
    await this.transport.write(Buffer.from('#'));
    await this.waitForPrompt(CLI_ENTER_TIMEOUT_MS);
    this.inCli = true;
  }

  // Exit CLI mode so the FC returns to normal MSP operation.
  // Call this (while holding the session lock) before issuing MSP requests
  // that follow CLI activity — the FC ignores MSP frames while in CLI mode.
  async exitCli(): Promise<void> {
    if (!this.inCli) return;
    this.buffer = '';
    await this.transport.write(Buffer.from('exit\n'));
    // Give the FC time to transition back to MSP mode before the next request.
    await new Promise<void>((r) => setTimeout(r, 300));
    this.inCli = false;
  }

  async execCommand(cmd: string): Promise<string> {
    const release = await this.lock();
    try {
      await this._enterCli();

      this.buffer = '';
      await this.transport.write(Buffer.from(`${cmd}\n`));

      const isDump = cmd.startsWith('dump') || cmd.startsWith('diff');
      const timeoutMs = isDump ? CLI_DUMP_TIMEOUT_MS : CLI_CMD_TIMEOUT_MS;

      await this.waitForPrompt(timeoutMs);

      // Strip the echoed command (everything up to first \r\n or \n)
      let response = this.buffer;
      const firstNewline = response.indexOf('\n');
      if (firstNewline !== -1) {
        response = response.slice(firstNewline + 1);
      }

      // Strip trailing prompt
      const promptIdx = response.lastIndexOf(CLI_PROMPT);
      if (promptIdx !== -1) {
        response = response.slice(0, promptIdx);
      }

      return response.trim();
    } finally {
      release();
    }
  }

  async execCommandAndDisconnect(cmd: string): Promise<string> {
    const release = await this.lock();
    try {
      await this._enterCli();

      this.buffer = '';
      await this.transport.write(Buffer.from(`${cmd}\n`));

      // Wait briefly for any acknowledgement
      await new Promise<void>((r) => setTimeout(r, 500));

      const response = this.buffer.trim();
      await this.transport.close();
      return response || 'Command sent. Flight controller is rebooting.';
    } finally {
      release();
    }
  }

  destroy(): void {
    this.transport.removeDataListener(this.dataListener);
  }
}
