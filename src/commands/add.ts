import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { parseAgentArg, promptForAgents } from "../agents.js";
import {
	configure,
	getSkillVersion,
	listSkillVersions,
} from "../api-client.js";
import { getSkillsDir, getTokenForRegistry, resolveConfig } from "../config.js";
import { extractApiErrorMessage } from "../errors.js";
import {
	downloadGitHubPackage,
	extractGitHubPackage,
	getGitHubDisplayName,
} from "../github.js";
import {
	calculateIntegrity,
	formatGitHubSpecifier,
	type GitHubLockfileEntry,
	getGitHubSkillName,
	isGitHubSpecifier,
	parseGitHubSpecifier,
	parseSkillSpecifier,
	resolveVersion,
} from "../lib/index.js";
import { addGitHubToLockfile, addToLockfile } from "../lockfile.js";
import {
	addDependency,
	addGitHubDependency,
	readManifest,
} from "../manifest.js";
import {
	createAgentSymlinks,
	getGitHubSkillPath,
	getRegistrySkillPath,
	type SkillInfo,
} from "../symlinks.js";

export interface AddOptions {
	save?: boolean;
	agent?: string;
	yes?: boolean;
}

/** Resolved package info from validation phase */
interface ResolvedRegistryPackage {
	type: "registry";
	specifier: string;
	username: string;
	name: string;
	versionRange: string | undefined;
	resolvedVersion: string;
	versionInfo: {
		downloadUrl: string;
		checksum: string;
	};
}

interface ResolvedGitHubPackage {
	type: "github";
	specifier: string;
	parsed: ReturnType<typeof parseGitHubSpecifier> & object;
	ref: string;
	downloadResult: {
		buffer: Buffer;
		commit: string;
		integrity: string;
	};
}

type ResolvedPackage = ResolvedRegistryPackage | ResolvedGitHubPackage;

