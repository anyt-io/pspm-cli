import { clearCredentials, isLoggedIn } from "@/config";

export async function logout(): Promise<void> {
	try {
		const loggedIn = await isLoggedIn();

		if (!loggedIn) {
			console.log("Not logged in.");
			return;
		}

		await clearCredentials();
		console.log("Logged out successfully.");
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		console.error(`Error: ${message}`);
		process.exit(1);
	}
}
