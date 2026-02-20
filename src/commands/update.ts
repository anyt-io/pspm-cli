import { configure, listSkillVersions } from "@/api-client";
import { getTokenForRegistry, resolveConfig } from "@/config";
import { extractApiErrorMessage } from "@/errors";
import { resolveVersion } from "@/lib/index";
import { listLockfileSkills } from "@/lockfile";
import { add } from "./add";

export interface UpdateOptions {
	dryRun?: boolean;
}

export async function update(options: UpdateOptions): Promise<void> {
	try {
		const config = await resolveConfig();
		const registryUrl = config.registryUrl;
		const apiKey = getTokenForRegistry(config, registryUrl);

		const skills = await listLockfileSkills();

		if (skills.length === 0) {
			console.log("No skills installed.");
			return;
		}

		// Configure SDK - apiKey may be undefined for public packages
		configure({ registryUrl, apiKey });

		const updates: Array<{
			name: string;
			current: string;
			latest: string;
		}> = [];

		console.log("Checking for updates...\n");

		for (const { name, entry } of skills) {
			const match = name.match(/^@user\/([^/]+)\/([^/]+)$/);
			if (!match) continue;

			const [, username, skillName] = match;

			try {
				const versionsResponse = await listSkillVersions(username, skillName);
				if (versionsResponse.status !== 200) {
					const errorMessage = extractApiErrorMessage(
						versionsResponse,
						"Failed to fetch versions",
					);
					console.warn(`  Warning: ${name}: ${errorMessage}`);
					continue;
				}
				const versions = versionsResponse.data;
				if (versions.length === 0) continue;

				const versionStrings = versions.map(
					(v: { version: string }) => v.version,
				);
				const latest = resolveVersion("*", versionStrings);

				if (latest && latest !== entry.version) {
					updates.push({
						name,
						current: entry.version,
						latest,
					});
				}
			} catch {
				console.warn(`  Warning: Could not check updates for ${name}`);
			}
		}

		if (updates.length === 0) {
			console.log("All skills are up to date.");
			return;
		}

		console.log("Updates available:\n");
		for (const { name, current, latest } of updates) {
			console.log(`  ${name}: ${current} -> ${latest}`);
		}

		if (options.dryRun) {
			console.log("\nDry run - no changes made.");
			return;
		}

		console.log("\nUpdating...\n");

		for (const { name, latest } of updates) {
			const match = name.match(/^@user\/([^/]+)\/([^/]+)$/);
			if (!match) continue;

			const [, username, skillName] = match;
			const specifier = `@user/${username}/${skillName}@${latest}`;

			await add([specifier], {});
		}

		console.log("\nAll skills updated.");
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		console.error(`Error: ${message}`);
		process.exit(1);
	}
}