export async function add(
	specifiers: string[],
	options: AddOptions,
): Promise<void> {
	// Phase 1: Validate and resolve all packages first
	console.log("Resolving packages...\n");

	const resolvedPackages: ResolvedPackage[] = [];
	const validationErrors: { specifier: string; error: string }[] = [];

	for (const specifier of specifiers) {
		try {
			if (isGitHubSpecifier(specifier)) {
				const resolved = await validateGitHubPackage(specifier);
				resolvedPackages.push(resolved);
			} else {
				const resolved = await validateRegistryPackage(specifier);
				resolvedPackages.push(resolved);
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			validationErrors.push({ specifier, error: message });
			console.error(`Failed to resolve ${specifier}: ${message}\n`);
		}
	}

	// If all packages failed validation, exit early
	if (resolvedPackages.length === 0) {
		console.error("No packages could be resolved.");
		process.exit(1);
	}

	// Show validation summary if there were failures
	if (validationErrors.length > 0) {
		console.log(
			`Resolved ${resolvedPackages.length} of ${specifiers.length} packages.\n`,
		);
	}

	// Phase 2: Determine which agents to use (after validation)
	let agents: string[];
	const manifest = await readManifest();

	if (options.agent) {
		// If --agent flag is provided, use it
		agents = parseAgentArg(options.agent);
	} else if (manifest) {
		// If pspm.json exists, use default agent (respect manifest's agent config)
		agents = parseAgentArg(undefined);
	} else if (options.yes) {
		// If -y flag is used, use default agent without prompting
		agents = parseAgentArg(undefined);
	} else {
		// No pspm.json exists, prompt user to select agents
		console.log("No pspm.json found. Let's set up your project.\n");
		agents = await promptForAgents();
		console.log(); // Add newline after selection
	}

	// Phase 3: Install all resolved packages
	const results: { specifier: string; success: boolean; error?: string }[] = [];

	for (const resolved of resolvedPackages) {
		try {
			if (resolved.type === "github") {
				await installGitHubPackage(resolved, {
					...options,
					resolvedAgents: agents,
				});
			} else {
				await installRegistryPackage(resolved, {
					...options,
					resolvedAgents: agents,
				});
			}
			results.push({ specifier: resolved.specifier, success: true });
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			results.push({
				specifier: resolved.specifier,
				success: false,
				error: message,
			});
			console.error(`Failed to install ${resolved.specifier}: ${message}\n`);
		}
	}

	// Print summary if multiple packages were requested
	if (specifiers.length > 1) {
		const succeeded = results.filter((r) => r.success).length;
		const failed =
			results.filter((r) => !r.success).length + validationErrors.length;
		console.log(`\nSummary: ${succeeded} added, ${failed} failed`);

		if (failed > 0) {
			process.exit(1);
		}
	}
}

interface InternalAddOptions extends AddOptions {
	resolvedAgents: string[];
}

/**
 * Validate and resolve a registry package (without downloading)
 */
async function validateRegistryPackage(
	specifier: string,
): Promise<ResolvedRegistryPackage> {
	// Get config - auth may be optional for public packages
	const config = await resolveConfig();
	const registryUrl = config.registryUrl;
	const apiKey = getTokenForRegistry(config, registryUrl);

	// Parse the specifier
	const parsed = parseSkillSpecifier(specifier);
	if (!parsed) {
		throw new Error(
			`Invalid skill specifier "${specifier}". Use format: @user/{username}/{name}[@{version}]`,
		);
	}

	const { username, name, versionRange } = parsed;

	// Configure SDK - apiKey may be undefined for public packages
	configure({ registryUrl, apiKey: apiKey ?? "" });

	console.log(`Resolving ${specifier}...`);

	// Get available versions
	const versionsResponse = await listSkillVersions(username, name);
	if (versionsResponse.status !== 200) {
		if (versionsResponse.status === 401) {
			if (!apiKey) {
				throw new Error(
					`Package @user/${username}/${name} requires authentication. Please run 'pspm login' to authenticate`,
				);
			}
			throw new Error(
				`Access denied to @user/${username}/${name}. You may not have permission to access this private package.`,
			);
		}
		const errorMessage = extractApiErrorMessage(
			versionsResponse,
			`Skill @user/${username}/${name} not found`,
		);
		throw new Error(errorMessage);
	}
	const versions = versionsResponse.data;
	if (versions.length === 0) {
		throw new Error(`Skill @user/${username}/${name} not found`);
	}

	// Resolve version
	const versionStrings = versions.map((v: { version: string }) => v.version);
	const resolvedVersion = resolveVersion(versionRange || "*", versionStrings);

	if (!resolvedVersion) {
		throw new Error(
			`No version matching "${versionRange || "latest"}" found for @user/${username}/${name}. Available versions: ${versionStrings.join(", ")}`,
		);
	}

	// Get version details with download URL
	const versionResponse = await getSkillVersion(
		username,
		name,
		resolvedVersion,
	);
	if (versionResponse.status !== 200 || !versionResponse.data) {
		const errorMessage = extractApiErrorMessage(
			versionResponse,
			`Version ${resolvedVersion} not found`,
		);
		throw new Error(errorMessage);
	}

	console.log(`Resolved @user/${username}/${name}@${resolvedVersion}`);

	return {
		type: "registry",
		specifier,
		username,
		name,
		versionRange,
		resolvedVersion,
		versionInfo: {
			downloadUrl: versionResponse.data.downloadUrl,
			checksum: versionResponse.data.checksum,
		},
	};
}

/**
 * Validate and download a GitHub package
 */
async function validateGitHubPackage(
	specifier: string,
): Promise<ResolvedGitHubPackage> {
	const parsed = parseGitHubSpecifier(specifier);
	if (!parsed) {
		throw new Error(
			`Invalid GitHub specifier "${specifier}". Use format: github:{owner}/{repo}[/{path}][@{ref}]`,
		);
	}

	const ref = parsed.ref || "HEAD";
	console.log(`Resolving ${getGitHubDisplayName(parsed)}...`);

	// Download from GitHub (also validates existence)
	const result = await downloadGitHubPackage(parsed);

	console.log(`Resolved ${specifier} (${ref}@${result.commit.slice(0, 7)})`);

	return {
		type: "github",
		specifier,
		parsed,
		ref,
		downloadResult: result,
	};
}

/**
 * Install a pre-validated registry package
 */
async function installRegistryPackage(
	resolved: ResolvedRegistryPackage,
	options: InternalAddOptions,
): Promise<void> {
	const { username, name, versionRange, resolvedVersion, versionInfo } =
		resolved;

	console.log(`Installing @user/${username}/${name}@${resolvedVersion}...`);

	// Get config for download
	const config = await resolveConfig();
	const apiKey = getTokenForRegistry(config, config.registryUrl);

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
		throw new Error(`Failed to download tarball (${tarballResponse.status})`);
	}

	const tarballBuffer = Buffer.from(await tarballResponse.arrayBuffer());

	// Calculate integrity
	const integrity = calculateIntegrity(tarballBuffer);

	// Verify checksum matches
	const expectedIntegrity = `sha256-${Buffer.from(versionInfo.checksum, "hex").toString("base64")}`;
	if (integrity !== expectedIntegrity) {
		throw new Error("Checksum verification failed");
	}

	// Create skills directory
	const skillsDir = getSkillsDir();
	const destDir = join(skillsDir, username, name);
	await mkdir(destDir, { recursive: true });

	// Extract tarball
	const { writeFile } = await import("node:fs/promises");
	const tempFile = join(destDir, ".temp.tgz");
	await writeFile(tempFile, tarballBuffer);

	const { exec } = await import("node:child_process");
	const { promisify } = await import("node:util");
	const execAsync = promisify(exec);

	try {
		// Clear destination and extract
		await rm(destDir, { recursive: true, force: true });
		await mkdir(destDir, { recursive: true });
		await writeFile(tempFile, tarballBuffer);
		await execAsync(
			`tar -xzf "${tempFile}" -C "${destDir}" --strip-components=1`,
		);
	} finally {
		await rm(tempFile, { force: true });
	}

	// Update lockfile
	const fullName = `@user/${username}/${name}`;
	await addToLockfile(fullName, {
		version: resolvedVersion,
		resolved: versionInfo.downloadUrl,
		integrity,
	});

	// Add to pspm.json dependencies
	const dependencyRange = versionRange || `^${resolvedVersion}`;
	await addDependency(fullName, dependencyRange);

	// Create agent symlinks
	const agents = options.resolvedAgents;
	if (agents[0] !== "none") {
		const skillManifest = await readManifest();
		const skillInfo: SkillInfo = {
			name,
			sourcePath: getRegistrySkillPath(username, name),
		};

		await createAgentSymlinks([skillInfo], {
			agents,
			projectRoot: process.cwd(),
			agentConfigs: skillManifest?.agents,
		});
	}

	console.log(`Installed @user/${username}/${name}@${resolvedVersion}`);
	console.log(`Location: ${destDir}`);
}

