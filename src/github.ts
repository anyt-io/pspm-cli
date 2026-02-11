/**
 * GitHub package download and extraction support.
 *
 * Downloads skill packages from GitHub repositories and extracts them
 * to .pspm/skills/_github/{owner}/{repo}/{path}/
 */

import { cp, lstat, mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { GitHubSpecifier } from "./lib/index";
import { calculateIntegrity } from "./lib/index";

/**
 * Result of downloading a GitHub package.
 */
export interface GitHubDownloadResult {
	/** Downloaded tarball as buffer */
	buffer: Buffer;
	/** Resolved commit SHA */
	commit: string;
	/** Integrity hash (sha256-...) */
	integrity: string;
}

/**
 * Error thrown when GitHub API rate limit is hit.
 */
export class GitHubRateLimitError extends Error {
	constructor() {
		super(
			"GitHub API rate limit exceeded. Set GITHUB_TOKEN environment variable for higher limits.",
		);
		this.name = "GitHubRateLimitError";
	}
}

/**
 * Error thrown when GitHub repository/ref is not found.
 */
export class GitHubNotFoundError extends Error {
	constructor(spec: GitHubSpecifier) {
		const path = spec.path ? `/${spec.path}` : "";
		const ref = spec.ref ? `@${spec.ref}` : "";
		super(
			`GitHub repository not found: ${spec.owner}/${spec.repo}${path}${ref}`,
		);
		this.name = "GitHubNotFoundError";
	}
}

/**
 * Error thrown when the specified path doesn't exist in the repository.
 */
export class GitHubPathNotFoundError extends Error {
	constructor(spec: GitHubSpecifier, availablePaths?: string[]) {
		const pathInfo = availablePaths?.length
			? `\nAvailable paths in repository root:\n  ${availablePaths.join("\n  ")}`
			: "";
		super(
			`Path "${spec.path}" not found in ${spec.owner}/${spec.repo}${pathInfo}`,
		);
		this.name = "GitHubPathNotFoundError";
	}
}

/**
 * Get GitHub API headers, including authentication if available.
 */
function getGitHubHeaders(): Record<string, string> {
	const headers: Record<string, string> = {
		Accept: "application/vnd.github+json",
		"X-GitHub-Api-Version": "2022-11-28",
		"User-Agent": "pspm-cli",
	};

	const token = process.env.GITHUB_TOKEN;
	if (token) {
		headers.Authorization = `Bearer ${token}`;
	}

	return headers;
}

/**
 * Resolve a Git ref (branch/tag) to a commit SHA.
 *
 * @param owner - Repository owner
 * @param repo - Repository name
 * @param ref - Branch, tag, or commit SHA (defaults to default branch)
 * @returns Resolved commit SHA
 */
export async function resolveGitHubRef(
	owner: string,
	repo: string,
	ref?: string,
): Promise<string> {
	const headers = getGitHubHeaders();

	// Use a local variable to avoid parameter reassignment
	let resolvedRef = ref;

	// If no ref specified, get the default branch first
	if (!resolvedRef || resolvedRef === "latest") {
		const repoUrl = `https://api.github.com/repos/${owner}/${repo}`;
		const repoResponse = await fetch(repoUrl, { headers });

		if (repoResponse.status === 404) {
			throw new GitHubNotFoundError({ owner, repo });
		}

		if (repoResponse.status === 403) {
			const remaining = repoResponse.headers.get("x-ratelimit-remaining");
			if (remaining === "0") {
				throw new GitHubRateLimitError();
			}
		}

		if (!repoResponse.ok) {
			throw new Error(`GitHub API error: ${repoResponse.status}`);
		}

		const repoData = (await repoResponse.json()) as { default_branch: string };
		resolvedRef = repoData.default_branch;
	}

	// Get the commit SHA for the ref
	const commitUrl = `https://api.github.com/repos/${owner}/${repo}/commits/${resolvedRef}`;
	const commitResponse = await fetch(commitUrl, { headers });

	if (commitResponse.status === 404) {
		throw new GitHubNotFoundError({ owner, repo, ref });
	}

	if (commitResponse.status === 403) {
		const remaining = commitResponse.headers.get("x-ratelimit-remaining");
		if (remaining === "0") {
			throw new GitHubRateLimitError();
		}
	}

	if (!commitResponse.ok) {
		throw new Error(`GitHub API error: ${commitResponse.status}`);
	}

	const commitData = (await commitResponse.json()) as { sha: string };
	return commitData.sha;
}

/**
 * Download a GitHub repository tarball.
 *
 * @param spec - GitHub specifier with owner, repo, and optional ref
 * @returns Download result with buffer, commit SHA, and integrity hash
 */
export async function downloadGitHubPackage(
	spec: GitHubSpecifier,
): Promise<GitHubDownloadResult> {
	const headers = getGitHubHeaders();

	// Resolve the ref to a commit SHA
	const commit = await resolveGitHubRef(spec.owner, spec.repo, spec.ref);

	// Download the tarball
	const tarballUrl = `https://api.github.com/repos/${spec.owner}/${spec.repo}/tarball/${commit}`;
	const response = await fetch(tarballUrl, {
		headers,
		redirect: "follow",
	});

	if (response.status === 404) {
		throw new GitHubNotFoundError(spec);
	}

	if (response.status === 403) {
		const remaining = response.headers.get("x-ratelimit-remaining");
		if (remaining === "0") {
			throw new GitHubRateLimitError();
		}
	}

	if (!response.ok) {
		throw new Error(`Failed to download GitHub tarball: ${response.status}`);
	}

	const buffer = Buffer.from(await response.arrayBuffer());
	const integrity = calculateIntegrity(buffer);

	return { buffer, commit, integrity };
}

/**
 * Extract a GitHub package to the skills directory.
 *
 * For subpath specifiers, extracts only the specified subdirectory.
 * Full path structure is preserved under .pspm/skills/_github/.
 *
 * @param spec - GitHub specifier
 * @param buffer - Downloaded tarball buffer
 * @param skillsDir - Base skills directory (.pspm/skills)
 * @returns Path to extracted skill (relative to project root)
 */
export async function extractGitHubPackage(
	spec: GitHubSpecifier,
	buffer: Buffer,
	skillsDir: string,
): Promise<string> {
	// Determine destination path
	const destPath = spec.path
		? join(skillsDir, "_github", spec.owner, spec.repo, spec.path)
		: join(skillsDir, "_github", spec.owner, spec.repo);

	// Create a temp directory for extraction
	const tempDir = join(skillsDir, "_github", ".temp", `${Date.now()}`);
	await mkdir(tempDir, { recursive: true });

	const tempFile = join(tempDir, "archive.tgz");

	try {
		// Write tarball to temp file
		await writeFile(tempFile, buffer);

		// Extract tarball
		const { exec } = await import("node:child_process");
		const { promisify } = await import("node:util");
		const execAsync = promisify(exec);

		await execAsync(`tar -xzf "${tempFile}" -C "${tempDir}"`);

		// Find the extracted directory (GitHub tarballs have a top-level dir like "owner-repo-sha")
		const entries = await readdir(tempDir);
		const extractedDir = entries.find(
			(e) => e !== "archive.tgz" && !e.startsWith("."),
		);

		if (!extractedDir) {
			throw new Error("Failed to find extracted directory in tarball");
		}

		const sourcePath = join(tempDir, extractedDir);

		// Determine what to copy - either a subpath or the entire repo
		const copySource = spec.path ? join(sourcePath, spec.path) : sourcePath;

		// If a subpath is specified, verify it exists in the repo
		if (spec.path) {
			const pathExists = await lstat(copySource).catch(() => null);
			if (!pathExists) {
				// List available directories in repo root for helpful error message
				const rootEntries = await readdir(sourcePath);
				const dirs = [];
				for (const entry of rootEntries) {
					const stat = await lstat(join(sourcePath, entry)).catch(() => null);
					if (stat?.isDirectory() && !entry.startsWith(".")) {
						dirs.push(entry);
					}
				}
				throw new GitHubPathNotFoundError(spec, dirs);
			}
		}

		// Remove existing destination and create fresh
		await rm(destPath, { recursive: true, force: true });
		await mkdir(destPath, { recursive: true });

		// Copy the contents
		await cp(copySource, destPath, { recursive: true });

		// Return the relative path from project root
		return spec.path
			? `.pspm/skills/_github/${spec.owner}/${spec.repo}/${spec.path}`
			: `.pspm/skills/_github/${spec.owner}/${spec.repo}`;
	} finally {
		// Clean up temp directory
		await rm(tempDir, { recursive: true, force: true });
	}
}

/**
 * Get a short display name for a GitHub package.
 *
 * @param spec - GitHub specifier
 * @param commit - Resolved commit SHA (first 7 chars will be shown)
 * @returns Display string like "github:owner/repo/path (ref@abc1234)"
 */
export function getGitHubDisplayName(
	spec: GitHubSpecifier,
	commit?: string,
): string {
	let name = `github:${spec.owner}/${spec.repo}`;
	if (spec.path) {
		name += `/${spec.path}`;
	}

	if (spec.ref || commit) {
		const ref = spec.ref || "HEAD";
		const shortCommit = commit ? commit.slice(0, 7) : "";
		name += ` (${ref}${shortCommit ? `@${shortCommit}` : ""})`;
	}

	return name;
}
