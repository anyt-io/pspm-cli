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
	/** Skills directory path */
	skillsDir: string;
}

/**
 * Default agent configurations with display names.
 * These can be overridden in pspm.json under the "agents" key.
 */
export const AGENT_INFO: Record<BuiltInAgent, AgentInfo> = {
	"claude-code": {
		displayName: "Claude Code",
		skillsDir: ".claude/skills",
	},
	codex: {
		displayName: "Codex",
		skillsDir: ".codex/skills",
	},
	cursor: {
		displayName: "Cursor",
		skillsDir: ".cursor/skills",
	},
	gemini: {
		displayName: "Gemini CLI",
		skillsDir: ".gemini/skills",
	},
	kiro: {
		displayName: "Kiro CLI",
		skillsDir: ".kiro/skills",
	},
	opencode: {
		displayName: "OpenCode",
		skillsDir: ".opencode/skills",
	},
};

/**
 * Default agent configurations (AgentConfig format).
 */
export const DEFAULT_AGENT_CONFIGS: Record<BuiltInAgent, AgentConfig> = {
	"claude-code": { skillsDir: AGENT_INFO["claude-code"].skillsDir },
	codex: { skillsDir: AGENT_INFO.codex.skillsDir },
	cursor: { skillsDir: AGENT_INFO.cursor.skillsDir },
	gemini: { skillsDir: AGENT_INFO.gemini.skillsDir },
	kiro: { skillsDir: AGENT_INFO.kiro.skillsDir },
	opencode: { skillsDir: AGENT_INFO.opencode.skillsDir },
};

/**
 * All built-in agent names in display order.
 */
export const ALL_AGENTS: BuiltInAgent[] = [
	"claude-code",
	"codex",
	"cursor",
	"gemini",
	"kiro",
	"opencode",
];

/**
 * Resolve agent configuration by name.
 *
 * @param name - Agent name (built-in or custom)
 * @param overrides - Custom agent configurations from pspm.json
 * @returns Agent configuration or null if not found
 *
 * @example
 * ```typescript
 * resolveAgentConfig("claude-code")
 * // => { skillsDir: ".claude/skills" }
 *
 * resolveAgentConfig("my-custom", { "my-custom": { skillsDir: ".myagent/prompts" } })
 * // => { skillsDir: ".myagent/prompts" }
 * ```
 */
export function resolveAgentConfig(
	name: string,
	overrides?: Record<string, AgentConfig>,
): AgentConfig | null {
	// Check overrides first
	if (overrides?.[name]) {
		return overrides[name];
	}

	// Check built-in defaults
	if (name in DEFAULT_AGENT_CONFIGS) {
		return DEFAULT_AGENT_CONFIGS[name as BuiltInAgent];
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
 * // => ["claude-code", "codex", "cursor", "gemini", "kiro", "opencode"]
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
