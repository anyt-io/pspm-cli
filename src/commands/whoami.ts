import { whoamiRequest } from "@/api-client";
import { getRegistryUrl, requireApiKey, resolveConfig } from "@/config";

export async function whoami(): Promise<void> {
	try {
		const resolved = await resolveConfig();
		const apiKey = await requireApiKey();
		const registryUrl = await getRegistryUrl();

		const user = await whoamiRequest(registryUrl, apiKey);

		if (user) {
			console.log(`Username: ${user.username}`);
			console.log(`User ID:  ${user.userId}`);
			console.log(`Registry: ${registryUrl}`);
		} else if (resolved.username) {
			// Use cached username if API call fails
			console.log(`Username: ${resolved.username} (cached)`);
			console.log(`Registry: ${registryUrl}`);
		} else {
			console.error("Could not determine current user.");
			process.exit(1);
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		console.error(`Error: ${message}`);
		process.exit(1);
	}
}
