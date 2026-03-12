/**
 * Symlink management for agent skill directories.
 *
 * Creates relative symlinks from agent-specific directories (e.g., .claude/skills/)
 * to the central .pspm/skills/ directory for portability.
 */

import { lstat, mkdir, readlink, rm, symlink } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { resolveAgentConfig } from "./agents";
import type { AgentConfig } from "./lib/index";

/**
 * Options for creating agent symlinks.
 */
export interface CreateSymlinksOptions {
  /** Agent names to create symlinks for */
  agents: string[];
  /** Project root directory (or home directory for global installs) */
  projectRoot: string;
  /** Custom agent configuration overrides from pspm.json */
  agentConfigs?: Record<string, AgentConfig>;
  /** If true, use global agent paths (relative to home directory) */
  global?: boolean;
}

/**
 * Information about an installed skill for symlinking.
 */
export interface SkillInfo {
  /** Skill name (used as symlink name) */
  name: string;
  /** Path to skill within .pspm/skills/ (relative to project root) */
  sourcePath: string;
}

/**
 * Create symlinks for all skills to specified agent directories.
 *
 * @param skills - List of skills to create symlinks for
 * @param options - Symlink creation options
 */
export async function createAgentSymlinks(
  skills: SkillInfo[],
  options: CreateSymlinksOptions,
): Promise<void> {
  const { agents, projectRoot, agentConfigs } = options;

  // Skip if "none" agent
  if (agents.length === 1 && agents[0] === "none") {
    return;
  }

  for (const agentName of agents) {
    const config = resolveAgentConfig(agentName, agentConfigs, options.global);

    if (!config) {
      console.warn(`Warning: Unknown agent "${agentName}", skipping symlinks`);
      continue;
    }

    const agentSkillsDir = join(projectRoot, config.skillsDir);

    // Create agent skills directory
    await mkdir(agentSkillsDir, { recursive: true });

    for (const skill of skills) {
      const symlinkPath = join(agentSkillsDir, skill.name);
      const targetPath = join(projectRoot, skill.sourcePath);

      // Calculate relative path from symlink location to target
      const relativeTarget = relative(dirname(symlinkPath), targetPath);

      await createSymlink(symlinkPath, relativeTarget, skill.name);
    }
  }
}

/**
 * Create a single symlink, handling existing files/symlinks.
 *
 * @param symlinkPath - Absolute path where symlink will be created
 * @param target - Relative path to target (relative to symlink's parent dir)
 * @param skillName - Name for logging
 */
async function createSymlink(
  symlinkPath: string,
  target: string,
  skillName: string,
): Promise<void> {
  try {
    // Check if something exists at the symlink path
    const stats = await lstat(symlinkPath).catch(() => null);

    if (stats) {
      if (stats.isSymbolicLink()) {
        // Check if it points to the correct target
        const existingTarget = await readlink(symlinkPath);
        if (existingTarget === target) {
          // Already correct, nothing to do
          return;
        }
        // Remove incorrect symlink
        await rm(symlinkPath);
      } else {
        // Regular file or directory exists - warn and skip
        console.warn(
          `Warning: File exists at symlink path for "${skillName}", skipping: ${symlinkPath}`,
        );
        return;
      }
    }

    // Create the symlink
    await symlink(target, symlinkPath);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(
      `Warning: Failed to create symlink for "${skillName}": ${message}`,
    );
  }
}

/**
 * Remove symlinks for a skill from all agent directories.
 *
 * @param skillName - Name of the skill (symlink name)
 * @param options - Symlink options
 */
export async function removeAgentSymlinks(
  skillName: string,
  options: CreateSymlinksOptions,
): Promise<void> {
  const { agents, projectRoot, agentConfigs } = options;

  // Skip if "none" agent
  if (agents.length === 1 && agents[0] === "none") {
    return;
  }

  for (const agentName of agents) {
    const config = resolveAgentConfig(agentName, agentConfigs);

    if (!config) {
      continue;
    }

    const symlinkPath = join(projectRoot, config.skillsDir, skillName);

    try {
      const stats = await lstat(symlinkPath).catch(() => null);

      if (stats?.isSymbolicLink()) {
        await rm(symlinkPath);
      }
    } catch {
      // Ignore errors - symlink may not exist
    }
  }
}

