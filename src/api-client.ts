/**
 * API Client for PSPM CLI
 *
 * This module re-exports the SDK functions and provides the
 * initialization logic for the CLI.
 */

import {
	getConfig,
	isConfigured,
	type SDKConfig,
	SDKError,
	configure as sdkConfigure,
} from "./sdk/fetcher";
import {
	deleteSkill,
	deleteSkillVersion,
	exchangeCliToken,
	getSkill,
	getSkillVersion,
	listMySkills,
	listSkillVersions,
	listUserSkills,
	me,
	publishSkill,
} from "./sdk/generated";

/**
 * Convert a registry URL to the base server URL for the SDK.
 *
 * The CLI stores registry URLs like "https://pspm.dev". This function
 * normalizes the URL by removing any trailing /api/skills path if present
 * (for backwards compatibility with older configs).
 */
function registryUrlToBaseUrl(registryUrl: string): string {
	return registryUrl.replace(/\/api\/skills\/?$/, "");
}

/**
 * Configure the SDK with registry URL and API key.
 *
 * This wrapper handles converting the CLI's registry URL format to the
 * base URL format expected by the SDK.
 */
export function configure(options: {
	registryUrl: string;
	apiKey: string;
}): void {
	const baseUrl = registryUrlToBaseUrl(options.registryUrl);
	sdkConfigure({ baseUrl, apiKey: options.apiKey });
}

// Re-export SDK functions for convenience
export {
	deleteSkill,
	deleteSkillVersion,
	exchangeCliToken,
	getConfig,
	getSkill,
	getSkillVersion,
	isConfigured,
	listMySkills,
	listSkillVersions,
	listUserSkills,
	me,
	publishSkill,
	SDKError,
};

// Re-export types
export type { SDKConfig };

/**
 * Get user info from the API using the /me endpoint.
 * Returns null if not authenticated.
 */
export async function whoamiRequest(
	registryUrl: string,
	apiKey: string,
): Promise<{ username: string; userId: string } | null> {
	try {
		// Use direct REST endpoints (not oRPC /rpc prefix)
		configure({ registryUrl, apiKey });
		const response = await me();
		// Check for successful response before accessing user data
		if (response.status !== 200 || !response.data) {
			return null;
		}
		const user = response.data;
		return {
			username: user.username,
			userId: user.userId,
		};
	} catch {
		return null;
	}
}

/**
 * Deprecate a skill version
 */
export async function deprecateSkillVersion(
	skillName: string,
	version: string,
	message: string,
): Promise<{ status: number; data?: unknown; error?: string }> {
	const config = getConfig();
	if (!config) {
		return { status: 401, error: "SDK not configured" };
	}

	try {
		const response = await fetch(
			`${config.baseUrl}/api/skills/${skillName}/${version}/deprecate`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${config.apiKey}`,
				},
				body: JSON.stringify({ message }),
			},
		);

		if (!response.ok) {
			const error = await response.text();
			return { status: response.status, error };
		}

		const data = await response.json();
		return { status: response.status, data };
	} catch (error) {
		return {
			status: 500,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

/**
 * Remove deprecation from a skill version
 */
export async function undeprecateSkillVersion(
	skillName: string,
	version: string,
): Promise<{ status: number; data?: unknown; error?: string }> {
	const config = getConfig();
	if (!config) {
		return { status: 401, error: "SDK not configured" };
	}

	try {
		const response = await fetch(
			`${config.baseUrl}/api/skills/${skillName}/${version}/deprecate`,
			{
				method: "DELETE",
				headers: {
					Authorization: `Bearer ${config.apiKey}`,
				},
			},
		);

		if (!response.ok) {
			const error = await response.text();
			return { status: response.status, error };
		}

		const data = await response.json();
		return { status: response.status, data };
	} catch (error) {
		return {
			status: 500,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

/**
 * Change skill visibility (public/private)
 */
export async function changeSkillAccess(
	skillName: string,
	input: { visibility: "public" | "private" },
): Promise<{
	status: number;
	data?: {
		id: string;
		name: string;
		username: string;
		description: string | null;
		visibility: "public" | "private";
		createdAt: string;
		updatedAt: string;
	};
	error?: string;
}> {
	const config = getConfig();
	if (!config) {
		return { status: 401, error: "SDK not configured" };
	}

	try {
		const response = await fetch(
			`${config.baseUrl}/api/skills/${skillName}/access`,
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${config.apiKey}`,
				},
				body: JSON.stringify(input),
			},
		);

		if (!response.ok) {
			const error = await response.text();
			try {
				const errorJson = JSON.parse(error);
				return {
					status: response.status,
					error: errorJson.message || errorJson.error || error,
				};
			} catch {
				return { status: response.status, error };
			}
		}

		const data = (await response.json()) as {
			id: string;
			name: string;
			username: string;
			description: string | null;
			visibility: "public" | "private";
			createdAt: string;
			updatedAt: string;
		};
		return { status: response.status, data };
	} catch (error) {
		return {
			status: 500,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}
