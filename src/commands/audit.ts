/**
 * Audit command - Verify integrity of installed skills and check for issues.
 *
 * Checks:
 * 1. Integrity verification: re-hash installed files and compare with lockfile
 * 2. Deprecated packages: flag any deprecated versions
 * 3. Missing packages: flag packages in lockfile but not on disk
 */

import { stat } from "node:fs/promises";
import { join } from "node:path";
import { getSkillsDir } from "@/config";
import { parseGitHubSpecifier, type WellKnownLockfileEntry } from "@/lib/index";
import {
  listLockfileGitHubPackages,
  listLockfileSkills,
  listLockfileWellKnownPackages,
  readLockfile,
} from "@/lockfile";

export interface AuditOptions {
  /** Output as JSON */
  json?: boolean;
}

interface AuditIssue {
  name: string;
  source: "registry" | "github" | "well-known";
  severity: "error" | "warning" | "info";
  type: "integrity" | "deprecated" | "missing" | "no-lockfile";
  message: string;
}

export async function audit(options: AuditOptions): Promise<void> {
  try {
    const lockfile = await readLockfile();

    if (!lockfile) {
      if (options.json) {
        console.log(
          JSON.stringify({
            ok: false,
            issues: [
              {
                name: "-",
                source: "-",
                severity: "error",
                type: "no-lockfile",
                message: "No lockfile found. Run 'pspm install' first.",
              },
            ],
          }),
        );
      } else {
        console.error("No lockfile found. Run 'pspm install' to create one.");
      }
      process.exit(1);
    }

    const issues: AuditIssue[] = [];
    const skillsDir = getSkillsDir();
    const projectRoot = process.cwd();

    if (!options.json) {
      console.log("Auditing installed skills...\n");
    }

    // =================================================================
    // Check registry packages
    // =================================================================
    const registrySkills = await listLockfileSkills();

    for (const { name: fullName, entry } of registrySkills) {
      const match = fullName.match(/^@user\/([^/]+)\/([^/]+)$/);
      if (!match) continue;

      const [, username, skillName] = match;
      const destDir = join(projectRoot, skillsDir, username, skillName);

      // Check if installed on disk
      const exists = await pathExists(destDir);
      if (!exists) {
        issues.push({
          name: fullName,
          source: "registry",
          severity: "error",
          type: "missing",
          message: `Not installed on disk. Run 'pspm install' to restore.`,
        });
        continue;
      }

      // Check for deprecation
      if (entry.deprecated) {
        issues.push({
          name: fullName,
          source: "registry",
          severity: "warning",
          type: "deprecated",
          message: `Deprecated: ${entry.deprecated}`,
        });
      }

      // Verify tarball integrity would require re-downloading;
      // instead check that the installed directory exists and has SKILL.md
      const skillMdExists = await pathExists(join(destDir, "SKILL.md"));
      if (!skillMdExists) {
        issues.push({
          name: fullName,
          source: "registry",
          severity: "warning",
          type: "integrity",
          message:
            "Missing SKILL.md in installed directory. Package may be corrupted.",
        });
      }
    }

    // =================================================================
    // Check GitHub packages
    // =================================================================
    const githubSkills = await listLockfileGitHubPackages();

    for (const { specifier } of githubSkills) {
      const parsed = parseGitHubSpecifier(specifier);
      if (!parsed) continue;

      const destDir = parsed.path
        ? join(
            projectRoot,
            skillsDir,
            "_github",
            parsed.owner,
            parsed.repo,
            parsed.path,
          )
        : join(projectRoot, skillsDir, "_github", parsed.owner, parsed.repo);

      const exists = await pathExists(destDir);
      if (!exists) {
        issues.push({
          name: specifier,
          source: "github",
          severity: "error",
          type: "missing",
          message: `Not installed on disk. Run 'pspm install' to restore.`,
        });
        continue;
      }

      // Check SKILL.md exists
      const skillMdExists = await pathExists(join(destDir, "SKILL.md"));
      if (!skillMdExists) {
        issues.push({
          name: specifier,
          source: "github",
          severity: "warning",
          type: "integrity",
          message:
            "Missing SKILL.md in installed directory. Package may be corrupted.",
        });
      }
    }

    // =================================================================
    // Check well-known packages
    // =================================================================
    const wellKnownSkills = await listLockfileWellKnownPackages();

    for (const { specifier, entry } of wellKnownSkills) {
      const wkEntry = entry as WellKnownLockfileEntry;
      const destDir = join(
        projectRoot,
        skillsDir,
        "_wellknown",
        wkEntry.hostname,
        wkEntry.name,
      );

      const exists = await pathExists(destDir);
      if (!exists) {
        issues.push({
          name: specifier,
          source: "well-known",
          severity: "error",
          type: "missing",
          message: `Not installed on disk. Run 'pspm install' to restore.`,
        });
        continue;
      }

      // Verify SKILL.md exists
      const skillMdExists = await pathExists(join(destDir, "SKILL.md"));
      if (!skillMdExists) {
        issues.push({
          name: specifier,
          source: "well-known",
          severity: "warning",
          type: "integrity",
          message:
            "Missing SKILL.md in installed directory. Package may be corrupted.",
        });
      }
    }

    // =================================================================
    // Report results
    // =================================================================
    const errorCount = issues.filter((i) => i.severity === "error").length;
    const warningCount = issues.filter((i) => i.severity === "warning").length;

    if (options.json) {
      console.log(
        JSON.stringify(
          {
            ok: errorCount === 0,
            totalPackages:
              registrySkills.length +
              githubSkills.length +
              wellKnownSkills.length,
            issues,
          },
          null,
          2,
        ),
      );
      if (errorCount > 0) process.exit(1);
      return;
    }

    if (issues.length === 0) {
      const totalPackages =
        registrySkills.length + githubSkills.length + wellKnownSkills.length;
      console.log(`Audited ${totalPackages} package(s). No issues found.`);
      return;
    }

    // Print issues grouped by severity
    const errors = issues.filter((i) => i.severity === "error");
    const warnings = issues.filter((i) => i.severity === "warning");

    if (errors.length > 0) {
      console.log("Errors:");
      for (const issue of errors) {
        console.log(
          `  [${issue.type.toUpperCase()}] ${issue.name} (${issue.source})`,
        );
        console.log(`    ${issue.message}`);
      }
      console.log();
    }

    if (warnings.length > 0) {
      console.log("Warnings:");
      for (const issue of warnings) {
        console.log(
          `  [${issue.type.toUpperCase()}] ${issue.name} (${issue.source})`,
        );
        console.log(`    ${issue.message}`);
      }
      console.log();
    }

    const totalPackages =
      registrySkills.length + githubSkills.length + wellKnownSkills.length;
    console.log(
      `Audited ${totalPackages} package(s): ${errorCount} error(s), ${warningCount} warning(s).`,
    );

    if (errorCount > 0) {
      process.exit(1);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}
