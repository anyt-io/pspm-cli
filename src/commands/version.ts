import semver from "semver";
import { getManifestPath, readManifest, writeManifest } from "@/manifest";

export type VersionBump = "major" | "minor" | "patch";

export interface VersionOptions {
	/** If true, don't actually write the file (just show what would happen) */
	dryRun?: boolean;
}

/**
 * Bump the version in pspm.json
 *
 * Similar to `npm version major|minor|patch`
 */
export async function version(
	bump: VersionBump,
	options: VersionOptions = {},
): Promise<void> {
	try {
		// Read existing manifest
		const manifest = await readManifest();

		if (!manifest) {
			console.error("Error: No pspm.json found in current directory.");
			console.error("Run 'pspm init' to create one.");
			process.exit(1);
		}

		if (!manifest.version) {
			console.error("Error: pspm.json does not have a version field.");
			console.error(
				'Add a version field (e.g., "version": "0.1.0") to your pspm.json.',
			);
			process.exit(1);
		}

		// Validate current version
		if (!semver.valid(manifest.version)) {
			console.error(
				`Error: Current version "${manifest.version}" is not valid semver.`,
			);
			console.error(
				'Fix the version in pspm.json to be valid semver (e.g., "1.0.0").',
			);
			process.exit(1);
		}

		// Bump the version
		const newVersion = semver.inc(manifest.version, bump);

		if (!newVersion) {
			console.error(`Error: Failed to bump version from ${manifest.version}`);
			process.exit(1);
		}

		if (options.dryRun) {
			console.log(`Would bump version: ${manifest.version} → ${newVersion}`);
			return;
		}

		// Update manifest with new version
		manifest.version = newVersion;
		await writeManifest(manifest);

		console.log(`v${newVersion}`);
		console.log(`Updated ${getManifestPath()}`);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		console.error(`Error: ${message}`);
		process.exit(1);
	}
}
