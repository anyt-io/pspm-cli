/**
 * Local specifier support for PSPM
 *
 * Format: file:{path}
 *
 * Supports both relative and absolute paths:
 * - file:../my-skill
 * - file:./local-skill
 * - file:/absolute/path/to/skill
 *
 * Similar to npm/pnpm's file: protocol, but creates symlinks
 * for instant updates during development.
 */

import { access, stat } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import type { LocalLockfileEntry } from "./lockfile.js";
import type { PspmManifest } from "./manifest.js";

// Re-export for convenience
export type { LocalLockfileEntry };

/**
 * Parsed local specifier
 *
 * @example
 * - file:../my-skill
 * - file:./local-skill
 * - file:/absolute/path/to/skill
 */
export interface LocalSpecifier {
	/** The path (relative or absolute) */
	path: string;
	/** Whether path is absolute (starts with /) */
	isAbsolute: boolean;
}

/**
 * Local specifier regex pattern
 * Matches: file:{path}
 *
 * Path can be:
 * - Relative: ./path, ../path
 * - Absolute: /path/to/skill
 */
const LOCAL_SPECIFIER_PATTERN = /^file:(.+)$/;

/**
 * Check if a string is a local specifier
 *
 * @param specifier - The specifier string to check
 * @returns true if the specifier starts with "file:"
 */
export function isLocalSpecifier(specifier: string): boolean {
	return specifier.startsWith("file:");
}

/**
 * Check if a string looks like a bare local path (no file: prefix)
 *
 * Used to auto-detect local paths like "../my-skill" or "./skill"
 *
 * @param specifier - The specifier string to check
 * @returns true if the specifier looks like a relative path
 */
export function isBareLocalPath(specifier: string): boolean {
	return specifier.startsWith("./") || specifier.startsWith("../");
}

/**
 * Parse a local specifier string.
 *
 * @param specifier - The specifier string (e.g., "file:../my-skill")
 * @returns Parsed specifier or null if invalid
 *
 * @example
 * ```typescript
 * parseLocalSpecifier("file:../my-skill")
 * // => { path: "../my-skill", isAbsolute: false }
 *
 * parseLocalSpecifier("file:/absolute/path/to/skill")
 * // => { path: "/absolute/path/to/skill", isAbsolute: true }
 * ```
 */
export function parseLocalSpecifier(specifier: string): LocalSpecifier | null {
	const match = specifier.match(LOCAL_SPECIFIER_PATTERN);

	if (!match) {
		return null;
	}

	const path = match[1];

	// Validate the path is not empty and looks valid
	if (!path || path.trim() === "") {
		return null;
	}

	return {
		path,
		isAbsolute: isAbsolute(path),
	};
}

/**
 * Format a LocalSpecifier back to string format.
 *
 * @param spec - The local specifier object
 * @returns Formatted string (e.g., "file:../my-skill")
 */
export function formatLocalSpecifier(spec: LocalSpecifier): string {
	return `file:${spec.path}`;
}

/**
 * Extract skill name from local specifier.
 * Uses the last segment of the path.
 *
 * @param spec - The local specifier object
 * @returns Skill name (e.g., "my-skill")
 *
 * @example
 * ```typescript
 * getLocalSkillName({ path: "../my-skill", isAbsolute: false })
 * // => "my-skill"
 *
 * getLocalSkillName({ path: "/path/to/awesome-skill", isAbsolute: true })
 * // => "awesome-skill"
 * ```
 */
export function getLocalSkillName(spec: LocalSpecifier): string {
	// Remove trailing slashes and get the last segment
	const normalizedPath = spec.path.replace(/\/+$/, "");
	const segments = normalizedPath.split("/").filter(Boolean);
	return segments[segments.length - 1] || spec.path;
}

/**
 * Normalize a bare path to a file: specifier
 *
 * @param path - A bare path like "../my-skill" or "./skill"
 * @returns File specifier string like "file:../my-skill"
 */
export function normalizeToFileSpecifier(path: string): string {
	if (isLocalSpecifier(path)) {
		return path;
	}
	return `file:${path}`;
}

/**
 * Resolve a local specifier path to an absolute path.
 *
 * @param spec - The local specifier object
 * @param basePath - Base path for relative paths (defaults to cwd)
 * @returns Absolute path to the skill directory
 */
export function resolveLocalPath(
	spec: LocalSpecifier,
	basePath: string = process.cwd(),
): string {
	if (spec.isAbsolute) {
		return resolve(spec.path);
	}
	return resolve(basePath, spec.path);
}

/**
 * Validate that a local skill directory exists and contains a valid manifest.
 *
 * @param absolutePath - Absolute path to the skill directory
 * @returns Object with validation result
 */
export async function validateLocalSkill(absolutePath: string): Promise<{
	valid: boolean;
	error?: string;
	manifest?: PspmManifest;
}> {
	// Check directory exists
	try {
		const stats = await stat(absolutePath);
		if (!stats.isDirectory()) {
			return { valid: false, error: `Not a directory: ${absolutePath}` };
		}
	} catch {
		return { valid: false, error: `Directory not found: ${absolutePath}` };
	}

	// Check for pspm.json
	const manifestPath = join(absolutePath, "pspm.json");
	try {
		await access(manifestPath);
	} catch {
		return {
			valid: false,
			error: `No pspm.json found in ${absolutePath}`,
		};
	}

	// Try to read and parse manifest
	try {
		const { readFile } = await import("node:fs/promises");
		const content = await readFile(manifestPath, "utf-8");
		const manifest = JSON.parse(content) as PspmManifest;

		// Validate manifest has required fields
		if (!manifest.name) {
			return {
				valid: false,
				error: `Manifest in ${absolutePath} is missing 'name' field`,
			};
		}

		return { valid: true, manifest };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			valid: false,
			error: `Failed to read manifest in ${absolutePath}: ${message}`,
		};
	}
}
