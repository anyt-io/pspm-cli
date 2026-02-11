import { mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import {
	getLegacyLockfilePath,
	getLegacySkillsDir,
	getLockfilePath,
	getPspmDir,
	getSkillsDir,
} from "@/config";
import { migrateLockfileIfNeeded } from "@/lockfile";

export interface MigrateOptions {
	dryRun?: boolean;
}

/**
 * Migrate from old directory structure to new:
 * - .skills/ → .pspm/skills/
 * - skill-lock.json → pspm-lock.json
 */
export async function migrate(options: MigrateOptions): Promise<void> {
	try {
		const legacySkillsDir = getLegacySkillsDir();
		const newSkillsDir = getSkillsDir();
		const legacyLockfilePath = getLegacyLockfilePath();
		const newLockfilePath = getLockfilePath();
		const pspmDir = getPspmDir();

		let migrationNeeded = false;
		const actions: string[] = [];

		// Check for legacy .skills directory
		try {
			const legacyStats = await stat(legacySkillsDir);
			if (legacyStats.isDirectory()) {
				// Check if it has any content
				const contents = await readdir(legacySkillsDir);
				if (contents.length > 0) {
					migrationNeeded = true;
					actions.push("Move .skills/ → .pspm/skills/");
				}
			}
		} catch {
			// Legacy directory doesn't exist
		}

		// Check for legacy lockfile
		try {
			await stat(legacyLockfilePath);
			// Check if new lockfile already exists
			try {
				await stat(newLockfilePath);
				// Both exist - suggest manual resolution
				actions.push(
					"Note: Both skill-lock.json and pspm-lock.json exist. Manual merge may be needed.",
				);
			} catch {
				migrationNeeded = true;
				actions.push("Migrate skill-lock.json → pspm-lock.json");
			}
		} catch {
			// Legacy lockfile doesn't exist
		}

		if (!migrationNeeded && actions.length === 0) {
			console.log(
				"No migration needed. Project is already using the new structure.",
			);
			return;
		}

		if (options.dryRun) {
			console.log("Migration plan (dry run):");
			console.log("");
			for (const action of actions) {
				console.log(`  - ${action}`);
			}
			console.log("");
			console.log("Run without --dry-run to perform migration.");
			return;
		}

		console.log("Migrating project structure...\n");

		// Migrate lockfile first
		const lockfileMigrated = await migrateLockfileIfNeeded();
		if (lockfileMigrated) {
			console.log("  ✓ Migrated skill-lock.json → pspm-lock.json");
		}

		// Migrate .skills directory
		try {
			const legacyStats = await stat(legacySkillsDir);
			if (legacyStats.isDirectory()) {
				const contents = await readdir(legacySkillsDir);
				if (contents.length > 0) {
					// Create .pspm directory
					await mkdir(pspmDir, { recursive: true });

					// Check if new skills dir exists and has content
					try {
						const newStats = await stat(newSkillsDir);
						if (newStats.isDirectory()) {
							const newContents = await readdir(newSkillsDir);
							if (newContents.length > 0) {
								console.log(
									"  ! Both .skills/ and .pspm/skills/ have content. Manual merge required.",
								);
							} else {
								// New dir exists but empty, remove it first
								await rm(newSkillsDir, { recursive: true, force: true });
								await rename(legacySkillsDir, newSkillsDir);
								console.log("  ✓ Moved .skills/ → .pspm/skills/");
							}
						}
					} catch {
						// New skills dir doesn't exist, safe to move
						await rename(legacySkillsDir, newSkillsDir);
						console.log("  ✓ Moved .skills/ → .pspm/skills/");
					}
				}
			}
		} catch {
			// Legacy directory doesn't exist
		}

		console.log("");
		console.log("Migration complete!");
		console.log("");
		console.log(
			"You can safely delete these legacy files if they still exist:",
		);
		console.log("  - skill-lock.json (replaced by pspm-lock.json)");
		console.log("  - .skills/ (replaced by .pspm/skills/)");
		console.log("");
		console.log("Update your .gitignore to include:");
		console.log("  .pspm/cache/");
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		console.error(`Error: ${message}`);
		process.exit(1);
	}
}
