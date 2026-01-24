import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
	getLegacyLockfilePath,
	getLockfilePath,
	getRegistryUrl,
} from "./config";
import type {
	GitHubLockfileEntry,
	PspmLockfile,
	PspmLockfileEntry,
} from "./lib/index.js";

// Re-export types for backward compatibility
export type { GitHubLockfileEntry, PspmLockfile, PspmLockfileEntry };

/**
 * Check if legacy lockfile exists (skill-lock.json)
 */
async function hasLegacyLockfile(): Promise<boolean> {
	try {
		await stat(getLegacyLockfilePath());
		return true;
	} catch {
		return false;
	}
}

/**
 * Migrate legacy lockfile (skill-lock.json) to new format (pspm-lock.json)
 * Returns true if migration was performed
 */
export async function migrateLockfileIfNeeded(): Promise<boolean> {
	const legacyPath = getLegacyLockfilePath();
	const newPath = getLockfilePath();

	// Check if legacy exists and new doesn't
	try {
		await stat(legacyPath);
	} catch {
		// No legacy file, nothing to migrate
		return false;
	}

	try {
		await stat(newPath);
		// New file already exists, don't overwrite
		return false;
	} catch {
		// New file doesn't exist, migrate
	}

	try {
		const content = await readFile(legacyPath, "utf-8");
		const oldLockfile = JSON.parse(content) as PspmLockfile;

		// Convert v1 to v2 format
		const newLockfile: PspmLockfile = {
			lockfileVersion: 2,
			registryUrl: oldLockfile.registryUrl,
			packages: oldLockfile.skills ?? {},
		};

		await writeFile(newPath, `${JSON.stringify(newLockfile, null, 2)}\n`);
		console.log("Migrated lockfile: skill-lock.json → pspm-lock.json");

		// Keep the old file for safety (user can delete it)
		return true;
	} catch {
		return false;
	}
}

/**
 * Read the lockfile, automatically checking for legacy format
 */
export async function readLockfile(): Promise<PspmLockfile | null> {
	const lockfilePath = getLockfilePath();

	try {
		const content = await readFile(lockfilePath, "utf-8");
		const lockfile = JSON.parse(content) as PspmLockfile;

		// Normalize v1 -> v2 in memory (skills -> packages)
		if (
			lockfile.lockfileVersion === 1 &&
			lockfile.skills &&
			!lockfile.packages
		) {
			return {
				...lockfile,
				lockfileVersion: 2,
				packages: lockfile.skills,
			};
		}

		return lockfile;
	} catch {
		// Try legacy path
		if (await hasLegacyLockfile()) {
			try {
				const content = await readFile(getLegacyLockfilePath(), "utf-8");
				const legacyLockfile = JSON.parse(content) as PspmLockfile;
				// Return normalized v2 format
				return {
					lockfileVersion: 2,
					registryUrl: legacyLockfile.registryUrl,
					packages: legacyLockfile.skills ?? {},
				};
			} catch {
				return null;
			}
		}
		return null;
	}
}

/**
 * Write the lockfile (v4 format if any package has dependencies, otherwise v3)
 */
export async function writeLockfile(lockfile: PspmLockfile): Promise<void> {
	const lockfilePath = getLockfilePath();
	await mkdir(dirname(lockfilePath), { recursive: true });

	const packages = lockfile.packages ?? lockfile.skills ?? {};

	// Check if any package has dependencies to determine version
	const hasDependencies = Object.values(packages).some(
		(pkg) => pkg.dependencies && Object.keys(pkg.dependencies).length > 0,
	);
	const version = hasDependencies ? 4 : 3;

	const normalized: PspmLockfile = {
		lockfileVersion: version,
		registryUrl: lockfile.registryUrl,
		packages,
	};

	// Only include githubPackages if there are entries
	if (
		lockfile.githubPackages &&
		Object.keys(lockfile.githubPackages).length > 0
	) {
		normalized.githubPackages = lockfile.githubPackages;
	}

	await writeFile(lockfilePath, `${JSON.stringify(normalized, null, 2)}\n`);
}

