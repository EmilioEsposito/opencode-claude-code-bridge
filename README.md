# opencode-claude-code-bridge

[![npm](https://img.shields.io/npm/v/opencode-claude-code-bridge)](https://www.npmjs.com/package/opencode-claude-code-bridge)

OpenCode plugin that bridges Claude Code's MCP server configs and the skills bundled inside Claude Code plugins into OpenCode — so switching between the two CLIs (or running them side-by-side) doesn't require re-wiring anything.

## What it pulls in

- **User-level MCP servers** from `~/.claude.json` (`mcpServers`).
- **Project-level MCP servers** from `<cwd>/.mcp.json`. If `.claude/settings.json` explicitly declares `enabledMcpjsonServers`, that allowlist is respected; otherwise the local file is imported as-is.
- **Plugin-bundled MCP servers** from any enabled Claude Code plugin (`~/.claude/plugins/installed_plugins.json` ∩ `enabledPlugins`).
- **Plugin-bundled skills** — symlinked from `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/skills/<name>` into `~/.config/opencode/skills/<name>` (OpenCode already discovers skills at that location).

For MCP definitions that reference `${CLAUDE_PROJECT_DIR}`, the bridge resolves it to OpenCode's current project directory.

Not yet supported (v1): bundled agents, slash commands, hooks.

## Install

Add the plugin to your OpenCode config (`~/.config/opencode/opencode.jsonc` or project-level `.opencode/opencode.jsonc`):

```jsonc
{
  "plugin": ["opencode-claude-code-bridge@latest"]
}
```

OpenCode will install it from npm on next start. The `@latest` tag ensures you automatically get new versions on each restart ([ref](https://github.com/anomalyco/opencode/issues/6159#issuecomment-3691647738)). To pin a specific version instead, use e.g. `"opencode-claude-code-bridge@0.1.1"`.

## When does OpenCode pick up Claude Code changes?

**On OpenCode restart.** OpenCode loads its config once at startup and does not hot-reload, so the same applies here — every time you start OpenCode, this plugin re-reads Claude's configs from scratch and injects the current state. No manual sync command needed; just quit and relaunch OpenCode.

What that means in practice:

| You change in Claude Code…                                            | Visible in OpenCode after… |
| --------------------------------------------------------------------- | -------------------------- |
| Add/remove an MCP server in `~/.claude.json` or `.mcp.json`           | OpenCode restart           |
| Toggle a plugin in `enabledPlugins`                                   | OpenCode restart           |
| Edit `enabledMcpjsonServers`                                          | OpenCode restart           |
| Install a new Claude plugin (new entry in `installed_plugins.json`)   | OpenCode restart           |
| Edit the contents of a skill file (e.g. `SKILL.md` body)              | Immediately — skills are symlinked, not copied |

## Conflict resolution

If you have an MCP server name declared in both your `opencode.jsonc` and Claude's configs, your `opencode.jsonc` entry wins.

## Debugging

Set `OPENCODE_CLAUDE_CODE_BRIDGE_DEBUG=1` before launching OpenCode to log which MCPs and plugins were discovered.

## Publishing

This package publishes through GitHub Actions trusted publishing from
`.github/workflows/publish.yml`.

For maintainer release steps and verification, use:

- `.claude/skills/publish-package/SKILL.md`
