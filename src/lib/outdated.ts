import type {
  GitHubLockfileEntry,
  LocalLockfileEntry,
  PspmLockfile,
  PspmLockfileEntry,
} from "./lockfile";
import type { PspmManifest } from "./manifest";
import { compareVersions, getLatestVersion, resolveVersion } from "./version";

/**
 * Package type for outdated checking
 */
export type OutdatedPackageType = "registry" | "github" | "local";

/**
 * Result of checking a single package for updates
 */
export interface OutdatedResult {
  /** Full specifier (e.g., "@user/alice/my-skill", "github:org/repo/path") */
  name: string;
  /** Currently installed version */
  current: string;
  /** Latest version satisfying the version range from manifest */
  wanted: string | null;
  /** Absolute latest version available */
  latest: string | null;
  /** Package type */
  type: OutdatedPackageType;
  /** Whether the package is outdated (current < wanted or current < latest) */
  isOutdated: boolean;
  /** Whether wanted version is outdated compared to latest */
  wantedBehindLatest: boolean;
  /** Version range from manifest (if available) */
  versionRange?: string;
  /** Deprecation message if current version is deprecated */
  deprecated?: string;
}

/**
 * Configuration for the outdated checker
 */
export interface OutdatedConfig {
  /** Base registry URL */
  registryUrl: string;
  /** Optional API key for authentication */
  apiKey?: string;
  /** Optional GitHub token for checking GitHub packages */
  githubToken?: string;
}

/**
 * Options for checking outdated packages
 */
export interface CheckOutdatedOptions {
  /** The lockfile to check */
  lockfile: PspmLockfile;
  /** Optional manifest with version ranges */
  manifest?: PspmManifest;
  /** Whether to include up-to-date packages in results */
  includeUpToDate?: boolean;
  /** Whether to include local packages in results */
  includeLocal?: boolean;
  /** Specific packages to check (if not provided, checks all) */
  packages?: string[];
}

/**
 * API response for skill versions endpoint
 */
interface SkillVersionResponse {
  id: string;
  skillId: string;
  version: string;
  r2Key: string;
  checksum: string;
  manifest: Record<string, unknown>;
  publishedAt: string;
  deprecatedAt?: string | null;
  deprecationMessage?: string | null;
}

/**
 * Create an outdated checker instance
 */
