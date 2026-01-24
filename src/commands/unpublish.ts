import { configure, deleteSkill, deleteSkillVersion } from "../api-client.js";
import { getRegistryUrl, requireApiKey } from "../config.js";
import { extractApiErrorMessage } from "../errors.js";
import { parseSkillSpecifier } from "../lib/index.js";

export interface UnpublishOptions {
	force?: boolean;
}

export async function unpublish(
	specifier: string,
	options: UnpublishOptions,
): Promise<void> {
	try {
		const apiKey = await requireApiKey();
		const registryUrl = await getRegistryUrl();

		// Parse the specifier
		const parsed = parseSkillSpecifier(specifier);
		if (!parsed) {
			console.error(
				`Error: Invalid skill specifier "${specifier}". Use format: @user/{username}/{name}[@{version}]`,
			);
			process.exit(1);
		}

		const { username, name, versionRange } = parsed;

		// Configure SDK (use direct REST endpoints, not oRPC)
		configure({ registryUrl, apiKey });

		if (versionRange) {
			// Delete specific version
			console.log(`Unpublishing ${specifier}...`);

			if (!options.force) {
				console.error(
					"Warning: This action is irreversible. Use --force to confirm.",
				);
				process.exit(1);
			}

			const response = await deleteSkillVersion(name, versionRange);
			if (response.status !== 200) {
				const errorMessage = extractApiErrorMessage(
					response,
					"Failed to unpublish. Version may not exist.",
				);
				console.error(`Error: ${errorMessage}`);
				process.exit(1);
			}
			console.log(`Unpublished @user/${username}/${name}@${versionRange}`);
		} else {
			// Delete entire skill
			console.log(`Unpublishing all versions of @user/${username}/${name}...`);

			if (!options.force) {
				console.error(
					"Warning: This will delete ALL versions. Use --force to confirm.",
				);
				process.exit(1);
			}

			const response = await deleteSkill(name);
			if (response.status !== 200) {
				const errorMessage = extractApiErrorMessage(
					response,
					"Failed to unpublish. Skill may not exist.",
				);
				console.error(`Error: ${errorMessage}`);
				process.exit(1);
			}
			console.log(`Unpublished @user/${username}/${name} (all versions)`);
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		console.error(`Error: ${message}`);
		process.exit(1);
	}
}
