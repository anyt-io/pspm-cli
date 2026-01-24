import { describe, expect, it } from "vitest";
import {
	type DependencyGraph,
	type DependencyNode,
	type ResolutionError,
	type VersionConflict,
	computeInstallOrder,
	formatResolutionErrors,
	formatVersionConflicts,
	topologicalSort,
} from "./resolver.js";

// Helper to create a minimal DependencyNode
function createNode(
	name: string,
	deps: Record<string, string> = {},
): DependencyNode {
	return {
		name,
		version: "1.0.0",
		versionRange: "^1.0.0",
		downloadUrl: `https://example.com/${name}.tgz`,
		integrity: "sha256-test",
		depth: 0,
		dependencies: deps,
		dependents: [],
		isDirect: true,
	};
}

// Helper to create a DependencyGraph
function createGraph(
	nodes: DependencyNode[],
	roots: string[] = [],
): DependencyGraph {
	const nodeMap = new Map<string, DependencyNode>();
	for (const node of nodes) {
		nodeMap.set(node.name, node);
	}
	return {
		nodes: nodeMap,
		roots: roots.length > 0 ? roots : nodes.map((n) => n.name),
		errors: [],
		conflicts: [],
	};
}

describe("topologicalSort", () => {
	it("should return single node", () => {
		const graph = createGraph([createNode("@user/alice/skill")]);
		const order = topologicalSort(graph);
		expect(order).toEqual(["@user/alice/skill"]);
	});

	it("should sort linear dependency chain", () => {
		// A depends on B, B depends on C
		const nodes = [
			createNode("@user/alice/a", { "@user/alice/b": "^1.0.0" }),
			createNode("@user/alice/b", { "@user/alice/c": "^1.0.0" }),
			createNode("@user/alice/c"),
		];
		const graph = createGraph(nodes, ["@user/alice/a"]);
		const order = topologicalSort(graph);

		// C should come before B, B should come before A
		const cIndex = order.indexOf("@user/alice/c");
		const bIndex = order.indexOf("@user/alice/b");
		const aIndex = order.indexOf("@user/alice/a");

		expect(cIndex).toBeLessThan(bIndex);
		expect(bIndex).toBeLessThan(aIndex);
	});

	it("should handle diamond dependency", () => {
		// A depends on B and C, both B and C depend on D
		const nodes = [
			createNode("@user/alice/a", {
				"@user/alice/b": "^1.0.0",
				"@user/alice/c": "^1.0.0",
			}),
			createNode("@user/alice/b", { "@user/alice/d": "^1.0.0" }),
			createNode("@user/alice/c", { "@user/alice/d": "^1.0.0" }),
			createNode("@user/alice/d"),
		];
		const graph = createGraph(nodes, ["@user/alice/a"]);
		const order = topologicalSort(graph);

		// D should come before B and C, B and C should come before A
		const dIndex = order.indexOf("@user/alice/d");
		const bIndex = order.indexOf("@user/alice/b");
		const cIndex = order.indexOf("@user/alice/c");
		const aIndex = order.indexOf("@user/alice/a");

		expect(dIndex).toBeLessThan(bIndex);
		expect(dIndex).toBeLessThan(cIndex);
		expect(bIndex).toBeLessThan(aIndex);
		expect(cIndex).toBeLessThan(aIndex);
	});

	it("should handle independent packages", () => {
		// A and B have no dependencies on each other
		const nodes = [createNode("@user/alice/a"), createNode("@user/alice/b")];
		const graph = createGraph(nodes);
		const order = topologicalSort(graph);

		// Both should be in the output
		expect(order).toContain("@user/alice/a");
		expect(order).toContain("@user/alice/b");
		expect(order).toHaveLength(2);
	});
});

