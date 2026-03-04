import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerConnectionTools } from './tools/connection.js';
import { registerRealtimeTools } from './tools/realtime.js';
import { registerCommandTools } from './tools/commands.js';
import { registerCliTools } from './tools/cli.js';
import { registerSystemTools } from './tools/system.js';
import { registerVariableTools } from './generated/variables.js';

const server = new McpServer({
  name: 'betaflight-mcp',
  version: '1.0.0',
});

registerConnectionTools(server);
registerRealtimeTools(server);
registerCommandTools(server);
registerCliTools(server);
registerSystemTools(server);
registerVariableTools(server);

const transport = new StdioServerTransport();
await server.connect(transport);

process.stderr.write('[betaflight-mcp] Server started. Awaiting MCP messages on stdio.\n');
