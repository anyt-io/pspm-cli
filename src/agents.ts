/**
 * Agent configuration for skill symlinks.
 *
 * Defines where different AI coding agents expect skills to be located.
 */

import { checkbox } from "@inquirer/prompts";
import type { AgentConfig, BuiltInAgent } from "./lib/index";

/**
 * Agent metadata for display purposes.
 */
export interface AgentInfo {
	/** Human-readable name for display */
	displayName: string;
	/** Skills directory path (project-level, relative to project root) */
	skillsDir: string;
	/** Global skills directory path (relative to home directory) */
	globalSkillsDir: string;
}

/**
 * Default agent configurations with display names.
 * These can be overridden in pspm.json under the "agents" key.
 */
export const AGENT_INFO: Record<BuiltInAgent, AgentInfo> = {
	adal: {
		displayName: "AdaL",
		skillsDir: ".adal/skills",
		globalSkillsDir: ".adal/skills",
	},
	amp: {
		displayName: "Amp",
		skillsDir: ".agents/skills",
		globalSkillsDir: ".config/agents/skills",
	},
	antigravity: {
		displayName: "Antigravity",
		skillsDir: ".agent/skills",
		globalSkillsDir: ".gemini/antigravity/skills",
	},
	augment: {
		displayName: "Augment",
		skillsDir: ".augment/skills",
		globalSkillsDir: ".augment/skills",
	},
	"claude-code": {
		displayName: "Claude Code",
		skillsDir: ".claude/skills",
		globalSkillsDir: ".claude/skills",
	},
	cline: {
		displayName: "Cline",
		skillsDir: ".agents/skills",
		globalSkillsDir: ".agents/skills",
	},
	codebuddy: {
		displayName: "CodeBuddy",
		skillsDir: ".codebuddy/skills",
		globalSkillsDir: ".codebuddy/skills",
	},
	codex: {
		displayName: "Codex",
		skillsDir: ".agents/skills",
		globalSkillsDir: ".codex/skills",
	},
	"command-code": {
		displayName: "Command Code",
		skillsDir: ".commandcode/skills",
		globalSkillsDir: ".commandcode/skills",
	},
	continue: {
		displayName: "Continue",
		skillsDir: ".continue/skills",
		globalSkillsDir: ".continue/skills",
	},
	cortex: {
		displayName: "Cortex Code",
		skillsDir: ".cortex/skills",
		globalSkillsDir: ".snowflake/cortex/skills",
	},
	crush: {
		displayName: "Crush",
		skillsDir: ".crush/skills",
		globalSkillsDir: ".config/crush/skills",
	},
	cursor: {
		displayName: "Cursor",
		skillsDir: ".agents/skills",
		globalSkillsDir: ".cursor/skills",
	},
	droid: {
		displayName: "Droid",
		skillsDir: ".factory/skills",
		globalSkillsDir: ".factory/skills",
	},
	"gemini-cli": {
		displayName: "Gemini CLI",
		skillsDir: ".agents/skills",
		globalSkillsDir: ".gemini/skills",
	},
	"github-copilot": {
		displayName: "GitHub Copilot",
		skillsDir: ".agents/skills",
		globalSkillsDir: ".copilot/skills",
	},
	goose: {
		displayName: "Goose",
		skillsDir: ".goose/skills",
		globalSkillsDir: ".config/goose/skills",
	},
	"iflow-cli": {
		displayName: "iFlow CLI",
		skillsDir: ".iflow/skills",
		globalSkillsDir: ".iflow/skills",
	},
	junie: {
		displayName: "Junie",
		skillsDir: ".junie/skills",
		globalSkillsDir: ".junie/skills",
	},
	kilo: {
		displayName: "Kilo Code",
		skillsDir: ".kilocode/skills",
		globalSkillsDir: ".kilocode/skills",
	},
	"kimi-cli": {
		displayName: "Kimi Code CLI",
		skillsDir: ".agents/skills",
		globalSkillsDir: ".config/agents/skills",
	},
	"kiro-cli": {
		displayName: "Kiro CLI",
		skillsDir: ".kiro/skills",
		globalSkillsDir: ".kiro/skills",
	},
	kode: {
		displayName: "Kode",
		skillsDir: ".kode/skills",
		globalSkillsDir: ".kode/skills",
	},
	mcpjam: {
		displayName: "MCPJam",
		skillsDir: ".mcpjam/skills",
		globalSkillsDir: ".mcpjam/skills",
	},
	"mistral-vibe": {
		displayName: "Mistral Vibe",
		skillsDir: ".vibe/skills",
		globalSkillsDir: ".vibe/skills",
	},
	mux: {
		displayName: "Mux",
		skillsDir: ".mux/skills",
		globalSkillsDir: ".mux/skills",
	},
	neovate: {
		displayName: "Neovate",
		skillsDir: ".neovate/skills",
		globalSkillsDir: ".neovate/skills",
	},
	openclaw: {
		displayName: "OpenClaw",
		skillsDir: "skills",
		globalSkillsDir: ".openclaw/skills",
	},
	opencode: {
		displayName: "OpenCode",
		skillsDir: ".agents/skills",
		globalSkillsDir: ".config/opencode/skills",
	},
	openhands: {
		displayName: "OpenHands",
		skillsDir: ".openhands/skills",
		globalSkillsDir: ".openhands/skills",
	},
	pi: {
		displayName: "Pi",
		skillsDir: ".pi/skills",
		globalSkillsDir: ".pi/agent/skills",
	},
	pochi: {
		displayName: "Pochi",
		skillsDir: ".pochi/skills",
		globalSkillsDir: ".pochi/skills",
	},
	qoder: {
		displayName: "Qoder",
		skillsDir: ".qoder/skills",
		globalSkillsDir: ".qoder/skills",
	},
	"qwen-code": {
		displayName: "Qwen Code",
		skillsDir: ".qwen/skills",
		globalSkillsDir: ".qwen/skills",
	},
	replit: {
		displayName: "Replit",
		skillsDir: ".agents/skills",
		globalSkillsDir: ".config/agents/skills",
	},
	roo: {
		displayName: "Roo Code",
		skillsDir: ".roo/skills",
		globalSkillsDir: ".roo/skills",
	},
	trae: {
		displayName: "Trae",
		skillsDir: ".trae/skills",
		globalSkillsDir: ".trae/skills",
	},
	"trae-cn": {
		displayName: "Trae CN",
		skillsDir: ".trae/skills",
		globalSkillsDir: ".trae-cn/skills",
	},
	universal: {
		displayName: "Universal",
		skillsDir: ".agents/skills",
		globalSkillsDir: ".config/agents/skills",
	},
	windsurf: {
		displayName: "Windsurf",
		skillsDir: ".windsurf/skills",
		globalSkillsDir: ".codeium/windsurf/skills",
	},
	zencoder: {
		displayName: "Zencoder",
		skillsDir: ".zencoder/skills",
		globalSkillsDir: ".zencoder/skills",
	},
};

