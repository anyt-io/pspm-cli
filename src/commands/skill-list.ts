/**
 * Skill List CLI Commands
 *
 * CRUD operations for managing skill lists via the CLI.
 */

import { configure, fetchSkillList } from "@/api-client";
import { getTokenForRegistry, requireApiKey, resolveConfig } from "@/config";

// =============================================================================
// Types
// =============================================================================

export interface SkillListCreateOptions {
  description?: string;
  visibility?: string;
  org?: string;
}

export interface SkillListListOptions {
  org?: string;
  json?: boolean;
}

export interface SkillListShowOptions {
  json?: boolean;
}

export interface SkillListUpdateOptions {
  description?: string;
  visibility?: string;
}

export interface SkillListAddSkillOptions {
  version?: string;
  note?: string;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Parse a list specifier like @user/alice/my-tools or @org/myorg/my-tools.
 * Returns { ownerType, ownerName, listName } or null.
 */
function parseListSpecifier(specifier: string): {
  ownerType: "user" | "org";
  ownerName: string;
  listName: string;
} | null {
  const match = specifier.match(/^@(user|org)\/([^/]+)\/([^/]+)$/);
  if (!match) return null;
  return {
    ownerType: match[1] as "user" | "org",
    ownerName: match[2],
    listName: match[3],
  };
}

/**
 * Extract a human-readable error message from an API error response.
 */
function extractErrorMessage(text: string): string {
  try {
    const json = JSON.parse(text);
    if (typeof json.message === "string") return json.message;
    if (typeof json.error === "string") return json.error;
    if (typeof json.error?.message === "string") return json.error.message;
  } catch {
    // Not JSON
  }
  return text;
}

async function getBaseUrl(): Promise<string> {
  const config = await resolveConfig();
  return config.registryUrl.replace(/\/api\/skills\/?$/, "");
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const apiKey = await requireApiKey();
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };
}

async function getOptionalAuthHeaders(): Promise<Record<string, string>> {
  const config = await resolveConfig();
  const apiKey = getTokenForRegistry(config, config.registryUrl);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  return headers;
}

// =============================================================================
// Commands
// =============================================================================

/**
 * List skill lists for the current user or an organization.
 */
export async function skillListList(
  options: SkillListListOptions,
): Promise<void> {
  const baseUrl = await getBaseUrl();
  const config = await resolveConfig();

  let path: string;
  if (options.org) {
    path = `/api/skill-lists/lists/@org/${options.org}`;
  } else {
    // Need username from config
    if (!config.username) {
      console.error("Error: Not logged in. Run `pspm login` first.");
      process.exit(1);
    }
    path = `/api/skill-lists/lists/@user/${config.username}`;
  }

  const headers = await getOptionalAuthHeaders();
  const response = await fetch(`${baseUrl}${path}`, { headers });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      `Error: Failed to list skill lists (${response.status}): ${extractErrorMessage(errorText)}`,
    );
    process.exit(1);
  }

  const lists = (await response.json()) as Array<{
    id: string;
    name: string;
    description: string | null;
    visibility: string;
    ownerType: string;
    ownerName: string;
    itemCount: number;
    createdAt: string;
    updatedAt: string;
  }>;

  if (options.json) {
    console.log(JSON.stringify(lists, null, 2));
    return;
  }

  if (lists.length === 0) {
    console.log("No skill lists found.");
    return;
  }

  const ownerLabel = options.org
    ? `@org/${options.org}`
    : `@user/${config.username}`;
  console.log(`\nSkill lists for ${ownerLabel}:\n`);
  console.log(
    `${"Name".padEnd(35)} ${"Skills".padEnd(8)} ${"Visibility".padEnd(12)} Description`,
  );
  console.log("-".repeat(90));

  for (const list of lists) {
    const desc = list.description ? list.description.slice(0, 30) : "";
    console.log(
      `${list.name.slice(0, 33).padEnd(35)} ${String(list.itemCount).padEnd(8)} ${list.visibility.padEnd(12)} ${desc}`,
    );
  }
  console.log(`\n${lists.length} list(s)`);
}

/**
 * Create a new skill list.
 */
export async function skillListCreate(
  name: string,
  options: SkillListCreateOptions,
): Promise<void> {
  const baseUrl = await getBaseUrl();
  const headers = await getAuthHeaders();
  const config = await resolveConfig();

  const visibility = options.visibility || "private";
  if (visibility !== "public" && visibility !== "private") {
    console.error('Error: --visibility must be "public" or "private"');
    process.exit(1);
  }

  let path: string;
  if (options.org) {
    path = `/api/skill-lists/lists/@org/${options.org}`;
  } else {
    if (!config.username) {
      console.error("Error: Not logged in. Run `pspm login` first.");
      process.exit(1);
    }
    path = `/api/skill-lists/lists/@user/${config.username}`;
  }

  const body: Record<string, string> = { name, visibility };
  if (options.description) {
    body.description = options.description;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      `Error: Failed to create list (${response.status}): ${extractErrorMessage(errorText)}`,
    );
    process.exit(1);
  }

  const list = (await response.json()) as {
    id: string;
    name: string;
    visibility: string;
    ownerType: string;
    ownerName: string;
  };

  const ownerLabel = options.org
    ? `@org/${options.org}`
    : `@user/${config.username}`;
  console.log(`Created list: ${ownerLabel}/${list.name} (${list.visibility})`);
  console.log(
    `\nInstall command: pspm skill-list install ${ownerLabel}/${list.name}`,
  );
}

