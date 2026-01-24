/**
 * PSPM Types - CLI-specific types for PSPM
 *
 * This module contains types and utilities used by the PSPM CLI
 * that are not part of the API contract (SDK).
 */

// Integrity utilities
export { calculateIntegrity, verifyIntegrity } from "./integrity.js";
// Lockfile types
// Legacy lockfile types (deprecated, use Pspm* versions)
export type {
	GitHubLockfileEntry,
	PspmLockfile,
	PspmLockfile as SkillLockfile,
	PspmLockfileEntry,
	PspmLockfileEntry as SkillLockfileEntry,
} from "./lockfile.js";

// Manifest types (pspm.json)
export {
	type AgentConfig,
	type BuiltInAgent,
	DEFAULT_MAIN,
	DEFAULT_SKILL_FILES,
	type ManifestDetectionResult,
	normalizeManifest,
	PSPM_SCHEMA_URL,
	type PspmManifest,
	type PspmManifestRequirements,
	validateManifest,
} from "./manifest.js";
// Skill specifier parsing
export {
	formatGitHubSpecifier,
	type GitHubSpecifier,
	generateSkillIdentifier,
	getGitHubSkillName,
	isGitHubSpecifier,
	parseGitHubSpecifier,
	parseSkillSpecifier,
	type SkillSpecifier,
} from "./specifier.js";
// Version utilities
export {
	compareVersions,
	getLatestVersion,
	isNewerVersion,
	normalizeVersionRange,
	resolveVersion,
	versionSatisfies,
} from "./version.js";
