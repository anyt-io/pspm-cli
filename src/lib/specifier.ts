/**
 * Parsed skill specifier (from CLI input)
 * e.g., "@user/bsheng/vite_slides@^2.0.0"
 */
export interface SkillSpecifier {
	username: string;
	name: string;
	versionRange?: string;
}

/**
 * Skill specifier regex pattern
 * Matches: @user/{username}/{name}[@{version}]
 */
const SPECIFIER_PATTERN =
	/^@user\/([a-zA-Z0-9_-]+)\/([a-z][a-z0-9_-]*)(?:@(.+))?$/;

/**
 * Parse a skill specifier string.
 *
 * @param specifier - The specifier string (e.g., "@user/bsheng/vite_slides@^2.0.0")
 * @returns Parsed specifier or null if invalid
 *
 * @example
 * ```typescript
 * parseSkillSpecifier("@user/bsheng/my-skill@^1.0.0")
 * // => { username: "bsheng", name: "my-skill", versionRange: "^1.0.0" }
 *
 * parseSkillSpecifier("@user/bsheng/my-skill")
 * // => { username: "bsheng", name: "my-skill", versionRange: undefined }
 * ```
 */
export function parseSkillSpecifier(specifier: string): SkillSpecifier | null {
	const match = specifier.match(SPECIFIER_PATTERN);

	if (!match) {
		return null;
	}

	const username = match[1];
	const name = match[2];
	if (!username || !name) {
		return null;
	}

	return {
		username,
		name,
		versionRange: match[3],
	};
}

/**
 * Generate a full skill identifier string.
 *
 * @param username - The owner's username
 * @param name - The skill name
 * @param version - Optional version string
 * @returns Full identifier (e.g., "@user/bsheng/my-skill@1.0.0")
 */
export function generateSkillIdentifier(
	username: string,
	name: string,
	version?: string,
): string {
	const base = `@user/${username}/${name}`;
	return version ? `${base}@${version}` : base;
}

// =============================================================================
// GitHub Specifier Support
// =============================================================================

/**
 * Parsed GitHub specifier
 *
 * Format: github:{owner}/{repo}[/{path}][@{ref}]
 *
 * @example
 * - github:vercel-labs/agent-skills
 * - github:vercel-labs/agent-skills@main
 * - github:vercel-labs/agent-skills/skills/react-best-practices
 * - github:vercel-labs/agent-skills/skills/react-best-practices@main
 * - github:myorg/prompts/team/frontend/code-review@v2.0.0
 */
export interface GitHubSpecifier {
	/** Repository owner */
	owner: string;
	/** Repository name */
	repo: string;
	/** Optional path within the repository (e.g., "skills/react-best-practices") */
	path?: string;
	/** Git ref (branch, tag, or commit SHA). Defaults to default branch if not specified. */
	ref?: string;
}

/**
 * GitHub specifier regex pattern
 * Matches: github:{owner}/{repo}[/{path}][@{ref}]
 *
 * Group 1: owner
 * Group 2: repo
 * Group 3: optional /path (with leading slash)
 * Group 4: optional @ref
 */
const GITHUB_SPECIFIER_PATTERN =
	/^github:([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)(\/[^@]+)?(?:@(.+))?$/;

/**
 * Parse a GitHub specifier string.
 *
 * @param specifier - The specifier string (e.g., "github:owner/repo/path@ref")
 * @returns Parsed specifier or null if invalid
 *
 * @example
 * ```typescript
 * parseGitHubSpecifier("github:vercel-labs/agent-skills/skills/react@main")
 * // => { owner: "vercel-labs", repo: "agent-skills", path: "skills/react", ref: "main" }
 *
 * parseGitHubSpecifier("github:myorg/prompts")
 * // => { owner: "myorg", repo: "prompts", path: undefined, ref: undefined }
 * ```
 */
export function parseGitHubSpecifier(
	specifier: string,
): GitHubSpecifier | null {
	const match = specifier.match(GITHUB_SPECIFIER_PATTERN);

	if (!match) {
		return null;
	}

	const [, owner, repo, pathWithSlash, ref] = match;
	if (!owner || !repo) {
		return null;
	}

	return {
		owner,
		repo,
		// Remove leading slash from path
		path: pathWithSlash ? pathWithSlash.slice(1) : undefined,
		ref: ref || undefined,
	};
}

/**
 * Format a GitHubSpecifier back to string format.
 *
 * @param spec - The GitHub specifier object
 * @returns Formatted string (e.g., "github:owner/repo/path@ref")
 */
export function formatGitHubSpecifier(spec: GitHubSpecifier): string {
	let result = `github:${spec.owner}/${spec.repo}`;
	if (spec.path) {
		result += `/${spec.path}`;
	}
	if (spec.ref) {
		result += `@${spec.ref}`;
	}
	return result;
}

/**
 * Extract skill name from GitHub specifier.
 * Uses the last segment of the path, or the repo name if no path.
 *
 * @param spec - The GitHub specifier object
 * @returns Skill name (e.g., "react-best-practices" or "prompts")
 *
 * @example
 * ```typescript
 * getGitHubSkillName({ owner: "vercel-labs", repo: "agent-skills", path: "skills/react" })
 * // => "react"
 *
 * getGitHubSkillName({ owner: "myorg", repo: "prompts" })
 * // => "prompts"
 * ```
 */
export function getGitHubSkillName(spec: GitHubSpecifier): string {
	if (spec.path) {
		const segments = spec.path.split("/").filter(Boolean);
		const lastSegment = segments[segments.length - 1];
		if (lastSegment) {
			return lastSegment;
		}
	}
	return spec.repo;
}

/**
 * Check if a string is a GitHub specifier (github: prefix)
 */
export function isGitHubSpecifier(specifier: string): boolean {
	return specifier.startsWith("github:");
}

// =============================================================================
// GitHub URL and Shorthand Support
// =============================================================================

/**
 * GitHub URL patterns
 *
 * Matches:
 * - https://github.com/owner/repo/tree/branch/path/to/skill
 * - https://github.com/owner/repo/tree/branch
 * - https://github.com/owner/repo
 * - https://github.com/owner/repo.git
 */
const GITHUB_URL_TREE_PATTERN =
	/^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)(?:\/(.+))?$/;
