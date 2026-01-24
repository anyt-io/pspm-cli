import {
	findProjectConfig,
	getConfigPath,
	resolveConfig,
} from "../../config.js";

/**
 * Show resolved configuration
 */
export async function configShow(): Promise<void> {
	try {
		const resolved = await resolveConfig();
		const projectConfig = await findProjectConfig();
		const configPath = getConfigPath();

		console.log("Resolved Configuration:\n");
		console.log(`  Registry URL:   ${resolved.registryUrl}`);
		console.log(`  API Key:        ${resolved.apiKey ? "***" : "(not set)"}`);
		console.log(`  Username:       ${resolved.username || "(not set)"}`);
		console.log("");
		console.log("Config Locations:");
		console.log(`  User config:    ${configPath}`);
		console.log(`  Project config: ${projectConfig ? ".pspmrc" : "(none)"}`);
		console.log("");
		console.log("Environment Variables:");
		console.log(
			`  PSPM_REGISTRY_URL: ${process.env.PSPM_REGISTRY_URL || "(not set)"}`,
		);
		console.log(
			`  PSPM_API_KEY:      ${process.env.PSPM_API_KEY ? "***" : "(not set)"}`,
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		console.error(`Error: ${message}`);
		process.exit(1);
	}
}
