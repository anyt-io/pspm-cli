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

/**
 * Find the highest version that satisfies ALL given ranges.
 * Used for pnpm-style dependency resolution where multiple dependents
 * may require the same package with different version constraints.
 *
 * @param ranges - Array of semver ranges to satisfy (e.g., ["^1.0.0", ">=1.2.0"])
 * @param availableVersions - List of available version strings
 * @returns The highest version satisfying all ranges, or null if none found
 */
export function findHighestSatisfying(
	ranges: string[],
	availableVersions: string[],
): string | null {
	const sorted = availableVersions
		.filter((v) => semver.valid(v))
		.sort((a, b) => semver.rcompare(a, b));

	if (sorted.length === 0) return null;

	// Normalize ranges
	const normalizedRanges = ranges.map((r) =>
		!r || r === "latest" || r === "*" ? "*" : r,
	);

	// Find highest version satisfying all ranges
	for (const version of sorted) {
		const satisfiesAll = normalizedRanges.every((range) =>
			semver.satisfies(version, range),
		);
		if (satisfiesAll) {
			return version;
		}
	}

	return null;
}

/**
 * Intersect multiple semver ranges to find if they're compatible.
 * Returns true if there exists at least one version that could satisfy all ranges.
 *
 * @param ranges - Array of semver ranges to check
 * @returns True if ranges can be satisfied together
 */
export function rangesIntersect(ranges: string[]): boolean {
	if (ranges.length === 0) return true;
	if (ranges.length === 1) return true;

	// Normalize ranges
	const normalizedRanges = ranges.map((r) =>
		!r || r === "latest" || r === "*" ? "*" : r,
	);

	// Check if all ranges intersect by seeing if any version could satisfy all
	// We use a subset of the range to find intersections
	try {
		const intersection = normalizedRanges.reduce((acc, range) => {
			if (acc === "*") return range;
			if (range === "*") return acc;
			return semver.intersects(acc, range) ? `${acc} ${range}` : "";
		}, "*");
		return intersection !== "";
	} catch {
		return false;
	}
}
