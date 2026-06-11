import { readFileSync, existsSync } from "node:fs"
import {
  CLAUDE_USER_CONFIG,
  CLAUDE_USER_SETTINGS,
  projectMcpPath,
  projectSettingsPath,
} from "./paths.js"

export type ClaudeMcpServer = {
  type?: "stdio" | "http" | "sse"
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  headers?: Record<string, string>
}

export type ClaudeSettings = {
  enableAllProjectMcpServers?: boolean
  enabledMcpjsonServers?: string[]
  enabledPlugins?: Record<string, boolean>
}

function readJson<T>(path: string): T | undefined {
  if (!existsSync(path)) return undefined
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T
  } catch {
    return undefined
  }
}

export function readUserMcp(): Record<string, ClaudeMcpServer> {
  const cfg = readJson<{ mcpServers?: Record<string, ClaudeMcpServer> }>(CLAUDE_USER_CONFIG)
  return cfg?.mcpServers ?? {}
}

export function readUserSettings(): ClaudeSettings {
  return readJson<ClaudeSettings>(CLAUDE_USER_SETTINGS) ?? {}
}

export function readProjectSettings(cwd: string): ClaudeSettings {
  return readJson<ClaudeSettings>(projectSettingsPath(cwd)) ?? {}
}

export function readProjectMcp(cwd: string): Record<string, ClaudeMcpServer> {
  const cfg = readJson<{ mcpServers?: Record<string, ClaudeMcpServer> }>(projectMcpPath(cwd))
  return cfg?.mcpServers ?? {}
}

/**
 * Import project-level .mcp.json by default so OpenCode can use local MCPs
 * without a separate Claude approval step. If Claude project settings include
 * enabledMcpjsonServers, respect that explicit allowlist.
 */
export function filterProjectMcp(
  servers: Record<string, ClaudeMcpServer>,
  projectSettings: ClaudeSettings,
): Record<string, ClaudeMcpServer> {
  if (projectSettings.enableAllProjectMcpServers) return servers
  if (!Object.prototype.hasOwnProperty.call(projectSettings, "enabledMcpjsonServers")) return servers
  const allow = new Set(projectSettings.enabledMcpjsonServers ?? [])
  if (allow.size === 0) return {}
  const out: Record<string, ClaudeMcpServer> = {}
  for (const [name, def] of Object.entries(servers)) {
    if (allow.has(name)) out[name] = def
  }
  return out
}