/**
 * Get the source path for a registry skill within .pspm/skills/.
 *
 * @param ownerOrNamespace - Skill author username, or namespace prefix
 * @param skillNameOrOwner - Skill name (2-arg form) or owner (3-arg form)
 * @param skillName - Skill name (3-arg form only)
 * @returns Relative path from project root (e.g., ".pspm/skills/alice/my-skill")
 */
export function getRegistrySkillPath(
  ownerOrNamespace: string,
  skillNameOrOwner: string,
  skillName?: string,
): string {
  if (skillName !== undefined) {
    // 3-arg form: namespace, owner, skillName
    // e.g., ("user", "alice", "my-skill") -> ".pspm/skills/alice/my-skill"
    // e.g., ("org", "anyt", "code-review") -> ".pspm/skills/_org/anyt/code-review"
    // e.g., ("github", "microsoft", "skills/azure-ai") -> ".pspm/skills/_github-registry/microsoft/skills/azure-ai"
    const namespace = ownerOrNamespace;
    const owner = skillNameOrOwner;
    if (namespace === "org") {
      return `.pspm/skills/_org/${owner}/${skillName}`;
    }
    if (namespace === "github") {
      // skillName contains "repo/subname" for @github namespace
      return `.pspm/skills/_github-registry/${owner}/${skillName}`;
    }
    // "user" namespace uses flat structure for backward compat
    return `.pspm/skills/${owner}/${skillName}`;
  }
  // 2-arg legacy form: username, skillName
  return `.pspm/skills/${ownerOrNamespace}/${skillNameOrOwner}`;
}

/**
 * Get the source path for a GitHub skill within .pspm/skills/.
 *
 * @param owner - GitHub repository owner
 * @param repo - GitHub repository name
 * @param path - Optional path within the repository
 * @returns Relative path from project root (e.g., ".pspm/skills/_github/owner/repo/path")
 */
export function getGitHubSkillPath(
  owner: string,
  repo: string,
  path?: string,
): string {
  if (path) {
    return `.pspm/skills/_github/${owner}/${repo}/${path}`;
  }
  return `.pspm/skills/_github/${owner}/${repo}`;
}

/**
 * Get the source path for a local skill within .pspm/skills/.
 *
 * @param skillName - Skill name
 * @returns Relative path from project root (e.g., ".pspm/skills/_local/my-skill")
 */
export function getLocalSkillPath(skillName: string): string {
  return `.pspm/skills/_local/${skillName}`;
}

/**
 * Get the source path for a well-known skill within .pspm/skills/.
 *
 * @param hostname - Source hostname (e.g., "acme.com")
 * @param skillName - Skill name
 * @returns Relative path from project root (e.g., ".pspm/skills/_wellknown/acme.com/my-skill")
 */
export function getWellKnownSkillPath(
  hostname: string,
  skillName: string,
): string {
  return `.pspm/skills/_wellknown/${hostname}/${skillName}`;
}

/**
 * Check which agents have symlinks for a given skill.
 *
 * @param skillName - Name of the skill (symlink name)
 * @param agents - Agent names to check
 * @param projectRoot - Project root directory
 * @param agentConfigs - Custom agent configurations
 * @returns Array of agent names that have valid symlinks
 */
export async function getLinkedAgents(
  skillName: string,
  agents: string[],
  projectRoot: string,
  agentConfigs?: Record<string, AgentConfig>,
): Promise<string[]> {
  const linkedAgents: string[] = [];

  for (const agentName of agents) {
    const config = resolveAgentConfig(agentName, agentConfigs);
    if (!config) continue;

    const symlinkPath = join(projectRoot, config.skillsDir, skillName);

    try {
      const stats = await lstat(symlinkPath);
      if (stats.isSymbolicLink()) {
        linkedAgents.push(agentName);
      }
    } catch {
      // Symlink doesn't exist
    }
  }

  return linkedAgents;
}
