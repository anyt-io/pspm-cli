import { describe, expect, it } from "vitest";
import type { PspmLockfile, PspmLockfileEntry } from "./lockfile";

describe("lockfile types", () => {
	describe("PspmLockfile", () => {
		it("should accept v4 lockfile format", () => {
			const lockfile: PspmLockfile = {
				lockfileVersion: 4,
				registryUrl: "https://pspm.dev",
				packages: {
					"@user/alice/skill": {
						version: "1.0.0",
						resolved: "https://example.com/skill.tgz",
						integrity: "sha256-abc123",
						dependencies: {
							"@user/bob/utils": "1.2.0",
						},
					},
				},
			};

			expect(lockfile.lockfileVersion).toBe(4);
			expect(lockfile.packages?.["@user/alice/skill"]?.dependencies).toEqual({
				"@user/bob/utils": "1.2.0",
			});
		});

		it("should accept lockfile without dependencies", () => {
			const lockfile: PspmLockfile = {
				lockfileVersion: 3,
				registryUrl: "https://pspm.dev",
				packages: {
					"@user/alice/skill": {
						version: "1.0.0",
						resolved: "https://example.com/skill.tgz",
						integrity: "sha256-abc123",
					},
				},
			};

			expect(lockfile.lockfileVersion).toBe(3);
			expect(
				lockfile.packages?.["@user/alice/skill"]?.dependencies,
			).toBeUndefined();
		});
	});

	describe("PspmLockfileEntry", () => {
		it("should accept entry with dependencies", () => {
			const entry: PspmLockfileEntry = {
				version: "1.0.0",
				resolved: "https://example.com/skill.tgz",
				integrity: "sha256-abc123",
				dependencies: {
					"@user/bob/utils": "1.2.0",
					"@user/carol/lib": "2.0.0",
				},
			};

			expect(entry.dependencies).toEqual({
				"@user/bob/utils": "1.2.0",
				"@user/carol/lib": "2.0.0",
			});
		});

		it("should accept entry with deprecated flag", () => {
			const entry: PspmLockfileEntry = {
				version: "1.0.0",
				resolved: "https://example.com/skill.tgz",
				integrity: "sha256-abc123",
				deprecated: "Use v2 instead",
				dependencies: {},
			};

			expect(entry.deprecated).toBe("Use v2 instead");
		});

		it("should accept entry with empty dependencies", () => {
			const entry: PspmLockfileEntry = {
				version: "1.0.0",
				resolved: "https://example.com/skill.tgz",
				integrity: "sha256-abc123",
				dependencies: {},
			};

			expect(Object.keys(entry.dependencies ?? {})).toHaveLength(0);
		});
	});

	describe("lockfile format compatibility", () => {
		it("should support v1 format with skills key", () => {
			const lockfile: PspmLockfile = {
				lockfileVersion: 1,
				registryUrl: "https://pspm.dev",
				skills: {
					"@user/alice/skill": {
						version: "1.0.0",
						resolved: "https://example.com/skill.tgz",
						integrity: "sha256-abc123",
					},
				},
			};

			expect(lockfile.lockfileVersion).toBe(1);
			expect(lockfile.skills?.["@user/alice/skill"]).toBeDefined();
		});

		it("should support v3 format with githubPackages", () => {
			const lockfile: PspmLockfile = {
				lockfileVersion: 3,
				registryUrl: "https://pspm.dev",
				packages: {},
				githubPackages: {
					"github:owner/repo": {
						version: "abc1234",
						resolved: "https://github.com/owner/repo",
						integrity: "sha256-abc123",
						gitCommit: "abc1234567890",
						gitRef: "main",
					},
				},
			};

			expect(lockfile.lockfileVersion).toBe(3);
			expect(lockfile.githubPackages?.["github:owner/repo"]).toBeDefined();
		});
	});
});
