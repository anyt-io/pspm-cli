import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import * as ini from "ini";
import { NotLoggedInError } from "./errors";

// =============================================================================
// Types
// =============================================================================

/**
 * User config stored in ~/.pspmrc (INI format)
 *
 * Supports npm-style configuration:
 * - registry = https://pspm.dev (default registry)
 * - authToken = sk_default (default auth token)
 * - @scope:registry = https://corp.pspm.io (scope to registry mapping)
 * - //host:authToken = sk_token (per-registry tokens)
 */
export interface UserConfig {
	registry?: string;
	authToken?: string;
	username?: string;
	/** Scope to registry URL mappings (e.g., @myorg -> https://corp.pspm.io) */
	scopedRegistries?: Record<string, string>;
	/** Host to auth token mappings (e.g., pspm.dev -> sk_xxx) */
	registryTokens?: Record<string, string>;
}

/**
 * Project config stored in .pspmrc (INI format)
 */
export interface ProjectConfig {
	registry?: string;
}

/**
 * Fully resolved configuration (after cascade)
 */
export interface ResolvedConfig {
	registryUrl: string;
	apiKey?: string;
	username?: string;
	/** Scope to registry URL mappings */
	scopedRegistries: Record<string, string>;
	/** Host to auth token mappings */
	registryTokens: Record<string, string>;
}

/**
 * Legacy V1 config schema (for migration)
 */
interface LegacyConfigV1 {
	registryUrl?: string;
	apiKey?: string;
	username?: string;
}

/**
 * Legacy V2 config schema (for migration)
 */
