import { readFileSync, existsSync, readdirSync, statSync } from "node:fs"
import { join } from "node:path"
import {
  CLAUDE_MANAGED_SETTINGS,
  CLAUDE_MANAGED_SETTINGS_D,
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function deepMerge(base: unknown, next: unknown): unknown {
  if (Array.isArray(base) && Array.isArray(next)) {
    const out = [...base]
    const seen = new Set(out.map((item) => JSON.stringify(item)))
    for (const item of next) {
      const key = JSON.stringify(item)
      if (seen.has(key)) continue
      seen.add(key)
      out.push(item)
    }
    return out
  }
  if (isPlainObject(base) && isPlainObject(next)) {
    const out: Record<string, unknown> = { ...base }
    for (const [key, value] of Object.entries(next)) {
      out[key] = key in out ? deepMerge(out[key], value) : value
    }
    return out
  }
  return next
}

function managedDropInPaths(): string[] {
  if (!existsSync(CLAUDE_MANAGED_SETTINGS_D)) return []
  try {
    return readdirSync(CLAUDE_MANAGED_SETTINGS_D)
      .filter((name) => name.endsWith(".json") && !name.startsWith("."))
      .sort()
      .map((name) => join(CLAUDE_MANAGED_SETTINGS_D, name))
      .filter((path) => {
        try {
          return statSync(path).isFile()
        } catch {
          return false
        }
      })
  } catch {
    return []
  }
}

export function readUserMcp(): Record<string, ClaudeMcpServer> {
  const cfg = readJson<{ mcpServers?: Record<string, ClaudeMcpServer> }>(CLAUDE_USER_CONFIG)
  return cfg?.mcpServers ?? {}
}

export function readUserSettings(): ClaudeSettings {
  return readJson<ClaudeSettings>(CLAUDE_USER_SETTINGS) ?? {}
}

export function readManagedSettings(): ClaudeSettings {
  let merged: unknown = readJson<Record<string, unknown>>(CLAUDE_MANAGED_SETTINGS) ?? {}
  for (const path of managedDropInPaths()) {
    const fragment = readJson<Record<string, unknown>>(path)
    if (!fragment) continue
    merged = deepMerge(merged, fragment)
  }
  return (isPlainObject(merged) ? merged : {}) as ClaudeSettings
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
