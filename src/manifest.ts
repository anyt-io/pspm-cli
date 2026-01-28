import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { PspmManifest } from "./lib/index.js";

/**
 * Get the manifest file path (pspm.json in current directory)
 */
export function getManifestPath(): string {
	return join(process.cwd(), "pspm.json");
}

/**
 * Read the manifest file (pspm.json)
 * Returns null if file doesn't exist
 */
export async function readManifest(): Promise<PspmManifest | null> {
	try {
		const content = await readFile(getManifestPath(), "utf-8");
		return JSON.parse(content) as PspmManifest;
	} catch {
		return null;
	}
}

/**
 * Write the manifest file (pspm.json)
 */
export async function writeManifest(manifest: PspmManifest): Promise<void> {
	const content = JSON.stringify(manifest, null, 2);
	await writeFile(getManifestPath(), `${content}\n`);
}

/**
 * Create a minimal manifest with just dependencies
 * Similar to how npm creates package.json with just dependencies when you run `npm add`
 * This is for consuming packages, not publishing - so only dependencies are needed
 */
export async function createMinimalManifest(): Promise<PspmManifest> {
	return {
		dependencies: {},
	} as PspmManifest;
}

/**
 * Ensure manifest exists, creating a minimal one if needed
 * Returns the manifest (existing or newly created)
 */
export async function ensureManifest(): Promise<PspmManifest> {
	let manifest = await readManifest();

	if (!manifest) {
		manifest = await createMinimalManifest();
		await writeManifest(manifest);
	}

	return manifest;
}

/**
 * Add a dependency to the manifest
 * Creates the manifest if it doesn't exist
 *
 * @param skillName - Full skill name (e.g., "@user/alice/my-skill")
 * @param versionRange - Version range to save (e.g., "^1.0.0")
 */
export async function addDependency(
	skillName: string,
	versionRange: string,
): Promise<void> {
	const manifest = await ensureManifest();

	// Initialize dependencies if not present
	if (!manifest.dependencies) {
		manifest.dependencies = {};
	}

	// Add or update the dependency
	manifest.dependencies[skillName] = versionRange;

	await writeManifest(manifest);
}

/**
 * Remove a dependency from the manifest
 *
 * @param skillName - Full skill name (e.g., "@user/alice/my-skill")
 * @returns true if dependency was removed, false if it didn't exist
 */
export async function removeDependency(skillName: string): Promise<boolean> {
	const manifest = await readManifest();

	if (!manifest?.dependencies?.[skillName]) {
		return false;
	}

	delete manifest.dependencies[skillName];
	await writeManifest(manifest);
	return true;
}

/**
 * Get all dependencies from the manifest
 * Returns empty object if manifest doesn't exist or has no dependencies
 */
export async function getDependencies(): Promise<Record<string, string>> {
	const manifest = await readManifest();
	return manifest?.dependencies ?? {};
}

/**
 * Get all GitHub dependencies from the manifest
 * Returns empty object if manifest doesn't exist or has no GitHub dependencies
 */
export async function getGitHubDependencies(): Promise<Record<string, string>> {
	const manifest = await readManifest();
	return manifest?.githubDependencies ?? {};
}

/**
 * Add a GitHub dependency to the manifest
 * Creates the manifest if it doesn't exist
 *
 * @param specifier - GitHub specifier (e.g., "github:owner/repo/path")
 * @param ref - Git ref (branch, tag, or "latest")
 */
export async function addGitHubDependency(
	specifier: string,
	ref: string,
): Promise<void> {
	const manifest = await ensureManifest();

	// Initialize githubDependencies if not present
	if (!manifest.githubDependencies) {
		manifest.githubDependencies = {};
	}

	// Add or update the dependency
	manifest.githubDependencies[specifier] = ref;

	await writeManifest(manifest);
}

/**
 * Remove a GitHub dependency from the manifest
 *
 * @param specifier - GitHub specifier (e.g., "github:owner/repo/path")
 * @returns true if dependency was removed, false if it didn't exist
 */
export async function removeGitHubDependency(
	specifier: string,
): Promise<boolean> {
	const manifest = await readManifest();

	if (!manifest?.githubDependencies?.[specifier]) {
		return false;
	}

	delete manifest.githubDependencies[specifier];
	await writeManifest(manifest);
	return true;
}

// =============================================================================
// Local Dependency Support
// =============================================================================

/**
 * Get all local dependencies from the manifest
 * Returns empty object if manifest doesn't exist or has no local dependencies
 */
export async function getLocalDependencies(): Promise<Record<string, string>> {
	const manifest = await readManifest();
	return manifest?.localDependencies ?? {};
}

/**
 * Add a local dependency to the manifest
 * Creates the manifest if it doesn't exist
 *
 * @param specifier - Local specifier (e.g., "file:../my-skill")
 * @param version - Version string (usually "*" for local deps)
 */
export async function addLocalDependency(
	specifier: string,
	version: string = "*",
): Promise<void> {
	const manifest = await ensureManifest();

	// Initialize localDependencies if not present
	if (!manifest.localDependencies) {
		manifest.localDependencies = {};
	}

	// Add or update the dependency
	manifest.localDependencies[specifier] = version;

	await writeManifest(manifest);
}

/**
 * Remove a local dependency from the manifest
 *
 * @param specifier - Local specifier (e.g., "file:../my-skill")
 * @returns true if dependency was removed, false if it didn't exist
 */
export async function removeLocalDependency(
	specifier: string,
): Promise<boolean> {
	const manifest = await readManifest();

	if (!manifest?.localDependencies?.[specifier]) {
		return false;
	}

	delete manifest.localDependencies[specifier];
	await writeManifest(manifest);
	return true;
}
