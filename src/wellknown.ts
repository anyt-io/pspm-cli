/**
 * Well-Known Skills Discovery (RFC 8615)
 *
 * Fetches skills from any HTTPS domain that serves a
 * /.well-known/skills/index.json endpoint.
 */

import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { calculateIntegrity } from "./lib/index";

// =============================================================================
// Types
// =============================================================================

/**
 * A single skill entry in the well-known index.json
 */
export interface WellKnownSkillEntry {
  /** Skill identifier (directory name). Lowercase alphanumeric + hyphens, 1-64 chars. */
  name: string;
  /** Brief description */
  description: string;
  /** List of files in the skill directory. Must include SKILL.md. */
  files: string[];
}

/**
 * The /.well-known/skills/index.json structure
 */
export interface WellKnownIndex {
  skills: WellKnownSkillEntry[];
}

/**
 * A fetched well-known skill with all its file contents
 */
export interface WellKnownSkill {
  /** Skill name from index */
  name: string;
  /** Description from index */
  description: string;
  /** SKILL.md content */
  content: string;
  /** All files keyed by relative path */
  files: Map<string, string>;
  /** Source URL for this skill */
  sourceUrl: string;
  /** The index entry */
  indexEntry: WellKnownSkillEntry;
}

/**
 * Result of extracting a well-known skill to disk
 */
export interface WellKnownDownloadResult {
  /** All skills fetched from the endpoint */
  skills: WellKnownSkill[];
  /** The resolved base URL where the index was found */
  resolvedBaseUrl: string;
  /** Hostname for identification */
  hostname: string;
}

// =============================================================================
// Constants
// =============================================================================

const WELL_KNOWN_PATH = ".well-known/skills";
const INDEX_FILE = "index.json";
const SKILL_NAME_PATTERN = /^[a-z0-9]([a-z0-9-]{0,62}[a-z0-9])?$/;

/** Hosts that should NOT be treated as well-known (they have dedicated providers) */
const EXCLUDED_HOSTS = [
  "github.com",
  "gitlab.com",
  "raw.githubusercontent.com",
];

// =============================================================================
// Detection
// =============================================================================

/**
 * Check if a string looks like a well-known skills URL.
 * Must be HTTP(S) and not a known git host.
 */
