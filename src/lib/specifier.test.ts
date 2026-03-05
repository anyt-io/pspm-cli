import { describe, expect, it } from "vitest";
import {
	formatGitHubSpecifier,
	generateSkillIdentifier,
	getGitHubSkillName,
	isGitHubShorthand,
	isGitHubSpecifier,
	isGitHubUrl,
	parseGitHubShorthand,
	parseGitHubSpecifier,
	parseGitHubUrl,
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
