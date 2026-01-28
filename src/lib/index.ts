/**
 * PSPM Types - CLI-specific types for PSPM
 *
 * This module contains types and utilities used by the PSPM CLI
 * that are not part of the API contract (SDK).
 */

// Integrity utilities
export { calculateIntegrity, verifyIntegrity } from "./integrity.js";
// Local specifier support
export {
	formatLocalSpecifier,
	getLocalSkillName,
	isBareLocalPath,
	isLocalSpecifier,
	type LocalSpecifier,
	normalizeToFileSpecifier,
	parseLocalSpecifier,
	resolveLocalPath,
	validateLocalSkill,
} from "./local.js";
// Lockfile types
// Legacy lockfile types (deprecated, use Pspm* versions)
export type {
	GitHubLockfileEntry,
	LocalLockfileEntry,
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
// Resolver utilities
export {
	computeInstallOrder,
	type DependencyGraph,
	type DependencyNode,
	formatResolutionErrors,
	formatVersionConflicts,
	MAX_DEPENDENCY_DEPTH,
	printResolutionErrors,
	type ResolutionError,
	type ResolutionErrorType,
	type ResolutionResult,
	type ResolverConfig,
	resolveRecursive,
	topologicalSort,
	type VersionConflict,
} from "./resolver.js";
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
	findHighestSatisfying,
	getLatestVersion,
	isNewerVersion,
	normalizeVersionRange,
	rangesIntersect,
	resolveVersion,
	versionSatisfies,
} from "./version.js";
