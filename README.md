# opencode-claude-code-bridge

[![npm](https://img.shields.io/npm/v/opencode-claude-code-bridge)](https://www.npmjs.com/package/opencode-claude-code-bridge)

OpenCode plugin that bridges Claude Code's MCP server configs and the skills bundled inside Claude Code plugins into OpenCode — so switching between the two CLIs (or running them side-by-side) doesn't require re-wiring anything.

It also brings Claude Code's **skills-as-slash-commands** ergonomics to the OpenCode TUI: every discovered skill becomes a first-class `/<skill>` command you can type and autocomplete, just like in Claude Code.

## What it pulls in

- **User-level MCP servers** from `~/.claude.json` (`mcpServers`).
- **Project-level MCP servers** from `<cwd>/.mcp.json`. If `.claude/settings.json` explicitly declares `enabledMcpjsonServers`, that allowlist is respected; otherwise the local file is imported as-is.
- **Plugin-bundled MCP servers** from any enabled Claude Code plugin (`~/.claude/plugins/installed_plugins.json` ∩ `enabledPlugins`).
- **Plugin-bundled skills** — symlinked from `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/skills/<name>` into `~/.config/opencode/skills/<name>` (OpenCode already discovers skills at that location).
- **Skills as TUI slash commands** — every discovered skill is surfaced as a first-class `/<skill>` slash command in the OpenCode **TUI**, for parity with Claude Code (see below).

For MCP definitions that reference `${CLAUDE_PROJECT_DIR}`, the bridge resolves it to OpenCode's current project directory.

Not yet supported (v1): bundled agents, hooks.

## Skills as slash commands (TUI parity with Claude Code)

In Claude Code, every skill is also a typeable `/<skill>` slash command. OpenCode treats skills differently per client:

- **Desktop** already renders skills as `/` slash entries natively.
- **TUI** does **not** — its slash palette only lists `source: "command"` entries, so out of the box skills are reachable in the TUI only via the `/skills` picker, never as `/<skill>`.

This plugin closes that gap. On non-Desktop clients (TUI, CLI `run`, headless) it injects a `source: "command"` wrapper for each discovered skill, so `/share`, `/list-repos`, etc. autocomplete in the TUI slash menu exactly like in Claude Code.

Key properties:

- **No duplicates in Desktop.** The plugin runs inside each client's own server process and gates on `OPENCODE_CLIENT`; under Desktop (`OPENCODE_CLIENT=desktop`) it injects nothing and leaves Desktop's native skill rendering untouched.
- **No transcript spam.** The wrapper is a one-line *shim* — it tells the agent to invoke the skill via its `skill` tool and forwards your `$ARGUMENTS`. The skill body loads as the skill tool result, so `/share` doesn't dump the whole `SKILL.md` into your message. Typing `/list-repos --limit 20` forwards `--limit 20` to the skill.
- **Covers every skill root**, not just plugin-bundled ones: `~/.config/opencode/skills` (global + bridged), `~/.claude/skills` (Claude Code "external" skills, e.g. those installed by other tooling), and `~/.agents/skills`.
- **User config always wins.** A command you define yourself (or an OpenCode built-in) with the same name is never overwritten.

This is config-hook injection only — no files are written to your `~/.config/opencode/command/` directory, so nothing leaks across clients or persists on disk.

## Install

Add the plugin to your OpenCode config (`~/.config/opencode/opencode.jsonc` or project-level `.opencode/opencode.jsonc`):

```jsonc
{
  "plugin": ["opencode-claude-code-bridge@latest"]
}
```

If OpenCode already has an authoritative MCP catalog and you only want Claude
plugin skills and slash-command parity, disable Claude MCP discovery:

```jsonc
{
  "plugin": [["opencode-claude-code-bridge@latest", { "mcp": false }]]
}
```

This leaves explicit OpenCode MCP entries untouched and skips user-level,
project-level, and Claude-plugin-bundled MCP imports. Skill bridging remains
enabled. MCP import defaults to `true` for backward compatibility.

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
| Add/remove a skill (new `/<skill>` TUI slash command)                | OpenCode restart           |
| Edit the contents of a skill file (e.g. `SKILL.md` body)              | Immediately — skills are symlinked, not copied |

## Conflict resolution

If you have an MCP server name declared in both your `opencode.jsonc` and Claude's configs, your `opencode.jsonc` entry wins.

## Debugging

Set `OPENCODE_CLAUDE_CODE_BRIDGE_DEBUG=1` before launching OpenCode to log which MCPs, plugins, and skill command wrappers were discovered (the latter logs as `injected skill command wrappers: [...]`, or `desktop client — skipping…` under Desktop).

To confirm a skill is now a slash command in the TUI, check that it appears with `source: "command"`:

```bash
opencode debug skill   # lists discovered skills
# In the TUI, type `/` and your skill names should autocomplete.
```

## Publishing

This package publishes through GitHub Actions trusted publishing from
`.github/workflows/publish.yml`.

For maintainer release steps and verification, use:

- `.claude/skills/publish-package/SKILL.md`
