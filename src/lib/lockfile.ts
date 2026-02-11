/**
 * PSPM Lockfile Schema URL for IDE validation
 */
export const PSPM_LOCKFILE_SCHEMA_URL =
	"https://pspm.dev/schema/v1/pspm-lock.json";

/**
 * PSPM Lockfile format (pspm-lock.json)
 * Similar to package-lock.json for npm.
 *
 * Migration notes:
 * - v1 used "skill-lock.json" with `skills` key.
 * - v2 uses "pspm-lock.json" with `packages` key.
 * - v3 adds `githubPackages` key for GitHub dependencies.
 * - v4 adds `dependencies` field to entries for recursive resolution.
 *       Also adds `localPackages` for local file: protocol packages.
 */
export interface PspmLockfile {
	/** JSON Schema URL for IDE validation */
	$schema?: string;
	/** Lockfile format version */
	lockfileVersion: 1 | 2 | 3 | 4;
	/** Registry URL used for resolution */
	registryUrl: string;
	/** Installed packages from registry (v2+ format) */
	packages?: Record<string, PspmLockfileEntry>;
	/** Installed packages from GitHub (v3+ format) */
	githubPackages?: Record<string, GitHubLockfileEntry>;
	/** Installed packages from local directories (v4+ format) */
	localPackages?: Record<string, LocalLockfileEntry>;
	/** Installed skills (v1 format, deprecated) */
	skills?: Record<string, PspmLockfileEntry>;
}

/**
 * Lockfile entry for a local package.
 * Key format in localPackages: "file:../path" or "file:/absolute/path"
 */
export interface LocalLockfileEntry {
	/** Always "local" for local packages */
	version: "local";
	/** Original path from the specifier (relative or absolute) */
	path: string;
	/** Resolved absolute path to the local skill directory */
	resolvedPath: string;
	/** Skill name (last segment of path) */
	name: string;
}

/**
 * Lockfile entry for a single package from registry.
 */
export interface PspmLockfileEntry {
	/** Resolved version */
	version: string;
	/** Download URL used to fetch the package */
	resolved: string;
	/** Integrity hash for verification (sha256-...) */
	integrity: string;
	/** Deprecation message if this version is deprecated */
	deprecated?: string;
	/** Dependencies: package name -> resolved version (v4+) */
	dependencies?: Record<string, string>;
}

/**
 * Lockfile entry for a GitHub package.
 * Key format in githubPackages: "github:owner/repo[/path]"
 */
export interface GitHubLockfileEntry extends PspmLockfileEntry {
	/** Resolved Git commit SHA */
	gitCommit: string;
	/** Original Git ref (branch, tag, or "latest") */
	gitRef: string;
}
