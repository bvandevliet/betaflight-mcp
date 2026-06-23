import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { requireSession } from '../state.js';

function textResult(text: string) {
  return { content: [{ type: 'text' as const, text }] };
}

function errorResult(err: unknown) {
  return textResult(`Error: ${err instanceof Error ? err.message : String(err)}`);
}

// Matches "set simplified_<anything> = <value>". Plain CLI `set` on these fields only
// updates the stored slider percentage — it does NOT recalculate the underlying
// p_roll/i_roll/d_roll/f_roll/d_max_roll gains (that recalculation only happens via the
// MSP slider path used by set_pid_sliders, the CLI "simplified_tuning apply" command, or
// a factory reset). Setting it via raw CLI alone silently desyncs the stored slider
// percentage from the gains actually being flown, and Betaflight Configurator will
// disable the PID tab sliders once it detects the mismatch.
const SIMPLIFIED_SET_RE = /^\s*set\s+simplified_\w+\s*=/i;

export function registerCliTools(server: McpServer): void {
  server.registerTool(
    'cli_exec',
    {
      description:
        'Execute an arbitrary CLI command on the flight controller and return the output. ' +
        'NOTE: for "set simplified_*" commands, prefer the set_pid_sliders tool — it recalculates the ' +
        'underlying PID/filter gains via MSP. If used here anyway, this tool automatically runs ' +
        '"simplified_tuning apply" afterward to keep the actual gains in sync with the slider value.',
      inputSchema: {
        command: z.string().describe('CLI command to execute (e.g. "get pid_process_denom")'),
      },
    },
    async ({ command }) => {
      try {
        const { cliClient } = requireSession();
        const result = await cliClient.execCommand(command);

        if (SIMPLIFIED_SET_RE.test(command)) {
          const applyResult = await cliClient.execCommand('simplified_tuning apply');
          return textResult(
            `${result || '(no output)'}\n\n` +
              '[auto] Detected a "set simplified_*" command. Plain CLI set only updates the slider ' +
              'percentage, not the underlying PID/D-max gains, so "simplified_tuning apply" was run ' +
              `automatically to recalculate them and keep Configurator in sync:\n${applyResult || '(no output)'}`,
          );
        }

        return textResult(result || '(no output)');
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'cli_dump',
    { description: 'Dump the complete flight controller configuration as CLI commands. This may take several seconds.' },
    async () => {
      try {
        const { cliClient } = requireSession();
        const result = await cliClient.execCommand('dump');
        return textResult(result);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'cli_diff',
    { description: 'Show only the settings that differ from the defaults (diff all). More concise than a full dump.' },
    async () => {
      try {
        const { cliClient } = requireSession();
        const result = await cliClient.execCommand('diff all');
        return textResult(result);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'cli_status',
    { description: 'Get flight controller status text output from the CLI status command.' },
    async () => {
      try {
        const { cliClient } = requireSession();
        const result = await cliClient.execCommand('status');
        return textResult(result);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'cli_help',
    { description: 'List all available CLI commands on the flight controller.' },
    async () => {
      try {
        const { cliClient } = requireSession();
        const result = await cliClient.execCommand('help');
        return textResult(result);
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'cli_save',
    {
      description:
        'Save current configuration to EEPROM and reboot the flight controller. ' +
        'WARNING: This will close the connection as the FC reboots. Reconnect after save.',
    },
    async () => {
      try {
        const { cliClient } = requireSession();
        const result = await cliClient.execCommandAndDisconnect('save');
        return textResult(
          `${result}\n\nConfiguration saved. The flight controller is rebooting. Use connect_flight_controller to reconnect.`,
        );
      } catch (err) {
        return errorResult(err);
      }
    },
  );

  server.registerTool(
    'cli_defaults',
    {
      description:
        'Reset flight controller configuration to factory defaults and reboot. ' +
        'WARNING: This will erase all settings and close the connection. Use cli_save after reconnecting to preserve the reset.',
    },
    async () => {
      try {
        const { cliClient } = requireSession();
        const result = await cliClient.execCommandAndDisconnect('defaults --show-defaults');
        return textResult(
          `${result}\n\nDefaults applied. The flight controller is rebooting. Use connect_flight_controller to reconnect.`,
        );
      } catch (err) {
        return errorResult(err);
      }
    },
  );
}
