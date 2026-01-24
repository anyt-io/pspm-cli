/**
 * PSPM Manifest format (pspm.json)
 *
 * This is the dedicated manifest format for prompt skill packages,
 * separate from package.json used for npm/node dependencies.
 */

/**
 * Version requirements for the skill
 */
export interface PspmManifestRequirements {
	/** Minimum Claude model version required (e.g., ">=3.5") */
	claude?: string;
	/** Minimum PSPM CLI version required (e.g., ">=0.1.0") */
	pspm?: string;
}

/**
 * Agent configuration for skill symlinks
 */
export interface AgentConfig {
	/** Directory where skills should be symlinked (e.g., ".claude/skills") */
	skillsDir: string;
}

/**
 * Built-in agent types with predefined configurations
 */
export type BuiltInAgent =
	| "claude-code"
	| "codex"
	| "cursor"
	| "gemini"
	| "kiro"
	| "opencode";

/**
 * PSPM Manifest schema for pspm.json
 *
 * @example
 * ```json
 * {
 *   "$schema": "https://pspm.dev/schema/pspm.json",
 *   "name": "my-skill",
 *   "version": "1.0.0",
 *   "description": "A skill for code reviews",
 *   "author": "username",
 *   "license": "MIT",
 *   "type": "skill",
 *   "capabilities": ["code-review", "typescript"],
 *   "main": "SKILL.md",
 *   "requirements": {
 *     "claude": ">=3.5",
 *     "pspm": ">=0.1.0"
 *   },
 *   "files": ["SKILL.md", "runtime/", "scripts/", "data/"],
 *   "dependencies": {},
 *   "private": false
 * }
 * ```
 */
export interface PspmManifest {
	/** JSON Schema URL for validation */
	$schema?: string;

	/** Package name (no @ prefix needed, username is derived from logged-in user) */
	name: string;

	/** Semantic version string */
	version: string;

	/** Human-readable description */
	description?: string;

	/** Package author */
	author?: string;

	/** License identifier (e.g., "MIT", "Apache-2.0") */
	license?: string;

	/** Package type (always "skill" for prompt skill packages) */
	type?: "skill";

	/** List of capabilities/tags for discovery */
	capabilities?: string[];

	/** Main entry point file (default: "SKILL.md") */
	main?: string;

	/** Version requirements */
	requirements?: PspmManifestRequirements;

	/** Files to include in the published package */
	files?: string[];

	/** Skill dependencies (format: "@user/{username}/{name}": "^1.0.0") */
	dependencies?: Record<string, string>;

	/**
	 * GitHub skill dependencies (format: "github:owner/repo/path": "ref")
	 *
	 * @example
	 * ```json
	 * {
	 *   "githubDependencies": {
	 *     "github:vercel-labs/agent-skills/skills/react-best-practices": "main",
	 *     "github:myorg/prompts/team/frontend/linter": "v2.0.0"
	 *   }
	 * }
	 * ```
	 */
	githubDependencies?: Record<string, string>;

	/**
	 * Custom agent configuration overrides.
	 * Built-in agents (claude-code, cursor, codex) have default configs.
	 * Custom agents can also be defined here.
	 *
	 * @example
	 * ```json
	 * {
	 *   "agents": {
	 *     "claude-code": { "skillsDir": ".claude/skills" },
	 *     "my-custom": { "skillsDir": ".myagent/prompts" }
	 *   }
	 * }
	 * ```
	 */
	agents?: Partial<Record<BuiltInAgent, AgentConfig>> &
		Record<string, AgentConfig>;

	/** If true, prevents publishing to registry */
	private?: boolean;
}

/**
 * Result of detecting and reading a manifest
 */
export interface ManifestDetectionResult {
	/** The detected manifest type */
	type: "pspm.json" | "package.json";

	/** The parsed manifest content */
	manifest: PspmManifest;

	/** The file path that was read */
	path: string;
}

/**
 * Default file patterns to include when publishing
 */
export const DEFAULT_SKILL_FILES = [
	"SKILL.md",
	"runtime",
	"scripts",
	"data",
] as const;

/**
 * Default main entry point
 */
export const DEFAULT_MAIN = "SKILL.md";

/**
 * Schema URL for pspm.json (versioned)
 */
export const PSPM_SCHEMA_URL = "https://pspm.dev/schema/v1/pspm.json";

/**
 * Validate that a manifest has required fields
 */
export function validateManifest(
	manifest: Partial<PspmManifest>,
): { valid: true } | { valid: false; error: string } {
	if (!manifest.name) {
		return { valid: false, error: "Manifest must have a 'name' field" };
	}

	if (!manifest.version) {
		return { valid: false, error: "Manifest must have a 'version' field" };
	}

	// Validate name format (lowercase, alphanumeric, hyphens, underscores)
	if (!/^[a-z][a-z0-9_-]*$/.test(manifest.name)) {
		return {
			valid: false,
			error:
				"Name must start with a lowercase letter and contain only lowercase letters, numbers, hyphens, and underscores",
		};
	}

	// Validate version is valid semver (basic check)
	if (!/^\d+\.\d+\.\d+/.test(manifest.version)) {
		return {
			valid: false,
			error: "Version must be a valid semantic version (e.g., 1.0.0)",
		};
	}

	return { valid: true };
}

/**
 * Normalize a manifest by filling in defaults
 */
export function normalizeManifest(manifest: PspmManifest): PspmManifest {
	return {
		...manifest,
		type: manifest.type ?? "skill",
		main: manifest.main ?? DEFAULT_MAIN,
		files: manifest.files ?? [...DEFAULT_SKILL_FILES],
		dependencies: manifest.dependencies ?? {},
		githubDependencies: manifest.githubDependencies ?? {},
		private: manifest.private ?? false,
	};
}
