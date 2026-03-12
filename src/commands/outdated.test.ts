import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  GitHubLockfileEntry,
  PspmLockfile,
  PspmLockfileEntry,
} from "@/lib/index";

// Mock config module
vi.mock("@/config", () => ({
  resolveConfig: vi.fn().mockResolvedValue({
    registryUrl: "https://registry.example.com/api/skills",
    apiKey: "sk_test_123",
    scopedRegistries: {},
    registryTokens: {},
  }),
  getTokenForRegistry: vi.fn().mockReturnValue("sk_test_123"),
}));

// Mock lockfile module
const mockReadLockfile = vi.fn();
vi.mock("@/lockfile", () => ({
  readLockfile: (...args: unknown[]) => mockReadLockfile(...args),
}));

// Mock manifest module
const mockReadManifest = vi.fn();
vi.mock("@/manifest", () => ({
  readManifest: (...args: unknown[]) => mockReadManifest(...args),
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { outdated } from "./outdated";

function makeLockfile(overrides?: Partial<PspmLockfile>): PspmLockfile {
  return {
    lockfileVersion: 4,
    registryUrl: "https://registry.example.com/api/skills",
    packages: {},
    githubPackages: {},
    ...overrides,
  };
}

function makeRegistryEntry(
  overrides?: Partial<PspmLockfileEntry>,
): PspmLockfileEntry {
  return {
    version: "1.0.0",
    resolved:
      "https://registry.example.com/api/skills/@user/alice/my-skill/versions/1.0.0/download",
    integrity: "sha256-abc123",
    ...overrides,
  };
}

function makeGitHubEntry(
  overrides?: Partial<GitHubLockfileEntry>,
): GitHubLockfileEntry {
  return {
    version: "1.0.0",
    resolved: "https://github.com/owner/repo",
    integrity: "sha256-abc123",
    gitCommit: "abc1234567890abcdef1234567890abcdef123456",
    gitRef: "main",
    ...overrides,
  };
}

function mockRegistryVersionsResponse(
  versions: string[],
  deprecated?: Record<string, string>,
) {
  return versions.map((version, i) => ({
    id: `id-${i}`,
    skillId: "skill-id",
    version,
    r2Key: `skills/user/skill/${version}.tgz`,
    checksum: `sha256-${version}`,
    manifest: { name: "skill", version },
    publishedAt: new Date().toISOString(),
    deprecatedAt: deprecated?.[version] ? new Date().toISOString() : null,
    deprecationMessage: deprecated?.[version] ?? null,
  }));
}

describe("outdated command", () => {
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    mockFetch.mockReset();
    mockReadLockfile.mockReset();
    mockReadManifest.mockReset();
    mockReadManifest.mockResolvedValue(null);
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    process.exitCode = undefined;
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("should show 'No skills installed' when no lockfile exists", async () => {
    mockReadLockfile.mockResolvedValue(null);

    await outdated([], {});

    expect(consoleLogSpy).toHaveBeenCalledWith("No skills installed.");
  });

  it("should show 'No skills installed' when lockfile is empty", async () => {
    mockReadLockfile.mockResolvedValue(makeLockfile());

    await outdated([], {});

    expect(consoleLogSpy).toHaveBeenCalledWith("No skills installed.");
  });

  it("should show 'All skills are up to date' when no outdated packages", async () => {
    mockReadLockfile.mockResolvedValue(
      makeLockfile({
        packages: {
          "@user/alice/my-skill": makeRegistryEntry({ version: "2.0.0" }),
        },
      }),
    );

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve(mockRegistryVersionsResponse(["1.0.0", "2.0.0"])),
    });

    await outdated([], {});

    expect(consoleLogSpy).toHaveBeenCalledWith("All skills are up to date.");
  });

  it("should display table for outdated registry packages", async () => {
    mockReadLockfile.mockResolvedValue(
      makeLockfile({
        packages: {
          "@user/alice/my-skill": makeRegistryEntry({ version: "1.0.0" }),
        },
      }),
    );

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve(
          mockRegistryVersionsResponse(["1.0.0", "1.5.0", "2.0.0"]),
        ),
    });

    await outdated([], {});

    // Check that the table was printed with relevant data
    const output = consoleLogSpy.mock.calls
      .map((c: string[]) => c[0])
      .join("\n");
    expect(output).toContain("@user/alice/my-skill");
    expect(output).toContain("1.0.0");
    expect(output).toContain("2.0.0");
    expect(output).toContain("registry");
    expect(process.exitCode).toBe(1);
  });

  it("should display short commit hashes for outdated GitHub packages", async () => {
    mockReadLockfile.mockResolvedValue(
      makeLockfile({
        githubPackages: {
          "github:owner/repo/path": makeGitHubEntry({
            gitCommit: "abc1234567890abcdef1234567890abcdef123456",
            gitRef: "main",
          }),
        },
      }),
    );

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          sha: "def4567890abcdef1234567890abcdef12345678",
        }),
    });

    await outdated([], {});

    const output = consoleLogSpy.mock.calls
      .map((c: string[]) => c[0])
      .join("\n");
    expect(output).toContain("github:owner/repo/path");
    expect(output).toContain("abc1234");
    expect(output).toContain("def4567");
    expect(output).toContain("github");
    expect(process.exitCode).toBe(1);
  });

  it("should output JSON when --json flag is set", async () => {
    mockReadLockfile.mockResolvedValue(
      makeLockfile({
        packages: {
          "@user/alice/my-skill": makeRegistryEntry({ version: "1.0.0" }),
        },
      }),
    );

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve(mockRegistryVersionsResponse(["1.0.0", "2.0.0"])),
    });

    await outdated([], { json: true });

    // Find the JSON output call (not the "Checking..." message)
    const jsonCall = consoleLogSpy.mock.calls.find((c: string[]) => {
      try {
        JSON.parse(c[0]);
        return true;
      } catch {
        return false;
      }
    });

    expect(jsonCall).toBeDefined();
    const parsed = JSON.parse(jsonCall?.[0] as string);
    expect(parsed).toBeInstanceOf(Array);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].name).toBe("@user/alice/my-skill");
    expect(parsed[0].isOutdated).toBe(true);
  });

  it("should include up-to-date packages when --all flag is set", async () => {
    mockReadLockfile.mockResolvedValue(
      makeLockfile({
        packages: {
          "@user/alice/my-skill": makeRegistryEntry({ version: "2.0.0" }),
        },
      }),
    );

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve(mockRegistryVersionsResponse(["1.0.0", "2.0.0"])),
    });

    await outdated([], { all: true });

    const output = consoleLogSpy.mock.calls
      .map((c: string[]) => c[0])
      .join("\n");
    expect(output).toContain("@user/alice/my-skill");
    expect(output).toContain("2.0.0");
  });

  it("should only check specified packages when filter is provided", async () => {
    mockReadLockfile.mockResolvedValue(
      makeLockfile({
        packages: {
          "@user/alice/skill-a": makeRegistryEntry({ version: "1.0.0" }),
          "@user/alice/skill-b": makeRegistryEntry({ version: "1.0.0" }),
        },
      }),
    );

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve(mockRegistryVersionsResponse(["1.0.0", "2.0.0"])),
    });

    await outdated(["@user/alice/skill-a"], {});

    // Only one fetch call should be made (for skill-a)
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const output = consoleLogSpy.mock.calls
      .map((c: string[]) => c[0])
      .join("\n");
    expect(output).toContain("@user/alice/skill-a");
    expect(output).not.toContain("@user/alice/skill-b");
  });

  it("should show deprecation warnings", async () => {
    mockReadLockfile.mockResolvedValue(
      makeLockfile({
        packages: {
          "@user/alice/my-skill": makeRegistryEntry({ version: "1.0.0" }),
        },
      }),
    );

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve(
          mockRegistryVersionsResponse(["1.0.0", "2.0.0"], {
            "1.0.0": "This version has a security vulnerability",
          }),
        ),
    });

    await outdated([], {});

    const output = consoleLogSpy.mock.calls
      .map((c: string[]) => c[0])
      .join("\n");
    expect(output).toContain("This version has a security vulnerability");
  });

  it("should not set exit code when all packages are up to date with --all", async () => {
    mockReadLockfile.mockResolvedValue(
      makeLockfile({
        packages: {
          "@user/alice/my-skill": makeRegistryEntry({ version: "2.0.0" }),
        },
      }),
    );

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve(mockRegistryVersionsResponse(["1.0.0", "2.0.0"])),
    });

    await outdated([], { all: true });

    const output = consoleLogSpy.mock.calls
      .map((c: string[]) => c[0])
      .join("\n");
    expect(output).toContain("@user/alice/my-skill");
    expect(process.exitCode).toBeUndefined();
  });

  it("should set exit code 1 when outdated packages exist with --all", async () => {
    mockReadLockfile.mockResolvedValue(
      makeLockfile({
        packages: {
          "@user/alice/skill-a": makeRegistryEntry({ version: "1.0.0" }),
          "@user/alice/skill-b": makeRegistryEntry({ version: "2.0.0" }),
        },
      }),
    );

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("skill-a")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve(mockRegistryVersionsResponse(["1.0.0", "2.0.0"])),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve(mockRegistryVersionsResponse(["1.0.0", "2.0.0"])),
      });
    });

    await outdated([], { all: true });

    expect(process.exitCode).toBe(1);
  });

  it("should print table with correct header and separator", async () => {
    mockReadLockfile.mockResolvedValue(
      makeLockfile({
        packages: {
          "@user/alice/my-skill": makeRegistryEntry({ version: "1.0.0" }),
        },
      }),
    );

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve(mockRegistryVersionsResponse(["1.0.0", "2.0.0"])),
    });

    await outdated([], {});

    const calls = consoleLogSpy.mock.calls.map((c: string[]) => c[0]);
    // After "Checking..." message, next should be header
    const headerIdx = calls.findIndex(
      (line: string) =>
        line.includes("Package") &&
        line.includes("Current") &&
        line.includes("Wanted") &&
        line.includes("Latest") &&
        line.includes("Type"),
    );
    expect(headerIdx).toBeGreaterThan(-1);

    // Next line should be separator
    const separator = calls[headerIdx + 1];
    expect(separator).toMatch(/─+/);

    // Next line should be the data row
    const dataRow = calls[headerIdx + 2];
    expect(dataRow).toContain("@user/alice/my-skill");
  });

  it("should display mixed registry and github packages in table", async () => {
    mockReadLockfile.mockResolvedValue(
      makeLockfile({
        packages: {
          "@user/alice/my-skill": makeRegistryEntry({ version: "1.0.0" }),
        },
        githubPackages: {
          "github:owner/repo": makeGitHubEntry({
            gitCommit: "abc1234567890abcdef1234567890abcdef123456",
            gitRef: "main",
          }),
        },
      }),
    );

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("registry.example.com")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve(mockRegistryVersionsResponse(["1.0.0", "2.0.0"])),
        });
      }
      if (url.includes("api.github.com")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              sha: "def4567890abcdef1234567890abcdef12345678",
            }),
        });
      }
      return Promise.reject(new Error("Unknown URL"));
    });

    await outdated([], {});

    const output = consoleLogSpy.mock.calls
      .map((c: string[]) => c[0])
      .join("\n");
    expect(output).toContain("@user/alice/my-skill");
    expect(output).toContain("registry");
    expect(output).toContain("github:owner/repo");
    expect(output).toContain("github");
    expect(process.exitCode).toBe(1);
  });

  it("should handle registry fetch errors gracefully and show '—' for unknown versions", async () => {
    mockReadLockfile.mockResolvedValue(
      makeLockfile({
        packages: {
          "@user/alice/my-skill": makeRegistryEntry({ version: "1.0.0" }),
        },
      }),
    );

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal server error"),
    });

    // With includeUpToDate (--all) so the error result is still returned
    await outdated([], { all: true, json: true });

    const jsonCall = consoleLogSpy.mock.calls.find((c: string[]) => {
      try {
        JSON.parse(c[0]);
        return true;
      } catch {
        return false;
      }
    });

    expect(jsonCall).toBeDefined();
    const parsed = JSON.parse(jsonCall?.[0] as string);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].wanted).toBeNull();
    expect(parsed[0].latest).toBeNull();
    expect(parsed[0].isOutdated).toBe(false);
  });

  it("should handle lockfile with only githubPackages", async () => {
    mockReadLockfile.mockResolvedValue(
      makeLockfile({
        packages: {},
        githubPackages: {
          "github:owner/repo": makeGitHubEntry(),
        },
      }),
    );

    const commitSha = "abc1234567890abcdef1234567890abcdef123456";
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ sha: commitSha }),
    });

    await outdated([], {});

    // Not outdated because commit matches
    expect(consoleLogSpy).toHaveBeenCalledWith("All skills are up to date.");
  });

  it("should handle legacy lockfile with 'skills' key", async () => {
    const legacyLockfile: PspmLockfile = {
      lockfileVersion: 1,
      registryUrl: "https://registry.example.com/api/skills",
      skills: {
        "@user/alice/my-skill": makeRegistryEntry({ version: "1.0.0" }),
      },
    };

    mockReadLockfile.mockResolvedValue(legacyLockfile);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve(mockRegistryVersionsResponse(["1.0.0", "2.0.0"])),
    });

    await outdated([], {});

    const output = consoleLogSpy.mock.calls
      .map((c: string[]) => c[0])
      .join("\n");
    expect(output).toContain("@user/alice/my-skill");
    expect(output).toContain("2.0.0");
    expect(process.exitCode).toBe(1);
  });

  it("should pass GITHUB_TOKEN from environment", async () => {
    const originalToken = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = "ghp_test_token_123";

    try {
      mockReadLockfile.mockResolvedValue(
        makeLockfile({
          githubPackages: {
            "github:owner/repo": makeGitHubEntry(),
          },
        }),
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            sha: "abc1234567890abcdef1234567890abcdef123456",
          }),
      });

      await outdated([], { all: true });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [, options] = mockFetch.mock.calls[0] as [
        string,
        RequestInit & { headers: Record<string, string> },
      ];
      expect(options.headers.Authorization).toBe("Bearer ghp_test_token_123");
    } finally {
      if (originalToken === undefined) {
        delete process.env.GITHUB_TOKEN;
      } else {
        process.env.GITHUB_TOKEN = originalToken;
      }
    }
  });

  it("should print error and exit on unexpected error", async () => {
    mockReadLockfile.mockRejectedValue(new Error("Disk read failed"));

    const mockExit = vi
      .spyOn(process, "exit")
      .mockImplementation((() => {}) as never);

    await outdated([], {});

    expect(consoleErrorSpy).toHaveBeenCalledWith("Error: Disk read failed");
    expect(mockExit).toHaveBeenCalledWith(1);
    mockExit.mockRestore();
  });

  it("should not print deprecation section when no packages are deprecated", async () => {
    mockReadLockfile.mockResolvedValue(
      makeLockfile({
        packages: {
          "@user/alice/my-skill": makeRegistryEntry({ version: "1.0.0" }),
        },
      }),
    );

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve(mockRegistryVersionsResponse(["1.0.0", "2.0.0"])),
    });

    await outdated([], {});

    const output = consoleLogSpy.mock.calls
      .map((c: string[]) => c[0])
      .join("\n");
    expect(output).not.toContain("⚠");
  });

  it("should show multiple deprecation warnings", async () => {
    mockReadLockfile.mockResolvedValue(
      makeLockfile({
        packages: {
          "@user/alice/skill-a": makeRegistryEntry({ version: "1.0.0" }),
          "@user/alice/skill-b": makeRegistryEntry({ version: "1.0.0" }),
        },
      }),
    );

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("skill-a")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve(
              mockRegistryVersionsResponse(["1.0.0", "2.0.0"], {
                "1.0.0": "Use skill-c instead",
              }),
            ),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve(
            mockRegistryVersionsResponse(["1.0.0", "2.0.0"], {
              "1.0.0": "Critical bug in this version",
            }),
          ),
      });
    });

    await outdated([], {});

    const output = consoleLogSpy.mock.calls
      .map((c: string[]) => c[0])
      .join("\n");
    expect(output).toContain("Use skill-c instead");
    expect(output).toContain("Critical bug in this version");
  });

  it("should handle --json with --all flag combined", async () => {
    mockReadLockfile.mockResolvedValue(
      makeLockfile({
        packages: {
          "@user/alice/skill-a": makeRegistryEntry({ version: "1.0.0" }),
          "@user/alice/skill-b": makeRegistryEntry({ version: "2.0.0" }),
        },
      }),
    );

    mockFetch.mockImplementation((url: string) => {
      if (url.includes("skill-a")) {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve(mockRegistryVersionsResponse(["1.0.0", "2.0.0"])),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve(mockRegistryVersionsResponse(["1.0.0", "2.0.0"])),
      });
    });

    await outdated([], { json: true, all: true });

    const jsonCall = consoleLogSpy.mock.calls.find((c: string[]) => {
      try {
        JSON.parse(c[0]);
        return true;
      } catch {
        return false;
      }
    });

    expect(jsonCall).toBeDefined();
    const parsed = JSON.parse(jsonCall?.[0] as string);
    expect(parsed).toHaveLength(2);

    const outdatedPkg = parsed.find(
      (p: { name: string }) => p.name === "@user/alice/skill-a",
    );
    const upToDatePkg = parsed.find(
      (p: { name: string }) => p.name === "@user/alice/skill-b",
    );
    expect(outdatedPkg.isOutdated).toBe(true);
    expect(upToDatePkg.isOutdated).toBe(false);
  });

  it("should use manifest version ranges when available", async () => {
    mockReadLockfile.mockResolvedValue(
      makeLockfile({
        packages: {
          "@user/alice/my-skill": makeRegistryEntry({ version: "1.0.0" }),
        },
      }),
    );

    mockReadManifest.mockResolvedValue({
      name: "test-project",
      version: "1.0.0",
      dependencies: {
        "@user/alice/my-skill": "^1.0.0",
      },
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve(
          mockRegistryVersionsResponse(["1.0.0", "1.5.0", "2.0.0"]),
        ),
    });

    await outdated([], { json: true });

    const jsonCall = consoleLogSpy.mock.calls.find((c: string[]) => {
      try {
        JSON.parse(c[0]);
        return true;
      } catch {
        return false;
      }
    });

    const parsed = JSON.parse(jsonCall?.[0] as string);
    expect(parsed[0].wanted).toBe("1.5.0");
    expect(parsed[0].latest).toBe("2.0.0");
    expect(parsed[0].versionRange).toBe("^1.0.0");
  });
});
