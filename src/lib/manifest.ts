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
  | "adal"
  | "amp"
  | "antigravity"
  | "augment"
  | "claude-code"
  | "cline"
  | "codebuddy"
  | "codex"
  | "command-code"
  | "continue"
  | "cortex"
  | "crush"
  | "cursor"
  | "droid"
  | "gemini-cli"
  | "github-copilot"
  | "goose"
  | "iflow-cli"
  | "junie"
  | "kilo"
  | "kimi-cli"
  | "kiro-cli"
  | "kode"
  | "mcpjam"
  | "mistral-vibe"
  | "mux"
  | "neovate"
  | "openclaw"
  | "opencode"
  | "openhands"
  | "pi"
  | "pochi"
  | "qoder"
  | "qwen-code"
  | "replit"
  | "roo"
  | "trae"
  | "trae-cn"
  | "universal"
  | "windsurf"
  | "zencoder";

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
   * Local skill dependencies (format: "file:../path": "*")
   *
   * Used for local development and testing before publishing.
   * Creates symlinks for instant updates during development.
   *
   * @example
   * ```json
   * {
   *   "localDependencies": {
   *     "file:../my-local-skill": "*",
   *     "file:/absolute/path/to/skill": "*"
   *   }
   * }
   * ```
   */
  localDependencies?: Record<string, string>;

  /**
   * Well-known skill dependencies from HTTPS domains.
   *
   * Skills hosted at /.well-known/skills/ on any domain.
   * Key is the base URL, value is an array of skill names (or "*" for all).
   *
   * @example
   * ```json
   * {
   *   "wellKnownDependencies": {
   *     "https://acme.com": ["code-review", "api-design"],
   *     "https://docs.stripe.com": "*"
   *   }
   * }
   * ```
   */
  wellKnownDependencies?: Record<string, string[] | string>;

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
  // Name can be bare ("my-skill") or qualified ("@user/owner/my-skill", "@org/owner/my-skill")
  const parts = manifest.name.split("/");
  const bareName = parts[parts.length - 1];
  if (!/^[a-z][a-z0-9_-]*$/.test(bareName)) {
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
