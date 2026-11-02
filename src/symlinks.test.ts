import { lstat, mkdir, mkdtemp, readlink, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { expect, it } from "vitest";
import { removeAgentSymlinks } from "./symlinks";

it("removes only the agent links pointing to the selected package", async () => {
	const projectRoot = await mkdtemp(join(tmpdir(), "pspm-remove-"));
	try {
		const registry = join(
			projectRoot,
			".pspm/skills/_github-registry/org/repo/demo",
		);
		const direct = join(
			projectRoot,
			".pspm/skills/_github/org/repo/skills/demo",
		);
		const codex = join(projectRoot, ".agents/skills");
		const claude = join(projectRoot, ".claude/skills");
		await mkdir(codex, { recursive: true });
		await mkdir(claude, { recursive: true });
		await symlink(relative(codex, direct), join(codex, "demo"), "dir");
		await symlink(relative(claude, registry), join(claude, "demo"), "dir");

		await removeAgentSymlinks("demo", registry, {
			agents: ["codex", "claude-code"],
			projectRoot,
		});

		expect(await readlink(join(codex, "demo"))).toBe(relative(codex, direct));
		await expect(lstat(join(claude, "demo"))).rejects.toMatchObject({
			code: "ENOENT",
		});
	} finally {
		await rm(projectRoot, { recursive: true, force: true });
	}
});
