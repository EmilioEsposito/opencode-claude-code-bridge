import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
  lstatSync,
  realpathSync,
  statSync,
} from "node:fs"
import { join } from "node:path"
import { BRIDGE_STATE_DIR, OPENCODE_GLOBAL_SKILLS } from "./paths.ts"
import type { EnabledPlugin } from "./claude-plugins.ts"

const MANIFEST = join(BRIDGE_STATE_DIR, "skill-bridge.json")

type Manifest = {
  // map of symlink path -> target path it points to
  symlinks: Record<string, string>
}

function readManifest(): Manifest {
  if (!existsSync(MANIFEST)) return { symlinks: {} }
  try {
    return JSON.parse(readFileSync(MANIFEST, "utf8")) as Manifest
  } catch {
    return { symlinks: {} }
  }
}

function writeManifest(m: Manifest): void {
  mkdirSync(BRIDGE_STATE_DIR, { recursive: true })
  writeFileSync(MANIFEST, JSON.stringify(m, null, 2))
}

function isOurSymlink(path: string, expectedTarget: string): boolean {
  try {
    const st = lstatSync(path)
    if (!st.isSymbolicLink()) return false
    return realpathSync(path) === realpathSync(expectedTarget)
  } catch {
    return false
  }
}

/**
 * For each enabled Claude plugin that ships a `skills/` directory, ensure a
 * symlink exists at `~/.config/opencode/skills/<skill-name>` pointing at the
 * plugin's skill directory. Idempotent and cleans up symlinks for plugins
 * that are no longer enabled.
 */
export function bridgeSkills(plugins: EnabledPlugin[]): void {
  const manifest = readManifest()
  const desired: Record<string, string> = {}

  for (const plugin of plugins) {
    const skillsDir = join(plugin.installPath, "skills")
    if (!existsSync(skillsDir)) continue
    let entries: string[]
    try {
      entries = readdirSync(skillsDir)
    } catch {
      continue
    }
    for (const name of entries) {
      const target = join(skillsDir, name)
      try {
        if (!statSync(target).isDirectory()) continue
      } catch {
        continue
      }
      const link = join(OPENCODE_GLOBAL_SKILLS, name)
      desired[link] = target
    }
  }

  mkdirSync(OPENCODE_GLOBAL_SKILLS, { recursive: true })

  // Remove stale symlinks we previously created.
  for (const [link, target] of Object.entries(manifest.symlinks)) {
    if (desired[link] === target) continue
    if (isOurSymlink(link, target)) {
      try {
        unlinkSync(link)
      } catch {
        // best-effort cleanup
      }
    }
  }

  // Create or refresh desired symlinks.
  for (const [link, target] of Object.entries(desired)) {
    if (isOurSymlink(link, target)) continue
    if (existsSync(link)) {
      // A real directory or foreign symlink lives here — don't clobber it.
      continue
    }
    try {
      symlinkSync(target, link, "dir")
    } catch {
      // ignore individual failures (e.g. permission)
    }
  }

  writeManifest({ symlinks: desired })
}
