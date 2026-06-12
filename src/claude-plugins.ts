import { readFileSync, existsSync } from "node:fs"
import { join } from "node:path"
import { CLAUDE_PLUGINS_INSTALLED } from "./paths.js"
import {
  readManagedSettings,
  readUserSettings,
  readProjectSettings,
  type ClaudeMcpServer,
} from "./claude-config.js"

type InstalledEntry = {
  scope: string
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
  scope: string
}

function hasOwn(obj: Record<string, boolean>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key)
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
  const managedEnabled = readManagedSettings().enabledPlugins ?? {}
  const userEnabled = readUserSettings().enabledPlugins ?? {}
  const projectEnabled = readProjectSettings(cwd).enabledPlugins ?? {}

  const out: EnabledPlugin[] = []
  for (const [key, entries] of Object.entries(installed.plugins)) {
    const managedHasFlag = hasOwn(managedEnabled, key)
    const projectHasFlag = hasOwn(projectEnabled, key)
    const userHasFlag = hasOwn(userEnabled, key)
    // Managed settings are policy, so they win when present. Otherwise mirror
    // Claude's local precedence: project settings override user settings.
    const enabled = managedHasFlag
      ? managedEnabled[key]
      : projectHasFlag
        ? projectEnabled[key]
        : userHasFlag
          ? userEnabled[key]
          : false
    if (!enabled) continue

    // Prefer the matching scope's install entry when available. Claude managed
    // plugins use scope="managed"; locally installed project plugins may use
    // either scope="project" or scope="local" depending on Claude Code version.
    const managedEntry = entries.find((e) => e.scope === "managed")
    const projectEntry = entries.find(
      (e) => (e.scope === "project" || e.scope === "local") && e.projectPath === cwd,
    )
    const userEntry = entries.find((e) => e.scope === "user")
    const pick = managedHasFlag
      ? managedEntry ?? projectEntry ?? userEntry ?? entries[0]
      : projectHasFlag
        ? projectEntry ?? userEntry ?? managedEntry ?? entries[0]
        : userEntry ?? projectEntry ?? managedEntry ?? entries[0]
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
