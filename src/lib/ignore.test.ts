import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	ALWAYS_IGNORED,
	getExcludeArgsForRsync,
	getExcludeArgsForTar,
	loadIgnorePatterns,
	parseIgnorePatterns,
} from "./ignore";

describe("parseIgnorePatterns", () => {
	it("should parse patterns from content", () => {
		const content = `
# Comment line
node_modules
dist
*.log

# Another comment
.env
`;
		const patterns = parseIgnorePatterns(content);
		expect(patterns).toEqual(["node_modules", "dist", "*.log", ".env"]);
	});

	it("should handle empty content", () => {
		expect(parseIgnorePatterns("")).toEqual([]);
	});

	it("should handle content with only comments", () => {
		const content = `# Comment 1
# Comment 2`;
		expect(parseIgnorePatterns(content)).toEqual([]);
	});

	it("should trim whitespace from patterns", () => {
		const content = "  node_modules  \n  dist  ";
		expect(parseIgnorePatterns(content)).toEqual(["node_modules", "dist"]);
	});
});

describe("getExcludeArgsForRsync", () => {
	it("should include always-ignored patterns", () => {
		const result = getExcludeArgsForRsync([]);
		expect(result).toContain("--exclude='node_modules'");
		expect(result).toContain("--exclude='.git'");
		expect(result).toContain("--exclude='.pspm-publish'");
	});

	it("should include custom patterns", () => {
		const result = getExcludeArgsForRsync(["dist", "*.log"]);
		expect(result).toContain("--exclude='dist'");
		expect(result).toContain("--exclude='*.log'");
	});

	it("should deduplicate patterns", () => {
		const result = getExcludeArgsForRsync(["node_modules", "dist"]);
		const nodeModulesCount = (result.match(/node_modules/g) || []).length;
		expect(nodeModulesCount).toBe(1);
	});
});

describe("getExcludeArgsForTar", () => {
	it("should include always-ignored patterns", () => {
		const result = getExcludeArgsForTar([]);
		expect(result).toContain("--exclude='node_modules'");
		expect(result).toContain("--exclude='.git'");
	});

	it("should include custom patterns", () => {
		const result = getExcludeArgsForTar(["dist", "*.log"]);
		expect(result).toContain("--exclude='dist'");
		expect(result).toContain("--exclude='*.log'");
	});
});

describe("loadIgnorePatterns", () => {
	const testDir = join(process.cwd(), ".test-ignore-temp");

	beforeEach(async () => {
		await mkdir(testDir, { recursive: true });
	});

	afterEach(async () => {
		await rm(testDir, { recursive: true, force: true });
	});

	it("should use .pspmignore when it exists", async () => {
		await writeFile(join(testDir, ".pspmignore"), "dist\n*.log\n");

		const result = await loadIgnorePatterns(testDir);

		expect(result.source).toBe(".pspmignore");
		expect(result.patterns).toEqual(["dist", "*.log"]);
		expect(result.ig.ignores("dist")).toBe(true);
		expect(result.ig.ignores("test.log")).toBe(true);
	});

	it("should fall back to .gitignore when .pspmignore does not exist", async () => {
		await writeFile(join(testDir, ".gitignore"), "build\n*.tmp\n");

		const result = await loadIgnorePatterns(testDir);

		expect(result.source).toBe(".gitignore");
		expect(result.patterns).toEqual(["build", "*.tmp"]);
		expect(result.ig.ignores("build")).toBe(true);
		expect(result.ig.ignores("test.tmp")).toBe(true);
	});

	it("should prefer .pspmignore over .gitignore", async () => {
		await writeFile(join(testDir, ".pspmignore"), "pspm-specific\n");
		await writeFile(join(testDir, ".gitignore"), "git-specific\n");

		const result = await loadIgnorePatterns(testDir);

		expect(result.source).toBe(".pspmignore");
		expect(result.patterns).toEqual(["pspm-specific"]);
		expect(result.ig.ignores("pspm-specific")).toBe(true);
		// gitignore patterns should NOT be loaded when .pspmignore exists
		expect(result.ig.ignores("git-specific")).toBe(false);
	});

	it("should return null source when no ignore file exists", async () => {
		const result = await loadIgnorePatterns(testDir);

		expect(result.source).toBe(null);
		expect(result.patterns).toEqual([]);
	});

	it("should always ignore node_modules and .git", async () => {
		const result = await loadIgnorePatterns(testDir);

		expect(result.ig.ignores("node_modules")).toBe(true);
		expect(result.ig.ignores(".git")).toBe(true);
		expect(result.ig.ignores(".pspm-publish")).toBe(true);
	});

	it("should handle patterns with directories", async () => {
		await writeFile(join(testDir, ".pspmignore"), "build/\nsrc/temp/\n");

		const result = await loadIgnorePatterns(testDir);

		expect(result.ig.ignores("build/")).toBe(true);
		expect(result.ig.ignores("src/temp/")).toBe(true);
	});

	it("should handle negation patterns", async () => {
		await writeFile(join(testDir, ".pspmignore"), "*.log\n!important.log\n");

		const result = await loadIgnorePatterns(testDir);

		expect(result.ig.ignores("debug.log")).toBe(true);
		expect(result.ig.ignores("important.log")).toBe(false);
	});
});

describe("ALWAYS_IGNORED", () => {
	it("should include essential directories", () => {
		expect(ALWAYS_IGNORED).toContain("node_modules");
		expect(ALWAYS_IGNORED).toContain(".git");
		expect(ALWAYS_IGNORED).toContain(".pspm-publish");
	});
});
