import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { SerialTransport } from '../transport/serial.js';
import { createSession, destroySession, getLastConnection, getSession, setLastConnection } from '../state.js';

export function registerConnectionTools(server: McpServer): void {
  server.registerTool(
    'list_serial_ports',
    {
      description: 'List all available serial ports on this system. Use this to find the port your flight controller is connected to.',
    },
    async () => {
      const ports = await SerialTransport.listPorts();
      if (ports.length === 0) {
        return { content: [{ type: 'text' as const, text: 'No serial ports found.' }] };
      }
      const lines = ports.map((p) => {
        const parts = [p.path];
        if (p.manufacturer) parts.push(`(${p.manufacturer})`);
        if (p.serialNumber) parts.push(`SN:${p.serialNumber}`);
        return parts.join(' ');
      });
      return { content: [{ type: 'text' as const, text: lines.join('\n') }] };
    },
  );

  server.registerTool(
    'connect_flight_controller',
    {
      description: 'Connect to a Betaflight flight controller over USB/serial. Use list_serial_ports first to find the correct port.',
      inputSchema: {
        port: z.string().describe('Serial port path, e.g. COM3 or /dev/ttyUSB0'),
        baud_rate: z.number().int().optional().describe('Baud rate (default: 115200)'),
      },
    },
    async ({ port, baud_rate }) => {
      const baudRate = baud_rate ?? 115200;
      try {
        const transport = await SerialTransport.connect(port, baudRate);
        createSession(transport);
        setLastConnection(port, baudRate);
        return {
          content: [
            {
              type: 'text' as const,
              text: `Connected to flight controller on ${port} at ${baudRate} baud.`,
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to connect: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
        };
      }
    },
  );

  server.registerTool(
    'reconnect_flight_controller',
    {
      description:
        'Reconnect to the last connected flight controller using the same port and baud rate. ' +
        'Useful after a reboot (e.g. following cli_save or reboot_flight_controller). ' +
        'Will disconnect any existing session first.',
    },
    async () => {
      const last = getLastConnection();
      if (!last) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'No previous connection recorded. Use connect_flight_controller with explicit port and baud rate.',
            },
          ],
        };
      }
      const existing = getSession();
      if (existing) {
        destroySession();
        try {
          await existing.transport.close();
        } catch {
          // ignore — transport may already be closed after a reboot
        }
      }
      try {
        const transport = await SerialTransport.connect(last.port, last.baudRate);
        createSession(transport);
        return {
          content: [
            {
              type: 'text' as const,
              text: `Reconnected to flight controller on ${last.port} at ${last.baudRate} baud.`,
            },
          ],
        };
      } catch (err) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Failed to reconnect: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
        };
      }
    },
  );

  server.registerTool(
    'disconnect_flight_controller',
    {
      description: 'Disconnect from the currently connected flight controller.',
    },
    async () => {
      const session = getSession();
      if (!session) {
        return { content: [{ type: 'text' as const, text: 'No flight controller connected.' }] };
      }
      try {
        destroySession();
        await session.transport.close();
        return { content: [{ type: 'text' as const, text: 'Disconnected from flight controller.' }] };
      } catch (err) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Error during disconnect: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
        };
      }
    },
  );
}
