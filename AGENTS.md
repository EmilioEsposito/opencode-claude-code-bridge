# Agent/Developer Context

## Dev shim (local development)

OpenCode auto-discovers plugins by scanning `{plugin,plugins}/*.{ts,js}` under
`~/.config/opencode/` and `.opencode/`. For local dev, a one-line shim file at
`~/.config/opencode/plugins/claude-code-bridge.ts` re-exports this repo's entry
point:

```ts
export { default } from "/Users/eesposito/code/opencode-claude-code-bridge/src/index.ts"
```

If the repo moves, update that absolute path. When the package is published to
npm, end users won't need this shim — they add `"opencode-claude-code-bridge"`
to their `opencode.jsonc` `plugin` array and OpenCode installs it directly.

## How the plugin works

OpenCode plugins can return a `config` hook that receives the resolved config
object by reference. We mutate `cfg.mcp` to inject Claude Code's MCP server
definitions before OpenCode's MCP service reads them. This works because MCP
clients are constructed lazily on first tool call, after the config hook has run.

Skills are handled differently: OpenCode scans fixed directories for `SKILL.md`
files but doesn't look inside Claude plugin cache dirs. We bridge this by
symlinking each enabled plugin's `skills/<name>/` into `~/.config/opencode/skills/`.
A manifest at `~/.local/state/opencode-claude-code-bridge/skill-bridge.json`
tracks which symlinks we own so stale ones get cleaned up.

## Testing changes

```bash
cd ~/portfolio && OPENCODE_CLAUDE_CODE_BRIDGE_DEBUG=1 opencode mcp list --print-logs
```

- Verify injected MCPs appear in the list and debug lines show expected servers.
- `opencode mcp list --pure` is the baseline (skips all external plugins).
- `opencode debug skill` lists discovered skills — check that symlinked skills appear.

## File layout

| File | Purpose |
|---|---|
| `src/index.ts` | Plugin entry. Exports default Plugin function, wires up `config` hook. |
| `src/claude-config.ts` | Reads `~/.claude.json`, `<cwd>/.mcp.json`, user/project settings. Applies gating. |
| `src/claude-plugins.ts` | Reads `installed_plugins.json`, filters by `enabledPlugins`, scans for bundled MCPs. |
| `src/mcp-translate.ts` | Translates Claude `mcpServers` schema to OpenCode `mcp` schema. Handles `${VAR:-default}`. |
| `src/skill-bridge.ts` | Symlinks plugin-bundled skills into `~/.config/opencode/skills/`. Idempotent. |
| `src/paths.ts` | Centralizes all resolved paths (`CLAUDE_HOME`, state dir, skills dir, etc.). |
