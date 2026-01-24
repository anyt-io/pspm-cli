import { createHash } from "node:crypto";

/**
 * Calculate integrity hash for a buffer.
 * Uses SHA-256 with base64 encoding, prefixed with "sha256-".
 *
 * @param data - The buffer to hash
 * @returns Integrity string (e.g., "sha256-abc123...")
 */
export function calculateIntegrity(data: Buffer): string {
	const hash = createHash("sha256").update(data).digest("base64");
	return `sha256-${hash}`;
}

/**
 * Verify that a buffer matches an expected integrity hash.
 *
 * @param data - The buffer to verify
 * @param expectedIntegrity - The expected integrity string
 * @returns True if the integrity matches
 */
export function verifyIntegrity(
	data: Buffer,
	expectedIntegrity: string,
): boolean {
	const match = expectedIntegrity.match(/^sha256-(.+)$/);
	if (!match) {
		return false;
	}

	const actualHash = createHash("sha256").update(data).digest("base64");
	return actualHash === match[1];
}
