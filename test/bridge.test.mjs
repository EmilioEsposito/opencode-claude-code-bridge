import assert from "node:assert/strict"
import { mkdir, mkdtemp, symlink, writeFile } from "node:fs/promises"
import { existsSync, realpathSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

const root = await mkdtemp(join(tmpdir(), "oc-claude-bridge-"))
const claudeHome = join(root, "claude")
const xdgConfig = join(root, "xdg-config")
const xdgState = join(root, "xdg-state")
const managedSettings = join(root, "managed-settings.json")
const managedDropIns = join(root, "managed-settings.d")
const projectDir = join(root, "project")

process.env.CLAUDE_HOME = claudeHome
process.env.XDG_CONFIG_HOME = xdgConfig
process.env.XDG_STATE_HOME = xdgState
process.env.OPENCODE_CLAUDE_CODE_BRIDGE_MANAGED_SETTINGS = managedSettings

await mkdir(join(claudeHome, "plugins"), { recursive: true })
await mkdir(managedDropIns, { recursive: true })
await mkdir(projectDir, { recursive: true })

const basePlugin = join(root, "plugins", "base", "5ad", "skills", "list-repos")
const tsindexPlugin = join(root, "plugins", "tsindex", "5ad", "skills", "tsindex")
await mkdir(basePlugin, { recursive: true })
await mkdir(tsindexPlugin, { recursive: true })
await writeFile(join(basePlugin, "SKILL.md"), "---\nname: list-repos\ndescription: lists repos\n---\n")
await writeFile(join(tsindexPlugin, "SKILL.md"), "---\nname: tsindex\ndescription: code nav\n---\n")

await writeFile(
  join(claudeHome, "plugins", "installed_plugins.json"),
  JSON.stringify(
    {
      version: 2,
      plugins: {
        "base@legalzoom-plugins": [
          { scope: "managed", installPath: join(root, "plugins", "base", "5ad"), version: "5ad" },
        ],
        "tsindex@legalzoom-plugins": [
          {
            scope: "managed",
            installPath: join(root, "plugins", "tsindex", "5ad"),
            version: "5ad",
          },
        ],
      },
    },
    null,
    2,
  ),
)
await writeFile(
  managedSettings,
  JSON.stringify({ enabledPlugins: { "base@legalzoom-plugins": true } }, null, 2),
)
await writeFile(
  join(managedDropIns, "30-tsindex.json"),
  JSON.stringify({ enabledPlugins: { "tsindex@legalzoom-plugins": true } }, null, 2),
)

const { enabledPlugins } = await import("../dist/claude-plugins.js")
const { bridgeSkills } = await import("../dist/skill-bridge.js")

test("managed settings and managed drop-ins enable Claude plugins", () => {
  const enabled = enabledPlugins(projectDir)
  assert.deepEqual(
    enabled.map((plugin) => plugin.key).sort(),
    ["base@legalzoom-plugins", "tsindex@legalzoom-plugins"],
  )
  assert.equal(enabled.find((plugin) => plugin.key === "base@legalzoom-plugins")?.scope, "managed")
})

test("skill bridge replaces dangling links with current managed plugin targets", async () => {
  const globalSkills = join(xdgConfig, "opencode", "skills")
  await mkdir(globalSkills, { recursive: true })
  const staleLink = join(globalSkills, "list-repos")
  await symlink(join(root, "plugins", "base", "old-missing", "skills", "list-repos"), staleLink, "dir")

  bridgeSkills(enabledPlugins(projectDir))

  assert.equal(realpathSync(staleLink), realpathSync(basePlugin))
  assert.equal(realpathSync(join(globalSkills, "tsindex")), realpathSync(tsindexPlugin))
  assert.equal(existsSync(join(xdgState, "opencode-claude-code-bridge", "skill-bridge.json")), true)
})
