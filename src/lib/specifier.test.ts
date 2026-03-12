import { describe, expect, it } from "vitest";
import {
  formatGitHubSpecifier,
  generateRegistryIdentifier,
  generateSkillIdentifier,
  getGitHubSkillName,
  getRegistrySkillName,
  isGitHubShorthand,
  isGitHubSpecifier,
  isGitHubUrl,
  isRegistrySpecifier,
  parseGitHubShorthand,
  parseGitHubSpecifier,
  parseGitHubUrl,
  parseRegistrySpecifier,
  parseSkillSpecifier,
} from "./specifier";

describe("specifier utilities", () => {
  describe("parseSkillSpecifier", () => {
    it("should parse basic specifier", () => {
      const result = parseSkillSpecifier("@user/alice/skill");
      expect(result).toEqual({
        username: "alice",
        name: "skill",
        versionRange: undefined,
      });
    });

    it("should parse specifier with version", () => {
      const result = parseSkillSpecifier("@user/alice/skill@1.0.0");
      expect(result).toEqual({
        username: "alice",
        name: "skill",
        versionRange: "1.0.0",
      });
    });

    it("should parse specifier with caret version", () => {
      const result = parseSkillSpecifier("@user/alice/skill@^1.0.0");
      expect(result).toEqual({
        username: "alice",
        name: "skill",
        versionRange: "^1.0.0",
      });
    });

    it("should return null for invalid specifier", () => {
      expect(parseSkillSpecifier("invalid")).toBeNull();
      expect(parseSkillSpecifier("@invalid")).toBeNull();
      expect(parseSkillSpecifier("alice/skill")).toBeNull();
    });
  });

  describe("parseRegistrySpecifier", () => {
    it("should parse @user specifier", () => {
      const result = parseRegistrySpecifier("@user/alice/skill");
      expect(result).toEqual({
        namespace: "user",
        owner: "alice",
        name: "skill",
        subname: undefined,
        versionRange: undefined,
      });
    });

    it("should parse @org specifier", () => {
      const result = parseRegistrySpecifier("@org/anyt/code-review");
      expect(result).toEqual({
        namespace: "org",
        owner: "anyt",
        name: "code-review",
        subname: undefined,
        versionRange: undefined,
      });
    });

    it("should parse @org specifier with version", () => {
      const result = parseRegistrySpecifier("@org/anyt/code-review@^2.0.0");
      expect(result).toEqual({
        namespace: "org",
        owner: "anyt",
        name: "code-review",
        subname: undefined,
        versionRange: "^2.0.0",
      });
    });

    it("should parse @github specifier with subname", () => {
      const result = parseRegistrySpecifier(
        "@github/microsoft/skills/azure-ai",
      );
      expect(result).toEqual({
        namespace: "github",
        owner: "microsoft",
        name: "skills",
        subname: "azure-ai",
        versionRange: undefined,
      });
    });

    it("should reject @github without subname", () => {
      expect(parseRegistrySpecifier("@github/microsoft/skills")).toBeNull();
    });

    it("should reject @user with subname", () => {
      expect(parseRegistrySpecifier("@user/alice/skill/extra")).toBeNull();
    });

    it("should reject invalid namespaces", () => {
      expect(parseRegistrySpecifier("@invalid/foo/bar")).toBeNull();
    });
  });

  describe("isRegistrySpecifier", () => {
    it("should detect registry specifiers", () => {
      expect(isRegistrySpecifier("@user/alice/skill")).toBe(true);
      expect(isRegistrySpecifier("@org/anyt/skill")).toBe(true);
      expect(isRegistrySpecifier("@github/owner/repo/skill")).toBe(true);
    });

    it("should reject non-registry specifiers", () => {
      expect(isRegistrySpecifier("github:owner/repo")).toBe(false);
      expect(isRegistrySpecifier("owner/repo")).toBe(false);
      expect(isRegistrySpecifier("file:./path")).toBe(false);
    });
  });

  describe("generateRegistryIdentifier", () => {
    it("should generate @user identifier", () => {
      expect(
        generateRegistryIdentifier({
          namespace: "user",
          owner: "alice",
          name: "skill",
        }),
      ).toBe("@user/alice/skill");
    });

    it("should generate @org identifier with version", () => {
      expect(
        generateRegistryIdentifier({
          namespace: "org",
          owner: "anyt",
          name: "code-review",
          versionRange: "^2.0.0",
        }),
      ).toBe("@org/anyt/code-review@^2.0.0");
    });

    it("should generate @github identifier with subname", () => {
      expect(
        generateRegistryIdentifier({
          namespace: "github",
          owner: "microsoft",
          name: "skills",
          subname: "azure-ai",
        }),
      ).toBe("@github/microsoft/skills/azure-ai");
    });
  });

  describe("getRegistrySkillName", () => {
    it("should return name for @user", () => {
      expect(
        getRegistrySkillName({
          namespace: "user",
          owner: "alice",
          name: "my-skill",
        }),
      ).toBe("my-skill");
    });

    it("should return subname for @github", () => {
      expect(
        getRegistrySkillName({
          namespace: "github",
          owner: "microsoft",
          name: "skills",
          subname: "azure-ai",
        }),
      ).toBe("azure-ai");
    });
  });

  describe("isGitHubSpecifier", () => {
    it("should return true for GitHub specifiers", () => {
      expect(isGitHubSpecifier("github:owner/repo")).toBe(true);
      expect(isGitHubSpecifier("github:owner/repo/path")).toBe(true);
      expect(isGitHubSpecifier("github:owner/repo@main")).toBe(true);
    });

    it("should return false for non-GitHub specifiers", () => {
      expect(isGitHubSpecifier("@user/alice/skill")).toBe(false);
      expect(isGitHubSpecifier("npm:package")).toBe(false);
    });
  });

  describe("parseGitHubSpecifier", () => {
    it("should parse basic GitHub specifier", () => {
      const result = parseGitHubSpecifier("github:owner/repo");
      expect(result).toEqual({
        owner: "owner",
        repo: "repo",
        path: undefined,
        ref: undefined,
      });
    });

    it("should parse GitHub specifier with path", () => {
      const result = parseGitHubSpecifier("github:owner/repo/path/to/skill");
      expect(result).toEqual({
        owner: "owner",
        repo: "repo",
        path: "path/to/skill",
        ref: undefined,
      });
    });

    it("should parse GitHub specifier with ref", () => {
      const result = parseGitHubSpecifier("github:owner/repo@main");
      expect(result).toEqual({
        owner: "owner",
        repo: "repo",
        path: undefined,
        ref: "main",
      });
    });

    it("should parse GitHub specifier with path and ref", () => {
      const result = parseGitHubSpecifier("github:owner/repo/path@v1.0.0");
      expect(result).toEqual({
        owner: "owner",
        repo: "repo",
        path: "path",
        ref: "v1.0.0",
      });
    });

    it("should return null for invalid specifier", () => {
      expect(parseGitHubSpecifier("invalid")).toBeNull();
      expect(parseGitHubSpecifier("@user/alice/skill")).toBeNull();
    });
  });

  describe("formatGitHubSpecifier", () => {
    it("should format basic specifier", () => {
      expect(formatGitHubSpecifier({ owner: "owner", repo: "repo" })).toBe(
        "github:owner/repo",
      );
    });

    it("should format specifier with path", () => {
      expect(
        formatGitHubSpecifier({ owner: "owner", repo: "repo", path: "skills" }),
      ).toBe("github:owner/repo/skills");
    });

    it("should format specifier with ref", () => {
      expect(
        formatGitHubSpecifier({ owner: "owner", repo: "repo", ref: "main" }),
      ).toBe("github:owner/repo@main");
    });
  });

  describe("getGitHubSkillName", () => {
    it("should return repo name for root skill", () => {
      expect(getGitHubSkillName({ owner: "owner", repo: "my-skill" })).toBe(
        "my-skill",
      );
    });

    it("should return last path segment for nested skill", () => {
      expect(
        getGitHubSkillName({
          owner: "owner",
          repo: "repo",
          path: "skills/my-skill",
        }),
      ).toBe("my-skill");
    });
  });

  describe("generateSkillIdentifier", () => {
    it("should generate identifier for registry skill", () => {
      expect(generateSkillIdentifier("alice", "my-skill")).toBe(
        "@user/alice/my-skill",
      );
    });
  });

  describe("isGitHubUrl", () => {
    it("should detect GitHub URLs", () => {
      expect(isGitHubUrl("https://github.com/owner/repo")).toBe(true);
      expect(isGitHubUrl("https://github.com/owner/repo.git")).toBe(true);
      expect(
        isGitHubUrl(
          "https://github.com/owner/repo/tree/main/skills/web-design",
        ),
      ).toBe(true);
      expect(isGitHubUrl("http://github.com/owner/repo")).toBe(true);
    });

    it("should reject non-GitHub URLs", () => {
      expect(isGitHubUrl("https://gitlab.com/owner/repo")).toBe(false);
      expect(isGitHubUrl("github:owner/repo")).toBe(false);
      expect(isGitHubUrl("owner/repo")).toBe(false);
      expect(isGitHubUrl("https://example.com")).toBe(false);
    });
  });

  describe("parseGitHubUrl", () => {
    it("should parse basic GitHub URL", () => {
      expect(parseGitHubUrl("https://github.com/owner/repo")).toEqual({
        owner: "owner",
        repo: "repo",
      });
    });

    it("should parse GitHub URL with .git suffix", () => {
      expect(parseGitHubUrl("https://github.com/owner/repo.git")).toEqual({
        owner: "owner",
        repo: "repo",
      });
    });

    it("should parse GitHub URL with trailing slash", () => {
      expect(parseGitHubUrl("https://github.com/owner/repo/")).toEqual({
        owner: "owner",
        repo: "repo",
      });
    });

    it("should parse GitHub tree URL with branch", () => {
      expect(parseGitHubUrl("https://github.com/owner/repo/tree/main")).toEqual(
        {
          owner: "owner",
          repo: "repo",
          ref: "main",
          path: undefined,
        },
      );
    });

    it("should parse GitHub tree URL with branch and path", () => {
      expect(
        parseGitHubUrl(
          "https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design",
        ),
      ).toEqual({
        owner: "vercel-labs",
        repo: "agent-skills",
        ref: "main",
        path: "skills/web-design",
      });
    });

    it("should parse GitHub tree URL with tag ref", () => {
      expect(
        parseGitHubUrl(
          "https://github.com/owner/repo/tree/v1.0.0/path/to/skill",
        ),
      ).toEqual({
        owner: "owner",
        repo: "repo",
        ref: "v1.0.0",
        path: "path/to/skill",
      });
    });

    it("should return null for non-GitHub URL", () => {
      expect(parseGitHubUrl("https://gitlab.com/owner/repo")).toBeNull();
      expect(parseGitHubUrl("not a url")).toBeNull();
    });
  });

  describe("isGitHubShorthand", () => {
    it("should detect GitHub shorthand", () => {
      expect(isGitHubShorthand("owner/repo")).toBe(true);
      expect(isGitHubShorthand("vercel-labs/agent-skills")).toBe(true);
      expect(isGitHubShorthand("owner/repo/path/to/skill")).toBe(true);
    });

    it("should reject non-shorthand inputs", () => {
      expect(isGitHubShorthand("github:owner/repo")).toBe(false);
      expect(isGitHubShorthand("@user/alice/skill")).toBe(false);
      expect(isGitHubShorthand("./local/path")).toBe(false);
      expect(isGitHubShorthand("../local/path")).toBe(false);
      expect(isGitHubShorthand("/absolute/path")).toBe(false);
      expect(isGitHubShorthand("https://github.com/owner/repo")).toBe(false);
      expect(isGitHubShorthand("file:./path")).toBe(false);
    });
  });

  describe("parseGitHubShorthand", () => {
    it("should parse basic shorthand", () => {
      expect(parseGitHubShorthand("owner/repo")).toEqual({
        owner: "owner",
        repo: "repo",
        path: undefined,
      });
    });

    it("should parse shorthand with path", () => {
      expect(
        parseGitHubShorthand("vercel-labs/agent-skills/skills/web-design"),
      ).toEqual({
        owner: "vercel-labs",
        repo: "agent-skills",
        path: "skills/web-design",
      });
    });

    it("should handle repo names with dots", () => {
      expect(parseGitHubShorthand("owner/repo.name")).toEqual({
        owner: "owner",
        repo: "repo.name",
        path: undefined,
      });
    });

    it("should return null for non-shorthand inputs", () => {
      expect(parseGitHubShorthand("github:owner/repo")).toBeNull();
      expect(parseGitHubShorthand("@user/alice/skill")).toBeNull();
      expect(parseGitHubShorthand("./local/path")).toBeNull();
    });
  });
});
