import { stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface ConfigInitOptions {
	registry?: string;
}

/**
 * Create a .pspmrc file in the current directory (INI format)
 */
export async function configInit(options: ConfigInitOptions): Promise<void> {
	try {
		const configPath = join(process.cwd(), ".pspmrc");

		// Check if file already exists
		try {
			await stat(configPath);
			console.error("Error: .pspmrc already exists in this directory.");
			process.exit(1);
		} catch {
			// File doesn't exist, good
		}

		// Build INI content
		const lines: string[] = ["; Project-specific PSPM configuration", ""];

		if (options.registry) {
			lines.push(`registry = ${options.registry}`);
		} else {
			lines.push("; Uncomment to use a custom registry:");
			lines.push("; registry = https://custom-registry.example.com");
		}

		lines.push("");

		// Write the file
		await writeFile(configPath, lines.join("\n"));

		console.log("Created .pspmrc");
		console.log("");
		console.log("Contents:");
		console.log(lines.join("\n"));
		console.log("Note: .pspmrc should be committed to version control.");
		console.log("API keys should NOT be stored here - use pspm login instead.");
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		console.error(`Error: ${message}`);
		process.exit(1);
	}
}
