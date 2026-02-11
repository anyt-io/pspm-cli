import { describe, expect, it } from "vitest";
import {
	compareVersions,
	findHighestSatisfying,
	getLatestVersion,
	isNewerVersion,
	normalizeVersionRange,
	rangesIntersect,
	resolveVersion,
	versionSatisfies,
} from "./version";

describe("version utilities", () => {
	describe("resolveVersion", () => {
		const versions = ["1.0.0", "1.1.0", "1.2.0", "2.0.0", "2.1.0"];

		it("should return latest version for empty range", () => {
			expect(resolveVersion("", versions)).toBe("2.1.0");
		});

		it("should return latest version for 'latest'", () => {
			expect(resolveVersion("latest", versions)).toBe("2.1.0");
		});

		it("should return latest version for '*'", () => {
			expect(resolveVersion("*", versions)).toBe("2.1.0");
		});

		it("should resolve caret range", () => {
			expect(resolveVersion("^1.0.0", versions)).toBe("1.2.0");
		});

		it("should resolve tilde range", () => {
			expect(resolveVersion("~1.1.0", versions)).toBe("1.1.0");
		});

		it("should resolve exact version", () => {
			expect(resolveVersion("1.1.0", versions)).toBe("1.1.0");
		});

		it("should return null for unsatisfiable range", () => {
			expect(resolveVersion("^3.0.0", versions)).toBeNull();
		});
	});

	describe("versionSatisfies", () => {
		it("should return true for satisfied range", () => {
			expect(versionSatisfies("1.2.0", "^1.0.0")).toBe(true);
		});

		it("should return false for unsatisfied range", () => {
			expect(versionSatisfies("2.0.0", "^1.0.0")).toBe(false);
		});

		it("should handle exact version", () => {
			expect(versionSatisfies("1.0.0", "1.0.0")).toBe(true);
			expect(versionSatisfies("1.0.1", "1.0.0")).toBe(false);
		});
	});

	describe("normalizeVersionRange", () => {
		it("should return '*' for undefined", () => {
			expect(normalizeVersionRange(undefined)).toBe("*");
		});

		it("should return '*' for 'latest'", () => {
			expect(normalizeVersionRange("latest")).toBe("*");
		});

		it("should return range as-is otherwise", () => {
			expect(normalizeVersionRange("^1.0.0")).toBe("^1.0.0");
		});
	});

	describe("compareVersions", () => {
		it("should return -1 when a < b", () => {
			expect(compareVersions("1.0.0", "2.0.0")).toBe(-1);
		});

		it("should return 0 when a === b", () => {
			expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
		});

		it("should return 1 when a > b", () => {
			expect(compareVersions("2.0.0", "1.0.0")).toBe(1);
		});
	});

	describe("isNewerVersion", () => {
		it("should return true when a > b", () => {
			expect(isNewerVersion("2.0.0", "1.0.0")).toBe(true);
		});

		it("should return false when a <= b", () => {
			expect(isNewerVersion("1.0.0", "2.0.0")).toBe(false);
			expect(isNewerVersion("1.0.0", "1.0.0")).toBe(false);
		});
	});

	describe("getLatestVersion", () => {
		it("should return highest version", () => {
			expect(getLatestVersion(["1.0.0", "2.0.0", "1.5.0"])).toBe("2.0.0");
		});

		it("should return null for empty list", () => {
			expect(getLatestVersion([])).toBeNull();
		});

		it("should filter invalid versions", () => {
			expect(getLatestVersion(["1.0.0", "invalid", "2.0.0"])).toBe("2.0.0");
		});
	});

	describe("findHighestSatisfying", () => {
		const versions = ["1.0.0", "1.1.0", "1.2.0", "1.3.0", "2.0.0", "2.1.0"];

		it("should find highest version satisfying a single range", () => {
			expect(findHighestSatisfying(["^1.0.0"], versions)).toBe("1.3.0");
		});

		it("should find highest version satisfying multiple compatible ranges", () => {
			// ^1.0.0 and >=1.2.0 should both be satisfied by 1.2.0 and 1.3.0
			expect(findHighestSatisfying(["^1.0.0", ">=1.2.0"], versions)).toBe(
				"1.3.0",
			);
		});

		it("should handle '*' and 'latest' ranges", () => {
			expect(findHighestSatisfying(["*"], versions)).toBe("2.1.0");
			expect(findHighestSatisfying(["latest"], versions)).toBe("2.1.0");
			expect(findHighestSatisfying([""], versions)).toBe("2.1.0");
		});

		it("should return null when no version satisfies all ranges", () => {
			// ^1.0.0 (max 1.x) and ^2.0.0 (min 2.0.0) are incompatible
			expect(findHighestSatisfying(["^1.0.0", "^2.0.0"], versions)).toBeNull();
		});

		it("should return null for empty versions list", () => {
			expect(findHighestSatisfying(["^1.0.0"], [])).toBeNull();
		});

		it("should handle restrictive ranges", () => {
			// >=1.1.0 <1.3.0 means only 1.1.0 and 1.2.0 are valid
			expect(findHighestSatisfying([">=1.1.0", "<1.3.0"], versions)).toBe(
				"1.2.0",
			);
		});

		it("should handle exact version requirements", () => {
			expect(findHighestSatisfying(["1.2.0"], versions)).toBe("1.2.0");
			expect(findHighestSatisfying(["^1.0.0", "1.2.0"], versions)).toBe(
				"1.2.0",
			);
		});
	});

	describe("rangesIntersect", () => {
		it("should return true for empty ranges", () => {
			expect(rangesIntersect([])).toBe(true);
		});

		it("should return true for single range", () => {
			expect(rangesIntersect(["^1.0.0"])).toBe(true);
		});

		it("should return true for compatible ranges", () => {
			expect(rangesIntersect(["^1.0.0", ">=1.2.0"])).toBe(true);
		});

		it("should return false for incompatible ranges", () => {
			expect(rangesIntersect(["^1.0.0", "^2.0.0"])).toBe(false);
		});

		it("should handle '*' ranges", () => {
			expect(rangesIntersect(["*", "^1.0.0"])).toBe(true);
		});
	});
});