describe("computeInstallOrder", () => {
	it("should return packages in dependency order", () => {
		const packages = {
			"@user/alice/a": {
				dependencies: { "@user/alice/b": "1.0.0" },
			},
			"@user/alice/b": {
				dependencies: { "@user/alice/c": "1.0.0" },
			},
			"@user/alice/c": {},
		};

		const order = computeInstallOrder(packages);

		const cIndex = order.indexOf("@user/alice/c");
		const bIndex = order.indexOf("@user/alice/b");
		const aIndex = order.indexOf("@user/alice/a");

		expect(cIndex).toBeLessThan(bIndex);
		expect(bIndex).toBeLessThan(aIndex);
	});

	it("should handle packages without dependencies", () => {
		const packages = {
			"@user/alice/a": {},
			"@user/alice/b": {},
		};

		const order = computeInstallOrder(packages);

		expect(order).toContain("@user/alice/a");
		expect(order).toContain("@user/alice/b");
		expect(order).toHaveLength(2);
	});

	it("should handle empty packages", () => {
		const order = computeInstallOrder({});
		expect(order).toEqual([]);
	});

	it("should handle diamond dependency", () => {
		const packages = {
			"@user/alice/a": {
				dependencies: {
					"@user/alice/b": "1.0.0",
					"@user/alice/c": "1.0.0",
				},
			},
			"@user/alice/b": {
				dependencies: { "@user/alice/d": "1.0.0" },
			},
			"@user/alice/c": {
				dependencies: { "@user/alice/d": "1.0.0" },
			},
			"@user/alice/d": {},
		};

		const order = computeInstallOrder(packages);

		const dIndex = order.indexOf("@user/alice/d");
		const bIndex = order.indexOf("@user/alice/b");
		const cIndex = order.indexOf("@user/alice/c");
		const aIndex = order.indexOf("@user/alice/a");

		// D should come before B and C
		expect(dIndex).toBeLessThan(bIndex);
		expect(dIndex).toBeLessThan(cIndex);
		// B and C should come before A
		expect(bIndex).toBeLessThan(aIndex);
		expect(cIndex).toBeLessThan(aIndex);
	});
});

describe("formatResolutionErrors", () => {
	it("should format circular dependency error", () => {
		const errors: ResolutionError[] = [
			{
				type: "circular_dependency",
				package: "@user/alice/c",
				message: "Circular dependency detected",
				path: ["@user/alice/a", "@user/alice/b", "@user/alice/c"],
			},
		];

		const formatted = formatResolutionErrors(errors);
		expect(formatted[0]).toContain("Circular dependency");
		expect(formatted[0]).toContain("@user/alice/a");
	});

	it("should format max depth exceeded error", () => {
		const errors: ResolutionError[] = [
			{
				type: "max_depth_exceeded",
				package: "@user/alice/f",
				message: "Max depth exceeded",
				path: ["a", "b", "c", "d", "e", "f"],
			},
		];

		const formatted = formatResolutionErrors(errors);
		expect(formatted[0]).toContain("Max depth exceeded");
	});

	it("should format no satisfying version error", () => {
		const errors: ResolutionError[] = [
			{
				type: "no_satisfying_version",
				package: "@user/alice/skill",
				message: "No version of @user/alice/skill satisfies: ^1.0.0, ^2.0.0",
			},
		];

		const formatted = formatResolutionErrors(errors);
		expect(formatted[0]).toContain("No version");
		expect(formatted[0]).toContain("@user/alice/skill");
	});

	it("should format package not found error", () => {
		const errors: ResolutionError[] = [
			{
				type: "package_not_found",
				package: "@user/alice/missing",
				message: "Package not found",
			},
		];

		const formatted = formatResolutionErrors(errors);
		expect(formatted[0]).toContain("Package not found");
		expect(formatted[0]).toContain("@user/alice/missing");
	});
});

describe("formatVersionConflicts", () => {
	it("should format version conflict", () => {
		const conflicts: VersionConflict[] = [
			{
				package: "@user/alice/utils",
				ranges: [
					{ dependent: "@user/alice/a", range: "^1.0.0" },
					{ dependent: "@user/alice/b", range: "^2.0.0" },
				],
				availableVersions: ["1.0.0", "1.1.0", "2.0.0"],
			},
		];

		const formatted = formatVersionConflicts(conflicts);
		expect(formatted[0]).toContain("@user/alice/utils");
		expect(formatted[0]).toContain("@user/alice/a");
		expect(formatted[0]).toContain("@user/alice/b");
	});
});