/**
 * Create a new empty lockfile (v4 format)
 */
export async function createEmptyLockfile(): Promise<PspmLockfile> {
	const registryUrl = await getRegistryUrl();
	return {
		lockfileVersion: 4,
		registryUrl,
		packages: {},
	};
}

/**
 * Get packages from lockfile (handles both v1 and v2)
 */
function getPackages(
	lockfile: PspmLockfile,
): Record<string, PspmLockfileEntry> {
	return lockfile.packages ?? lockfile.skills ?? {};
}

/**
 * Add a skill to the lockfile
 */
export async function addToLockfile(
	fullName: string,
	entry: PspmLockfileEntry,
): Promise<void> {
	let lockfile = await readLockfile();
	if (!lockfile) {
		lockfile = await createEmptyLockfile();
	}

	const packages = getPackages(lockfile);
	packages[fullName] = entry;
	lockfile.packages = packages;

	await writeLockfile(lockfile);
}

/**
 * Add a skill to the lockfile with dependencies (v4 format)
 */
export async function addToLockfileWithDeps(
	fullName: string,
	entry: PspmLockfileEntry,
	dependencies?: Record<string, string>,
): Promise<void> {
	let lockfile = await readLockfile();
	if (!lockfile) {
		lockfile = await createEmptyLockfile();
	}

	const packages = getPackages(lockfile);
	const entryWithDeps = { ...entry };
	if (dependencies && Object.keys(dependencies).length > 0) {
		entryWithDeps.dependencies = dependencies;
	}
	packages[fullName] = entryWithDeps;
	lockfile.packages = packages;

	await writeLockfile(lockfile);
}

/**
 * Remove a skill from the lockfile
 */
export async function removeFromLockfile(fullName: string): Promise<boolean> {
	const lockfile = await readLockfile();
	if (!lockfile) {
		return false;
	}

	const packages = getPackages(lockfile);
	if (!packages[fullName]) {
		return false;
	}

	delete packages[fullName];
	lockfile.packages = packages;
	await writeLockfile(lockfile);
	return true;
}

/**
 * List all skills in the lockfile
 */
export async function listLockfileSkills(): Promise<
	Array<{ name: string; entry: PspmLockfileEntry }>
> {
	const lockfile = await readLockfile();
	if (!lockfile) {
		return [];
	}

	const packages = getPackages(lockfile);
	return Object.entries(packages).map(([name, entry]) => ({
		name,
		entry: entry as PspmLockfileEntry,
	}));
}

// =============================================================================
// GitHub Package Support
// =============================================================================

/**
 * Add a GitHub package to the lockfile
 */
export async function addGitHubToLockfile(
	specifier: string,
	entry: GitHubLockfileEntry,
): Promise<void> {
	let lockfile = await readLockfile();
	if (!lockfile) {
		lockfile = await createEmptyLockfile();
	}

	if (!lockfile.githubPackages) {
		lockfile.githubPackages = {};
	}

	lockfile.githubPackages[specifier] = entry;
	await writeLockfile(lockfile);
}

/**
 * Remove a GitHub package from the lockfile
 */
export async function removeGitHubFromLockfile(
	specifier: string,
): Promise<boolean> {
	const lockfile = await readLockfile();
	if (!lockfile?.githubPackages?.[specifier]) {
		return false;
	}

	delete lockfile.githubPackages[specifier];
	await writeLockfile(lockfile);
	return true;
}

/**
 * List all GitHub packages in the lockfile
 */
export async function listLockfileGitHubPackages(): Promise<
	Array<{ specifier: string; entry: GitHubLockfileEntry }>
> {
	const lockfile = await readLockfile();
	if (!lockfile?.githubPackages) {
		return [];
	}

	return Object.entries(lockfile.githubPackages).map(([specifier, entry]) => ({
		specifier,
		entry: entry as GitHubLockfileEntry,
	}));
}
