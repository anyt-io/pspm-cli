/**
 * PSPM Lockfile format (pspm-lock.json)
 * Similar to package-lock.json for npm.
 *
 * Migration notes:
 * - v1 used "skill-lock.json" with `skills` key.
 * - v2 uses "pspm-lock.json" with `packages` key.
 * - v3 adds `githubPackages` key for GitHub dependencies.
 */
export interface PspmLockfile {
	/** Lockfile format version */
	lockfileVersion: 1 | 2 | 3;
	/** Registry URL used for resolution */
	registryUrl: string;
	/** Installed packages from registry (v2+ format) */
	packages?: Record<string, PspmLockfileEntry>;
	/** Installed packages from GitHub (v3+ format) */
	githubPackages?: Record<string, GitHubLockfileEntry>;
	/** Installed skills (v1 format, deprecated) */
	skills?: Record<string, PspmLockfileEntry>;
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
