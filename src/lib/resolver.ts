/**
 * Recursive Dependency Resolver for PSPM
 *
 * Implements pnpm-style dependency resolution:
 * - Highest satisfying version strategy
 * - 5-depth limit to prevent deep trees
 * - Circular dependency detection
 * - Topological sort for installation order
 */

import { configure, getSkillVersion, listSkillVersions } from "@/api-client";
import { findHighestSatisfying } from "./version";

// =============================================================================
// Constants
// =============================================================================

/** Maximum depth for transitive dependency resolution */
export const MAX_DEPENDENCY_DEPTH = 5;

// =============================================================================
// Types
// =============================================================================

export interface ResolverConfig {
	/** Maximum depth for resolution (default: 5) */
	maxDepth: number;
	/** Registry URL */
	registryUrl: string;
	/** API key for authentication */
	apiKey?: string;
}

export interface DependencyNode {
	/** Full package name (e.g., @user/alice/skill) */
	name: string;
	/** Resolved version (e.g., 1.2.3) */
	version: string;
	/** Original version range requested (e.g., ^1.0.0) */
	versionRange: string;
	/** Download URL for the package */
	downloadUrl: string;
	/** Integrity hash for verification */
	integrity: string;
	/** Depth in dependency tree (0 = direct dependency) */
	depth: number;
	/** Dependencies: name -> resolved version */
	dependencies: Record<string, string>;
	/** Packages that depend on this one */
	dependents: string[];
	/** Whether this is a direct dependency (from pspm.json) */
	isDirect: boolean;
	/** Deprecation message if deprecated */
	deprecated?: string;
}

export interface DependencyGraph {
	/** All resolved nodes: name -> node */
	nodes: Map<string, DependencyNode>;
	/** Root package names (direct dependencies) */
	roots: string[];
	/** Resolution errors */
	errors: ResolutionError[];
	/** Version conflicts (multiple packages need incompatible versions) */
	conflicts: VersionConflict[];
}

export interface ResolutionResult {
	/** Whether resolution completed successfully */
	success: boolean;
	/** The dependency graph */
	graph: DependencyGraph;
	/** Topologically sorted install order */
	installOrder: string[];
}

export type ResolutionErrorType =
	| "circular_dependency"
	| "max_depth_exceeded"
	| "no_satisfying_version"
	| "package_not_found"
	| "fetch_error";

export interface ResolutionError {
	type: ResolutionErrorType;
	package: string;
	message: string;
	/** Path that led to this error */
	path?: string[];
}

export interface VersionConflict {
	/** Package name */
	package: string;
	/** Ranges requested by different dependents */
	ranges: Array<{ dependent: string; range: string }>;
	/** Available versions that were checked */
	availableVersions: string[];
}

// =============================================================================
// Internal Types
// =============================================================================

interface QueueItem {
	name: string;
	versionRange: string;
	depth: number;
	dependent: string;
	path: string[];
}

interface CollectedRange {
	range: string;
	dependent: string;
	depth: number;
}

// =============================================================================
// Main Resolution Function
// =============================================================================

/**
 * Resolve dependencies recursively using BFS.
 *
 * Algorithm:
 * 1. Queue root dependencies at depth=0
 * 2. For each package, collect all version ranges from dependents
 * 3. Find highest version satisfying ALL ranges
 * 4. Fetch package details including its dependencies
 * 5. Queue transitive dependencies at depth+1
 * 6. Topologically sort for installation order
 *
 * @param rootDeps - Direct dependencies: name -> version range
 * @param config - Resolver configuration
 * @returns Resolution result with graph and install order
 */
