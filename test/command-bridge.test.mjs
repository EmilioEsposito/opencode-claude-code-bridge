import assert from "node:assert/strict"
import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

// Isolate all path roots under a temp dir BEFORE importing the module (paths.ts
// reads env at import time).
const root = await mkdtemp(join(tmpdir(), "oc-cmd-bridge-"))
const claudeHome = join(root, "claude")
const xdgConfig = join(root, "xdg-config")
const home = join(root, "home")

process.env.CLAUDE_HOME = claudeHome
process.env.XDG_CONFIG_HOME = xdgConfig
process.env.HOME = home
process.env.USERPROFILE = home

const globalSkills = join(xdgConfig, "opencode", "skills")
const claudeSkills = join(claudeHome, "skills")
const agentsSkills = join(home, ".agents", "skills")

// A plugin-bridged/global skill (list-repos), an external native skill (share),
// an agents-root skill, and one without frontmatter (must be ignored).
await mkdir(join(globalSkills, "list-repos"), { recursive: true })
await writeFile(
  join(globalSkills, "list-repos", "SKILL.md"),
  "---\nname: list-repos\ndescription: List git repos\n---\n# List Repos\n\nRun gh repo list.\n",
)

await mkdir(join(claudeSkills, "share"), { recursive: true })
await writeFile(
  join(claudeSkills, "share", "SKILL.md"),
  '---\nname: share\ndescription: "Publish learnings"\n---\nShare body here.\n',
)

await mkdir(join(agentsSkills, "agento"), { recursive: true })
await writeFile(
  join(agentsSkills, "agento", "SKILL.md"),
  "---\nname: agento\ndescription: agent skill\n---\nBody.\n",
)

await mkdir(join(globalSkills, "nofrontmatter"), { recursive: true })
await writeFile(join(globalSkills, "nofrontmatter", "SKILL.md"), "# just a heading, no frontmatter\n")

const { discoverSkills, bridgeCommands, isDesktopClient } = await import("../dist/command-bridge.js")

test("discoverSkills finds skills across all roots and skips frontmatter-less files", () => {
  const skills = discoverSkills()
  assert.equal(skills.has("list-repos"), true)
  assert.equal(skills.has("share"), true)
  assert.equal(skills.has("agento"), true)
  assert.equal(skills.has("nofrontmatter"), false)
  assert.equal(skills.get("share").description, "Publish learnings")
})

test("bridgeCommands injects source=command shim wrappers for non-desktop clients", () => {
  delete process.env.OPENCODE_CLIENT
  const cfg = {}
  const wrapped = bridgeCommands(cfg)
  assert.ok(wrapped.includes("list-repos"))
  assert.ok(wrapped.includes("share"))
  const tmpl = cfg.command["list-repos"].template
  // Shim invokes the skill tool by name — does NOT inline the skill body.
  assert.ok(tmpl.includes("`list-repos` skill"))
  assert.ok(tmpl.includes("skill"))
  assert.ok(!tmpl.includes("Run gh repo list."), "skill body must not be inlined")
  // arguments passthrough present
  assert.ok(tmpl.includes("$ARGUMENTS"))
  // shim stays short (one-liner-ish), not a body dump
  assert.ok(tmpl.length < 300, "shim should be small")
  assert.equal(cfg.command["share"].description, "Publish learnings")
})

test("bridgeCommands is a no-op under the desktop client", () => {
  process.env.OPENCODE_CLIENT = "desktop"
  assert.equal(isDesktopClient(), true)
  const cfg = {}
  const wrapped = bridgeCommands(cfg)
  assert.deepEqual(wrapped, [])
  assert.equal(cfg.command, undefined)
  delete process.env.OPENCODE_CLIENT
})

test("bridgeCommands never overwrites an existing command entry", () => {
  delete process.env.OPENCODE_CLIENT
  const cfg = { command: { share: { template: "USER WINS", description: "user" } } }
  bridgeCommands(cfg)
  assert.equal(cfg.command["share"].template, "USER WINS")
  assert.equal(cfg.command["share"].description, "user")
  // other skills still injected alongside the preserved one
  assert.ok(cfg.command["list-repos"])
})
