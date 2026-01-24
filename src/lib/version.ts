import * as semver from "semver";

/**
 * Resolve the best matching version from a list of available versions.
 *
 * @param range - The version range to match (e.g., "^1.0.0", "~2.1.0", "*")
 * @param availableVersions - List of available version strings
 * @returns The best matching version or null if none found
 */
export function resolveVersion(
	range: string,
	availableVersions: string[],
): string | null {
	const sorted = availableVersions
		.filter((v) => semver.valid(v))
		.sort((a, b) => semver.rcompare(a, b));

	if (!range || range === "latest" || range === "*") {
		return sorted[0] ?? null;
	}

	return semver.maxSatisfying(sorted, range);
}

/**
 * Check if a version satisfies a given range.
 */
export function versionSatisfies(version: string, range: string): boolean {
	return semver.satisfies(version, range);
}

/**
 * Normalize a version range string.
 * Converts "latest" or empty to "*".
 */
export function normalizeVersionRange(range?: string): string {
	if (!range || range === "latest") {
		return "*";
	}
	return range;
}

/**
 * Compare two versions.
 * Returns: -1 if a < b, 0 if a === b, 1 if a > b
 */
export function compareVersions(a: string, b: string): number {
	return semver.compare(a, b);
}

/**
 * Check if version a is greater than version b.
 */
export function isNewerVersion(a: string, b: string): boolean {
	return semver.gt(a, b);
}

/**
 * Get the latest version from a list.
 */
export function getLatestVersion(versions: string[]): string | null {
	const valid = versions.filter((v) => semver.valid(v));
	if (valid.length === 0) return null;
	return valid.sort((a, b) => semver.rcompare(a, b))[0] ?? null;
}
