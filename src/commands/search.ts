/**
 * Search command - Search and discover skills from the registry.
 *
 * Queries the public explore API with optional search term and
 * displays results in a formatted table.
 */

import { configure } from "@/api-client";
import { getTokenForRegistry, resolveConfig } from "@/config";
import { explorePublicSkills } from "@/sdk/generated";

export interface SearchOptions {
	/** Sort results: downloads, recent, name */
	sort?: "downloads" | "recent" | "name";
	/** Maximum number of results */
	limit?: number;
	/** Output as JSON */
	json?: boolean;
}

export async function search(
	query: string | undefined,
	options: SearchOptions,
): Promise<void> {
	try {
		// Configure SDK (no auth needed for public explore)
		const config = await resolveConfig();
		const apiKey = getTokenForRegistry(config, config.registryUrl);
		configure({ registryUrl: config.registryUrl, apiKey });

		const limit = options.limit ?? 20;
		const sort = options.sort ?? "downloads";

		if (!options.json) {
			if (query) {
				console.log(`Searching for "${query}"...\n`);
			} else {
				console.log("Browsing skills...\n");
			}
		}

		const response = await explorePublicSkills({
			search: query,
			sort,
			limit,
			page: 1,
		});

		if (response.status !== 200) {
			console.error("Error: Failed to search skills");
			process.exit(1);
		}

		const { skills, total } = response.data;

		if (skills.length === 0) {
			if (query) {
				console.log(`No skills found matching "${query}".`);
			} else {
				console.log("No skills published yet.");
			}
			return;
		}

		if (options.json) {
			console.log(JSON.stringify(skills, null, 2));
			return;
		}

		// Display results
		for (const skill of skills) {
			const name = `@user/${skill.username}/${skill.name}`;
			const desc = skill.description
				? ` - ${skill.description.slice(0, 80)}${skill.description.length > 80 ? "..." : ""}`
				: "";
			const downloads =
				skill.totalDownloads > 0
					? ` (${formatDownloads(skill.totalDownloads)} downloads)`
					: "";

			console.log(`  ${name}${downloads}`);
			if (desc) {
				console.log(`    ${desc.trim()}`);
			}
		}

		// Summary
		const showing = Math.min(skills.length, limit);
		if (total > showing) {
			console.log(`\nShowing ${showing} of ${total} results.`);
		} else {
			console.log(`\n${total} skill(s) found.`);
		}

		// Hint for install
		if (skills.length > 0) {
			const first = skills[0];
			console.log(
				`\nInstall with: pspm add @user/${first.username}/${first.name}`,
			);
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		console.error(`Error: ${message}`);
		process.exit(1);
	}
}

/**
 * Format download count for display (e.g., 1234 -> "1.2k")
 */
function formatDownloads(count: number): string {
	if (count >= 1_000_000) {
		return `${(count / 1_000_000).toFixed(1)}M`;
	}
	if (count >= 1_000) {
		return `${(count / 1_000).toFixed(1)}k`;
	}
	return String(count);
}