/**
 * Install a pre-validated GitHub package
 */
async function installGitHubPackage(
	resolved: ResolvedGitHubPackage,
	options: InternalAddOptions,
): Promise<void> {
	const { specifier, parsed, ref, downloadResult } = resolved;

	console.log(
		`Installing ${specifier} (${ref}@${downloadResult.commit.slice(0, 7)})...`,
	);

	// Extract to skills directory
	const skillsDir = getSkillsDir();
	const destPath = await extractGitHubPackage(
		parsed,
		downloadResult.buffer,
		skillsDir,
	);

	// Add to lockfile
	const lockfileSpecifier = formatGitHubSpecifier({
		owner: parsed.owner,
		repo: parsed.repo,
		path: parsed.path,
		// Don't include ref in the specifier key, it's stored in gitRef
	});

	const entry: GitHubLockfileEntry = {
		version: downloadResult.commit.slice(0, 7),
		resolved: `https://github.com/${parsed.owner}/${parsed.repo}`,
		integrity: downloadResult.integrity,
		gitCommit: downloadResult.commit,
		gitRef: ref,
	};

	await addGitHubToLockfile(lockfileSpecifier, entry);

	// Add to pspm.json githubDependencies
	await addGitHubDependency(lockfileSpecifier, ref);

	// Create agent symlinks
	const agents = options.resolvedAgents;
	if (agents[0] !== "none") {
		const manifest = await readManifest();
		const skillName = getGitHubSkillName(parsed);
		const skillInfo: SkillInfo = {
			name: skillName,
			sourcePath: getGitHubSkillPath(parsed.owner, parsed.repo, parsed.path),
		};

		await createAgentSymlinks([skillInfo], {
			agents,
			projectRoot: process.cwd(),
			agentConfigs: manifest?.agents,
		});
	}

	console.log(
		`Installed ${specifier} (${ref}@${downloadResult.commit.slice(0, 7)})`,
	);
	console.log(`Location: ${destPath}`);
}