const GITHUB_URL_PATTERN =
	/^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/;

/**
 * GitHub shorthand pattern: owner/repo or owner/repo/path
 * Must not contain :, not start with . / or @
 */
const GITHUB_SHORTHAND_PATTERN =
	/^([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)(?:\/(.+))?$/;

/**
 * Check if a string is a GitHub URL (https://github.com/...)
 */
export function isGitHubUrl(input: string): boolean {
	return /^https?:\/\/github\.com\/[^/]+\/[^/]+/.test(input);
}

/**
 * Parse a GitHub URL into a GitHubSpecifier.
 *
 * Supports:
 * - https://github.com/owner/repo
 * - https://github.com/owner/repo.git
 * - https://github.com/owner/repo/tree/branch
 * - https://github.com/owner/repo/tree/branch/path/to/skill
 *
 * @example
 * ```typescript
 * parseGitHubUrl("https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design")
 * // => { owner: "vercel-labs", repo: "agent-skills", ref: "main", path: "skills/web-design" }
 *
 * parseGitHubUrl("https://github.com/vercel-labs/agent-skills")
 * // => { owner: "vercel-labs", repo: "agent-skills" }
 * ```
 */
export function parseGitHubUrl(input: string): GitHubSpecifier | null {
	// Try tree URL first (more specific)
	const treeMatch = input.match(GITHUB_URL_TREE_PATTERN);
	if (treeMatch) {
		const [, owner, repo, ref, path] = treeMatch;
		if (!owner || !repo || !ref) return null;
		return {
			owner,
			repo,
			ref,
			path: path || undefined,
		};
	}

	// Plain repo URL
	const repoMatch = input.match(GITHUB_URL_PATTERN);
	if (repoMatch) {
		const [, owner, repo] = repoMatch;
		if (!owner || !repo) return null;
		return { owner, repo };
	}

	return null;
}

/**
 * Check if a string is a GitHub shorthand (owner/repo or owner/repo/path).
 *
 * Must not contain colons (protocol prefix), not start with `.`, `/`, or `@`.
 * This avoids conflicts with local paths, registry specifiers, and URLs.
 */
export function isGitHubShorthand(input: string): boolean {
	if (
		input.includes(":") ||
		input.startsWith(".") ||
		input.startsWith("/") ||
		input.startsWith("@")
	) {
		return false;
	}
	return GITHUB_SHORTHAND_PATTERN.test(input);
}

/**
 * Parse a GitHub shorthand into a GitHubSpecifier.
 *
 * Supports:
 * - owner/repo
 * - owner/repo/path/to/skill
 *
 * @example
 * ```typescript
 * parseGitHubShorthand("vercel-labs/agent-skills")
 * // => { owner: "vercel-labs", repo: "agent-skills" }
 *
 * parseGitHubShorthand("vercel-labs/agent-skills/skills/web-design")
 * // => { owner: "vercel-labs", repo: "agent-skills", path: "skills/web-design" }
 * ```
 */
export function parseGitHubShorthand(input: string): GitHubSpecifier | null {
	if (
		input.includes(":") ||
		input.startsWith(".") ||
		input.startsWith("/") ||
		input.startsWith("@")
	) {
		return null;
	}

	const match = input.match(GITHUB_SHORTHAND_PATTERN);
	if (!match) return null;

	const [, owner, repo, path] = match;
	if (!owner || !repo) return null;

	return {
		owner,
		repo,
		path: path || undefined,
	};
}
