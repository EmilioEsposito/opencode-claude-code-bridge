This was the original prompt Emilio hand wrote to accomplish this work. 

# Context

I want to make migration from Claude Code to OpenCode seamless, and even want OpenCode to dynamically keep itself up to date with all skills, mcp configs, and plugins that Claude Code has. 

Claude Code is most popular right now and will continue to be, but I am betting OpenCode will be able to take ground *if* we can make switching to it seamless without rework. 


OpenCode has already done this with standalone skills. For example, from their docs:

"OpenCode already searches these locations for skills
Project config: .opencode/skills/<name>/SKILL.md
Global config: ~/.config/opencode/skills/<name>/SKILL.md
Project Claude-compatible: .claude/skills/<name>/SKILL.md
Global Claude-compatible: ~/.claude/skills/<name>/SKILL.md
Project agent-compatible: .agents/skills/<name>/SKILL.md
Global agent-compatible: ~/.agents/skills/<name>/SKILL.md" 
   - source: https://opencode.ai/docs/skills/


# Targeted Goal
Allow OpenCode to also search claude code native locations for MCP configs and Plugins. In Claude Code, plugins are basically collections of bundled things like skills, mcp configs, and other stuff (like agent configs). Skills and MCP configs are highest priority, other things are nice to have.

My initial thoguht is to create an [OpenCode plugin](https://opencode.ai/docs/plugins/) to achieve this. Don't conflate OpenCode Plugins with Claude Code Plugins, they appear to serve different things. It seems to me that Claude Code Plugins are more like configs, while OpenCode Plugins actually affect how the OpenCode harness itself can behave (e.g. OpenCode plugins are actually *code*). A core requirement here is scalability across many users. Ideally, users just add a couple lines to their user-level (or managed) opencode.jsonc file once time, and forever-more OpenCode will just pickup their Claude Code MCP configs and plugins. 

## Existing research I've done has revealed that Claude Code uses this framework for MCP configs and plugins. Do your own validation as well:
 
#### mcp config
##### user level MCP
~/.claude.json

#####project level .mcp.json
some-project/.mcp.json

#### plugin compatibility

##### user level plugins
~/.claude/plugins/<some relevant files/folders?>
I think /Users/eesposito/.claude/plugins/installed_plugins.json is key, as well as I think the cache folder it points to

##### project level plugins (Example repo: portfolio Example plugin: frontend-design)
portfolio/.claude/settings.json enabledPlugins key (entry here)
~/.claude/plugins/installed_plugins.json (entry here)
~/.claude/plugins/cache/claude-plugins-official/frontend-design


# Testing
You should validate your changes work (i.e. see if both OpenCode is actually picking up the changes, and validate that it's currently already working in Claude Code). You can do things like spinup "claude" and "opencode" cli runs in my ~/portfolio repo for project level testing. If you run out of OpenCode token usage, let me know and I'll buy more. Don't compromise ability to test. 


# Other Resources:
https://opencode.ai/docs/plugins/
https://code.claude.com/docs/en/mcp#mcp-installation-scopes
https://code.claude.com/docs/en/discover-plugins
https://code.claude.com/docs/en/settings#configuration-scopes

