/**
 * Custom fetch wrapper for Orval-generated SDK
 *
 * Handles authentication and base URL configuration.
 */

export interface SDKConfig {
	baseUrl: string;
	/** API key for authentication. Optional for public package access. */
	apiKey?: string;
}

let config: SDKConfig | null = null;

/**
 * Configure the SDK with base URL and API key.
 * Must be called before making any API requests.
 *
 * @example
 * ```typescript
 * import { configure } from "./sdk/fetcher";
 *
 * configure({
 *   baseUrl: "http://localhost:5600",
 *   apiKey: "your-api-key"
 * });
 * ```
 */
export function configure(options: SDKConfig): void {
	config = options;
}

/**
 * Get the current SDK configuration.
 * @throws Error if not configured
 */
export function getConfig(): SDKConfig {
	if (!config) {
		throw new Error("SDK not configured. Call configure() first.");
	}
	return config;
}

/**
 * Check if the SDK is configured.
 */
export function isConfigured(): boolean {
	return config !== null;
}

/**
 * Error class for SDK API errors
 */
export class SDKError extends Error {
	constructor(
		message: string,
		public readonly status: number,
		public readonly body?: string,
	) {
		super(message);
		this.name = "SDKError";
	}
}

/**
 * Custom fetch function for Orval
 *
 * This is used by all generated API functions to make HTTP requests.
 * It handles authentication, error handling, and response parsing.
 *
 * Returns { data, status, headers } structure expected by Orval v8.
 */
export async function customFetch<T>(
	url: string,
	options: RequestInit,
): Promise<T> {
	const { baseUrl, apiKey } = getConfig();

	// The URL from Orval will be like "/api/skills/me"
	// We need to prepend the baseUrl
	const fullUrl = `${baseUrl}${url}`;

	// Build headers - only include Authorization if apiKey is provided
	const headers: Record<string, string> = {
		...((options.headers as Record<string, string>) ?? {}),
		"Content-Type": "application/json",
	};
	if (apiKey) {
		headers.Authorization = `Bearer ${apiKey}`;
	}

	const response = await fetch(fullUrl, {
		...options,
		headers,
	});

	const text = await response.text();
	let data: unknown = null;

	if (text) {
		try {
			data = JSON.parse(text);
		} catch {
			data = text;
		}
	}

	// Return the structure expected by Orval v8: { data, status, headers }
	return {
		data,
		status: response.status,
		headers: response.headers,
	} as T;
}