/**
 * Default agent configurations (AgentConfig format).
 */
export const DEFAULT_AGENT_CONFIGS: Record<BuiltInAgent, AgentConfig> =
	Object.fromEntries(
		Object.entries(AGENT_INFO).map(([key, info]) => [
			key,
			{ skillsDir: info.skillsDir },
		]),
	) as Record<BuiltInAgent, AgentConfig>;

/**
 * All built-in agent names in display order.
 */
export const ALL_AGENTS: BuiltInAgent[] = Object.keys(
	AGENT_INFO,
).sort() as BuiltInAgent[];

/**
 * Resolve agent configuration by name.
 *
 * @param name - Agent name (built-in or custom)
 * @param overrides - Custom agent configurations from pspm.json
 * @param global - If true, return global paths instead of project paths
 * @returns Agent configuration or null if not found
 *
 * @example
 * ```typescript
 * resolveAgentConfig("claude-code")
 * // => { skillsDir: ".claude/skills" }
 *
 * resolveAgentConfig("claude-code", undefined, true)
 * // => { skillsDir: ".claude/skills" } (global path, used relative to ~)
 *
 * resolveAgentConfig("my-custom", { "my-custom": { skillsDir: ".myagent/prompts" } })
 * // => { skillsDir: ".myagent/prompts" }
 * ```
 */
export function resolveAgentConfig(
	name: string,
	overrides?: Record<string, AgentConfig>,
	global?: boolean,
): AgentConfig | null {
	// Check overrides first (not applicable for global)
	if (!global && overrides?.[name]) {
		return overrides[name];
	}

	// Check built-in defaults
	if (name in AGENT_INFO) {
		const info = AGENT_INFO[name as BuiltInAgent];
		return {
			skillsDir: global ? info.globalSkillsDir : info.skillsDir,
		};
	}

	return null;
}

/**
 * Parse comma-separated agent names from CLI argument.
 *
 * @param agentArg - Comma-separated agent names (e.g., "claude-code,cursor")
 * @returns Array of agent names, or ["none"] if skipping symlinks
 *
 * @example
 * ```typescript
 * parseAgentArg("claude-code,cursor")
 * // => ["claude-code", "cursor"]
 *
 * parseAgentArg("none")
 * // => ["none"]
 *
 * parseAgentArg(undefined)
 * // => [...ALL_AGENTS]
 * ```
 */
export function parseAgentArg(agentArg?: string): string[] {
	if (!agentArg) {
		return [...ALL_AGENTS];
	}

	if (agentArg === "none") {
		return ["none"];
	}

	return agentArg
		.split(",")
		.map((a) => a.trim())
		.filter(Boolean);
}

/**
 * Get all available agent names (built-in + custom).
 */
export function getAvailableAgents(
	overrides?: Record<string, AgentConfig>,
): string[] {
	const builtIn = Object.keys(DEFAULT_AGENT_CONFIGS);
	const custom = overrides ? Object.keys(overrides) : [];
	return [...new Set([...builtIn, ...custom])];
}

/**
 * Prompt user to select which agents to install skills to.
 *
 * @returns Array of selected agent names
 */
export async function promptForAgents(): Promise<string[]> {
	const choices = ALL_AGENTS.map((agent) => ({
		name: `${AGENT_INFO[agent].displayName} (${AGENT_INFO[agent].skillsDir})`,
		value: agent,
		checked: true, // All selected by default
	}));

	const selected = await checkbox({
		message: "Select agents to install skills to",
		choices,
	});

	if (selected.length === 0) {
		return ["none"];
	}

	return selected;
}
