import {
  configure,
  deprecateSkillVersion,
  undeprecateSkillVersion,
} from "@/api-client";
import { getRegistryUrl, requireApiKey } from "@/config";
import {
  generateRegistryIdentifier,
  parseRegistrySpecifier,
} from "@/lib/index";

export interface DeprecateOptions {
  undo?: boolean;
}

/**
 * Deprecate or undeprecate a skill version
 *
 * Usage:
 *   pspm deprecate @user/bob/skill@1.0.0 "Use v2.0.0 instead"
 *   pspm deprecate @user/bob/skill@1.0.0 --undo
 */
export async function deprecate(
  specifier: string,
  message: string | undefined,
  options: DeprecateOptions,
): Promise<void> {
  try {
    const apiKey = await requireApiKey();
    const registryUrl = await getRegistryUrl();

    // Parse the specifier
    const parsed = parseRegistrySpecifier(specifier);
    if (!parsed) {
      console.error(
        `Error: Invalid skill specifier "${specifier}". Use format: @user/{username}/{name}@{version} or @org/{orgname}/{name}@{version}`,
      );
      process.exit(1);
    }

    const { owner, name, versionRange } = parsed;
    const fullName = generateRegistryIdentifier({
      namespace: parsed.namespace,
      owner,
      name,
    });

    if (!versionRange) {
      console.error(
        "Error: Version is required for deprecation. Use format: @user/{username}/{name}@{version}",
      );
      process.exit(1);
    }

    // Configure SDK
    configure({ registryUrl, apiKey });

    if (options.undo) {
      // Remove deprecation
      console.log(`Removing deprecation from ${fullName}@${versionRange}...`);

      const response = await undeprecateSkillVersion(owner, name, versionRange);
      if (response.status !== 200) {
        console.error(
          `Error: ${response.error || "Failed to remove deprecation"}`,
        );
        process.exit(1);
      }

      console.log(`Removed deprecation from ${fullName}@${versionRange}`);
    } else {
      // Add deprecation
      if (!message) {
        console.error(
          "Error: Deprecation message is required. Usage: pspm deprecate <specifier> <message>",
        );
        process.exit(1);
      }

      console.log(`Deprecating ${fullName}@${versionRange}...`);

      const response = await deprecateSkillVersion(
        owner,
        name,
        versionRange,
        message,
      );
      if (response.status !== 200) {
        console.error(
          `Error: ${response.error || "Failed to deprecate version"}`,
        );
        process.exit(1);
      }

      console.log(`Deprecated ${fullName}@${versionRange}`);
      console.log(`Message: ${message}`);
      console.log("");
      console.log(
        "Users installing this version will see a deprecation warning.",
      );
      console.log("The package is still available for download.");
    }
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`Error: ${errorMessage}`);
    process.exit(1);
  }
}