/**
 * Show details of a skill list.
 */
export async function skillListShow(
  specifier: string,
  options: SkillListShowOptions,
): Promise<void> {
  const parsed = parseListSpecifier(specifier);
  if (!parsed) {
    console.error(
      "Error: Invalid list specifier. Use @user/<username>/<list-name> or @org/<orgname>/<list-name>",
    );
    process.exit(1);
  }

  const config = await resolveConfig();
  configure({
    registryUrl: config.registryUrl,
    apiKey: getTokenForRegistry(config, config.registryUrl),
  });

  const response = await fetchSkillList(
    parsed.ownerType,
    parsed.ownerName,
    parsed.listName,
  );

  if (response.status !== 200 || !response.data) {
    const errorMsg =
      response.status === 404
        ? `List "${specifier}" not found or is private.`
        : response.error || "Failed to fetch list";
    console.error(`Error: ${errorMsg}`);
    process.exit(1);
  }

  const list = response.data;

  if (options.json) {
    console.log(JSON.stringify(list, null, 2));
    return;
  }

  console.log(`\n${list.name}`);
  if (list.description) {
    console.log(`  ${list.description}`);
  }
  console.log(`  Visibility: ${list.visibility}`);
  console.log(`  Owner: @${list.ownerType}/${list.ownerName}`);
  console.log(`  Skills: ${list.items.length}`);

  if (list.items.length > 0) {
    console.log("");
    for (const item of list.items) {
      const ns = item.namespace === "org" ? "org" : "user";
      const spec = `@${ns}/${item.ownerName}/${item.skillName}`;
      const ver = item.pinnedVersion ? `@${item.pinnedVersion}` : "";
      console.log(`  - ${spec}${ver}`);
    }
  }

  console.log(`\nInstall all: pspm skill-list install ${specifier}`);
}

/**
 * Delete a skill list.
 */
