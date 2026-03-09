---
name: betaflight-mcp-setup
description: Configure the betaflight-mcp server path for the current machine. Run this once after installing the plugin and building the project, and again after each plugin update.
argument-hint: "[path-to-repo (optional)]"
context: fork
model: haiku
allowed-tools: Read, Write, Bash
---

Help the user configure the betaflight-mcp MCP server path so Claude Code can connect to the server automatically.

## What this command does

The installed plugin's `.mcp.json` contains a placeholder `BETAFLIGHT_MCP_SERVER_PATH` that must be replaced with the absolute path to `dist/server.js` on this machine.

Claude Code caches the plugin at install time in `~/.claude/plugins/cache/`. This command updates the **cached** copy — not the repo's `plugin/.mcp.json` — so the placeholder in the repo stays clean for git and other users.

## Steps

1. Determine the absolute path to `dist/server.js`:
   - If the user provided a path argument, use that as the repo root.
   - Otherwise, try to find `betaflight-mcp/dist/server.js` relative to the current directory or its parents.
   - Ask the user for the repo path if not found.
   - The final path should be the absolute path to `dist/server.js`, e.g.:
     - Windows: `C:/Users/name/repos/betaflight-mcp/dist/server.js`
     - Linux/macOS: `/home/name/repos/betaflight-mcp/dist/server.js`
   - Always use forward slashes on all platforms.

2. Verify the file exists at that path. If not, tell the user to run `pnpm build` first.

3. Find the cached `.mcp.json` by searching `~/.claude/plugins/cache/` for a file named `.mcp.json` that contains `BETAFLIGHT_MCP_SERVER_PATH`. Use Bash to locate it, e.g.:
   - On Windows (Git Bash): `find ~/.claude/plugins/cache -name ".mcp.json" | xargs grep -l "BETAFLIGHT_MCP_SERVER_PATH" 2>/dev/null`
   - On Linux/macOS: same command
   - If multiple matches are found, pick the one whose path contains `betaflight-mcp`.
   - If no match is found, tell the user the plugin may not be installed yet or the path was already configured, and suggest running `/plugin install betaflight-mcp` first.

4. Read the cached `.mcp.json`, replace `BETAFLIGHT_MCP_SERVER_PATH` with the resolved absolute path, and write it back.

5. Do NOT modify the repo's `plugin/.mcp.json` — the placeholder must stay intact there for future plugin updates and other users.

6. Confirm to the user:
   - The cached file that was updated
   - The path that was configured
   - That they should restart Claude Code for the MCP server to take effect
   - Remind them the server connects to their FC when they say: "Connect to my FPV quad"
