import { changeSkillAccess, configure } from "../api-client.js";
import { getRegistryUrl, requireApiKey } from "../config.js";
import { parseSkillSpecifier } from "../lib/index.js";

export interface AccessOptions {
	public?: boolean;
	private?: boolean;
}

/**
 * Change the visibility of a skill package.
 *
 * Usage:
 *   pspm access --public              # Make current package public
 *   pspm access @user/bob/skill --public  # Make specific package public
 *
 * Note: Making a package public is irreversible (like npm).
 */
export async function access(
	specifier: string | undefined,
	options: AccessOptions,
): Promise<void> {
	try {
		const apiKey = await requireApiKey();
		const registryUrl = await getRegistryUrl();

		// Determine visibility from options
		if (options.public && options.private) {
			console.error("Error: Cannot specify both --public and --private");
			process.exit(1);
		}

		if (!options.public && !options.private) {
			console.error("Error: Must specify either --public or --private");
			process.exit(1);
		}

		const visibility = options.public ? "public" : "private";

		// Parse package name - either from specifier or from current directory's pspm.json
		let packageName: string;

		if (specifier) {
			// Parse the specifier to extract the package name
			const parsed = parseSkillSpecifier(specifier);
			if (!parsed) {
				console.error(
					`Error: Invalid skill specifier "${specifier}". Use format: @user/{username}/{name}`,
				);
				process.exit(1);
			}
			packageName = parsed.name;
		} else {
			// Read from current directory's pspm.json or package.json
			const { readFile } = await import("node:fs/promises");
			const { join } = await import("node:path");

			let manifest: { name: string } | null = null;

			// Try pspm.json first
			try {
				const content = await readFile(
					join(process.cwd(), "pspm.json"),
					"utf-8",
				);
				manifest = JSON.parse(content);
			} catch {
				// Try package.json
				try {
					const content = await readFile(
						join(process.cwd(), "package.json"),
						"utf-8",
					);
					manifest = JSON.parse(content);
				} catch {
					console.error(
						"Error: No pspm.json or package.json found in current directory",
					);
					console.error(
						"Either run this command in a package directory or specify a package name",
					);
					process.exit(1);
				}
			}

			if (!manifest?.name) {
				console.error("Error: Package manifest is missing 'name' field");
				process.exit(1);
			}

			packageName = manifest.name;
		}

		// Configure SDK and make API call
		configure({ registryUrl, apiKey });

		console.log(`Setting ${packageName} to ${visibility}...`);

		const response = await changeSkillAccess(packageName, { visibility });

		if (response.status !== 200 || !response.data) {
			const errorMessage = response.error ?? "Failed to change visibility";
			console.error(`Error: ${errorMessage}`);
			process.exit(1);
		}

		const result = response.data;
		console.log(
			`+ @user/${result.username}/${result.name} is now ${result.visibility}`,
		);

		if (visibility === "public") {
			console.log("");
			console.log(
				"Note: This action is irreversible. Public packages cannot be made private.",
			);
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		console.error(`Error: ${message}`);
		process.exit(1);
	}
}
