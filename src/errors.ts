/**
 * Base error class for PSPM configuration errors
 */
export class ConfigError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ConfigError";
	}
}

/**
 * Error thrown when the user is not logged in
 */
export class NotLoggedInError extends ConfigError {
	constructor() {
		super(
			"Not logged in. Run 'pspm login --api-key <key>' first, or set PSPM_API_KEY env var.",
		);
		this.name = "NotLoggedInError";
	}
}

/**
 * API error response structure from OpenAPI spec
 */
interface ApiErrorResponse {
	code?: string;
	message?: string;
	details?:
		| {
				issues?: Array<{ path?: Array<string | number>; message?: string }>;
		  }
		| Record<string, unknown>;
	requestId?: string;
	timestamp?: string;
}

/**
 * Get a human-readable description for common HTTP status codes
 */
function getHttpStatusDescription(status: number): string {
	const descriptions: Record<number, string> = {
		400: "Bad Request - The request was malformed",
		401: "Unauthorized - Please run 'pspm login' first",
		403: "Forbidden - You don't have permission for this action",
		404: "Not Found - The endpoint or resource doesn't exist",
		409: "Conflict - The resource already exists or there's a version conflict",
		422: "Validation Error - The request data is invalid",
		429: "Too Many Requests - Please slow down and try again",
		500: "Internal Server Error - Something went wrong on the server",
		502: "Bad Gateway - The server is temporarily unavailable",
		503: "Service Unavailable - The server is temporarily unavailable",
	};
	return descriptions[status] || `HTTP Error ${status}`;
}

/**
 * Extract a human-readable error message from an API response
 * Handles both ApiError and ValidationError types
 */
export function extractApiErrorMessage(
	response: { status: number; data: unknown },
	fallbackMessage: string,
): string {
	const errorData = response.data as ApiErrorResponse | null;

	if (process.env.PSPM_DEBUG) {
		console.log(`[debug] API response status: ${response.status}`);
		console.log(
			"[debug] API response data:",
			JSON.stringify(errorData, null, 2),
		);
	}

	// Handle cases where errorData is a string (like "Not Found" from 404)
	if (typeof errorData === "string") {
		if (response.status === 404) {
			return `${fallbackMessage}: ${getHttpStatusDescription(404)}\nThe registry endpoint may be unavailable or misconfigured.`;
		}
		return `${fallbackMessage}: ${errorData} (HTTP ${response.status})`;
	}

	// Handle empty or null response
	if (!errorData || typeof errorData !== "object") {
		const statusDesc = getHttpStatusDescription(response.status);
		if (response.status === 404) {
			return `${fallbackMessage}: ${statusDesc}\nCheck that the registry URL is correct in your config.`;
		}
		return `${fallbackMessage}: ${statusDesc}`;
	}

	// Start with the message field or fallback
	let errorMessage = errorData.message || fallbackMessage;

	// For validation errors, format the issues
	if (errorData.code === "VALIDATION_ERROR" && errorData.details) {
		const issues = (
			errorData.details as {
				issues?: Array<{ path?: Array<string | number>; message?: string }>;
			}
		).issues;
		if (issues && Array.isArray(issues)) {
			const issueMessages = issues
				.map((issue) => {
					const path = issue.path?.join(".") || "input";
					const msg = issue.message || "invalid value";
					return `  - ${path}: ${msg}`;
				})
				.join("\n");
			errorMessage = `Validation failed:\n${issueMessages}`;
		}
	}

	// Add error code prefix if available and not already in message
	if (errorData.code && !errorMessage.includes(errorData.code)) {
		errorMessage = `[${errorData.code}] ${errorMessage}`;
	}

	// Add HTTP status context for non-200 responses
	if (response.status >= 400) {
		errorMessage += ` (HTTP ${response.status})`;
	}

	// Add request ID for debugging
	if (errorData.requestId) {
		errorMessage += `\n(Request ID: ${errorData.requestId})`;
	}

	return errorMessage;
}
