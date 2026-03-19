/**
 * Remove command - Remove an installed skill.
 *
 * Supports:
 * - Registry skills (by full specifier or short name)
 * - GitHub skills (by specifier or skill name)
 */

import { rm } from "node:fs/promises";
import { join } from "node:path";
import { getAvailableAgents } from "@/agents";
import { getSkillsDir } from "@/config";
import {
  getGitHubSkillName,
  isGitHubSpecifier,
  isRegistrySpecifier,
  parseGitHubSpecifier,
  parseRegistrySpecifier,
} from "@/lib/index";
import {
  listLockfileGitHubPackages,
  listLockfileSkills,
  removeFromLockfile,
  removeGitHubFromLockfile,
} from "@/lockfile";
import {
  readManifest,
  removeDependency,
  removeGitHubDependency,
} from "@/manifest";
import { getGitHubSkillPath, removeAgentSymlinks } from "@/symlinks";

export async function remove(nameOrSpecifier: string): Promise<void> {
  try {
    // Read manifest for agent config overrides
    const manifest = await readManifest();
    const agentConfigs = manifest?.agents;
    const agents = getAvailableAgents(agentConfigs);

    // Determine type of specifier
    if (isGitHubSpecifier(nameOrSpecifier)) {
      await removeGitHub(nameOrSpecifier, agents, agentConfigs);
    } else if (isRegistrySpecifier(nameOrSpecifier)) {
      await removeRegistry(nameOrSpecifier, agents, agentConfigs);
    } else {
      // Short name - try to find in either registry or GitHub skills
      await removeByShortName(nameOrSpecifier, agents, agentConfigs);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}

/**
 * Remove a registry skill by full specifier.
 */
async function removeRegistry(
  specifier: string,
  agents: string[],
  agentConfigs?: Record<string, { skillsDir: string }>,
): Promise<void> {
  const parsed = parseRegistrySpecifier(specifier);
  if (!parsed) {
    console.error(`Error: Invalid skill specifier: ${specifier}`);
    process.exit(1);
  }

  const { namespace, owner, name, subname } = parsed;
  // Build the full lockfile key — @github includes subname
  const fullName =
    namespace === "github" && subname
      ? `@github/${owner}/${name}/${subname}`
      : `@${namespace}/${owner}/${name}`;

  console.log(`Removing ${fullName}...`);

  // Remove from lockfile
  const removedFromLockfile = await removeFromLockfile(fullName);

  // Remove from pspm.json dependencies
  const removedFromManifest = await removeDependency(fullName);

  if (!removedFromLockfile && !removedFromManifest) {
    console.error(`Error: ${fullName} not found in lockfile or pspm.json`);
    process.exit(1);
  }

  // Remove symlinks from all agents — use subname for @github (the actual skill name)
  const symlinkName = subname ?? name;
  await removeAgentSymlinks(symlinkName, {
    agents,
    projectRoot: process.cwd(),
    agentConfigs,
  });

  // Remove from disk
  const skillsDir = getSkillsDir();
  let destDir: string;
  if (namespace === "github" && subname) {
    destDir = join(skillsDir, "_github-registry", owner, name, subname);
  } else if (namespace === "org") {
    destDir = join(skillsDir, "_org", owner, name);
  } else {
    destDir = join(skillsDir, owner, name);
  }

  try {
    await rm(destDir, { recursive: true, force: true });
  } catch {
    // Ignore errors if directory doesn't exist
  }

  console.log(`Removed ${fullName}`);
}

/**
 * Remove a GitHub skill by specifier.
 */
async function removeGitHub(
  specifier: string,
  agents: string[],
  agentConfigs?: Record<string, { skillsDir: string }>,
): Promise<void> {
  const parsed = parseGitHubSpecifier(specifier);
  if (!parsed) {
    console.error(`Error: Invalid GitHub specifier: ${specifier}`);
    process.exit(1);
  }

  // Build the lockfile key (without ref)
  const lockfileKey = parsed.path
    ? `github:${parsed.owner}/${parsed.repo}/${parsed.path}`
    : `github:${parsed.owner}/${parsed.repo}`;

  console.log(`Removing ${lockfileKey}...`);

  // Remove from lockfile
  const removedFromLockfile = await removeGitHubFromLockfile(lockfileKey);

  // Remove from pspm.json githubDependencies
  const removedFromManifest = await removeGitHubDependency(lockfileKey);

  if (!removedFromLockfile && !removedFromManifest) {
    console.error(`Error: ${lockfileKey} not found in lockfile or pspm.json`);
    process.exit(1);
  }

  // Remove symlinks from all agents
  const skillName = getGitHubSkillName(parsed);
  await removeAgentSymlinks(skillName, {
    agents,
    projectRoot: process.cwd(),
    agentConfigs,
  });

  // Remove from disk
  const skillsDir = getSkillsDir();
  const destPath = getGitHubSkillPath(parsed.owner, parsed.repo, parsed.path);
  const destDir = join(skillsDir, "..", destPath);

  try {
    await rm(destDir, { recursive: true, force: true });
  } catch {
    // Ignore errors if directory doesn't exist
  }

  console.log(`Removed ${lockfileKey}`);
}

/**
 * Remove a skill by short name (searches both registry and GitHub skills).
 */
async function removeByShortName(
  shortName: string,
  agents: string[],
  agentConfigs?: Record<string, { skillsDir: string }>,
): Promise<void> {
  // First try to find in registry skills (covers @user, @org, @github namespaces)
  const registrySkills = await listLockfileSkills();
  const foundRegistry = registrySkills.find((s) => {
    const parsed = parseRegistrySpecifier(s.name);
    if (!parsed) return false;
    // For @github, the effective skill name is subname; for others it's name
    const effectiveName = parsed.subname ?? parsed.name;
    return effectiveName === shortName;
  });

  if (foundRegistry) {
    await removeRegistry(foundRegistry.name, agents, agentConfigs);
    return;
  }

  // Try to find in GitHub skills
  const githubSkills = await listLockfileGitHubPackages();
  const foundGitHub = githubSkills.find((s) => {
    const parsed = parseGitHubSpecifier(s.specifier);
    if (!parsed) return false;
    return getGitHubSkillName(parsed) === shortName;
  });

  if (foundGitHub) {
    await removeGitHub(foundGitHub.specifier, agents, agentConfigs);
    return;
  }

  console.error(`Error: Skill "${shortName}" not found in lockfile`);
  process.exit(1);
}
