/**
 * Link command - Recreate agent symlinks without reinstalling.
 *
 * Useful after:
 * - Adding new agents to pspm.json
 * - Changing agent configuration
 * - Recovering from accidentally deleted symlinks
 */

import { parseAgentArg, promptForAgents } from "@/agents";
import {
	getGitHubSkillName,
	parseGitHubSpecifier,
	parseSkillSpecifier,
} from "@/lib/index";
import { listLockfileGitHubPackages, listLockfileSkills } from "@/lockfile";
import { readManifest } from "@/manifest";
import {
	createAgentSymlinks,
	getGitHubSkillPath,
	getRegistrySkillPath,
	type SkillInfo,
} from "@/symlinks";

export interface LinkOptions {
	agent?: string;
	yes?: boolean;
}

export async function link(options: LinkOptions): Promise<void> {
	try {
		// Read manifest for agent config overrides
		const manifest = await readManifest();
		const agentConfigs = manifest?.agents;

		// Determine which agents to use
		let agents: string[];
		if (options.agent) {
			// If --agent flag is provided, use it
			agents = parseAgentArg(options.agent);
		} else if (manifest) {
			// If pspm.json exists, use default agent (respect manifest's agent config)
			agents = parseAgentArg(undefined);
		} else if (options.yes) {
			// If -y flag is used, use default agent without prompting
			agents = parseAgentArg(undefined);
		} else {
			// No pspm.json exists, prompt user to select agents
			console.log("No pspm.json found. Let's set up your project.\n");
			agents = await promptForAgents();
		}

		// Skip if "none" agent
		if (agents.length === 1 && agents[0] === "none") {
			console.log("Skipping symlink creation (--agent none)");
			return;
		}

		// Collect all installed skills
		const skills: SkillInfo[] = [];

		// Get registry skills from lockfile
		const registrySkills = await listLockfileSkills();
		for (const { name } of registrySkills) {
			const parsed = parseSkillSpecifier(name);
			if (!parsed) {
				console.warn(`Warning: Invalid skill name in lockfile: ${name}`);
				continue;
			}

			skills.push({
				name: parsed.name,
				sourcePath: getRegistrySkillPath(parsed.username, parsed.name),
			});
		}

		// Get GitHub skills from lockfile
		const githubSkills = await listLockfileGitHubPackages();
		for (const { specifier } of githubSkills) {
			const parsed = parseGitHubSpecifier(specifier);
			if (!parsed) {
				console.warn(
					`Warning: Invalid GitHub specifier in lockfile: ${specifier}`,
				);
				continue;
			}

			const skillName = getGitHubSkillName(parsed);
			skills.push({
				name: skillName,
				sourcePath: getGitHubSkillPath(parsed.owner, parsed.repo, parsed.path),
			});
		}

		if (skills.length === 0) {
			console.log("No skills found in lockfile. Nothing to link.");
			return;
		}

		console.log(
			`Creating symlinks for ${skills.length} skill(s) to agent(s): ${agents.join(", ")}...`,
		);

		await createAgentSymlinks(skills, {
			agents,
			projectRoot: process.cwd(),
			agentConfigs,
		});

		console.log("Symlinks created successfully.");

		// List created symlinks
		console.log("\nLinked skills:");
		for (const skill of skills) {
			console.log(`  ${skill.name} -> ${skill.sourcePath}`);
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		console.error(`Error: ${message}`);
		process.exit(1);
	}
}
