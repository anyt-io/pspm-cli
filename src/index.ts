#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";
import {
	access,
	add,
	audit,
	configInit,
	configShow,
	deprecate,
	init,
	install,
	link,
	list,
	login,
	logout,
	migrate,
	outdated,
	publish,
	remove,
	search,
	unpublish,
	update,
	upgrade,
	version as versionCommand,
	whoami,
} from "./commands/index";
import { checkForUpdates } from "./update-notifier";

// Read version from package.json
const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(
	readFileSync(join(__dirname, "..", "package.json"), "utf-8"),
);
const version: string = packageJson.version;

const program = new Command();

program
	.name("pspm")
	.description("Prompt Skill Package Manager for AI coding agents")
	.version(version);

// =============================================================================
// Config commands
// =============================================================================

const configCmd = program
	.command("config")
	.description("Manage PSPM configuration");

configCmd
	.command("show")
	.description("Show resolved configuration")
	.action(async () => {
		await configShow();
	});

configCmd
	.command("init")
	.description("Create a .pspmrc file in the current directory")
	.option("--registry <url>", "Registry URL override")
	.action(async (options) => {
		await configInit({
			registry: options.registry,
		});
	});

// =============================================================================
// Self-upgrade
// =============================================================================

program
	.command("upgrade")
	.description("Upgrade pspm to the latest version")
	.action(async () => {
		await upgrade();
	});

// =============================================================================
// Authentication commands
// =============================================================================

program
	.command("login")
	.description("Log in via browser or with an API key")
	.option(
		"--api-key <key>",
		"API key for direct authentication (skips browser)",
	)
	.action(async (options) => {
		await login({ apiKey: options.apiKey });
	});

program
	.command("logout")
	.description("Log out and clear stored credentials")
	.action(async () => {
		await logout();
	});

program
	.command("whoami")
	.description("Show current user information")
	.action(async () => {
		await whoami();
	});

// =============================================================================
// Project initialization commands
// =============================================================================

program
	.command("init")
	.description("Create a new pspm.json manifest in the current directory")
	.option("-n, --name <name>", "Skill name")
	.option("-d, --description <desc>", "Skill description")
	.option("-a, --author <author>", "Author name")
	.option("-y, --yes", "Skip prompts and use defaults")
	.option("-f, --force", "Overwrite existing pspm.json")
	.action(async (options) => {
		await init({
			name: options.name,
			description: options.description,
			author: options.author,
			yes: options.yes,
			force: options.force,
		});
	});

program
	.command("migrate")
	.description(
		"Migrate from old directory structure (.skills/, skill-lock.json)",
	)
	.option("--dry-run", "Show what would be migrated without making changes")
	.action(async (options) => {
		await migrate({ dryRun: options.dryRun });
	});

// =============================================================================
// Skill management commands
// =============================================================================

program
	.command("add <specifiers...>")
	.description(
		"Add skills from registry, GitHub, local paths, or well-known URLs",
	)
	.option("--save", "Save to lockfile (default)")
	.option(
		"--agent <agents>",
		'Comma-separated agents for symlinks (default: all agents, use "none" to skip)',
	)
	.option("-g, --global", "Install to user home directory instead of project")
	.option("-y, --yes", "Skip agent selection prompt and use defaults")
	.action(async (specifiers, options) => {
		await add(specifiers, {
			save: options.save ?? true,
			agent: options.agent,
			yes: options.yes,
			global: options.global,
		});
	});

program
	.command("remove <name>")
	.alias("rm")
	.description("Remove an installed skill")
	.action(async (name) => {
		await remove(name);
	});

program
	.command("list")
	.alias("ls")
	.description("List installed skills")
	.option("--json", "Output as JSON")
	.option("-g, --global", "List globally installed skills")
	.action(async (options) => {
		await list({ json: options.json, global: options.global });
	});

