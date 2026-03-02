import type { SerialTransport } from './transport/serial.js';
import { MspClient } from './msp/client.js';
import { CliClient, createMutex } from './cli/client.js';

interface Session {
  transport: SerialTransport;
  mspClient: MspClient;
  cliClient: CliClient;
  lock: ReturnType<typeof createMutex>;
}

let _session: Session | null = null;

export function getSession(): Session | null {
  return _session;
}

export function requireSession(): Session {
  if (!_session) {
    throw new Error('No flight controller connected. Use connect_flight_controller first.');
  }
  return _session;
}

export function createSession(transport: SerialTransport): Session {
  const lock = createMutex();
  const mspClient = new MspClient(transport);
  const cliClient = new CliClient(transport, lock);

  const session: Session = { transport, mspClient, cliClient, lock };
  _session = session;

  transport.onClose(() => {
    destroySession();
  });

  return session;
}

export function destroySession(): void {
  if (!_session) return;
  const s = _session;
  _session = null;
  s.mspClient.destroy();
  s.cliClient.destroy();
}
