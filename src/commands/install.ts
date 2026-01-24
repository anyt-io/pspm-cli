import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseAgentArg, promptForAgents } from "../agents.js";
import {
	configure,
	getSkillVersion,
	listSkillVersions,
} from "../api-client.js";
import {
	getCacheDir,
	getSkillsDir,
	getTokenForRegistry,
	resolveConfig,
} from "../config.js";
import { extractApiErrorMessage } from "../errors.js";
import {
	downloadGitHubPackage,
	extractGitHubPackage,
	GitHubNotFoundError,
	GitHubPathNotFoundError,
	GitHubRateLimitError,
	getGitHubDisplayName,
} from "../github.js";
import {
	calculateIntegrity,
	type GitHubLockfileEntry,
	getGitHubSkillName,
	type PspmLockfileEntry,
	parseGitHubSpecifier,
	parseSkillSpecifier,
	resolveVersion,
} from "../lib/index.js";
import {
	addGitHubToLockfile,
	addToLockfile,
	migrateLockfileIfNeeded,
	readLockfile,
} from "../lockfile.js";
import {
	getDependencies,
	getGitHubDependencies,
	readManifest,
} from "../manifest.js";
import {
	createAgentSymlinks,
	getGitHubSkillPath,
	getRegistrySkillPath,
	type SkillInfo,
} from "../symlinks.js";

/**
 * Get cache file path from integrity hash
 */
function getCacheFilePath(cacheDir: string, integrity: string): string {
	// integrity is "sha256-{base64hash}"
	// Convert to safe filename: sha256-{hex}.tgz
	const match = integrity.match(/^sha256-(.+)$/);
	if (!match) {
		throw new Error(`Invalid integrity format: ${integrity}`);
	}
	// Convert base64 to hex for safe filename
	const base64Hash = match[1];
	const hexHash = Buffer.from(base64Hash, "base64").toString("hex");
	return join(cacheDir, `sha256-${hexHash}.tgz`);
}

/**
 * Try to read tarball from cache
 */
async function readFromCache(
	cacheDir: string,
	integrity: string,
): Promise<Buffer | null> {
	try {
		const cachePath = getCacheFilePath(cacheDir, integrity);
		const data = await readFile(cachePath);

		// Verify integrity
		const actualIntegrity = `sha256-${createHash("sha256").update(data).digest("base64")}`;
		if (actualIntegrity !== integrity) {
			// Cache corrupted, remove it
			await rm(cachePath, { force: true });
			return null;
		}

		return data;
	} catch {
		return null;
	}
}

/**
 * Write tarball to cache
 */
async function writeToCache(
	cacheDir: string,
	integrity: string,
	data: Buffer,
): Promise<void> {
	try {
		await mkdir(cacheDir, { recursive: true });
		const cachePath = getCacheFilePath(cacheDir, integrity);
		await writeFile(cachePath, data);
	} catch {
		// Cache write failures are non-fatal
	}
}

export interface InstallOptions {
	frozenLockfile?: boolean;
	dir?: string;
	agent?: string;
	yes?: boolean;
}

export async function install(
	specifiers: string[],
	options: InstallOptions,
): Promise<void> {
	// If specifiers are provided, delegate to add command
	if (specifiers.length > 0) {
		const { add } = await import("./add.js");
		await add(specifiers, {
			save: true,
			agent: options.agent,
			yes: options.yes,
		});
		return;
	}

	// Otherwise, install from lockfile
	await installFromLockfile(options);
}

