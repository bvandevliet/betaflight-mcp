import type { SerialTransport } from '../transport/serial.js';

const CLI_PROMPT = '# ';
const CLI_ENTER_TIMEOUT_MS = 5000;
const CLI_CMD_TIMEOUT_MS = 10000;
const CLI_DUMP_TIMEOUT_MS = 15000;

// CLI commands that reboot the FC or hand off to another mode entirely — none of these
// produce a trailing "# " prompt, so execCommand() must not wait for one. Dedicated tools
// (cli_save, cli_defaults, reboot_flight_controller) already use execCommandAndDisconnect()
// for the common cases; this set guards the generic cli_exec path for the same commands.
const REBOOTING_COMMANDS = new Set(['reboot', 'save', 'defaults', 'bl', 'msc']);

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

// Minimum idle time (no new data) required before a trailing "# " is trusted as the
// real end-of-output prompt, rather than a coincidental mid-stream chunk boundary.
const PROMPT_QUIET_MS = 60;

export class CliClient {
  private inCli = false;
  private buffer = '';
  private lastDataAt = 0;
  private dataListener: (chunk: Buffer) => void;

  constructor(
    private transport: SerialTransport,
    private lock: Mutex,
  ) {
    this.dataListener = (chunk: Buffer) => {
      this.buffer += chunk.toString('latin1');
      this.lastDataAt = Date.now();
    };
    this.transport.addDataListener(this.dataListener);
  }

  // IMPORTANT: Betaflight dump/diff output is full of comment lines like "# version",
  // "# master", "# profile 0", etc. A naive `buffer.includes(CLI_PROMPT)` check matches
  // the FIRST such comment line, resolving long before the real output has finished
  // streaming in — this is what caused cli_dump/cli_diff to silently truncate.
  // The real end-of-output prompt is the LAST thing written, with nothing after it.
  // We require the buffer to *end* with the prompt AND have been quiet (no new data)
  // for PROMPT_QUIET_MS before trusting it, to avoid false-triggering on a chunk
  // boundary that happens to land right after a "# " inside a comment line.
  private waitForPrompt(timeoutMs: number): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const check = () => {
        if (this.buffer.endsWith(CLI_PROMPT) && Date.now() - this.lastDataAt >= PROMPT_QUIET_MS) {
          clearInterval(interval);
          clearTimeout(timer);
          resolve(this.buffer);
        }
      };

      // Poll every 10ms
      const interval = setInterval(check, 10);

      const timer = setTimeout(() => {
        clearInterval(interval);
        reject(new Error(`CLI prompt not received within ${timeoutMs}ms. Buffer: ${JSON.stringify(this.buffer.slice(-200))}`));
      }, timeoutMs);

      // Immediate check (covers the case where the prompt was already buffered)
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

      // "exit" leaves CLI mode with no new prompt; "reboot"/"save"/"defaults"/"bl"/"msc"
      // restart or hand off the MCU entirely. None of these ever produce a trailing "# ",
      // so waitForPrompt() would always time out even on success. Callers should prefer
      // exitCli() / execCommandAndDisconnect() for these, but cli_exec accepts arbitrary
      // text, so guard against it here too rather than reporting a false error.
      const trimmedCmd = cmd.trim().toLowerCase();
      if (trimmedCmd === 'exit') {
        await new Promise<void>((r) => setTimeout(r, 300));
        this.inCli = false;
        const response = this.buffer.trim();
        return response || 'Left CLI mode.';
      }
      if (REBOOTING_COMMANDS.has(trimmedCmd.split(/\s+/)[0] ?? '')) {
        await new Promise<void>((r) => setTimeout(r, 500));
        this.inCli = false;
        const response = this.buffer.trim();
        return response || 'Command sent. Flight controller is rebooting.';
      }

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
