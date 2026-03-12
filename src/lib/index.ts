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
} from "./ignore";

// Integrity utilities
export { calculateIntegrity } from "./integrity";
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
  type WellKnownLockfileEntry,
} from "./lockfile";

// Manifest types (pspm.json)
export {
  type AgentConfig,
  type BuiltInAgent,
  DEFAULT_SKILL_FILES,
  type ManifestDetectionResult,
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
  generateRegistryIdentifier,
  generateSkillIdentifier,
  getGitHubSkillName,
  getRegistrySkillName,
  isGitHubShorthand,
  isGitHubSpecifier,
  isGitHubUrl,
  isRegistrySpecifier,
  type NamespaceType,
  parseGitHubShorthand,
  parseGitHubSpecifier,
  parseGitHubUrl,
  parseRegistrySpecifier,
  parseSkillSpecifier,
  type RegistrySpecifier,
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
