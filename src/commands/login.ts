import { randomBytes } from "node:crypto";
import http from "node:http";
import { URL } from "node:url";
import open from "open";
import { whoamiRequest } from "../api-client.js";
import { getRegistryUrl, setCredentials } from "../config.js";

export interface LoginOptions {
	apiKey?: string;
}

const DEFAULT_WEB_APP_URL = "https://pspm.dev";

/**
 * Get the web app URL.
 * Priority:
 * 1. PSPM_WEB_URL environment variable (for local dev where web and server run on different ports)
 * 2. Derived from registry URL (for production where they share the same origin)
 *
 * Local dev example:
 *   PSPM_WEB_URL=http://localhost:5500 pspm login
 *
 * The registry URL is like https://pspm.dev
 * The web app URL is the same: https://pspm.dev
 */
function getWebAppUrl(registryUrl: string): string {
	// Environment variable takes priority (for local dev)
	if (process.env.PSPM_WEB_URL) {
		return process.env.PSPM_WEB_URL.replace(/\/$/, ""); // Remove trailing slash
	}

	try {
		const url = new URL(registryUrl);
		return `${url.protocol}//${url.host}`;
	} catch {
		return DEFAULT_WEB_APP_URL;
	}
}

/**
 * Get the server/API base URL from the registry URL
 * The registry URL is like https://pspm.dev
 * The server URL is the same: https://pspm.dev
 */
function getServerUrl(registryUrl: string): string {
	try {
		const url = new URL(registryUrl);
		return `${url.protocol}//${url.host}`;
	} catch {
		return DEFAULT_WEB_APP_URL;
	}
}

/**
 * Exchange a CLI token for an API key using fetch
 */
async function exchangeCliToken(
	registryUrl: string,
	token: string,
): Promise<{ apiKey: string; username: string }> {
	const serverUrl = getServerUrl(registryUrl);
	// Use direct REST endpoint (not oRPC) for CLI compatibility
	const rpcUrl = `${serverUrl}/api/api-keys/cli-token-exchange`;

	const response = await fetch(rpcUrl, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ token }),
	});

	if (!response.ok) {
		const errorText = await response.text();
		throw new Error(`Failed to exchange token: ${errorText}`);
	}

	return response.json() as Promise<{ apiKey: string; username: string }>;
}

/**
 * Start a local HTTP server to receive the OAuth callback
 */
function startCallbackServer(expectedState: string): Promise<{
	port: number;
	tokenPromise: Promise<string>;
	cleanup: () => void;
}> {
	return new Promise((resolveServer, rejectServer) => {
		let resolveToken: (token: string) => void;
		let rejectToken: (error: Error) => void;
		let timeoutId: NodeJS.Timeout;

		const tokenPromise = new Promise<string>((resolve, reject) => {
			resolveToken = resolve;
			rejectToken = reject;
		});

		const server = http.createServer((req, res) => {
			const url = new URL(req.url || "/", "http://localhost");

			if (url.pathname === "/callback") {
				const token = url.searchParams.get("token");
				const state = url.searchParams.get("state");

				if (state !== expectedState) {
					res.writeHead(400, { "Content-Type": "text/html" });
					res.end(`
						<html>
							<body style="font-family: system-ui; text-align: center; padding: 40px;">
								<h1 style="color: #dc2626;">Security Error</h1>
								<p>State mismatch - this may be a security issue.</p>
								<p>Please try running <code>pspm login</code> again.</p>
							</body>
						</html>
					`);
					rejectToken(new Error("State mismatch - possible CSRF attack"));
					return;
				}

				if (!token) {
					res.writeHead(400, { "Content-Type": "text/html" });
					res.end(`
						<html>
							<body style="font-family: system-ui; text-align: center; padding: 40px;">
								<h1 style="color: #dc2626;">Error</h1>
								<p>No token received from the server.</p>
								<p>Please try running <code>pspm login</code> again.</p>
							</body>
						</html>
					`);
					rejectToken(new Error("No token received"));
					return;
				}

				res.writeHead(200, { "Content-Type": "text/html" });
				res.end(`
					<html>
						<head>
							<script>
								// Try to close the window after a short delay
								setTimeout(function() {
									window.close();
								}, 1500);
							</script>
						</head>
						<body style="font-family: system-ui; text-align: center; padding: 40px;">
							<h1 style="color: #16a34a;">Success!</h1>
							<p>You are now logged in to PSPM.</p>
							<p style="color: #666; font-size: 14px;">This window will close automatically, or you can close it manually.</p>
						</body>
					</html>
				`);

				resolveToken(token);
			} else {
				res.writeHead(404, { "Content-Type": "text/plain" });
				res.end("Not found");
			}
		});

		// Cleanup function to close server and clear timeout
		const cleanup = () => {
			clearTimeout(timeoutId);
			server.close();
		};

		// Use port 0 to let the OS assign an available port
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			if (typeof address === "object" && address !== null) {
				resolveServer({ port: address.port, tokenPromise, cleanup });
			} else {
				rejectServer(new Error("Failed to get server address"));
			}
		});

		server.on("error", (err) => {
			rejectServer(err);
		});

		// Timeout after 5 minutes
		timeoutId = setTimeout(
			() => {
				rejectToken(new Error("Login timed out - please try again"));
				server.close();
			},
			5 * 60 * 1000,
		);
	});
}

/**
 * Login using browser-based OAuth flow
 */
async function browserLogin(): Promise<void> {
	const registryUrl = await getRegistryUrl();
	const webAppUrl = getWebAppUrl(registryUrl);

	// Generate state for CSRF protection
	const state = randomBytes(32).toString("base64url");

	console.log("Starting browser-based login...");

	// Start local callback server
	const { port, tokenPromise, cleanup } = await startCallbackServer(state);

	// Build the login URL
	const loginUrl = `${webAppUrl}/cli/login?port=${port}&state=${encodeURIComponent(state)}`;

	console.log("Opening browser to authenticate...");
	console.log(`If the browser doesn't open, visit: ${loginUrl}`);

	// Open the browser
	try {
		await open(loginUrl);
	} catch {
		console.log("Could not open browser automatically.");
		console.log(`Please visit: ${loginUrl}`);
	}

	console.log("Waiting for authentication...");

	// Wait for the callback with the token
	const token = await tokenPromise;

	// Clean up server and timeout immediately after receiving token
	cleanup();

	console.log("Received token, exchanging for API key...");

	// Exchange the token for an API key
	const { apiKey, username } = await exchangeCliToken(registryUrl, token);

	// Store credentials
	await setCredentials(apiKey, username, registryUrl);

	console.log(`Logged in as ${username}`);
	console.log(`Registry: ${registryUrl}`);
}

/**
 * Login using direct API key (fallback method)
 */
async function directLogin(apiKey: string): Promise<void> {
	console.log("Verifying API key...");

	const registryUrl = await getRegistryUrl();

	const user = await whoamiRequest(registryUrl, apiKey);
	if (!user) {
		console.error("Error: Invalid API key or not authenticated");
		process.exit(1);
	}

	// Store credentials
	await setCredentials(apiKey, user.username, registryUrl);
	console.log(`Logged in as ${user.username}`);
	console.log(`Registry: ${registryUrl}`);
}

export async function login(options: LoginOptions): Promise<void> {
	try {
		if (options.apiKey) {
			// Direct login with API key
			await directLogin(options.apiKey);
		} else {
			// Browser-based OAuth flow
			await browserLogin();
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		console.error(`Error: ${message}`);
		process.exit(1);
	}
}
