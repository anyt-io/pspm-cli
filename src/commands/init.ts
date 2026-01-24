import { readFile, stat, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { createInterface } from "node:readline";
import {
	DEFAULT_SKILL_FILES,
	PSPM_SCHEMA_URL,
	type PspmManifest,
} from "../lib/index.js";

export interface InitOptions {
	name?: string;
	description?: string;
	author?: string;
	yes?: boolean;
	force?: boolean;
}

/**
 * Simple readline prompt that mimics npm's style
 */
function prompt(
	rl: ReturnType<typeof createInterface>,
	question: string,
	defaultValue: string,
): Promise<string> {
	return new Promise((resolve) => {
		const displayDefault = defaultValue ? ` (${defaultValue})` : "";
		rl.question(`${question}${displayDefault} `, (answer) => {
			resolve(answer.trim() || defaultValue);
		});
	});
}

/**
 * Try to read existing package.json to extract some defaults
 */
async function readExistingPackageJson(): Promise<Partial<PspmManifest> | null> {
	try {
		const content = await readFile(
			join(process.cwd(), "package.json"),
			"utf-8",
		);
		const pkg = JSON.parse(content);
		return {
			name: pkg.name,
			version: pkg.version,
			description: pkg.description,
			author: typeof pkg.author === "string" ? pkg.author : pkg.author?.name,
			license: pkg.license,
		};
	} catch {
		return null;
	}
}

/**
 * Try to detect author from git config
 */
async function getGitAuthor(): Promise<string | null> {
	try {
		const { exec } = await import("node:child_process");
		const { promisify } = await import("node:util");
		const execAsync = promisify(exec);

		const [nameResult, emailResult] = await Promise.all([
			execAsync("git config user.name").catch(() => ({ stdout: "" })),
			execAsync("git config user.email").catch(() => ({ stdout: "" })),
		]);

		const name = nameResult.stdout.trim();
		const email = emailResult.stdout.trim();

		if (name && email) {
			return `${name} <${email}>`;
		}
		if (name) {
			return name;
		}
		return null;
	} catch {
		return null;
	}
}

/**
 * Sanitize a name for use as skill name
 * - Remove @ prefix and scope
 * - Convert to lowercase
 * - Replace invalid characters with hyphens
 */
function sanitizeName(name: string): string {
	// Remove npm scope if present (e.g., @user/package -> package)
	const withoutScope = name.replace(/^@[^/]+\//, "");
	// Lowercase and replace invalid chars
	return withoutScope
		.toLowerCase()
		.replace(/[^a-z0-9_-]/g, "-")
		.replace(/^-+|-+$/g, "")
		.replace(/-+/g, "-");
}

/**
 * Validate skill name format
 */
function isValidName(name: string): boolean {
	return /^[a-z][a-z0-9_-]*$/.test(name);
}

/**
 * Validate semver format
 */
function isValidVersion(version: string): boolean {
	return /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/.test(version);
}

/**
 * Initialize a new pspm.json manifest in the current directory
 */
export async function init(options: InitOptions): Promise<void> {
	try {
		const pspmJsonPath = join(process.cwd(), "pspm.json");

		// Check if pspm.json already exists
		let exists = false;
		try {
			await stat(pspmJsonPath);
			exists = true;
		} catch {
			// File doesn't exist, good
		}

		if (exists && !options.force) {
			console.error("Error: pspm.json already exists in this directory.");
			console.error("Use --force to overwrite.");
			process.exit(1);
		}

		// Try to read defaults from existing package.json and git
		const existingPkg = await readExistingPackageJson();
		const gitAuthor = await getGitAuthor();

		// Determine default values
		const defaultName = sanitizeName(
			options.name || existingPkg?.name || basename(process.cwd()),
		);
		const defaultVersion = existingPkg?.version || "0.1.0";
		const defaultDescription =
			options.description || existingPkg?.description || "";
		const defaultAuthor =
			options.author || existingPkg?.author || gitAuthor || "";
		const defaultLicense = existingPkg?.license || "MIT";
		const defaultMain = "SKILL.md";
		const defaultCapabilities = "";

		let manifest: PspmManifest;

		if (options.yes) {
			// Non-interactive mode: use all defaults
			manifest = {
				$schema: PSPM_SCHEMA_URL,
				name: defaultName,
				version: defaultVersion,
				description: defaultDescription || undefined,
				author: defaultAuthor || undefined,
				license: defaultLicense,
				type: "skill",
				capabilities: [],
				main: defaultMain,
				requirements: {
					pspm: ">=0.1.0",
				},
				files: [...DEFAULT_SKILL_FILES],
				dependencies: {},
				private: false,
			};
		} else {
			// Interactive mode: prompt for each field
			console.log(
				"This utility will walk you through creating a pspm.json file.",
			);
			console.log(
				"It only covers the most common items, and tries to guess sensible defaults.",
			);
			console.log("");
			console.log(
				"See `pspm init --help` for definitive documentation on these fields",
			);
			console.log("and exactly what they do.");
			console.log("");
			console.log("Press ^C at any time to quit.");

			const rl = createInterface({
				input: process.stdin,
				output: process.stdout,
			});

			try {
				// Prompt for each field
				let name = await prompt(rl, "skill name:", defaultName);

				// Validate name and re-prompt if invalid
				while (!isValidName(name)) {
					console.log(
						"  Name must start with a lowercase letter and contain only lowercase letters, numbers, hyphens, and underscores.",
					);
					name = await prompt(rl, "skill name:", sanitizeName(name));
				}

				let version = await prompt(rl, "version:", defaultVersion);

				// Validate version and re-prompt if invalid
				while (!isValidVersion(version)) {
					console.log("  Version must be valid semver (e.g., 1.0.0)");
					version = await prompt(rl, "version:", "0.1.0");
				}

				const description = await prompt(
					rl,
					"description:",
					defaultDescription,
				);
				const main = await prompt(rl, "entry point:", defaultMain);
				const capabilitiesStr = await prompt(
					rl,
					"capabilities (comma-separated):",
					defaultCapabilities,
				);
				const author = await prompt(rl, "author:", defaultAuthor);
				const license = await prompt(rl, "license:", defaultLicense);

				rl.close();

				// Parse capabilities
				const capabilities = capabilitiesStr
					? capabilitiesStr
							.split(",")
							.map((s) => s.trim())
							.filter(Boolean)
					: [];

				manifest = {
					$schema: PSPM_SCHEMA_URL,
					name,
					version,
					description: description || undefined,
					author: author || undefined,
					license,
					type: "skill",
					capabilities,
					main,
					requirements: {
						pspm: ">=0.1.0",
					},
					files: [...DEFAULT_SKILL_FILES],
					dependencies: {},
					private: false,
				};
			} catch (error) {
				rl.close();
				// User pressed Ctrl+C
				if (
					error instanceof Error &&
					error.message.includes("readline was closed")
				) {
					console.log("\nAborted.");
					process.exit(0);
				}
				throw error;
			}
		}

		// Remove undefined/empty fields for cleaner output
		if (!manifest.description) manifest.description = undefined;
		if (!manifest.author) manifest.author = undefined;
		if (manifest.capabilities?.length === 0) manifest.capabilities = undefined;

		// Show preview
		const content = JSON.stringify(manifest, null, 2);

		console.log("");
		console.log(`About to write to ${pspmJsonPath}:`);
		console.log("");
		console.log(content);
		console.log("");

		// In interactive mode, confirm before writing
		if (!options.yes) {
			const rl = createInterface({
				input: process.stdin,
				output: process.stdout,
			});

			const confirm = await prompt(rl, "Is this OK?", "yes");
			rl.close();

			if (confirm.toLowerCase() !== "yes" && confirm.toLowerCase() !== "y") {
				console.log("Aborted.");
				process.exit(0);
			}
		}

		// Write the manifest
		await writeFile(pspmJsonPath, `${content}\n`);

		// Check if SKILL.md exists
		try {
			await stat(join(process.cwd(), "SKILL.md"));
		} catch {
			console.log(
				"Note: Create a SKILL.md file with your skill's prompt content.",
			);
		}

		if (existingPkg) {
			console.log("Note: Values were derived from existing package.json.");
			console.log("      pspm.json is for publishing to PSPM registry.");
			console.log("      package.json can still be used for npm dependencies.");
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		console.error(`Error: ${message}`);
		process.exit(1);
	}
}
