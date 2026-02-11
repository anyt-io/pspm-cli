/**
 * Ignore file handling for PSPM publish/pack
 *
 * Similar to npm's .npmignore behavior:
 * - If .pspmignore exists, use it
 * - Otherwise, fallback to .gitignore
 * - Always ignore node_modules and .git regardless
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import ignore, { type Ignore } from "ignore";

/**
 * Files/directories that are always ignored regardless of ignore file contents
 */
const ALWAYS_IGNORED = [
	"node_modules",
	".git",
	".pspm-publish", // temp directory used during publish
];

/**
 * Result of loading ignore patterns
 */
export interface IgnoreLoadResult {
	/** The ignore instance with loaded patterns */
	ig: Ignore;
	/** Which file the patterns came from (null if using defaults only) */
	source: ".pspmignore" | ".gitignore" | null;
	/** Raw patterns loaded from the file (excluding defaults) */
	patterns: string[];
}

/**
 * Load ignore patterns from .pspmignore or .gitignore
 *
 * Priority:
 * 1. .pspmignore (if exists)
 * 2. .gitignore (if exists)
 * 3. Default patterns only (node_modules, .git)
 *
 * @param cwd - The directory to look for ignore files (defaults to process.cwd())
 * @returns An ignore instance and the source file used
 */
export async function loadIgnorePatterns(
	cwd: string = process.cwd(),
): Promise<IgnoreLoadResult> {
	const ig = ignore();

	// Always add default ignores
	ig.add(ALWAYS_IGNORED);

	// Try .pspmignore first
	const pspmIgnorePath = join(cwd, ".pspmignore");
	try {
		const content = await readFile(pspmIgnorePath, "utf-8");
		const patterns = parseIgnorePatterns(content);
		ig.add(patterns);
		return { ig, source: ".pspmignore", patterns };
	} catch {
		// .pspmignore not found, try .gitignore
	}

	// Fallback to .gitignore
	const gitIgnorePath = join(cwd, ".gitignore");
	try {
		const content = await readFile(gitIgnorePath, "utf-8");
		const patterns = parseIgnorePatterns(content);
		ig.add(patterns);
		return { ig, source: ".gitignore", patterns };
	} catch {
		// No .gitignore either, use defaults only
	}

	return { ig, source: null, patterns: [] };
}

/**
 * Create rsync exclude arguments from ignore patterns
 *
 * @param ig - The ignore instance
 * @returns Array of --exclude='pattern' arguments for rsync
 */
export function getExcludeArgsForRsync(patterns: string[]): string {
	// Always include the essential excludes
	const allPatterns = [...new Set([...ALWAYS_IGNORED, ...patterns])];

	return allPatterns.map((p) => `--exclude='${p}'`).join(" ");
}

/**
 * Create tar exclude arguments from ignore patterns
 *
 * @param patterns - Array of patterns to exclude
 * @returns String of --exclude='pattern' arguments for tar
 */
export function getExcludeArgsForTar(patterns: string[]): string {
	// Same as rsync
	const allPatterns = [...new Set([...ALWAYS_IGNORED, ...patterns])];

	return allPatterns.map((p) => `--exclude='${p}'`).join(" ");
}

/**
 * Parse an ignore file content into an array of patterns
 * Filters out comments and empty lines
 *
 * @param content - The content of an ignore file
 * @returns Array of patterns
 */
export function parseIgnorePatterns(content: string): string[] {
	return content
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line && !line.startsWith("#"));
}

/**
 * Read patterns from an ignore file
 *
 * @param filePath - Path to the ignore file
 * @returns Array of patterns, or empty array if file doesn't exist
 */
export async function readIgnoreFile(filePath: string): Promise<string[]> {
	try {
		const content = await readFile(filePath, "utf-8");
		return parseIgnorePatterns(content);
	} catch {
		return [];
	}
}

export { ALWAYS_IGNORED };