interface LegacyConfigV2 {
	version: 2;
	defaultProfile: string;
	profiles: Record<
		string,
		{
			registryUrl?: string;
			apiKey?: string;
			username?: string;
		}
	>;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_REGISTRY_URL = "https://registry.pspm.dev";

/**
 * Get the user config file path (~/.pspmrc)
 */
export function getConfigPath(): string {
	return join(homedir(), ".pspmrc");
}

/**
 * Get the legacy config file path (~/.pspm/config.json) for migration
 */
function getLegacyConfigPath(): string {
	return join(homedir(), ".pspm", "config.json");
}

/**
 * Get the .pspm directory path (for current project)
 */
export function getPspmDir(): string {
	return join(process.cwd(), ".pspm");
}

/**
 * Get the skills directory path (for current project)
 * New path: .pspm/skills/
 */
export function getSkillsDir(): string {
	return join(process.cwd(), ".pspm", "skills");
}

/**
 * Get the cache directory path (for current project)
 * Used for tarball caching: .pspm/cache/
 */
export function getCacheDir(): string {
	return join(process.cwd(), ".pspm", "cache");
}

/**
 * Get the lockfile path (for current project)
 * New path: pspm-lock.json (at project root, npm-style)
 */
export function getLockfilePath(): string {
	return join(process.cwd(), "pspm-lock.json");
}

/**
 * Get the legacy lockfile path (for migration)
 */
export function getLegacyLockfilePath(): string {
	return join(process.cwd(), "skill-lock.json");
}

/**
 * Get the legacy skills directory path (for migration)
 */
export function getLegacySkillsDir(): string {
	return join(process.cwd(), ".skills");
}

// =============================================================================
// INI Config Functions
// =============================================================================

/**
 * Read the user config file (~/.pspmrc, INI format)
 *
 * Supports npm-style configuration:
 * ```ini
 * ; Default registry and auth
 * registry = https://pspm.dev
 * authToken = sk_default
 *
 * ; Scope mappings
 * @myorg:registry = https://corp.pspm.io
 *
 * ; Per-registry tokens
 * //pspm.dev:authToken = sk_public
 * //corp.pspm.io:authToken = sk_corp
 * ```
 */
export async function readUserConfig(): Promise<UserConfig> {
	const configPath = getConfigPath();

	if (process.env.PSPM_DEBUG) {
		console.log(`[config] Reading config from: ${configPath}`);
	}

	try {
		const content = await readFile(configPath, "utf-8");
		const parsed = ini.parse(content);

		if (process.env.PSPM_DEBUG) {
			console.log("[config] Parsed config:", JSON.stringify(parsed, null, 2));
		}

		// Extract scoped registries (@scope:registry = url)
		const scopedRegistries: Record<string, string> = {};
		for (const key of Object.keys(parsed)) {
			const scopeMatch = key.match(/^(@[^:]+):registry$/);
			if (scopeMatch) {
				const scope = scopeMatch[1];
				scopedRegistries[scope] = parsed[key] as string;
			}
		}

		// Extract per-registry tokens (//host:authToken = token)
		// INI parser may nest these under a key like "//host"
		const registryTokens: Record<string, string> = {};
		for (const key of Object.keys(parsed)) {
			// Check for //host:authToken format
			const tokenMatch = key.match(/^\/\/([^:]+):authToken$/);
			if (tokenMatch) {
				const host = tokenMatch[1];
				registryTokens[host] = parsed[key] as string;
			}
			// Also check for nested format (ini parser may parse //host as a section)
			if (key.startsWith("//") && typeof parsed[key] === "object") {
				const host = key.slice(2);
				const section = parsed[key] as Record<string, string>;
				if (section.authToken) {
					registryTokens[host] = section.authToken;
				}
			}
		}

		return {
			registry: parsed.registry as string | undefined,
			authToken: parsed.authToken as string | undefined,
			username: parsed.username as string | undefined,
			scopedRegistries:
				Object.keys(scopedRegistries).length > 0 ? scopedRegistries : undefined,
			registryTokens:
				Object.keys(registryTokens).length > 0 ? registryTokens : undefined,
		};
	} catch (error) {
		if (process.env.PSPM_DEBUG) {
			console.log(
				`[config] Error reading config: ${
					error instanceof Error ? error.message : String(error)
				}`,
			);
		}
		return {};
	}
}

/**
 * Write the user config file (~/.pspmrc, INI format)
 */
export async function writeUserConfig(config: UserConfig): Promise<void> {
	const configPath = getConfigPath();

	// Build INI content with comments
	const lines: string[] = ["; PSPM Configuration", ""];

	if (config.registry) {
		lines.push(`registry = ${config.registry}`);
	}
	if (config.authToken) {
		lines.push(`authToken = ${config.authToken}`);
	}
	if (config.username) {
		lines.push(`username = ${config.username}`);
	}

	// Always end with a newline
	lines.push("");

	await mkdir(dirname(configPath), { recursive: true });
	await writeFile(configPath, lines.join("\n"));

	if (process.env.PSPM_DEBUG) {
		console.log(`[config] Wrote config to: ${configPath}`);
	}
}

/**
 * Find and read project config (.pspmrc) by searching up directory tree
 */
export async function findProjectConfig(): Promise<ProjectConfig | null> {
	let currentDir = process.cwd();
	const root = dirname(currentDir);

	while (currentDir !== root) {
		const configPath = join(currentDir, ".pspmrc");
		try {
			const stats = await stat(configPath);
			if (stats.isFile()) {
				const content = await readFile(configPath, "utf-8");
				// Try parsing as INI first
				try {
					const parsed = ini.parse(content);
					if (process.env.PSPM_DEBUG) {
						console.log(
							`[config] Found project config at ${configPath}:`,
							JSON.stringify(parsed, null, 2),
						);
					}
					return {
						registry: parsed.registry as string | undefined,
					};
				} catch {
					// Fall back to JSON for backward compatibility during migration
					try {
						const jsonConfig = JSON.parse(content);
						return {
							registry: jsonConfig.registryUrl,
						};
					} catch {
						// Unparseable, skip
					}
				}
			}
		} catch {
			// File doesn't exist, continue searching
		}
		currentDir = dirname(currentDir);
	}

	return null;
}

/**
 * Migrate from legacy config format (~/.pspm/config.json) if it exists
 */
async function migrateFromLegacyConfig(): Promise<UserConfig | null> {
	const legacyPath = getLegacyConfigPath();

	try {
		const content = await readFile(legacyPath, "utf-8");
		const parsed = JSON.parse(content);

		let config: UserConfig = {};

		// Check if V2 format (with profiles)
		if (parsed.version === 2 && parsed.profiles) {
			const v2Config = parsed as LegacyConfigV2;
			const defaultProfileName = v2Config.defaultProfile || "default";
			const profile = v2Config.profiles[defaultProfileName];

			if (profile) {
				config = {
					registry:
						profile.registryUrl !== DEFAULT_REGISTRY_URL
							? profile.registryUrl
							: undefined,
					authToken: profile.apiKey,
					username: profile.username,
				};
			}

			console.log(
				`Migrating from legacy config (profile: ${defaultProfileName})...`,
			);
		} else {
			// V1 format (flat)
			const v1Config = parsed as LegacyConfigV1;
			config = {
				registry:
					v1Config.registryUrl !== DEFAULT_REGISTRY_URL
						? v1Config.registryUrl
						: undefined,
				authToken: v1Config.apiKey,
				username: v1Config.username,
			};

			console.log("Migrating from legacy config...");
		}

		// Write new format
		await writeUserConfig(config);
		console.log(`Created new config at: ${getConfigPath()}`);

		// Remove old config directory
		await unlink(legacyPath);
		console.log(`Removed legacy config: ${legacyPath}`);

		return config;
	} catch {
		// Legacy config doesn't exist or couldn't be read
		return null;
	}
}

/**
 * Resolve the full configuration using cascade priority:
 * 1. Environment variables (PSPM_REGISTRY_URL, PSPM_API_KEY)
 * 2. Project config (.pspmrc in project directory)
 * 3. User config (~/.pspmrc)
 * 4. Defaults
 */
export async function resolveConfig(): Promise<ResolvedConfig> {
	// Check for legacy config and migrate if needed
	const newConfigPath = getConfigPath();
	try {
		await stat(newConfigPath);
	} catch {
		// New config doesn't exist, try migrating from legacy
		await migrateFromLegacyConfig();
	}

	const userConfig = await readUserConfig();
	const projectConfig = await findProjectConfig();

	// Build resolved config with cascade priority
	let registryUrl = DEFAULT_REGISTRY_URL;
	let apiKey = userConfig.authToken;
	const username = userConfig.username;
	const scopedRegistries = userConfig.scopedRegistries ?? {};
	const registryTokens = userConfig.registryTokens ?? {};

	// User config
	if (userConfig.registry) {
		registryUrl = userConfig.registry;
	}

	// Project config can override registryUrl (but not apiKey for security)
	if (projectConfig?.registry) {
		registryUrl = projectConfig.registry;
	}

	// Environment variables always win
	if (process.env.PSPM_REGISTRY_URL) {
		registryUrl = process.env.PSPM_REGISTRY_URL;
	}
	if (process.env.PSPM_API_KEY) {
		apiKey = process.env.PSPM_API_KEY;
	}

	if (process.env.PSPM_DEBUG) {
		console.log("[config] Resolved config:");
		console.log(`[config]   registryUrl: ${registryUrl}`);
		console.log(`[config]   apiKey: ${apiKey ? "***" : "(not set)"}`);
		console.log(`[config]   username: ${username || "(not set)"}`);
		console.log(
			`[config]   scopedRegistries: ${JSON.stringify(scopedRegistries)}`,
		);
		console.log(
			`[config]   registryTokens: ${Object.keys(registryTokens).length} configured`,
		);
	}

	return {
		registryUrl,
		apiKey,
		username,
		scopedRegistries,
		registryTokens,
	};
}

// =============================================================================
// Multi-Registry Helpers
// =============================================================================

/**
 * Get the auth token for a given registry URL.
 * Falls back to the default API key if no registry-specific token is configured.
 *
 * @param config - The resolved configuration
 * @param registryUrl - The registry URL
 * @returns The auth token to use, or undefined if none available
 */
export function getTokenForRegistry(
	config: ResolvedConfig,
	registryUrl: string,
): string | undefined {
	try {
		const url = new URL(registryUrl);
		const host = url.host;

		// Check for host-specific token first
		if (config.registryTokens[host]) {
			return config.registryTokens[host];
		}

		// Fall back to default API key
		return config.apiKey;
	} catch {
		// Invalid URL, fall back to default
		return config.apiKey;
	}
}

// =============================================================================
// Credential Management
// =============================================================================

/**
 * Set credentials (authToken and optionally username/registry)
 */
export async function setCredentials(
	authToken: string,
	username?: string,
	registry?: string,
): Promise<void> {
	const config = await readUserConfig();

	config.authToken = authToken;
	if (username) {
		config.username = username;
	}
	if (registry && registry !== DEFAULT_REGISTRY_URL) {
		config.registry = registry;
	}

	await writeUserConfig(config);
}

/**
 * Clear credentials (authToken and username)
 */
export async function clearCredentials(): Promise<void> {
	const config = await readUserConfig();

	config.authToken = undefined;
	config.username = undefined;

	await writeUserConfig(config);
}

/**
 * Check if user is logged in
 */
export async function isLoggedIn(): Promise<boolean> {
	try {
		const resolved = await resolveConfig();
		return !!resolved.apiKey;
	} catch {
		return false;
	}
}

/**
 * Get the API key (throws if not logged in)
 */
export async function requireApiKey(): Promise<string> {
	const resolved = await resolveConfig();

	if (!resolved.apiKey) {
		if (process.env.PSPM_DEBUG) {
			console.log("[config] requireApiKey: No API key found");
		}
		throw new NotLoggedInError();
	}

	if (process.env.PSPM_DEBUG) {
		console.log(
			`[config] requireApiKey: Got API key (${resolved.apiKey.substring(0, 10)}...)`,
		);
	}

	return resolved.apiKey;
}

/**
 * Get the registry URL
 */
export async function getRegistryUrl(): Promise<string> {
	const resolved = await resolveConfig();
	return resolved.registryUrl;
}
