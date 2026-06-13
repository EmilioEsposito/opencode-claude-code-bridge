import { homedir } from "node:os"
import { dirname, join } from "node:path"

export const HOME = homedir()
export const CLAUDE_HOME = process.env.CLAUDE_HOME || join(HOME, ".claude")
export const CLAUDE_USER_CONFIG = join(HOME, ".claude.json")
export const CLAUDE_USER_SETTINGS = join(CLAUDE_HOME, "settings.json")
export const CLAUDE_PLUGINS_INSTALLED = join(CLAUDE_HOME, "plugins", "installed_plugins.json")
export const CLAUDE_MANAGED_SETTINGS =
  process.env.OPENCODE_CLAUDE_CODE_BRIDGE_MANAGED_SETTINGS ||
  join("/Library", "Application Support", "ClaudeCode", "managed-settings.json")
export const CLAUDE_MANAGED_SETTINGS_D = join(dirname(CLAUDE_MANAGED_SETTINGS), "managed-settings.d")

export const OPENCODE_CONFIG_DIR = join(
  process.env.XDG_CONFIG_HOME || join(HOME, ".config"),
  "opencode",
)

export const OPENCODE_GLOBAL_SKILLS = join(OPENCODE_CONFIG_DIR, "skills")

// Skill roots OpenCode auto-discovers, in the order it scans them. The command
// bridge enumerates these to build TUI slash-command wrappers for every skill.
// - OPENCODE_GLOBAL_SKILLS holds both OpenCode-native global skills and the
//   plugin-bundled skills this bridge symlinks in (see skill-bridge.ts).
// - ~/.claude/skills and ~/.agents/skills are "external" roots OpenCode loads
//   directly; they are NOT touched by skill-bridge.ts, so the command bridge is
//   the only place they get slash-command parity.
export const SKILL_ROOTS = [
  OPENCODE_GLOBAL_SKILLS,
  join(CLAUDE_HOME, "skills"),
  join(HOME, ".agents", "skills"),
]

export const BRIDGE_STATE_DIR = join(
  process.env.XDG_STATE_HOME || join(HOME, ".local", "state"),
  "opencode-claude-code-bridge",
)

export function projectSettingsPath(cwd: string): string {
  return join(cwd, ".claude", "settings.json")
}

export function projectMcpPath(cwd: string): string {
  return join(cwd, ".mcp.json")
}
