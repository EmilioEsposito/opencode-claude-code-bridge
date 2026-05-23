import { homedir } from "node:os"
import { join } from "node:path"

export const HOME = homedir()
export const CLAUDE_HOME = process.env.CLAUDE_HOME || join(HOME, ".claude")
export const CLAUDE_USER_CONFIG = join(HOME, ".claude.json")
export const CLAUDE_USER_SETTINGS = join(CLAUDE_HOME, "settings.json")
export const CLAUDE_PLUGINS_INSTALLED = join(CLAUDE_HOME, "plugins", "installed_plugins.json")

export const OPENCODE_GLOBAL_SKILLS = join(
  process.env.XDG_CONFIG_HOME || join(HOME, ".config"),
  "opencode",
  "skills",
)

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
