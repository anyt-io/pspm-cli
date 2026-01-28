/**
 * Remove command - Remove an installed skill.
 *
 * Supports:
 * - Registry skills (by full specifier or short name)
 * - GitHub skills (by specifier or skill name)
 * - Local skills (by specifier or skill name)
 */

import { rm } from "node:fs/promises";
import { join } from "node:path";
import { getAvailableAgents } from "../agents.js";
import { getSkillsDir } from "../config.js";
import {
	getGitHubSkillName,
	isGitHubSpecifier,
	isLocalSpecifier,
	parseGitHubSpecifier,
	parseLocalSpecifier,
} from "../lib/index.js";
import {
	listLockfileGitHubPackages,
	listLockfileLocalPackages,
	listLockfileSkills,
	removeFromLockfile,
	removeGitHubFromLockfile,
	removeLocalFromLockfile,
} from "../lockfile.js";
import {
	readManifest,
	removeDependency,
	removeGitHubDependency,
	removeLocalDependency,
} from "../manifest.js";
import { getGitHubSkillPath, removeAgentSymlinks } from "../symlinks.js";

export async function remove(nameOrSpecifier: string): Promise<void> {
	try {
		// Read manifest for agent config overrides
		const manifest = await readManifest();
		const agentConfigs = manifest?.agents;
		const agents = getAvailableAgents(agentConfigs);

		// Determine type of specifier
		if (isLocalSpecifier(nameOrSpecifier)) {
			await removeLocal(nameOrSpecifier, agents, agentConfigs);
		} else if (isGitHubSpecifier(nameOrSpecifier)) {
			await removeGitHub(nameOrSpecifier, agents, agentConfigs);
		} else if (nameOrSpecifier.startsWith("@user/")) {
			await removeRegistry(nameOrSpecifier, agents, agentConfigs);
		} else {
			// Short name - try to find in registry, GitHub, or local skills
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
	const match = specifier.match(/^@user\/([^/]+)\/([^@/]+)/);
	if (!match) {
		console.error(`Error: Invalid skill specifier: ${specifier}`);
		process.exit(1);
	}

	const fullName = `@user/${match[1]}/${match[2]}`;
	const username = match[1];
	const name = match[2];

	console.log(`Removing ${fullName}...`);

	// Remove from lockfile
	const removedFromLockfile = await removeFromLockfile(fullName);

	// Remove from pspm.json dependencies
	const removedFromManifest = await removeDependency(fullName);

	if (!removedFromLockfile && !removedFromManifest) {
		console.error(`Error: ${fullName} not found in lockfile or pspm.json`);
		process.exit(1);
	}

	// Remove symlinks from all agents
	await removeAgentSymlinks(name, {
		agents,
		projectRoot: process.cwd(),
		agentConfigs,
	});

	// Remove from disk
	const skillsDir = getSkillsDir();
	const destDir = join(skillsDir, username, name);

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
 * Remove a local skill by specifier.
 */
async function removeLocal(
	specifier: string,
	agents: string[],
	agentConfigs?: Record<string, { skillsDir: string }>,
): Promise<void> {
	const parsed = parseLocalSpecifier(specifier);
	if (!parsed) {
		console.error(`Error: Invalid local specifier: ${specifier}`);
		process.exit(1);
	}

	console.log(`Removing ${specifier}...`);

	// Remove from lockfile
	const removedFromLockfile = await removeLocalFromLockfile(specifier);

	// Remove from pspm.json localDependencies
	const removedFromManifest = await removeLocalDependency(specifier);

	if (!removedFromLockfile && !removedFromManifest) {
		console.error(`Error: ${specifier} not found in lockfile or pspm.json`);
		process.exit(1);
	}

	// Get skill name from lockfile or parse from path
	const localSkills = await listLockfileLocalPackages();
	const foundLocal = localSkills.find((s) => s.specifier === specifier);
	const skillName =
		foundLocal?.entry.name ||
		parsed.path.split("/").filter(Boolean).pop() ||
		"unknown";

	// Remove symlinks from all agents
	await removeAgentSymlinks(skillName, {
		agents,
		projectRoot: process.cwd(),
		agentConfigs,
	});

	// Remove from disk (the symlink in _local)
	const skillsDir = getSkillsDir();
	const symlinkPath = join(skillsDir, "_local", skillName);

	try {
		await rm(symlinkPath, { force: true });
	} catch {
		// Ignore errors if symlink doesn't exist
	}

	console.log(`Removed ${specifier}`);
}

/**
 * Remove a skill by short name (searches registry, GitHub, and local skills).
 */
async function removeByShortName(
	shortName: string,
	agents: string[],
	agentConfigs?: Record<string, { skillsDir: string }>,
): Promise<void> {
	// First try to find in registry skills
	const registrySkills = await listLockfileSkills();
	const foundRegistry = registrySkills.find((s) => {
		const match = s.name.match(/^@user\/([^/]+)\/([^/]+)$/);
		return match && match[2] === shortName;
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

	// Try to find in local skills
	const localSkills = await listLockfileLocalPackages();
	const foundLocal = localSkills.find((s) => s.entry.name === shortName);

	if (foundLocal) {
		await removeLocal(foundLocal.specifier, agents, agentConfigs);
		return;
	}

	console.error(`Error: Skill "${shortName}" not found in lockfile`);
	process.exit(1);
}