export function isWellKnownSpecifier(input: string): boolean {
  if (!input.startsWith("http://") && !input.startsWith("https://")) {
    return false;
  }

  try {
    const parsed = new URL(input);
    if (EXCLUDED_HOSTS.includes(parsed.hostname)) {
      return false;
    }
    if (input.endsWith(".git")) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Extract hostname from a well-known URL (strips www. prefix).
 */
export function getWellKnownHostname(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate a single skill entry from the index.
 */
function isValidSkillEntry(entry: unknown): entry is WellKnownSkillEntry {
  if (!entry || typeof entry !== "object") return false;

  const e = entry as Record<string, unknown>;

  // Required string fields
  if (typeof e.name !== "string" || e.name.length === 0) return false;
  if (typeof e.description !== "string" || e.description.length === 0)
    return false;

  // Name must match pattern
  if (!SKILL_NAME_PATTERN.test(e.name)) return false;

  // Files must be a non-empty array of strings
  if (!Array.isArray(e.files) || e.files.length === 0) return false;

  let hasSkillMd = false;
  for (const file of e.files) {
    if (typeof file !== "string") return false;
    // No absolute paths
    if (file.startsWith("/") || file.startsWith("\\")) return false;
    // No path traversal
    if (file.includes("..")) return false;
    // Check for SKILL.md
    if (file.toLowerCase() === "skill.md") hasSkillMd = true;
  }

  if (!hasSkillMd) return false;

  return true;
}

/**
 * Validate a well-known index structure.
 */
function isValidIndex(data: unknown): data is WellKnownIndex {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.skills)) return false;
  return d.skills.every(isValidSkillEntry);
}

// =============================================================================
// Fetching
// =============================================================================

/**
 * Fetch the well-known index from a URL.
 *
 * Tries path-relative first, then root:
 * 1. {baseUrl}/.well-known/skills/index.json
 * 2. {protocol}://{host}/.well-known/skills/index.json
 */
export async function fetchWellKnownIndex(
  baseUrl: string,
): Promise<{ index: WellKnownIndex; resolvedBaseUrl: string } | null> {
  const parsed = new URL(baseUrl);

  // Try 1: path-relative
  const pathRelativeUrl = `${baseUrl.replace(/\/$/, "")}/${WELL_KNOWN_PATH}/${INDEX_FILE}`;
  const pathRelativeBase = `${baseUrl.replace(/\/$/, "")}/${WELL_KNOWN_PATH}`;

  try {
    const response = await fetch(pathRelativeUrl, {
      signal: AbortSignal.timeout(10000),
    });
    if (response.ok) {
      const data = await response.json();
      if (isValidIndex(data)) {
        return { index: data, resolvedBaseUrl: pathRelativeBase };
      }
    }
  } catch {
    // Try next
  }

  // Try 2: root well-known (skip if URL has no path)
  const rootUrl = `${parsed.protocol}//${parsed.host}/${WELL_KNOWN_PATH}/${INDEX_FILE}`;
  const rootBase = `${parsed.protocol}//${parsed.host}/${WELL_KNOWN_PATH}`;

  // Avoid duplicate request if path-relative already tried the root
  if (rootUrl !== pathRelativeUrl) {
    try {
      const response = await fetch(rootUrl, {
        signal: AbortSignal.timeout(10000),
      });
      if (response.ok) {
        const data = await response.json();
        if (isValidIndex(data)) {
          return { index: data, resolvedBaseUrl: rootBase };
        }
      }
    } catch {
      // No index found
    }
  }

  return null;
}

/**
 * Fetch a single skill's files from a well-known endpoint.
 */
async function fetchSkillFiles(
  baseUrl: string,
  entry: WellKnownSkillEntry,
): Promise<WellKnownSkill | null> {
  const skillBaseUrl = `${baseUrl}/${entry.name}`;
  const files = new Map<string, string>();
  let skillMdContent = "";

  // Fetch all files in parallel
  const results = await Promise.allSettled(
    entry.files.map(async (filePath) => {
      const fileUrl = `${skillBaseUrl}/${filePath}`;
      const response = await fetch(fileUrl, {
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch ${fileUrl}: ${response.status}`);
      }
      const content = await response.text();
      return { filePath, content };
    }),
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      files.set(result.value.filePath, result.value.content);
      if (result.value.filePath.toLowerCase() === "skill.md") {
        skillMdContent = result.value.content;
      }
    }
    // Skip failed files (non-fatal except SKILL.md)
  }

  // SKILL.md is required
  if (!skillMdContent) {
    return null;
  }

  return {
    name: entry.name,
    description: entry.description,
    content: skillMdContent,
    files,
    sourceUrl: `${skillBaseUrl}/SKILL.md`,
    indexEntry: entry,
  };
}

/**
 * Fetch all skills from a well-known endpoint.
 */
export async function fetchWellKnownSkills(
  url: string,
): Promise<WellKnownDownloadResult | null> {
  const result = await fetchWellKnownIndex(url);
  if (!result) return null;

  const { index, resolvedBaseUrl } = result;
  const hostname = getWellKnownHostname(url);

  // Fetch all skills in parallel
  const skillResults = await Promise.allSettled(
    index.skills.map((entry) => fetchSkillFiles(resolvedBaseUrl, entry)),
  );

  const skills: WellKnownSkill[] = [];
  for (const r of skillResults) {
    if (r.status === "fulfilled" && r.value) {
      skills.push(r.value);
    }
  }

  if (skills.length === 0) return null;

  return { skills, resolvedBaseUrl, hostname };
}

// =============================================================================
// Extraction
// =============================================================================

/**
 * Extract a well-known skill to the .pspm/skills/_wellknown/ directory.
 *
 * @param skill - The fetched skill
 * @param hostname - Source hostname (for directory namespacing)
 * @param skillsDir - Base skills directory (.pspm/skills)
 * @returns Path to extracted skill (relative to project root)
 */
export async function extractWellKnownSkill(
  skill: WellKnownSkill,
  hostname: string,
  skillsDir: string,
): Promise<string> {
  const destPath = join(skillsDir, "_wellknown", hostname, skill.name);

  // Clean and recreate
  await rm(destPath, { recursive: true, force: true });
  await mkdir(destPath, { recursive: true });

  // Write all files
  for (const [filePath, content] of skill.files) {
    // Security: validate path doesn't escape
    const fullPath = join(destPath, filePath);
    if (!fullPath.startsWith(destPath)) {
      continue; // Skip files that would escape the directory
    }

    // Create parent directories
    const { dirname } = await import("node:path");
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, content, "utf-8");
  }

  return `.pspm/skills/_wellknown/${hostname}/${skill.name}`;
}

/**
 * Calculate integrity hash for a well-known skill (hash of all file contents).
 */
export function calculateWellKnownIntegrity(skill: WellKnownSkill): string {
  // Sort files by path for deterministic hashing
  const sortedEntries = [...skill.files.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const combined = sortedEntries
    .map(([path, content]) => `${path}:${content}`)
    .join("\n");
  return calculateIntegrity(Buffer.from(combined, "utf-8"));
}

/**
 * Get display name for a well-known skill.
 */
export function getWellKnownDisplayName(
  hostname: string,
  skillName: string,
): string {
  return `${hostname}/${skillName} (well-known)`;
}