export async function resolveRecursive(
	rootDeps: Record<string, string>,
	config: ResolverConfig,
): Promise<ResolutionResult> {
	const graph: DependencyGraph = {
		nodes: new Map(),
		roots: Object.keys(rootDeps),
		errors: [],
		conflicts: [],
	};

	// Configure API client
	configure({
		registryUrl: config.registryUrl,
		apiKey: config.apiKey ?? "",
	});

	// Collect version ranges for each package
	const rangesByPackage = new Map<string, CollectedRange[]>();

	// Queue for BFS traversal
	const queue: QueueItem[] = [];

	// Initialize queue with root dependencies
	for (const [name, range] of Object.entries(rootDeps)) {
		queue.push({
			name,
			versionRange: range,
			depth: 0,
			dependent: "root",
			path: [],
		});
	}

	// Set of packages being processed (for cycle detection)
	const processing = new Set<string>();

	// Phase 1: Collect all version ranges using BFS
	while (queue.length > 0) {
		const item = queue.shift();
		if (!item) continue;
		const { name, versionRange, depth, dependent, path } = item;

		// Check depth limit
		if (depth > config.maxDepth) {
			graph.errors.push({
				type: "max_depth_exceeded",
				package: name,
				message: `Maximum dependency depth (${config.maxDepth}) exceeded at: ${[...path, name].join(" -> ")}`,
				path: [...path, name],
			});
			continue;
		}

		// Check for circular dependency
		if (path.includes(name)) {
			graph.errors.push({
				type: "circular_dependency",
				package: name,
				message: `Circular dependency detected: ${[...path, name].join(" -> ")}`,
				path: [...path, name],
			});
			continue;
		}

		// Collect range for this package
		if (!rangesByPackage.has(name)) {
			rangesByPackage.set(name, []);
		}
		rangesByPackage.get(name)?.push({
			range: versionRange,
			dependent,
			depth,
		});

		// Only process each package once for fetching
		if (processing.has(name)) {
			continue;
		}
		processing.add(name);

		// Parse package name
		const match = name.match(/^@user\/([^/]+)\/([^/]+)$/);
		if (!match) {
			graph.errors.push({
				type: "package_not_found",
				package: name,
				message: `Invalid package name format: ${name}`,
			});
			continue;
		}
		const [, username, skillName] = match;

		// Fetch available versions
		try {
			const versionsResponse = await listSkillVersions(username, skillName);
			if (versionsResponse.status !== 200) {
				graph.errors.push({
					type: "package_not_found",
					package: name,
					message: `Package ${name} not found in registry`,
				});
				continue;
			}

			const versions = versionsResponse.data as Array<{ version: string }>;
			if (versions.length === 0) {
				graph.errors.push({
					type: "package_not_found",
					package: name,
					message: `Package ${name} has no versions`,
				});
				continue;
			}

			const availableVersions = versions.map((v) => v.version);

			// Find highest satisfying version (will be finalized in phase 2)
			const resolvedVersion = findHighestSatisfying(
				[versionRange],
				availableVersions,
			);

			if (!resolvedVersion) {
				graph.errors.push({
					type: "no_satisfying_version",
					package: name,
					message: `No version of ${name} satisfies: ${versionRange}`,
				});
				continue;
			}

			// Fetch package details for dependencies
			const versionResponse = await getSkillVersion(
				username,
				skillName,
				resolvedVersion,
			);
			if (versionResponse.status !== 200 || !versionResponse.data) {
				graph.errors.push({
					type: "fetch_error",
					package: name,
					message: `Failed to fetch ${name}@${resolvedVersion}`,
				});
				continue;
			}

			const versionInfo = versionResponse.data;
			const manifest = versionInfo.manifest as
				| { dependencies?: Record<string, string> }
				| undefined;
			const dependencies = manifest?.dependencies ?? {};

			// Create node (may be updated in phase 2 with final version)
			const node: DependencyNode = {
				name,
				version: resolvedVersion,
				versionRange,
				downloadUrl: versionInfo.downloadUrl,
				integrity: `sha256-${Buffer.from(versionInfo.checksum, "hex").toString("base64")}`,
				depth,
				dependencies,
				dependents: [dependent],
				isDirect: depth === 0,
				deprecated: versionInfo.deprecationMessage ?? undefined,
			};
			graph.nodes.set(name, node);

			// Queue transitive dependencies
			for (const [depName, depRange] of Object.entries(dependencies)) {
				queue.push({
					name: depName,
					versionRange: depRange,
					depth: depth + 1,
					dependent: name,
					path: [...path, name],
				});
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			graph.errors.push({
				type: "fetch_error",
				package: name,
				message: `Error fetching ${name}: ${message}`,
			});
		}
	}

	// Phase 2: Resolve final versions considering all collected ranges
	for (const [name, ranges] of rangesByPackage.entries()) {
		const node = graph.nodes.get(name);
		if (!node) continue;

		// Update dependents list
		const uniqueDependents = [...new Set(ranges.map((r) => r.dependent))];
		node.dependents = uniqueDependents;

		// Check if all ranges can be satisfied
		const allRanges = ranges.map((r) => r.range);
		const match = name.match(/^@user\/([^/]+)\/([^/]+)$/);
		if (!match) continue;

		const [, username, skillName] = match;

		try {
			const versionsResponse = await listSkillVersions(username, skillName);
			if (versionsResponse.status !== 200) continue;

			const versions = versionsResponse.data as Array<{ version: string }>;
			const availableVersions = versions.map((v) => v.version);

			const finalVersion = findHighestSatisfying(allRanges, availableVersions);

			if (!finalVersion) {
				// Record conflict
				graph.conflicts.push({
					package: name,
					ranges: ranges.map((r) => ({
						dependent: r.dependent,
						range: r.range,
					})),
					availableVersions,
				});

				graph.errors.push({
					type: "no_satisfying_version",
					package: name,
					message: `No version of ${name} satisfies all requirements: ${allRanges.join(", ")}`,
				});
				continue;
			}

			// Update node if version changed
			if (finalVersion !== node.version) {
				const versionResponse = await getSkillVersion(
					username,
					skillName,
					finalVersion,
				);
				if (versionResponse.status === 200 && versionResponse.data) {
					const versionInfo = versionResponse.data;
					node.version = finalVersion;
					node.downloadUrl = versionInfo.downloadUrl;
					node.integrity = `sha256-${Buffer.from(versionInfo.checksum, "hex").toString("base64")}`;
					node.deprecated = versionInfo.deprecationMessage ?? undefined;

					const manifest = versionInfo.manifest as
						| { dependencies?: Record<string, string> }
						| undefined;
					node.dependencies = manifest?.dependencies ?? {};
				}
			}
		} catch {
			// Already have a node, keep it
		}
	}

	// Phase 3: Compute topological sort
	const installOrder = topologicalSort(graph);

	// Determine success
	const success = graph.errors.length === 0 && graph.conflicts.length === 0;

	return {
		success,
		graph,
		installOrder,
	};
}

// =============================================================================
// Topological Sort
// =============================================================================

/**
 * Topologically sort packages using Kahn's algorithm.
 * Packages with no dependencies are installed first.
 *
 * @param graph - The dependency graph
 * @returns Sorted list of package names
 */
export function topologicalSort(graph: DependencyGraph): string[] {
	// in-degree: number of dependencies a node has (within the graph)
	const inDegree = new Map<string, number>();
	// dependents: nodes that depend on this node (reverse edges)
	const dependents = new Map<string, string[]>();

	// Initialize all nodes
	for (const name of graph.nodes.keys()) {
		inDegree.set(name, 0);
		dependents.set(name, []);
	}

	// Build the graph
	for (const [name, node] of graph.nodes.entries()) {
		for (const depName of Object.keys(node.dependencies)) {
			// Only count dependencies that exist in our graph
			if (graph.nodes.has(depName)) {
				// Increment in-degree of current node (it has a dependency)
				inDegree.set(name, (inDegree.get(name) ?? 0) + 1);
				// Add reverse edge: depName is depended on by name
				if (!dependents.has(depName)) {
					dependents.set(depName, []);
				}
				dependents.get(depName)?.push(name);
			}
		}
	}

	// Find nodes with in-degree 0 (no dependencies within our graph)
	const queue: string[] = [];
	for (const [name, degree] of inDegree.entries()) {
		if (degree === 0) {
			queue.push(name);
		}
	}

	const sorted: string[] = [];
	while (queue.length > 0) {
		const current = queue.shift();
		if (!current) continue;
		sorted.push(current);

		// For each node that depends on current, decrease its in-degree
		const deps = dependents.get(current) ?? [];
		for (const dependent of deps) {
			const newDegree = (inDegree.get(dependent) ?? 1) - 1;
			inDegree.set(dependent, newDegree);
			if (newDegree === 0 && !sorted.includes(dependent)) {
				queue.push(dependent);
			}
		}
	}

	return sorted;
}

/**
 * Compute installation order from lockfile packages.
 * Dependencies are installed before dependents.
 *
 * @param packages - Lockfile packages with dependencies field
 * @returns Sorted list of package names
 */
export function computeInstallOrder(
	packages: Record<string, { dependencies?: Record<string, string> }>,
): string[] {
	const visited = new Set<string>();
	const order: string[] = [];

	function visit(name: string) {
		if (visited.has(name)) return;
		visited.add(name);

		const entry = packages[name];
		if (entry?.dependencies) {
			for (const dep of Object.keys(entry.dependencies)) {
				visit(dep);
			}
		}
		order.push(name);
	}

	for (const name of Object.keys(packages)) {
		visit(name);
	}

	return order;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Format resolution errors for display.
 *
 * @param errors - Resolution errors
 * @returns Formatted error messages
 */
export function formatResolutionErrors(errors: ResolutionError[]): string[] {
	return errors.map((error) => {
		switch (error.type) {
			case "circular_dependency":
				return `Circular dependency: ${error.path?.join(" -> ") ?? error.package}`;
			case "max_depth_exceeded":
				return `Max depth exceeded at: ${error.path?.join(" -> ") ?? error.package}`;
			case "no_satisfying_version":
				return error.message;
			case "package_not_found":
				return `Package not found: ${error.package}`;
			case "fetch_error":
				return error.message;
			default:
				return error.message;
		}
	});
}

/**
 * Format version conflicts for display.
 *
 * @param conflicts - Version conflicts
 * @returns Formatted conflict messages
 */
export function formatVersionConflicts(conflicts: VersionConflict[]): string[] {
	return conflicts.map((conflict) => {
		const requirements = conflict.ranges
			.map((r) => `${r.dependent} needs ${r.range}`)
			.join(", ");
		return `No version of ${conflict.package} satisfies: ${requirements}`;
	});
}

/**
 * Print resolution errors to console.
 *
 * @param errors - Resolution errors
 * @param conflicts - Version conflicts
 */
export function printResolutionErrors(
	errors: ResolutionError[],
	conflicts: VersionConflict[] = [],
): void {
	if (errors.length > 0) {
		console.error("\nResolution errors:");
		for (const msg of formatResolutionErrors(errors)) {
			console.error(`  - ${msg}`);
		}
	}

	if (conflicts.length > 0) {
		console.error("\nVersion conflicts:");
		for (const msg of formatVersionConflicts(conflicts)) {
			console.error(`  - ${msg}`);
		}
	}
}
