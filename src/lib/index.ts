/**
 * PSPM Types - CLI-specific types for PSPM
 *
 * This module contains types and utilities used by the PSPM CLI
 * that are not part of the API contract (SDK).
 */

// Ignore file utilities
export {
	ALWAYS_IGNORED,
	getExcludeArgsForRsync,
	getExcludeArgsForTar,
	type IgnoreLoadResult,
	loadIgnorePatterns,
	parseIgnorePatterns,
	readIgnoreFile,
} from "./ignore";

// Integrity utilities
export { calculateIntegrity, verifyIntegrity } from "./integrity";
// Lockfile types
// Legacy lockfile types (deprecated, use Pspm* versions)
export {
	type GitHubLockfileEntry,
	type LocalLockfileEntry,
	PSPM_LOCKFILE_SCHEMA_URL,
	type PspmLockfile,
	type PspmLockfile as SkillLockfile,
	type PspmLockfileEntry,
	type PspmLockfileEntry as SkillLockfileEntry,
} from "./lockfile";

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
} from "./manifest";
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
} from "./resolver";
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
} from "./specifier";
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
} from "./version";
