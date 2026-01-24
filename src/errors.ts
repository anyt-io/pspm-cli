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

	if (!errorData) {
		return `${fallbackMessage} (HTTP ${response.status})`;
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

	// Add request ID for debugging
	if (errorData.requestId) {
		errorMessage += `\n(Request ID: ${errorData.requestId})`;
	}

	return errorMessage;
}
