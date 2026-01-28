import { mkdir, rm, symlink } from "node:fs/promises";
import { dirname, join } from "node:path";
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
	type DependencyNode,
	formatGitHubSpecifier,
	type GitHubLockfileEntry,
	getGitHubSkillName,
	getLocalSkillName,
	isBareLocalPath,
	isGitHubSpecifier,
	isLocalSpecifier,
	type LocalLockfileEntry,
	type LocalSpecifier,
	MAX_DEPENDENCY_DEPTH,
	normalizeToFileSpecifier,
	parseGitHubSpecifier,
	parseLocalSpecifier,
	parseSkillSpecifier,
	printResolutionErrors,
	resolveLocalPath,
	resolveRecursive,
	resolveVersion,
	validateLocalSkill,
} from "../lib/index.js";
import {
	addGitHubToLockfile,
	addLocalToLockfile,
	addToLockfileWithDeps,
} from "../lockfile.js";
import {
	addDependency,
	addGitHubDependency,
	addLocalDependency,
	readManifest,
} from "../manifest.js";
import {
	createAgentSymlinks,
	getGitHubSkillPath,
	getLocalSkillPath,
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

interface ResolvedLocalPackage {
	type: "local";
	specifier: string;
	parsed: LocalSpecifier;
	name: string;
	resolvedPath: string;
}

type ResolvedPackage =
	| ResolvedRegistryPackage
	| ResolvedGitHubPackage
	| ResolvedLocalPackage;

export async function add(
	specifiers: string[],
	options: AddOptions,
): Promise<void> {
	// Phase 1: Validate and resolve all packages first
	console.log("Resolving packages...\n");

	const resolvedPackages: ResolvedPackage[] = [];
	const validationErrors: { specifier: string; error: string }[] = [];

	for (let specifier of specifiers) {
		try {
			// Auto-detect bare local paths and normalize to file: specifier
			if (isBareLocalPath(specifier)) {
				specifier = normalizeToFileSpecifier(specifier);
			}

			if (isLocalSpecifier(specifier)) {
				const resolved = await validateLocalPackage(specifier);
				resolvedPackages.push(resolved);
			} else if (isGitHubSpecifier(specifier)) {
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

	// Phase 2: Resolve recursive dependencies for registry packages
	const config = await resolveConfig();
	const apiKey = getTokenForRegistry(config, config.registryUrl);

	// Build root deps from validated registry packages
	const registryPackages = resolvedPackages.filter(
		(p): p is ResolvedRegistryPackage => p.type === "registry",
	);
	const githubPackages = resolvedPackages.filter(
		(p): p is ResolvedGitHubPackage => p.type === "github",
	);
	const localPackages = resolvedPackages.filter(
		(p): p is ResolvedLocalPackage => p.type === "local",
	);

	let resolutionResult: Awaited<ReturnType<typeof resolveRecursive>> | null =
		null;

	if (registryPackages.length > 0) {
		const rootDeps: Record<string, string> = {};
		for (const pkg of registryPackages) {
			const fullName = `@user/${pkg.username}/${pkg.name}`;
			rootDeps[fullName] = pkg.versionRange || `^${pkg.resolvedVersion}`;
		}

		// Resolve recursively
		console.log("Resolving dependencies...");
		resolutionResult = await resolveRecursive(rootDeps, {
			maxDepth: MAX_DEPENDENCY_DEPTH,
			registryUrl: config.registryUrl,
			apiKey,
		});

		// Handle resolution errors
		if (!resolutionResult.success) {
			printResolutionErrors(
				resolutionResult.graph.errors,
				resolutionResult.graph.conflicts,
			);
			process.exit(1);
		}

		const transitiveDeps = resolutionResult.installOrder.filter(
			(name) => !rootDeps[name],
		);
		if (transitiveDeps.length > 0) {
			console.log(
				`Resolved ${transitiveDeps.length} transitive dependencies.\n`,
			);
		} else {
			console.log();
		}
	}

	// Phase 3: Determine which agents to use (after validation)
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

	// Phase 4: Install all resolved packages
	const results: { specifier: string; success: boolean; error?: string }[] = [];

	// Install registry packages in topological order (dependencies first)
	if (resolutionResult) {
		for (const name of resolutionResult.installOrder) {
			const node = resolutionResult.graph.nodes.get(name);
			if (!node) continue;

			try {
				await installFromNode(node, {
					...options,
					resolvedAgents: agents,
					isDirect: node.isDirect,
				});
				results.push({ specifier: name, success: true });
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Unknown error";
				results.push({
					specifier: name,
					success: false,
					error: message,
				});
				console.error(`Failed to install ${name}: ${message}\n`);
			}
		}
	}

	// Install GitHub packages (no recursive resolution for now)
	for (const resolved of githubPackages) {
		try {
			await installGitHubPackage(resolved, {
				...options,
				resolvedAgents: agents,
			});
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

	// Install local packages (create symlinks)
	for (const resolved of localPackages) {
		try {
			await installLocalPackage(resolved, {
				...options,
				resolvedAgents: agents,
			});
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

interface InternalAddOptionsWithDirect extends InternalAddOptions {
	/** Whether this is a direct dependency (from command line) */
	isDirect: boolean;
}

/**
 * Install a package from a DependencyNode (resolved from resolver)
 */
async function installFromNode(
	node: DependencyNode,
	options: InternalAddOptionsWithDirect,
): Promise<void> {
	// Parse package name
	const match = node.name.match(/^@user\/([^/]+)\/([^/]+)$/);
	if (!match) {
		throw new Error(`Invalid package name: ${node.name}`);
	}
	const [, username, name] = match;

	console.log(`Installing ${node.name}@${node.version}...`);

	// Get config for download
	const config = await resolveConfig();
	const apiKey = getTokenForRegistry(config, config.registryUrl);

	// Download the tarball
	const isPresignedUrl =
		node.downloadUrl.includes(".r2.cloudflarestorage.com") ||
		node.downloadUrl.includes("X-Amz-Signature");

	const downloadHeaders: Record<string, string> = {};
	if (!isPresignedUrl && apiKey) {
		downloadHeaders.Authorization = `Bearer ${apiKey}`;
	}

	const tarballResponse = await fetch(node.downloadUrl, {
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
	if (integrity !== node.integrity) {
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

	// Update lockfile with dependencies
	// Convert dependencies to resolved version format
	const resolvedDeps: Record<string, string> = {};
	for (const [depName, _range] of Object.entries(node.dependencies)) {
		// The resolver already resolved the version, but we need to look it up
		// from the graph. For now, store the range; install.ts will use resolved versions
		resolvedDeps[depName] = _range;
	}

	await addToLockfileWithDeps(
		node.name,
		{
			version: node.version,
			resolved: node.downloadUrl,
			integrity,
			deprecated: node.deprecated,
		},
		Object.keys(resolvedDeps).length > 0 ? resolvedDeps : undefined,
	);

	// Only add direct dependencies to pspm.json
	if (options.isDirect) {
		const dependencyRange = node.versionRange || `^${node.version}`;
		await addDependency(node.name, dependencyRange);
	}

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

	console.log(`Installed ${node.name}@${node.version}`);
	console.log(`Location: ${destDir}`);
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

/**
 * Validate and resolve a local package
 */
async function validateLocalPackage(
	specifier: string,
): Promise<ResolvedLocalPackage> {
	const parsed = parseLocalSpecifier(specifier);
	if (!parsed) {
		throw new Error(
			`Invalid local specifier "${specifier}". Use format: file:../path or file:/absolute/path`,
		);
	}

	console.log(`Resolving ${specifier}...`);

	// Resolve to absolute path
	const resolvedPath = resolveLocalPath(parsed);

	// Validate the local skill directory
	const validation = await validateLocalSkill(resolvedPath);
	if (!validation.valid) {
		throw new Error(validation.error);
	}

	const name = validation.manifest?.name || getLocalSkillName(parsed);
	console.log(`Resolved ${specifier} -> ${name} (local)`);

	return {
		type: "local",
		specifier,
		parsed,
		name,
		resolvedPath,
	};
}

/**
 * Install a pre-validated local package (creates symlink)
 */
async function installLocalPackage(
	resolved: ResolvedLocalPackage,
	options: InternalAddOptions,
): Promise<void> {
	const { specifier, name, resolvedPath, parsed } = resolved;

	console.log(`Installing ${specifier} (local symlink)...`);

	// Create the _local directory
	const skillsDir = getSkillsDir();
	const localDir = join(skillsDir, "_local");
	await mkdir(localDir, { recursive: true });

	// Create symlink from .pspm/skills/_local/{name} -> resolved path
	const symlinkPath = join(localDir, name);

	// Remove existing symlink if any
	try {
		await rm(symlinkPath, { force: true });
	} catch {
		// Ignore if doesn't exist
	}

	// Create symlink (use relative path from symlink location to target)
	const { relative: relativePath } = await import("node:path");
	const relativeTarget = relativePath(dirname(symlinkPath), resolvedPath);
	await symlink(relativeTarget, symlinkPath);

	// Add to lockfile
	const entry: LocalLockfileEntry = {
		version: "local",
		path: parsed.path,
		resolvedPath,
		name,
	};

	await addLocalToLockfile(specifier, entry);

	// Add to pspm.json localDependencies
	await addLocalDependency(specifier, "*");

	// Create agent symlinks
	const agents = options.resolvedAgents;
	if (agents[0] !== "none") {
		const manifest = await readManifest();
		const skillInfo: SkillInfo = {
			name,
			sourcePath: getLocalSkillPath(name),
		};

		await createAgentSymlinks([skillInfo], {
			agents,
			projectRoot: process.cwd(),
			agentConfigs: manifest?.agents,
		});
	}

	console.log(`Installed ${specifier} (local)`);
	console.log(`Location: ${symlinkPath} -> ${resolvedPath}`);
}
