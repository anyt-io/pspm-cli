import { execSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { isNewerVersion } from "@/lib/version";

const PACKAGE_NAME = "@anytio/pspm";
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_DIR = join(homedir(), ".pspm");
const CACHE_FILE = join(CACHE_DIR, "update-check.json");

interface UpdateCache {
  lastCheck: number;
  latestVersion: string;
}

/**
 * Check for updates in the background and print a warning if outdated.
 * This is non-blocking — it reads from cache and spawns a background check.
 */
export async function checkForUpdates(currentVersion: string): Promise<void> {
  try {
    const cache = await readCache();

    // If cache exists and is fresh, show warning if needed
    if (cache && Date.now() - cache.lastCheck < CHECK_INTERVAL_MS) {
      if (isNewerVersion(cache.latestVersion, currentVersion)) {
        printUpdateWarning(currentVersion, cache.latestVersion);
      }
      return;
    }

    // Cache is stale or missing — fetch in background
    fetchAndCache(currentVersion);
  } catch {
    // Never let update checking break the CLI
  }
}

async function readCache(): Promise<UpdateCache | null> {
  try {
    const content = await readFile(CACHE_FILE, "utf-8");
    return JSON.parse(content) as UpdateCache;
  } catch {
    return null;
  }
}

async function writeCache(cache: UpdateCache): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(CACHE_FILE, JSON.stringify(cache));
}

/**
 * Fetch latest version and update cache.
 * Runs synchronously but is called after command execution so it doesn't block UX.
 */
function fetchAndCache(currentVersion: string): void {
  try {
    const latestVersion = execSync(`npm view ${PACKAGE_NAME} version`, {
      encoding: "utf-8",
      timeout: 5000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();

    if (!latestVersion) return;

    const cache: UpdateCache = {
      lastCheck: Date.now(),
      latestVersion,
    };

    // Write cache (fire and forget)
    writeCache(cache).catch(() => {});

    if (isNewerVersion(latestVersion, currentVersion)) {
      printUpdateWarning(currentVersion, latestVersion);
    }
  } catch {
    // Network error or npm not available — silently ignore
  }
}

function printUpdateWarning(
  currentVersion: string,
  latestVersion: string,
): void {
  console.warn(
    `\n  Update available: ${currentVersion} → ${latestVersion}` +
      "\n  Run `pspm upgrade` to update\n",
  );
}
