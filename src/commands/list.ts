/**
 * List command - Show installed skills.
 *
 * Displays:
 * - Registry and GitHub skills
 * - Source type
 * - Version / commit info
 * - Linked agent paths
 */

import { access } from "node:fs/promises";
import { join } from "node:path";
import { getAvailableAgents, resolveAgentConfig } from "../agents.js";
import {
	type GitHubLockfileEntry,
	getGitHubSkillName,
	parseGitHubSpecifier,
} from "../lib/index.js";
import { listLockfileGitHubPackages, listLockfileSkills } from "../lockfile.js";
import { readManifest } from "../manifest.js";
import {
	getGitHubSkillPath,
	getLinkedAgents,
	getRegistrySkillPath,
} from "../symlinks.js";

export interface ListOptions {
	json?: boolean;
}

interface SkillListItem {
	name: string;
	fullName: string;
	version: string;
	source: "registry" | "github";
	sourcePath: string;
	status: "installed" | "missing";
	linkedAgents: string[];
	gitRef?: string;
	gitCommit?: string;
}

export async function list(options: ListOptions): Promise<void> {
	try {
		// Get all skills from lockfile
		const registrySkills = await listLockfileSkills();
		const githubSkills = await listLockfileGitHubPackages();

		// Read manifest for agent configs
		const manifest = await readManifest();
		const agentConfigs = manifest?.agents;
		const availableAgents = getAvailableAgents(agentConfigs);
		const projectRoot = process.cwd();

		// Build list of all skills
		const skills: SkillListItem[] = [];

		// Add registry skills
		for (const { name: fullName, entry } of registrySkills) {
			const match = fullName.match(/^@user\/([^/]+)\/([^/]+)$/);
			if (!match) continue;

			const [, username, skillName] = match;
			const sourcePath = getRegistrySkillPath(username, skillName);
			const absolutePath = join(projectRoot, sourcePath);

			// Check if installed on disk
			let status: "installed" | "missing" = "installed";
			try {
				await access(absolutePath);
			} catch {
				status = "missing";
			}

			// Check which agents have symlinks
			const linkedAgents = await getLinkedAgents(
				skillName,
				availableAgents,
				projectRoot,
				agentConfigs,
			);

			skills.push({
				name: skillName,
				fullName,
				version: entry.version,
				source: "registry",
				sourcePath,
				status,
				linkedAgents,
			});
		}

		// Add GitHub skills
		for (const { specifier, entry } of githubSkills) {
			const parsed = parseGitHubSpecifier(specifier);
			if (!parsed) continue;

			const ghEntry = entry as GitHubLockfileEntry;
			const skillName = getGitHubSkillName(parsed);
			const sourcePath = getGitHubSkillPath(
				parsed.owner,
				parsed.repo,
				parsed.path,
			);
			const absolutePath = join(projectRoot, sourcePath);

			// Check if installed on disk
			let status: "installed" | "missing" = "installed";
			try {
				await access(absolutePath);
			} catch {
				status = "missing";
			}

			// Check which agents have symlinks
			const linkedAgents = await getLinkedAgents(
				skillName,
				availableAgents,
				projectRoot,
				agentConfigs,
			);

			skills.push({
				name: skillName,
				fullName: specifier,
				version: ghEntry.gitCommit.slice(0, 7),
				source: "github",
				sourcePath,
				status,
				linkedAgents,
				gitRef: ghEntry.gitRef,
				gitCommit: ghEntry.gitCommit,
			});
		}

		if (skills.length === 0) {
			console.log("No skills installed.");
			return;
		}

		if (options.json) {
			console.log(JSON.stringify(skills, null, 2));
			return;
		}

		console.log("Installed skills:\n");

		for (const skill of skills) {
			// Header line: name@version (source)
			if (skill.source === "registry") {
				console.log(`  ${skill.fullName}@${skill.version} (registry)`);
			} else {
				const refInfo = skill.gitRef
					? `${skill.gitRef}@${skill.gitCommit?.slice(0, 7)}`
					: skill.version;
				console.log(`  ${skill.fullName} (${refInfo})`);
			}

			// Status line if missing
			if (skill.status === "missing") {
				console.log(`    Status: MISSING (run 'pspm install' to restore)`);
			}

			// Symlink line
			if (skill.linkedAgents.length > 0) {
				for (const agent of skill.linkedAgents) {
					const config = resolveAgentConfig(agent, agentConfigs);
					if (config) {
						console.log(`    -> ${config.skillsDir}/${skill.name}`);
					}
				}
			}
		}

		// Summary
		const registryCount = skills.filter((s) => s.source === "registry").length;
		const githubCount = skills.filter((s) => s.source === "github").length;
		const parts: string[] = [];
		if (registryCount > 0) parts.push(`${registryCount} registry`);
		if (githubCount > 0) parts.push(`${githubCount} github`);

		console.log(`\nTotal: ${skills.length} skill(s) (${parts.join(", ")})`);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		console.error(`Error: ${message}`);
		process.exit(1);
	}
}
