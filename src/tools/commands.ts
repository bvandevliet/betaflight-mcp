import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { requireSession } from '../state.js';

function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

function errorResult(err: unknown) {
  return textResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
}

export function registerCommandTools(server: McpServer): void {
  server.registerTool(
    'feature_list',
    { description: 'List all features and their enabled/disabled state on the flight controller.' },
    async () => {
      try {
        const { cliClient } = requireSession();
        const result = await cliClient.execCommand('feature');
        return textResult(result);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'feature_enable',
    {
      description: 'Enable a named feature on the flight controller (e.g. TELEMETRY, GPS, SOFTSERIAL).',
      inputSchema: {
        name: z.string().describe('Feature name to enable'),
      },
    },
    async ({ name }) => {
      try {
        const { cliClient } = requireSession();
        const result = await cliClient.execCommand(`feature ${name}`);
        return textResult(result || 'OK');
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'feature_disable',
    {
      description: 'Disable a named feature on the flight controller.',
      inputSchema: {
        name: z.string().describe('Feature name to disable'),
      },
    },
    async ({ name }) => {
      try {
        const { cliClient } = requireSession();
        const result = await cliClient.execCommand(`feature -${name}`);
        return textResult(result || 'OK');
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'get_serial_config',
    { description: 'Get serial port configuration from the flight controller.' },
    async () => {
      try {
        const { cliClient } = requireSession();
        const result = await cliClient.execCommand('serial');
        return textResult(result);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'get_aux_config',
    { description: 'Get auxiliary channel (AUX) mode configuration.' },
    async () => {
      try {
        const { cliClient } = requireSession();
        const result = await cliClient.execCommand('aux');
        return textResult(result);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'get_channel_map',
    { description: 'Get the current RC channel map (order of AETR channels).' },
    async () => {
      try {
        const { cliClient } = requireSession();
        const result = await cliClient.execCommand('map');
        return textResult(result);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'set_channel_map',
    {
      description: 'Set the RC channel map order (e.g. AETR1234).',
      inputSchema: {
        order: z.string().describe('Channel map order string, e.g. AETR1234'),
      },
    },
    async ({ order }) => {
      try {
        const { cliClient } = requireSession();
        const result = await cliClient.execCommand(`map ${order}`);
        return textResult(result || 'OK');
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'get_mixer',
    { description: 'Get the current mixer type configuration.' },
    async () => {
      try {
        const { cliClient } = requireSession();
        const result = await cliClient.execCommand('mixer');
        return textResult(result);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'get_tasks',
    { description: 'Get the list of scheduler tasks and their timing statistics.' },
    async () => {
      try {
        const { cliClient } = requireSession();
        const result = await cliClient.execCommand('tasks');
        return textResult(result);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'get_version',
    { description: 'Get the Betaflight firmware version and build information.' },
    async () => {
      try {
        const { cliClient } = requireSession();
        const result = await cliClient.execCommand('version');
        return textResult(result);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'motor_get',
    {
      description: 'Get the current output value for a specific motor index.',
      inputSchema: {
        index: z.number().int().min(0).describe('Motor index (0-based)'),
      },
    },
    async ({ index }) => {
      try {
        const { cliClient } = requireSession();
        const result = await cliClient.execCommand(`motor ${index}`);
        return textResult(result);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'motor_set',
    {
      description: 'Set the output value for a specific motor (use with caution — props off!). Value 0 = off, 1000–2000 = throttle range.',
      inputSchema: {
        index: z.number().int().min(0).describe('Motor index (0-based)'),
        value: z.number().int().min(0).max(2000).describe('Motor value (0 = off, 1000–2000 = throttle range)'),
      },
    },
    async ({ index, value }) => {
      try {
        const { cliClient } = requireSession();
        const result = await cliClient.execCommand(`motor ${index} ${value}`);
        return textResult(result || 'OK');
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
