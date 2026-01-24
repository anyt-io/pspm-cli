import { exec as execCb } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { promisify } from "node:util";
import { changeSkillAccess, configure, publishSkill } from "../api-client.js";
import { getRegistryUrl, requireApiKey } from "../config.js";
import { extractApiErrorMessage } from "../errors.js";
import {
	DEFAULT_SKILL_FILES,
	type ManifestDetectionResult,
	type PspmManifest,
	validateManifest,
} from "../lib/index.js";
import type { SkillManifest } from "../sdk/generated";

const exec = promisify(execCb);

/**
 * Detect and read manifest file (pspm.json or package.json)
 */
async function detectManifest(): Promise<ManifestDetectionResult> {
	const cwd = process.cwd();

	// Try pspm.json first (preferred)
	const pspmJsonPath = join(cwd, "pspm.json");
	try {
		const content = await readFile(pspmJsonPath, "utf-8");
		const manifest = JSON.parse(content) as PspmManifest;
		return { type: "pspm.json", manifest, path: pspmJsonPath };
	} catch {
		// pspm.json not found, try package.json
	}

	// Fall back to package.json
	const packageJsonPath = join(cwd, "package.json");
	try {
		const content = await readFile(packageJsonPath, "utf-8");
		const packageJson = JSON.parse(content);

		// Convert package.json to PspmManifest format
		const manifest: PspmManifest = {
			name: packageJson.name,
			version: packageJson.version,
			description: packageJson.description,
			author:
				typeof packageJson.author === "string"
					? packageJson.author
					: packageJson.author?.name,
			license: packageJson.license,
			files: packageJson.files,
		};

		return { type: "package.json", manifest, path: packageJsonPath };
	} catch {
		throw new Error("No pspm.json or package.json found in current directory");
	}
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes}B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}kB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Recursively get all files in a directory with their sizes
 */
async function getFilesWithSizes(
	dir: string,
	baseDir: string,
): Promise<Array<{ path: string; size: number }>> {
	const results: Array<{ path: string; size: number }> = [];

	try {
		const entries = await readdir(dir, { withFileTypes: true });

		for (const entry of entries) {
			const fullPath = join(dir, entry.name);
			const relativePath = relative(baseDir, fullPath);

			// Skip node_modules and .git
			if (entry.name === "node_modules" || entry.name === ".git") {
				continue;
			}

			if (entry.isDirectory()) {
				const subFiles = await getFilesWithSizes(fullPath, baseDir);
				results.push(...subFiles);
			} else {
				const fileStat = await stat(fullPath);
				results.push({ path: relativePath, size: fileStat.size });
			}
		}
	} catch {
		// Directory doesn't exist or can't be read
	}

	return results;
}

export interface PublishOptions {
	bump?: "major" | "minor" | "patch";
	tag?: string;
	/** Set package visibility during publish */
	access?: "public" | "private";
}