async function installFromLockfile(options: InstallOptions): Promise<void> {
	try {
		// Get config - auth may be optional for public packages
		const config = await resolveConfig();
		const registryUrl = config.registryUrl;
		const apiKey = getTokenForRegistry(config, registryUrl);
		const skillsDir = options.dir || getSkillsDir();
		const cacheDir = getCacheDir();

		// Migrate legacy lockfile if needed
		await migrateLockfileIfNeeded();

		// Read lockfile and dependencies from pspm.json
		let lockfile = await readLockfile();
		const manifestDeps = await getDependencies();
		const manifestGitHubDeps = await getGitHubDependencies();
		const lockfilePackages = lockfile?.packages ?? lockfile?.skills ?? {};
		const lockfileGitHubPackages = lockfile?.githubPackages ?? {};

		// Track all installed skills for symlink creation
		const installedSkills: SkillInfo[] = [];

		// =================================================================
		// Phase 1: Resolve missing registry dependencies
		// =================================================================
		const missingDeps: Array<{ fullName: string; versionRange: string }> = [];
		for (const [fullName, versionRange] of Object.entries(manifestDeps)) {
			if (!lockfilePackages[fullName]) {
				missingDeps.push({ fullName, versionRange });
			}
		}

		if (missingDeps.length > 0) {
			if (options.frozenLockfile) {
				console.error(
					"Error: Dependencies in pspm.json are not in lockfile. Cannot install with --frozen-lockfile",
				);
				console.error("Missing dependencies:");
				for (const dep of missingDeps) {
					console.error(`  - ${dep.fullName}@${dep.versionRange}`);
				}
				process.exit(1);
			}

			console.log(`Resolving ${missingDeps.length} new dependency(ies)...\n`);
			configure({ registryUrl, apiKey: apiKey ?? "" });

			for (const { fullName, versionRange } of missingDeps) {
				const parsed = parseSkillSpecifier(fullName);
				if (!parsed) {
					console.error(`Error: Invalid dependency specifier: ${fullName}`);
					continue;
				}

				const { username, name } = parsed;
				console.log(`Resolving ${fullName}@${versionRange}...`);

				// Get available versions
				const versionsResponse = await listSkillVersions(username, name);
				if (versionsResponse.status !== 200) {
					const errorMessage = extractApiErrorMessage(
						versionsResponse,
						`Skill ${fullName} not found`,
					);
					console.error(`Error: ${errorMessage}`);
					continue;
				}

				const versions = versionsResponse.data;
				if (versions.length === 0) {
					console.error(`Error: Skill ${fullName} not found`);
					continue;
				}

				// Resolve version
				const versionStrings = versions.map(
					(v: { version: string }) => v.version,
				);
				const resolved = resolveVersion(versionRange || "*", versionStrings);

				if (!resolved) {
					console.error(
						`Error: No version matching "${versionRange}" for ${fullName}`,
					);
					continue;
				}

				// Get version details with download URL
				const versionResponse = await getSkillVersion(username, name, resolved);
				if (versionResponse.status !== 200 || !versionResponse.data) {
					const errorMessage = extractApiErrorMessage(
						versionResponse,
						`Version ${resolved} not found`,
					);
					console.error(`Error: ${errorMessage}`);
					continue;
				}
				const versionInfo = versionResponse.data;

				// Download the tarball
				const isPresignedUrl =
					versionInfo.downloadUrl.includes(".r2.cloudflarestorage.com") ||
					versionInfo.downloadUrl.includes("X-Amz-Signature");

				const downloadHeaders: Record<string, string> = {};
				if (!isPresignedUrl && apiKey) {
					downloadHeaders.Authorization = `Bearer ${apiKey}`;
				}

				const tarballResponse = await fetch(versionInfo.downloadUrl, {
					headers: downloadHeaders,
					redirect: "follow",
				});

				if (!tarballResponse.ok) {
					console.error(
						`Error: Failed to download tarball for ${fullName} (${tarballResponse.status})`,
					);
					continue;
				}

				const tarballBuffer = Buffer.from(await tarballResponse.arrayBuffer());
				const integrity = calculateIntegrity(tarballBuffer);

				// Add to lockfile
				await addToLockfile(fullName, {
					version: resolved,
					resolved: versionInfo.downloadUrl,
					integrity,
				});

				// Cache the tarball
				await writeToCache(cacheDir, integrity, tarballBuffer);

				console.log(`  Resolved ${fullName}@${resolved}`);
			}

			// Re-read lockfile after adding new entries
			lockfile = await readLockfile();
		}

		// =================================================================
		// Phase 2: Resolve missing GitHub dependencies
		// =================================================================
		const missingGitHubDeps: Array<{ specifier: string; ref: string }> = [];
		for (const [specifier, ref] of Object.entries(manifestGitHubDeps)) {
			if (!lockfileGitHubPackages[specifier]) {
				missingGitHubDeps.push({ specifier, ref });
			}
		}

		if (missingGitHubDeps.length > 0) {
			if (options.frozenLockfile) {
				console.error(
					"Error: GitHub dependencies in pspm.json are not in lockfile. Cannot install with --frozen-lockfile",
				);
				console.error("Missing GitHub dependencies:");
				for (const dep of missingGitHubDeps) {
					console.error(`  - ${dep.specifier}@${dep.ref}`);
				}
				process.exit(1);
			}

			console.log(
				`\nResolving ${missingGitHubDeps.length} GitHub dependency(ies)...\n`,
			);

			for (const { specifier, ref } of missingGitHubDeps) {
				const parsed = parseGitHubSpecifier(specifier);
				if (!parsed) {
					console.error(`Error: Invalid GitHub specifier: ${specifier}`);
					continue;
				}

				// Set the ref from manifest if not in specifier
				parsed.ref = parsed.ref || ref;

				console.log(`Resolving ${getGitHubDisplayName(parsed)}...`);

				try {
					const result = await downloadGitHubPackage(parsed);

					// Extract to skills directory
					await extractGitHubPackage(parsed, result.buffer, skillsDir);

					// Add to lockfile
					const entry: GitHubLockfileEntry = {
						version: result.commit.slice(0, 7),
						resolved: `https://github.com/${parsed.owner}/${parsed.repo}`,
						integrity: result.integrity,
						gitCommit: result.commit,
						gitRef: ref || "HEAD",
					};

					await addGitHubToLockfile(specifier, entry);

					// Cache the tarball
					await writeToCache(cacheDir, result.integrity, result.buffer);

					console.log(
						`  Resolved ${specifier} (${ref}@${result.commit.slice(0, 7)})`,
					);
				} catch (error) {
					if (error instanceof GitHubRateLimitError) {
						console.error(`Error: ${error.message}`);
					} else if (error instanceof GitHubPathNotFoundError) {
						console.error(`Error: ${error.message}`);
					} else if (error instanceof GitHubNotFoundError) {
						console.error(`Error: ${error.message}`);
					} else {
						const message =
							error instanceof Error ? error.message : String(error);
						console.error(`Error resolving ${specifier}: ${message}`);
					}
				}
			}

			// Re-read lockfile after adding new entries
			lockfile = await readLockfile();
		}

		// =================================================================
		// Determine which agents to use (after resolution, before installation)
		// =================================================================
		const manifest = await readManifest();
		const agentConfigs = manifest?.agents;

		let agents: string[];
		if (options.agent) {
			// If --agent flag is provided, use it
			agents = parseAgentArg(options.agent);
		} else if (manifest) {
			// If pspm.json exists, use default agent
			agents = parseAgentArg(undefined);
		} else if (options.yes) {
			// If -y flag is used, use default agent without prompting
			agents = parseAgentArg(undefined);
		} else {
			// No pspm.json exists, prompt user to select agents
			console.log("\nNo pspm.json found. Let's set up your project.\n");
			agents = await promptForAgents();
			console.log(); // Add newline after selection
		}

		// =================================================================
		// Phase 3: Install registry packages from lockfile
		// =================================================================
		const packages = lockfile?.packages ?? lockfile?.skills ?? {};
		const packageCount = Object.keys(packages).length;

		if (packageCount > 0) {
			console.log(`\nInstalling ${packageCount} registry skill(s)...\n`);

			const entries = Object.entries(packages) as [string, PspmLockfileEntry][];

			for (const [fullName, entry] of entries) {
				const match = fullName.match(/^@user\/([^/]+)\/([^/]+)$/);
				if (!match) {
					console.warn(`Warning: Invalid skill name in lockfile: ${fullName}`);
					continue;
				}

				const [, username, name] = match;
				console.log(`Installing ${fullName}@${entry.version}...`);

				let tarballBuffer: Buffer;
				let fromCache = false;

				// Try to read from cache first
				const cachedTarball = await readFromCache(cacheDir, entry.integrity);
				if (cachedTarball) {
					tarballBuffer = cachedTarball;
					fromCache = true;
				} else {
					// Download the tarball
					const isPresignedUrl =
						entry.resolved.includes(".r2.cloudflarestorage.com") ||
						entry.resolved.includes("X-Amz-Signature");

					const downloadHeaders: Record<string, string> = {};
					if (!isPresignedUrl && apiKey) {
						downloadHeaders.Authorization = `Bearer ${apiKey}`;
					}

					const response = await fetch(entry.resolved, {
						headers: downloadHeaders,
						redirect: "follow",
					});

					if (!response.ok) {
						if (response.status === 401) {
							if (!apiKey) {
								console.error(
									`  Error: ${fullName} requires authentication. Run 'pspm login' first.`,
								);
							} else {
								console.error(
									`  Error: Access denied to ${fullName}. You may not have permission to access this private package.`,
								);
							}
						} else {
							console.error(
								`  Error: Failed to download ${fullName} (${response.status})`,
							);
						}
						continue;
					}

					tarballBuffer = Buffer.from(await response.arrayBuffer());

					// Verify checksum
					const actualIntegrity = `sha256-${createHash("sha256").update(tarballBuffer).digest("base64")}`;

					if (actualIntegrity !== entry.integrity) {
						console.error(
							`  Error: Checksum verification failed for ${fullName}`,
						);
						if (options.frozenLockfile) {
							process.exit(1);
						}
						continue;
					}

					// Cache the verified tarball
					await writeToCache(cacheDir, entry.integrity, tarballBuffer);
				}

				// Extract tarball
				const destDir = join(skillsDir, username, name);
				await rm(destDir, { recursive: true, force: true });
				await mkdir(destDir, { recursive: true });

				const tempFile = join(destDir, ".temp.tgz");
				await writeFile(tempFile, tarballBuffer);

				const { exec } = await import("node:child_process");
				const { promisify } = await import("node:util");
				const execAsync = promisify(exec);

				try {
					await execAsync(
						`tar -xzf "${tempFile}" -C "${destDir}" --strip-components=1`,
					);
				} finally {
					await rm(tempFile, { force: true });
				}

				console.log(
					`  Installed to ${destDir}${fromCache ? " (from cache)" : ""}`,
				);

				// Track for symlinks
				installedSkills.push({
					name,
					sourcePath: getRegistrySkillPath(username, name),
				});
			}
		}

		// =================================================================
		// Phase 4: Install GitHub packages from lockfile
		// =================================================================
		const githubPackages = lockfile?.githubPackages ?? {};
		const githubCount = Object.keys(githubPackages).length;

		if (githubCount > 0) {
			console.log(`\nInstalling ${githubCount} GitHub skill(s)...\n`);

			for (const [specifier, entry] of Object.entries(githubPackages)) {
				const parsed = parseGitHubSpecifier(specifier);
				if (!parsed) {
					console.warn(
						`Warning: Invalid GitHub specifier in lockfile: ${specifier}`,
					);
					continue;
				}

				const ghEntry = entry as GitHubLockfileEntry;
				console.log(
					`Installing ${specifier} (${ghEntry.gitRef}@${ghEntry.gitCommit.slice(0, 7)})...`,
				);

				let tarballBuffer: Buffer;
				let fromCache = false;

				// Try to read from cache first
				const cachedTarball = await readFromCache(cacheDir, ghEntry.integrity);
				if (cachedTarball) {
					tarballBuffer = cachedTarball;
					fromCache = true;
				} else {
					// Download from GitHub
					try {
						// Use the locked commit
						const specWithCommit = { ...parsed, ref: ghEntry.gitCommit };
						const result = await downloadGitHubPackage(specWithCommit);
						tarballBuffer = result.buffer;

						// Verify integrity
						if (result.integrity !== ghEntry.integrity) {
							console.error(
								`  Error: Checksum verification failed for ${specifier}`,
							);
							if (options.frozenLockfile) {
								process.exit(1);
							}
							continue;
						}

						// Cache the verified tarball
						await writeToCache(cacheDir, ghEntry.integrity, tarballBuffer);
					} catch (error) {
						if (error instanceof GitHubRateLimitError) {
							console.error(`  Error: ${error.message}`);
						} else if (error instanceof GitHubPathNotFoundError) {
							console.error(`  Error: ${error.message}`);
						} else if (error instanceof GitHubNotFoundError) {
							console.error(`  Error: ${error.message}`);
						} else {
							const message =
								error instanceof Error ? error.message : String(error);
							console.error(`  Error downloading ${specifier}: ${message}`);
						}
						continue;
					}
				}

				// Extract the package
				try {
					const destPath = await extractGitHubPackage(
						parsed,
						tarballBuffer,
						skillsDir,
					);
					console.log(
						`  Installed to ${destPath}${fromCache ? " (from cache)" : ""}`,
					);

					// Track for symlinks
					const skillName = getGitHubSkillName(parsed);
					installedSkills.push({
						name: skillName,
						sourcePath: getGitHubSkillPath(
							parsed.owner,
							parsed.repo,
							parsed.path,
						),
					});
				} catch (error) {
					const message =
						error instanceof Error ? error.message : String(error);
					console.error(`  Error extracting ${specifier}: ${message}`);
				}
			}
		}

		// =================================================================
		// Phase 5: Create agent symlinks
		// =================================================================
		if (installedSkills.length > 0 && agents[0] !== "none") {
			console.log(`\nCreating symlinks for agent(s): ${agents.join(", ")}...`);

			await createAgentSymlinks(installedSkills, {
				agents,
				projectRoot: process.cwd(),
				agentConfigs,
			});

			console.log("  Symlinks created.");
		}

		// =================================================================
		// Summary
		// =================================================================
		const totalCount = packageCount + githubCount;
		if (totalCount === 0) {
			console.log("No skills to install.");
		} else {
			console.log(`\nAll ${totalCount} skill(s) installed.`);
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		console.error(`Error: ${message}`);
		process.exit(1);
	}
}
