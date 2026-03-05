import { getTokenForRegistry, resolveConfig } from "@/config";
import {
	checkOutdated as checkOutdatedFn,
	type OutdatedResult,
} from "@/lib/outdated";
import { readLockfile } from "@/lockfile";
import { readManifest } from "@/manifest";

export interface OutdatedOptions {
	json?: boolean;
	all?: boolean;
}

export async function outdated(
	packages: string[],
	options: OutdatedOptions,
): Promise<void> {
	try {
		const lockfile = await readLockfile();
		if (!lockfile) {
			console.log("No skills installed.");
			return;
		}

		const hasPackages =
			Object.keys(lockfile.packages ?? lockfile.skills ?? {}).length > 0 ||
			Object.keys(lockfile.githubPackages ?? {}).length > 0 ||
			Object.keys(lockfile.localPackages ?? {}).length > 0;

		if (!hasPackages) {
			console.log("No skills installed.");
			return;
		}

		const config = await resolveConfig();
		const registryUrl = config.registryUrl;
		const apiKey = getTokenForRegistry(config, registryUrl);
		const githubToken = process.env.GITHUB_TOKEN;

		const manifest = await readManifest();

		console.log("Checking for outdated packages...\n");

		const results = await checkOutdatedFn(
			{ registryUrl, apiKey, githubToken },
			{
				lockfile,
				manifest: manifest ?? undefined,
				includeUpToDate: options.all,
				packages: packages.length > 0 ? packages : undefined,
			},
		);

		if (results.length === 0) {
			console.log("All skills are up to date.");
			return;
		}

		if (options.json) {
			console.log(JSON.stringify(results, null, 2));
		} else {
			printTable(results);
		}

		// Show deprecation warnings
		const deprecated = results.filter((r) => r.deprecated);
		if (deprecated.length > 0) {
			console.log("");
			for (const r of deprecated) {
				console.log(`\x1b[33m⚠ ${r.name}: ${r.deprecated}\x1b[0m`);
			}
		}

		// Exit code 1 if any outdated packages (useful for CI)
		const hasOutdated = results.some((r) => r.isOutdated);
		if (hasOutdated) {
			process.exitCode = 1;
		}
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		console.error(`Error: ${message}`);
		process.exit(1);
	}
}

function printTable(results: OutdatedResult[]): void {
	// Calculate column widths
	const headers = ["Package", "Current", "Wanted", "Latest", "Type"];
	const rows = results.map((r) => [
		r.name,
		r.current,
		r.wanted ?? "—",
		r.latest ?? "—",
		r.type,
	]);

	const widths = headers.map((h, i) =>
		Math.max(h.length, ...rows.map((row) => row[i].length)),
	);

	// Print header
	const headerLine = headers.map((h, i) => h.padEnd(widths[i])).join("  ");
	console.log(headerLine);
	console.log(widths.map((w) => "─".repeat(w)).join("──"));

	// Print rows
	for (const row of rows) {
		const line = row.map((cell, i) => cell.padEnd(widths[i])).join("  ");
		console.log(line);
	}
}
