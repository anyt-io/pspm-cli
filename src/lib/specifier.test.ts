import { describe, expect, it } from "vitest";
import {
	formatGitHubSpecifier,
	generateSkillIdentifier,
	getGitHubSkillName,
	isGitHubSpecifier,
	parseGitHubSpecifier,
	parseSkillSpecifier,
} from "./specifier.js";

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
});
