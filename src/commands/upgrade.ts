import { execSync } from "node:child_process";
import * as semver from "semver";

export async function upgrade(): Promise<void> {
  const packageName = "@anytio/pspm";

  try {
    // Get current version from package.json (already loaded at startup)
    const currentVersion = getCurrentVersion();

    // Check latest version from npm registry
    console.log("Checking for updates...\n");
    const latestVersion = getLatestVersion(packageName);

    if (!latestVersion) {
      console.error("Error: Could not fetch latest version from registry.");
      process.exit(1);
    }

    if (
      semver.valid(currentVersion) &&
      semver.valid(latestVersion) &&
      !semver.gt(latestVersion, currentVersion)
    ) {
      console.log(`Already on the latest version: ${currentVersion}`);
      return;
    }

    console.log(`  Current version: ${currentVersion}`);
    console.log(`  Latest version:  ${latestVersion}\n`);

    // Detect which package manager was used to install
    const pm = detectPackageManager();
    const installCmd = getInstallCommand(pm, packageName, latestVersion);

    console.log(`Upgrading via ${pm}...\n`);
    console.log(`  $ ${installCmd}\n`);

    execSync(installCmd, { stdio: "inherit" });

    console.log(`\nSuccessfully upgraded to ${latestVersion}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}

function getCurrentVersion(): string {
  try {
    const output = execSync("pspm --version", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    return output;
  } catch {
    return "unknown";
  }
}

function getLatestVersion(packageName: string): string | null {
  try {
    const output = execSync(`npm view ${packageName} version`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
    return output || null;
  } catch {
    return null;
  }
}

function detectPackageManager(): "pnpm" | "npm" | "yarn" | "bun" {
  // Check if installed globally via specific package managers
  try {
    const pnpmList = execSync("pnpm list -g --depth=0 2>/dev/null", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    if (pnpmList.includes("@anytio/pspm")) return "pnpm";
  } catch {}

  try {
    const bunList = execSync("bun pm ls -g 2>/dev/null", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    if (bunList.includes("@anytio/pspm")) return "bun";
  } catch {}

  try {
    const yarnList = execSync("yarn global list 2>/dev/null", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    if (yarnList.includes("@anytio/pspm")) return "yarn";
  } catch {}

  // Default to npm
  return "npm";
}

function getInstallCommand(
  pm: "pnpm" | "npm" | "yarn" | "bun",
  packageName: string,
  version: string,
): string {
  switch (pm) {
    case "pnpm":
      return `pnpm add -g ${packageName}@${version}`;
    case "yarn":
      return `yarn global add ${packageName}@${version}`;
    case "bun":
      return `bun add -g ${packageName}@${version}`;
    case "npm":
      return `npm install -g ${packageName}@${version}`;
  }
}