export async function publishCommand(options: PublishOptions): Promise<void> {
	try {
		const apiKey = await requireApiKey();
		const registryUrl = await getRegistryUrl();

		// Detect and read manifest (pspm.json preferred, package.json fallback)
		const detection = await detectManifest();
		const manifest = detection.manifest;

		// Warn if using package.json instead of pspm.json
		if (detection.type === "package.json") {
			console.log("pspm warn Using package.json instead of pspm.json");
			console.log(
				"pspm warn Run 'pspm init' to create a dedicated pspm.json manifest",
			);
			console.log("");
		}

		// Validate manifest
		const validation = validateManifest(manifest);
		if (!validation.valid) {
			console.error(`Error: ${validation.error}`);
			process.exit(1);
		}

		// Create a mutable copy for version bumping
		const packageJson: SkillManifest = {
			name: manifest.name,
			version: manifest.version,
			description: manifest.description,
			files: manifest.files,
		};

		// Handle version bump if requested
		if (options.bump) {
			const semver = await import("semver");
			const newVersion = semver.default.inc(packageJson.version, options.bump);
			if (!newVersion) {
				console.error(
					`Error: Failed to bump version from ${packageJson.version}`,
				);
				process.exit(1);
			}
			packageJson.version = newVersion;
			console.log(`Bumped version to ${newVersion}`);
		}

		// Create tarball using npm pack (or tar directly)
		// Sanitize name for filename (replace @ and / with -)
		const safeName = packageJson.name.replace(/[@/]/g, "-").replace(/^-+/, "");
		const tarballName = `${safeName}-${packageJson.version}.tgz`;
		const tempDir = join(process.cwd(), ".pspm-publish");

		// Create tarball
		try {
			await exec(`rm -rf "${tempDir}" && mkdir -p "${tempDir}"`);

			// Get files to include (use 'files' from manifest or default)
			const files = packageJson.files || [...DEFAULT_SKILL_FILES];

			// Create the tarball structure: package/{files}
			await exec(`mkdir -p "${tempDir}/package"`);

			for (const file of files) {
				try {
					// Use rsync to copy while excluding node_modules
					await exec(
						`rsync -a --exclude='node_modules' --exclude='.git' "${file}" "${tempDir}/package/" 2>/dev/null || true`,
					);
				} catch {
					// Ignore files that don't exist
				}
			}

			// Always include the manifest file used for publishing
			if (detection.type === "pspm.json") {
				await exec(`cp pspm.json "${tempDir}/package/"`);
				// Also include package.json if it exists (for npm compatibility)
				try {
					await stat(join(process.cwd(), "package.json"));
					await exec(
						`cp package.json "${tempDir}/package/" 2>/dev/null || true`,
					);
				} catch {
					// No package.json, that's fine
				}
			} else {
				// Using package.json as manifest
				await exec(`cp package.json "${tempDir}/package/"`);
			}

			// Get list of files that will be included and their sizes
			const packageDir = join(tempDir, "package");
			const tarballContents = await getFilesWithSizes(packageDir, packageDir);
			const unpackedSize = tarballContents.reduce((acc, f) => acc + f.size, 0);

			// Create tarball (excluding node_modules just in case)
			const tarballPath = join(tempDir, tarballName);
			await exec(
				`tar -czf "${tarballPath}" -C "${tempDir}" --exclude='node_modules' --exclude='.git' package`,
			);

			// Read tarball and calculate hashes
			const tarballBuffer = await readFile(tarballPath);
			const tarballBase64 = tarballBuffer.toString("base64");
			const tarballSize = tarballBuffer.length;

			// Calculate shasum (sha1) and integrity (sha512)
			const shasum = createHash("sha1").update(tarballBuffer).digest("hex");
			const integrityHash = createHash("sha512")
				.update(tarballBuffer)
				.digest("base64");
			const integrity = `sha512-${integrityHash}`;

			// Print npm-style publish notice
			console.log("");
			console.log("pspm notice");
			console.log(`pspm notice 📦  ${packageJson.name}@${packageJson.version}`);
			console.log("pspm notice Tarball Contents");

			// Sort files by size descending for display
			tarballContents.sort((a, b) => b.size - a.size);
			for (const file of tarballContents) {
				console.log(
					`pspm notice ${formatBytes(file.size).padStart(8)} ${file.path}`,
				);
			}

			console.log("pspm notice Tarball Details");
			console.log(`pspm notice name:          ${packageJson.name}`);
			console.log(`pspm notice version:       ${packageJson.version}`);
			console.log(`pspm notice filename:      ${tarballName}`);
			console.log(`pspm notice package size:  ${formatBytes(tarballSize)}`);
			console.log(`pspm notice unpacked size: ${formatBytes(unpackedSize)}`);
			console.log(`pspm notice shasum:        ${shasum}`);
			console.log(
				`pspm notice integrity:     ${integrity.substring(0, 50)}...`,
			);
			console.log(`pspm notice total files:   ${tarballContents.length}`);
			console.log("pspm notice");
			console.log(`pspm notice Publishing to ${registryUrl} with tag latest`);

			// Configure SDK and publish (use direct REST endpoints, not oRPC)
			configure({ registryUrl, apiKey });
			const response = await publishSkill({
				manifest: packageJson,
				tarballBase64,
			});

			if (response.status !== 200) {
				const errorMessage = extractApiErrorMessage(response, "Publish failed");

				// Check for version conflict errors
				if (
					errorMessage.includes("must be greater than") ||
					errorMessage.includes("already exists")
				) {
					console.error("pspm error code E403");
					console.error(
						`pspm error 403 403 Forbidden - You cannot publish over the previously published versions: ${packageJson.version}.`,
					);
				}

				throw new Error(errorMessage);
			}

			const result = response.data;
			console.log(
				`+ @user/${result.skill.username}/${result.skill.name}@${result.version.version}`,
			);
			console.log(`Checksum: ${result.version.checksum}`);

			// Set visibility if --access flag was provided
			if (options.access) {
				console.log(`\nSetting visibility to ${options.access}...`);
				const accessResponse = await changeSkillAccess(packageJson.name, {
					visibility: options.access,
				});

				if (accessResponse.status !== 200 || !accessResponse.data) {
					console.warn(
						`Warning: Failed to set visibility: ${accessResponse.error ?? "Unknown error"}`,
					);
				} else {
					console.log(`Package is now ${accessResponse.data.visibility}`);
					if (options.access === "public") {
						console.log(
							"Note: This action is irreversible. Public packages cannot be made private.",
						);
					}
				}
			}
		} finally {
			// Cleanup
			await exec(`rm -rf "${tempDir}"`).catch(() => {});
		}
	} catch (error) {
		if (error instanceof Error) {
			console.error(`Error: ${error.message}`);
		} else {
			console.error(`Error: ${String(error)}`);
		}
		process.exit(1);
	}
}

// Keep old export name for backwards compatibility
export { publishCommand as publish };
