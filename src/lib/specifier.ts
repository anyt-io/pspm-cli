// =============================================================================
// Registry Namespace Types
// =============================================================================

/**
 * Supported registry namespace types.
 *
 * - "user"   — Individual user skills: @user/{username}/{skillname}
 * - "org"    — Organization skills: @org/{orgname}/{skillname}
 * - "github" — GitHub-indexed skills: @github/{owner}/{repo}/{skillname}
 */
export type NamespaceType = "user" | "org" | "github";

/**
 * Parsed registry specifier (unified across all namespaces).
 *
 * @example
 * - @user/bsheng/vite-slides         -> { namespace: "user", owner: "bsheng", name: "vite-slides" }
 * - @org/anyt/code-review@^2.0.0     -> { namespace: "org", owner: "anyt", name: "code-review", versionRange: "^2.0.0" }
 * - @github/microsoft/skills/azure-ai -> { namespace: "github", owner: "microsoft", name: "skills", subname: "azure-ai" }
 */
export interface RegistrySpecifier {
  namespace: NamespaceType;
  /** username for @user, orgname for @org, GitHub owner for @github */
  owner: string;
  /** skill name for @user/@org, repo name for @github */
  name: string;
  /** skill name within the repo (only for @github) */
  subname?: string;
  versionRange?: string;
}

// =============================================================================
// Registry Specifier Parsing
// =============================================================================

/**
 * Unified registry specifier regex pattern.
 *
 * Matches:
 * - @user/{owner}/{name}[@version]
 * - @org/{owner}/{name}[@version]
 * - @github/{owner}/{repo}/{skillname}[@version]
 *
 * Group 1: namespace (user|org|github)
 * Group 2: owner
 * Group 3: name (skill name for user/org, repo name for github)
 * Group 4: optional subname (skill name within repo, github only)
 * Group 5: optional @version
 */
const REGISTRY_SPECIFIER_PATTERN =
  /^@(user|org|github)\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9._-]+)(?:\/([a-z][a-z0-9-]*))?(?:@(.+))?$/;

/**
 * Parse a registry specifier string (any namespace).
 *
 * @param specifier - The specifier string
 * @returns Parsed specifier or null if invalid
 */
export function parseRegistrySpecifier(
  specifier: string,
): RegistrySpecifier | null {
  const match = specifier.match(REGISTRY_SPECIFIER_PATTERN);

  if (!match) {
    return null;
  }

  const namespace = match[1] as NamespaceType;
  const owner = match[2];
  const name = match[3];
  const subname = match[4];
  const versionRange = match[5];

  if (!owner || !name) {
    return null;
  }

  // @github requires a subname (skill within repo)
  if (namespace === "github" && !subname) {
    return null;
  }

  // @user and @org should not have a subname
  if (namespace !== "github" && subname) {
    return null;
  }

  return {
    namespace,
    owner,
    name,
    subname: subname || undefined,
    versionRange: versionRange || undefined,
  };
}

/**
 * Generate a full registry identifier string.
 */
export function generateRegistryIdentifier(
  spec: Pick<
    RegistrySpecifier,
    "namespace" | "owner" | "name" | "subname" | "versionRange"
  >,
): string {
  let base = `@${spec.namespace}/${spec.owner}/${spec.name}`;
  if (spec.subname) {
    base += `/${spec.subname}`;
  }
  if (spec.versionRange) {
    base += `@${spec.versionRange}`;
  }
  return base;
}

/**
 * Check if a string is a registry specifier (starts with @user/, @org/, or @github/).
 */
export function isRegistrySpecifier(specifier: string): boolean {
  return (
    specifier.startsWith("@user/") ||
    specifier.startsWith("@org/") ||
    specifier.startsWith("@github/")
  );
}

/**
 * Get the effective skill name from a registry specifier.
 * For @user/@org this is `name`, for @github this is `subname`.
 */
export function getRegistrySkillName(spec: RegistrySpecifier): string {
  return spec.subname ?? spec.name;
}

// =============================================================================
// Backward-Compatible Aliases (@user namespace only)
// =============================================================================

/**
 * Parsed skill specifier (@user namespace only).
 * @deprecated Use `RegistrySpecifier` instead for multi-namespace support.
 */
export interface SkillSpecifier {
  username: string;
  name: string;
  versionRange?: string;
}

/**
 * Parse a skill specifier string (@user namespace only, backward compat).
 * @deprecated Use `parseRegistrySpecifier` instead.
 */
export function parseSkillSpecifier(specifier: string): SkillSpecifier | null {
  const result = parseRegistrySpecifier(specifier);
  if (!result || result.namespace !== "user") {
    return null;
  }
  return {
    username: result.owner,
    name: result.name,
    versionRange: result.versionRange,
  };
}

/**
 * Generate a full skill identifier string (@user namespace).
 * @deprecated Use `generateRegistryIdentifier` instead.
 */
export function generateSkillIdentifier(
  username: string,
  name: string,
  version?: string,
): string {
  return generateRegistryIdentifier({
    namespace: "user",
    owner: username,
    name,
    versionRange: version,
  });
}

// =============================================================================
// GitHub Specifier Support (github: protocol, direct download)
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
