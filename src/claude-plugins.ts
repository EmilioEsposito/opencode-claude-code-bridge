import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { CLAUDE_PLUGINS_INSTALLED } from "./paths.ts"
import { readUserSettings, readProjectSettings, type ClaudeMcpServer } from "./claude-config.ts"

type InstalledEntry = {
  scope: "user" | "project"
  projectPath?: string
  installPath: string
  version?: string
}

type InstalledFile = {
  version?: number
  plugins?: Record<string, InstalledEntry[]>
}

export type EnabledPlugin = {
  key: string // "<name>@<marketplace>"
  installPath: string
  scope: "user" | "project"
}

function readInstalled(): InstalledFile {
  if (!existsSync(CLAUDE_PLUGINS_INSTALLED)) return {}
  try {
    return JSON.parse(readFileSync(CLAUDE_PLUGINS_INSTALLED, "utf8")) as InstalledFile
  } catch {
    return {}
  }
}

/**
 * Resolve which Claude plugins are enabled for the given working directory,
 * applying user-level and project-level `enabledPlugins` settings.
 */
export function enabledPlugins(cwd: string): EnabledPlugin[] {
  const installed = readInstalled()
  if (!installed.plugins) return []
  const userEnabled = readUserSettings().enabledPlugins ?? {}
  const projectEnabled = readProjectSettings(cwd).enabledPlugins ?? {}

  const out: EnabledPlugin[] = []
  for (const [key, entries] of Object.entries(installed.plugins)) {
    const projectFlag = projectEnabled[key]
    const userFlag = userEnabled[key]
    // Project setting overrides user setting when present.
    const enabled = projectFlag ?? userFlag
    if (!enabled) continue

    // Prefer the matching scope's install entry when available.
    const projectEntry = entries.find((e) => e.scope === "project" && e.projectPath === cwd)
    const userEntry = entries.find((e) => e.scope === "user")
    const pick = projectEntry ?? userEntry ?? entries[0]
    if (!pick) continue
    out.push({ key, installPath: pick.installPath, scope: pick.scope })
  }
  return out
}

/**
 * Read MCP servers bundled inside a Claude plugin install directory.
 * Plugins commonly ship a `.mcp.json` or `.claude-plugin/mcp.json`.
 */
export function readPluginBundledMcp(installPath: string): Record<string, ClaudeMcpServer> {
  const candidates = [
    join(installPath, ".mcp.json"),
    join(installPath, ".claude-plugin", "mcp.json"),
  ]
  for (const path of candidates) {
    if (!existsSync(path)) continue
    try {
      const parsed = JSON.parse(readFileSync(path, "utf8")) as {
        mcpServers?: Record<string, ClaudeMcpServer>
      }
      if (parsed.mcpServers) return parsed.mcpServers
    } catch {
      // ignore malformed plugin mcp config
    }
  }
  return {}
}