export function createOutdatedChecker(config: OutdatedConfig) {
  const { registryUrl, apiKey, githubToken } = config;

  async function fetchWithAuth(
    url: string,
    token?: string,
  ): Promise<Response> {
    const headers: Record<string, string> = {};
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Request failed (${response.status}): ${text}`);
    }

    return response;
  }

  /**
   * Fetch available versions for a registry package
   */
  async function fetchRegistryVersions(
    username: string,
    name: string,
  ): Promise<SkillVersionResponse[]> {
    const url = `${registryUrl}/@user/${username}/${name}/versions`;
    const response = await fetchWithAuth(url, apiKey);
    return (await response.json()) as SkillVersionResponse[];
  }

  /**
   * Fetch available versions for a @github registry package
   */
  async function fetchGithubRegistryVersions(
    owner: string,
    repo: string,
    skillname: string,
  ): Promise<SkillVersionResponse[]> {
    const url = `${registryUrl}/@github/${owner}/${repo}/${skillname}/versions`;
    const response = await fetchWithAuth(url, apiKey);
    return (await response.json()) as SkillVersionResponse[];
  }

  /**
   * Check a single registry package for updates
   */
  async function checkRegistryPackage(
    specifier: string,
    entry: PspmLockfileEntry,
    versionRange?: string,
  ): Promise<OutdatedResult> {
    // Parse @user/{username}/{name} or @org/{orgname}/{name} or @github/{owner}/{repo}/{skillname}
    const userMatch = specifier.match(/^@(?:user|org)\/([^/]+)\/([^/]+)$/);
    const githubMatch = specifier.match(
      /^@github\/([^/]+)\/([^/]+)\/([^/]+)$/,
    );

    if (!userMatch && !githubMatch) {
      throw new Error(`Invalid registry specifier: ${specifier}`);
    }

    // Determine how to fetch versions based on namespace
    const isGithubRegistry = !!githubMatch;
    const username = userMatch ? userMatch[1] : "";
    const name = userMatch ? userMatch[2] : "";

    try {
      const versions =
        isGithubRegistry && githubMatch
          ? await fetchGithubRegistryVersions(
              githubMatch[1],
              githubMatch[2],
              githubMatch[3],
            )
          : await fetchRegistryVersions(username, name);
      const versionStrings = versions.map((v) => v.version);

      // Resolve wanted (best matching range) and latest
      const range = versionRange || "*";
      const wanted = resolveVersion(range, versionStrings);
      const latest = getLatestVersion(versionStrings);

      // Check if current version is deprecated
      const currentVersionInfo = versions.find(
        (v) => v.version === entry.version,
      );
      const deprecated = currentVersionInfo?.deprecationMessage ?? undefined;

      // Determine if outdated
      const isOutdated =
        (wanted !== null && compareVersions(entry.version, wanted) < 0) ||
        (latest !== null && compareVersions(entry.version, latest) < 0);

      const wantedBehindLatest =
        wanted !== null &&
        latest !== null &&
        compareVersions(wanted, latest) < 0;

      return {
        name: specifier,
        current: entry.version,
        wanted,
        latest,
        type: "registry",
        isOutdated,
        wantedBehindLatest,
        versionRange: range,
        deprecated,
      };
    } catch {
      // If we can't fetch versions, return unknown state
      return {
        name: specifier,
        current: entry.version,
        wanted: null,
        latest: null,
        type: "registry",
        isOutdated: false,
        wantedBehindLatest: false,
        versionRange,
      };
    }
  }

  /**
   * Fetch latest commit for a GitHub ref
   */
  async function fetchGitHubLatestCommit(
    owner: string,
    repo: string,
    ref: string,
  ): Promise<string | null> {
    try {
      const url = `https://api.github.com/repos/${owner}/${repo}/commits/${ref}`;
      const response = await fetchWithAuth(url, githubToken);
      const data = (await response.json()) as { sha: string };
      return data.sha;
    } catch {
      return null;
    }
  }

  /**
   * Check a single GitHub package for updates
   */
  async function checkGitHubPackage(
    specifier: string,
    entry: GitHubLockfileEntry,
  ): Promise<OutdatedResult> {
    // Parse github:{owner}/{repo}[/{path}]
    const match = specifier.match(
      /^github:([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)/,
    );
    if (!match) {
      throw new Error(`Invalid GitHub specifier: ${specifier}`);
    }

    const [, owner, repo] = match;
    const ref = entry.gitRef || "HEAD";

    const latestCommit = await fetchGitHubLatestCommit(owner, repo, ref);
    const currentShort = entry.gitCommit.slice(0, 7);
    const latestShort = latestCommit?.slice(0, 7) ?? null;

    const isOutdated =
      latestCommit !== null && entry.gitCommit !== latestCommit;

    return {
      name: specifier,
      current: currentShort,
      wanted: latestShort,
      latest: latestShort,
      type: "github",
      isOutdated,
      wantedBehindLatest: false,
      versionRange: ref,
    };
  }

  /**
   * Check a local package (always up-to-date)
   */
  function checkLocalPackage(
    specifier: string,
    _entry: LocalLockfileEntry,
  ): OutdatedResult {
    return {
      name: specifier,
      current: "local",
      wanted: null,
      latest: null,
      type: "local",
      isOutdated: false,
      wantedBehindLatest: false,
    };
  }

  /**
   * Check all packages for updates
   */
  async function checkOutdated(
    options: CheckOutdatedOptions,
  ): Promise<OutdatedResult[]> {
    const {
      lockfile,
      manifest,
      includeUpToDate = false,
      includeLocal = false,
      packages: filterPackages,
    } = options;

    const results: OutdatedResult[] = [];

    // Check registry packages
    const registryPackages = lockfile.packages || lockfile.skills || {};
    const registryDeps = manifest?.dependencies || {};

    const registryEntries = Object.entries(registryPackages).filter(
      ([specifier]) => !filterPackages || filterPackages.includes(specifier),
    );

    const registryResults = await Promise.all(
      registryEntries.map(([specifier, entry]) =>
        checkRegistryPackage(
          specifier,
          entry as PspmLockfileEntry,
          registryDeps[specifier],
        ),
      ),
    );
    results.push(...registryResults);

    // Check GitHub packages
    const githubPackages = lockfile.githubPackages || {};

    const githubEntries = Object.entries(githubPackages).filter(
      ([specifier]) => !filterPackages || filterPackages.includes(specifier),
    );

    const githubResults = await Promise.all(
      githubEntries.map(([specifier, entry]) =>
        checkGitHubPackage(specifier, entry as GitHubLockfileEntry),
      ),
    );
    results.push(...githubResults);

    // Check local packages (if requested)
    if (includeLocal) {
      const localPackages = lockfile.localPackages || {};

      const localEntries = Object.entries(localPackages).filter(
        ([specifier]) => !filterPackages || filterPackages.includes(specifier),
      );

      for (const [specifier, entry] of localEntries) {
        results.push(checkLocalPackage(specifier, entry as LocalLockfileEntry));
      }
    }

    // Filter results
    if (!includeUpToDate) {
      return results.filter((r) => r.isOutdated);
    }

    return results;
  }

  return {
    checkOutdated,
    checkRegistryPackage,
    checkGitHubPackage,
    checkLocalPackage,
    fetchRegistryVersions,
  };
}

/**
 * Convenience function to check outdated packages
 */
export async function checkOutdated(
  config: OutdatedConfig,
  options: CheckOutdatedOptions,
): Promise<OutdatedResult[]> {
  const checker = createOutdatedChecker(config);
  return checker.checkOutdated(options);
}
