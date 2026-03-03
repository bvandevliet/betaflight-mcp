---
name: betaflight-mcp-setup
description: Configure the betaflight-mcp server path for the current machine. Run this once after cloning the repo and building the project.
argument-hint: "[path-to-repo]"
allowed-tools: Read, Write, Bash
---

Help the user configure the betaflight-mcp MCP server path so Claude Code can connect to the server automatically.

## What this command does

The `plugin/.mcp.json` file contains a placeholder `BETAFLIGHT_MCP_SERVER_PATH` that must be replaced with the absolute path to `dist/server.js` on this machine. Run this once after cloning and building.

## Steps

1. Determine the absolute path to `dist/server.js`:
   - If the user provided a path argument, use that as the repo root.
   - Otherwise, check common locations:
     - Try to find `betaflight-mcp/dist/server.js` relative to the current directory or its parents.
     - Ask the user for the repo path if not found.
   - The final path should be the absolute path to `dist/server.js`, e.g.:
     - Windows: `C:\Users\name\repos\betaflight-mcp\dist\server.js`
     - Linux/macOS: `/home/name/repos/betaflight-mcp/dist/server.js`

2. Verify the file exists at that path. If not, tell the user to run `pnpm build` first.

3. Read `plugin/.mcp.json` and replace `BETAFLIGHT_MCP_SERVER_PATH` with the resolved absolute path. Use forward slashes on all platforms.

4. Write the updated file back.

5. Confirm to the user:
   - The path that was configured
   - That they should restart Claude Code for the MCP server to take effect
   - Remind them the server connects to their FC when they say: "Connect to my flight controller on COM3" (Windows) or "Connect to my flight controller on /dev/ttyACM0" (Linux/macOS)
