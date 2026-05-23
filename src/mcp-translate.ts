import type { ClaudeMcpServer } from "./claude-config.ts"

export type OpencodeMcpLocal = {
  type: "local"
  command: string[]
  environment?: Record<string, string>
  enabled?: boolean
}

export type OpencodeMcpRemote = {
  type: "remote"
  url: string
  headers?: Record<string, string>
  enabled?: boolean
}

export type OpencodeMcp = OpencodeMcpLocal | OpencodeMcpRemote

/**
 * Expand `${VAR}` and `${VAR:-default}` references using process.env, matching
 * Claude Code's .mcp.json substitution behavior. Unknown vars with no default
 * are left as the empty string (same as Claude).
 */
export function expandEnv(input: string): string {
  return input.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}/g, (_, name, def) => {
    const v = process.env[name]
    if (v !== undefined && v !== "") return v
    return def ?? ""
  })
}

function expandStrings<T>(value: T): T {
  if (typeof value === "string") return expandEnv(value) as unknown as T
  if (Array.isArray(value)) return value.map(expandStrings) as unknown as T
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = expandStrings(v)
    }
    return out as T
  }
  return value
}

export function translate(name: string, claude: ClaudeMcpServer): OpencodeMcp | null {
  const c = expandStrings(claude)
  const isRemote = c.type === "http" || c.type === "sse" || (!c.type && !!c.url)
  if (isRemote) {
    if (!c.url) return null
    const out: OpencodeMcpRemote = { type: "remote", url: c.url }
    if (c.headers && Object.keys(c.headers).length > 0) out.headers = c.headers
    return out
  }
  // stdio (default when command is present)
  if (!c.command) return null
  const command = [c.command, ...(c.args ?? [])]
  const out: OpencodeMcpLocal = { type: "local", command }
  if (c.env && Object.keys(c.env).length > 0) out.environment = c.env
  return out
}

export function translateAll(
  servers: Record<string, ClaudeMcpServer>,
): Record<string, OpencodeMcp> {
  const out: Record<string, OpencodeMcp> = {}
  for (const [name, def] of Object.entries(servers)) {
    const t = translate(name, def)
    if (t) out[name] = t
  }
  return out
}
