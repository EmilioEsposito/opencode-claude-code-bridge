import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs"
import { join } from "node:path"
import { SKILL_ROOTS } from "./paths.js"

/**
 * Why this module exists
 * ----------------------
 * OpenCode discovers skills and exposes them to the model via the `skill`
 * tool, and the server also lists each skill in the `/command` API with
 * `source: "skill"`. The OpenCode **Desktop** client renders those skill
 * entries directly in its `/` slash menu. The **TUI** client does NOT — its
 * slash palette only renders entries with `source: "command"`, so skills are
 * reachable in the TUI only via the `/skills` picker, never as first-class
 * `/<name>` slash commands.
 *
 * This module closes that gap WITHOUT creating duplicates in Desktop. The
 * plugin runs inside each client's own server process, so we gate on the
 * client: only non-Desktop clients (TUI / CLI / headless) get the injected
 * command wrappers. Desktop is left exactly as-is.
 *
 * Mechanism: in the plugin `config` hook we add `cfg.command[<skill>]` entries
 * whose `template` is a tiny *shim* that instructs the agent to invoke the
 * skill via its `skill` tool. We deliberately do NOT inline the skill body:
 * a command template becomes the user's message text, so inlining would dump
 * the entire SKILL.md into the transcript as the user turn. The shim keeps the
 * user message one line; the skill body then loads where it belongs — as the
 * `skill` tool result. Injecting a command with the same name as a skill
 * *replaces* the skill entry in the `/command` list (verified against OpenCode
 * 1.17.4), so the TUI shows one `source: "command"` entry per skill and there
 * is no duplication. A user- or config-declared command of the same name
 * always wins (we never overwrite an existing `cfg.command` entry).
 */

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

type ParsedSkill = {
  name: string
  description?: string
}

/**
 * Minimal YAML-frontmatter scalar reader. We only need top-level `name` and
 * `description`; we intentionally do not pull in a YAML dependency. Values may
 * be quoted or bare; everything after the first colon on the line is the value.
 */
function readScalar(frontmatter: string, key: string): string | undefined {
  const re = new RegExp(`^${key}:[ \\t]*(.*)$`, "m")
  const m = frontmatter.match(re)
  if (!m) return undefined
  let v = m[1].trim()
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1)
  }
  return v || undefined
}

function parseSkillFile(skillMdPath: string, dirName: string): ParsedSkill | null {
  let raw: string
  try {
    raw = readFileSync(skillMdPath, "utf8")
  } catch {
    return null
  }
  const m = raw.match(FRONTMATTER)
  // Skills require frontmatter; OpenCode itself ignores SKILL.md without it.
  if (!m) return null
  const frontmatter = m[1]
  const name = readScalar(frontmatter, "name") || dirName
  const description = readScalar(frontmatter, "description")
  return { name, description }
}

/**
 * Enumerate every skill OpenCode would discover across SKILL_ROOTS, in scan
 * order. The first occurrence of a given skill name wins, matching OpenCode's
 * own precedence (earlier roots shadow later ones). Returns a map keyed by
 * skill name so the caller can build command wrappers without dedup logic.
 */
export function discoverSkills(): Map<string, ParsedSkill> {
  const skills = new Map<string, ParsedSkill>()
  const seenDirs = new Set<string>()

  for (const root of SKILL_ROOTS) {
    if (!existsSync(root)) continue
    let entries: string[]
    try {
      entries = readdirSync(root)
    } catch {
      continue
    }
    for (const dirName of entries) {
      if (dirName.startsWith(".")) continue
      const skillDir = join(root, dirName)
      // Resolve symlinks (the skill bridge populates the global root with
      // symlinks) and dedup by real path so a skill reachable through two
      // roots is only read once.
      let realDir: string
      try {
        if (!statSync(skillDir).isDirectory()) continue
        realDir = realpathSync(skillDir)
      } catch {
        continue
      }
      if (seenDirs.has(realDir)) continue
      seenDirs.add(realDir)

      const skillMd = join(skillDir, "SKILL.md")
      if (!existsSync(skillMd)) continue
      const parsed = parseSkillFile(skillMd, dirName)
      if (!parsed) continue
      // First root wins on name collision.
      if (!skills.has(parsed.name)) skills.set(parsed.name, parsed)
    }
  }
  return skills
}

export type OpencodeCommand = {
  template: string
  description?: string
}

/**
 * True when running under the OpenCode Desktop client, which already renders
 * skills as first-class slash entries. We skip command-wrapper injection there
 * to avoid replacing Desktop's native skill rendering / creating confusion.
 * Every other client (TUI, CLI `run`, headless) leaves OPENCODE_CLIENT unset
 * or set to a non-desktop value and benefits from the wrappers.
 */
export function isDesktopClient(): boolean {
  return (process.env.OPENCODE_CLIENT || "").toLowerCase() === "desktop"
}

/**
 * Build the one-line shim that becomes the command's prompt text. It directs
 * the agent to load the skill through its `skill` tool (so the body arrives as
 * a tool result, not as the user message) and forwards any slash arguments.
 * `$ARGUMENTS` is substituted by OpenCode with whatever the user typed after
 * the command name (empty string when none).
 */
function shimTemplate(name: string): string {
  return [
    `Invoke the \`${name}\` skill now using your \`skill\` tool (skill name: "${name}").`,
    `Follow its instructions. Additional user arguments (may be empty): $ARGUMENTS`,
  ].join("\n")
}

/**
 * Inject a `source: "command"` wrapper into `cfg.command` for each discovered
 * skill, so the OpenCode TUI surfaces `/<skill>` in its slash palette. The
 * wrapper template is a tiny shim that invokes the skill via the `skill` tool
 * (see shimTemplate) — it does NOT inline the skill body, so the user's message
 * stays one line and the body loads as the skill tool result.
 *
 * Returns the names of skills that were wrapped (for debug logging).
 *
 * Invariants:
 * - No-op (returns []) under Desktop.
 * - Never overwrites an existing cfg.command entry (explicit user/config
 *   commands and OpenCode built-ins win).
 */
export function bridgeCommands(cfg: { command?: Record<string, OpencodeCommand> }): string[] {
  if (isDesktopClient()) return []

  const skills = discoverSkills()
  if (skills.size === 0) return []

  const command: Record<string, OpencodeCommand> = cfg.command ?? {}
  const wrapped: string[] = []

  for (const [name, skill] of skills) {
    // Respect anything already defined (user config, other plugins, built-ins).
    if (Object.prototype.hasOwnProperty.call(command, name)) continue

    command[name] = {
      template: shimTemplate(name),
      ...(skill.description ? { description: skill.description } : {}),
    }
    wrapped.push(name)
  }

  if (wrapped.length > 0) cfg.command = command
  return wrapped
}