program
	.command("install [specifiers...]")
	.alias("i")
	.description(
		"Install skills from lockfile, or add and install specific packages",
	)
	.option("--frozen-lockfile", "Fail if lockfile is missing or outdated")
	.option("--dir <path>", "Install skills to a specific directory")
	.option(
		"--agent <agents>",
		'Comma-separated agents for symlinks (default: all agents, use "none" to skip)',
	)
	.option("-g, --global", "Install to user home directory instead of project")
	.option("-y, --yes", "Skip agent selection prompt and use defaults")
	.action(async (specifiers, options) => {
		await install(specifiers, {
			frozenLockfile: options.frozenLockfile,
			dir: options.dir,
			agent: options.agent,
			yes: options.yes,
			global: options.global,
		});
	});

program
	.command("link")
	.description("Recreate agent symlinks without reinstalling")
	.option(
		"--agent <agents>",
		'Comma-separated agents for symlinks (default: all agents, use "none" to skip)',
	)
	.option("-g, --global", "Recreate global agent symlinks")
	.option("-y, --yes", "Skip agent selection prompt and use defaults")
	.action(async (options) => {
		await link({
			agent: options.agent,
			yes: options.yes,
			global: options.global,
		});
	});

program
	.command("update")
	.description("Update all skills to latest compatible versions")
	.option("--dry-run", "Show what would be updated without making changes")
	.action(async (options) => {
		await update({ dryRun: options.dryRun });
	});

program
	.command("search [query]")
	.alias("find")
	.description("Search and discover skills from the registry")
	.option(
		"-s, --sort <sort>",
		"Sort by: downloads, recent, name (default: downloads)",
	)
	.option("-l, --limit <n>", "Maximum results (default: 20)", Number.parseInt)
	.option("--json", "Output as JSON")
	.action(async (query: string | undefined, options) => {
		await search(query, {
			sort: options.sort,
			limit: options.limit,
			json: options.json,
		});
	});

program
	.command("audit")
	.description("Verify integrity of installed skills and check for issues")
	.option("--json", "Output as JSON")
	.action(async (options) => {
		await audit({ json: options.json });
	});

program
	.command("outdated [packages...]")
	.description("Check for outdated skills")
	.option("--json", "Output as JSON")
	.option("--all", "Include up-to-date packages")
	.action(async (packages: string[], options) => {
		await outdated(packages, { json: options.json, all: options.all });
	});

// =============================================================================
// Publishing commands
// =============================================================================

program
	.command("version <bump>")
	.description("Bump package version (major, minor, patch)")
	.option("--dry-run", "Show what would be changed without writing")
	.action(async (bump: string, options) => {
		const validBumps = ["major", "minor", "patch"];
		if (!validBumps.includes(bump)) {
			console.error(`Error: Invalid version bump "${bump}".`);
			console.error("Must be one of: major, minor, patch");
			process.exit(1);
		}
		await versionCommand(bump as "major" | "minor" | "patch", {
			dryRun: options.dryRun,
		});
	});

program
	.command("publish")
	.description("Publish current directory as a skill")
	.option("--bump <level>", "Bump version (major, minor, patch)")
	.option("--tag <tag>", "Tag for the release")
	.requiredOption(
		"--access <level>",
		"Set package visibility (public or private)",
	)
	.action(async (options) => {
		const access = options.access as string;
		if (access !== "public" && access !== "private") {
			console.error('Error: --access must be "public" or "private"');
			process.exit(1);
		}
		await publish({
			bump: options.bump as "major" | "minor" | "patch" | undefined,
			tag: options.tag,
			access,
		});
	});

program
	.command("unpublish <specifier>")
	.description(
		"Remove a published skill version (only within 72 hours of publishing)",
	)
	.option("--force", "Confirm destructive action")
	.action(async (specifier, options) => {
		await unpublish(specifier, { force: options.force });
	});

program
	.command("access [specifier]")
	.description("Change package visibility (public/private)")
	.option("--public", "Make the package public (irreversible)")
	.option("--private", "Make the package private (only for private packages)")
	.action(async (specifier, options) => {
		await access(specifier, {
			public: options.public,
			private: options.private,
		});
	});

program
	.command("deprecate <specifier> [message]")
	.description(
		"Mark a skill version as deprecated (alternative to unpublish after 72 hours)",
	)
	.option("--undo", "Remove deprecation status")
	.action(async (specifier, message, options) => {
		await deprecate(specifier, message, { undo: options.undo });
	});

// Parse and execute command, then check for updates
await program.parseAsync();
await checkForUpdates(version);
