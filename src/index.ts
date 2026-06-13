import type { Plugin } from "@opencode-ai/plugin"
import { readUserMcp, readProjectMcp, readProjectSettings, filterProjectMcp } from "./claude-config.js"
import { enabledPlugins, readPluginBundledMcp } from "./claude-plugins.js"
import { translateAll, type OpencodeMcp } from "./mcp-translate.js"
import { bridgeSkills } from "./skill-bridge.js"
import { bridgeCommands, isDesktopClient } from "./command-bridge.js"

const DEBUG = process.env.OPENCODE_CLAUDE_CODE_BRIDGE_DEBUG === "1"
function log(...args: unknown[]): void {
  if (DEBUG) console.log("[opencode-claude-code-bridge]", ...args)
}

function collectClaudeMcp(cwd: string): Record<string, OpencodeMcp> {
  // user-level MCPs from ~/.claude.json
  const userMcp = readUserMcp()
  log("user mcp servers:", Object.keys(userMcp))

  // project-level MCPs from <cwd>/.mcp.json, narrowed by Claude's allowlist when present
  const projectSettings = readProjectSettings(cwd)
  const projectMcp = filterProjectMcp(readProjectMcp(cwd), projectSettings)
  log("project mcp servers (post-gating):", Object.keys(projectMcp))

  // MCPs bundled inside enabled Claude plugins
  const plugins = enabledPlugins(cwd)
  log("enabled claude plugins:", plugins.map((p) => p.key))
  const bundled: Record<string, ReturnType<typeof readPluginBundledMcp>[string]> = {}
  for (const p of plugins) {
    const bm = readPluginBundledMcp(p.installPath)
    for (const [name, def] of Object.entries(bm)) {
      bundled[name] = def
    }
  }

  // Merge with later sources winning (project > user > bundled). Project
  // settings are the most specific, so they should take precedence.
  const merged = { ...bundled, ...userMcp, ...projectMcp }
  return translateAll(merged, { CLAUDE_PROJECT_DIR: cwd })
}

const plugin: Plugin = async ({ directory }) => {
  return {
    config: async (cfg: any) => {
      try {
        const merged = collectClaudeMcp(directory)
        const existing = cfg.mcp ?? {}
        // OpenCode-declared entries win on conflict — user's explicit config beats discovery.
        cfg.mcp = { ...merged, ...existing }
        log("injected mcp servers:", Object.keys(merged))

        bridgeSkills(enabledPlugins(directory))

        // TUI/CLI clients don't render skills in the `/` slash palette the way
        // Desktop does. Inject command wrappers so every discovered skill is a
        // first-class `/<skill>` command there. Gated to non-Desktop clients to
        // avoid duplicating Desktop's native skill rendering.
        if (isDesktopClient()) {
          log("desktop client — skipping skill→command wrappers (native rendering)")
        } else {
          const wrapped = bridgeCommands(cfg)
          log("injected skill command wrappers:", wrapped)
        }
      } catch (err) {
        console.error("[opencode-claude-code-bridge] failed to apply Claude config:", err)
      }
    },
  }
}

export default plugin