export async function skillListDelete(specifier: string): Promise<void> {
  const parsed = parseListSpecifier(specifier);
  if (!parsed) {
    console.error(
      "Error: Invalid list specifier. Use @user/<username>/<list-name> or @org/<orgname>/<list-name>",
    );
    process.exit(1);
  }

  const baseUrl = await getBaseUrl();
  const headers = await getAuthHeaders();

  const path = `/api/skill-lists/lists/@${parsed.ownerType}/${parsed.ownerName}/${parsed.listName}`;
  const response = await fetch(`${baseUrl}${path}`, {
    method: "DELETE",
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    if (response.status === 404) {
      console.error(`Error: List "${specifier}" not found.`);
    } else {
      console.error(
        `Error: Failed to delete list (${response.status}): ${extractErrorMessage(errorText)}`,
      );
    }
    process.exit(1);
  }

  console.log(`Deleted list: ${specifier}`);
}

/**
 * Update a skill list's metadata.
 */
export async function skillListUpdate(
  specifier: string,
  options: SkillListUpdateOptions,
): Promise<void> {
  const parsed = parseListSpecifier(specifier);
  if (!parsed) {
    console.error(
      "Error: Invalid list specifier. Use @user/<username>/<list-name> or @org/<orgname>/<list-name>",
    );
    process.exit(1);
  }

  if (!options.description && !options.visibility) {
    console.error(
      "Error: Provide at least one of --description or --visibility",
    );
    process.exit(1);
  }

  if (
    options.visibility &&
    options.visibility !== "public" &&
    options.visibility !== "private"
  ) {
    console.error('Error: --visibility must be "public" or "private"');
    process.exit(1);
  }

  const baseUrl = await getBaseUrl();
  const headers = await getAuthHeaders();

  const body: Record<string, string> = {};
  if (options.description !== undefined) {
    body.description = options.description;
  }
  if (options.visibility) {
    body.visibility = options.visibility;
  }

  const path = `/api/skill-lists/lists/@${parsed.ownerType}/${parsed.ownerName}/${parsed.listName}`;
  const response = await fetch(`${baseUrl}${path}`, {
    method: "PUT",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      `Error: Failed to update list (${response.status}): ${extractErrorMessage(errorText)}`,
    );
    process.exit(1);
  }

  console.log(`Updated list: ${specifier}`);
}

/**
 * Add a skill to a list.
 */
export async function skillListAddSkill(
  specifier: string,
  skillSpecifiers: string[],
  options: SkillListAddSkillOptions,
): Promise<void> {
  const parsed = parseListSpecifier(specifier);
  if (!parsed) {
    console.error(
      "Error: Invalid list specifier. Use @user/<username>/<list-name> or @org/<orgname>/<list-name>",
    );
    process.exit(1);
  }

  const baseUrl = await getBaseUrl();
  const headers = await getAuthHeaders();

  // First, get the list to find skill IDs
  const config = await resolveConfig();
  configure({
    registryUrl: config.registryUrl,
    apiKey: getTokenForRegistry(config, config.registryUrl),
  });

  for (const skillSpec of skillSpecifiers) {
    // Resolve skill specifier to a skill ID via the explore API
    const skillId = await resolveSkillId(baseUrl, headers, skillSpec);
    if (!skillId) {
      console.error(`Error: Skill "${skillSpec}" not found.`);
      continue;
    }

    const path = `/api/skill-lists/lists/@${parsed.ownerType}/${parsed.ownerName}/${parsed.listName}/items`;
    const addBody: Record<string, string> = { skillId };
    if (options.note) {
      addBody.note = options.note;
    }

    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(addBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      if (response.status === 409) {
        console.log(`Already in list: ${skillSpec}`);
      } else {
        console.error(
          `Error: Failed to add "${skillSpec}" (${response.status}): ${extractErrorMessage(errorText)}`,
        );
      }
      continue;
    }

    console.log(`Added: ${skillSpec}`);
  }
}

/**
 * Remove a skill from a list.
 */
export async function skillListRemoveSkill(
  specifier: string,
  skillSpecifier: string,
): Promise<void> {
  const parsed = parseListSpecifier(specifier);
  if (!parsed) {
    console.error(
      "Error: Invalid list specifier. Use @user/<username>/<list-name> or @org/<orgname>/<list-name>",
    );
    process.exit(1);
  }

  const config = await resolveConfig();
  configure({
    registryUrl: config.registryUrl,
    apiKey: getTokenForRegistry(config, config.registryUrl),
  });

  // Get the list details to find the item ID
  const listResponse = await fetchSkillList(
    parsed.ownerType,
    parsed.ownerName,
    parsed.listName,
  );

  if (listResponse.status !== 200 || !listResponse.data) {
    console.error(`Error: List "${specifier}" not found.`);
    process.exit(1);
  }

  // Find the item by skill specifier
  const item = listResponse.data.items.find((i) => {
    const ns = i.namespace === "org" ? "org" : "user";
    const fullSpec = `@${ns}/${i.ownerName}/${i.skillName}`;
    return (
      fullSpec === skillSpecifier ||
      i.skillName === skillSpecifier ||
      `${i.ownerName}/${i.skillName}` === skillSpecifier
    );
  });

  if (!item) {
    console.error(
      `Error: Skill "${skillSpecifier}" not found in list "${specifier}".`,
    );
    process.exit(1);
  }

  const baseUrl = await getBaseUrl();
  const headers = await getAuthHeaders();

  const path = `/api/skill-lists/lists/@${parsed.ownerType}/${parsed.ownerName}/${parsed.listName}/items/${item.id}`;
  const response = await fetch(`${baseUrl}${path}`, {
    method: "DELETE",
    headers,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(
      `Error: Failed to remove skill (${response.status}): ${extractErrorMessage(errorText)}`,
    );
    process.exit(1);
  }

  console.log(`Removed: ${skillSpecifier} from ${specifier}`);
}

/**
 * Install all skills from a list (delegates to the install command).
 */
export async function skillListInstall(
  specifier: string,
  options: {
    agent?: string;
    yes?: boolean;
    global?: boolean;
    dir?: string;
  },
): Promise<void> {
  const { install } = await import("@/commands/install");
  await install([], {
    list: specifier,
    agent: options.agent,
    yes: options.yes,
    global: options.global,
    dir: options.dir,
  });
}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Resolve a skill specifier (e.g. @user/alice/my-skill) to a skill ID
 * by searching the explore API.
 */
async function resolveSkillId(
  baseUrl: string,
  headers: Record<string, string>,
  specifier: string,
): Promise<string | null> {
  // Parse the specifier to extract search terms
  const match = specifier.match(/^@(user|org|github)\/(.+)$/);
  let search: string;
  let namespace: string | undefined;

  if (match) {
    namespace = match[1];
    // Use the last part as the search term (skill name)
    const parts = match[2].split("/");
    search = parts[parts.length - 1];
  } else {
    search = specifier;
  }

  const params = new URLSearchParams({ search, limit: "5" });
  if (namespace) {
    params.set("namespace", namespace);
  }

  const response = await fetch(`${baseUrl}/api/skills/-/explore?${params}`, {
    headers,
  });

  if (!response.ok) return null;

  const data = (await response.json()) as {
    skills: Array<{
      id: string;
      name: string;
      username: string;
      namespace: string;
    }>;
  };

  if (!data.skills || data.skills.length === 0) return null;

  // Try to find an exact match
  if (match) {
    const parts = match[2].split("/");
    const skillName = parts[parts.length - 1];
    const ownerName = parts.length >= 2 ? parts[parts.length - 2] : undefined;

    const exact = data.skills.find(
      (s) =>
        s.name === skillName &&
        (!ownerName || s.username === ownerName) &&
        (!namespace || s.namespace === namespace),
    );
    if (exact) return exact.id;
  }

  // Fall back to first result
  return data.skills[0].id;
}
