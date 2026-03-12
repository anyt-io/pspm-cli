# CLAUDE.md - @anytio/pspm (CLI)

## Commands

```bash
# Development
pnpm dev:cli                      # Start CLI in dev mode (with tsx watch)
pnpm build:cli                    # Build CLI for production
pnpm cli -- <command>             # Run CLI command in dev mode

# From apps/cli directory
pnpm dev                          # Start dev mode
pnpm build                        # Build with tsup
pnpm test                         # Run tests with vitest

# Examples
pnpm cli -- --help                # Show help
pnpm cli -- whoami                # Check current user
pnpm cli -- add @user/skill       # Add a skill
```

## Architecture

The CLI is a Commander.js application that manages prompt skills for AI coding agents.

### Key Files

- `src/index.ts` - Main CLI entry point with all commands
- `src/api-client.ts` - SDK wrapper (imports from local `src/sdk/`); includes `@github` namespace API functions (`listGithubSkillVersions`, `getGithubSkillVersion`)
- `src/sdk/` - Generated SDK (fetcher.ts + generated/index.ts)
- `src/config.ts` - User/project configuration (~/.pspmrc, .pspmrc)
- `src/lockfile.ts` - Lockfile operations (pspm-lock.json)
- `src/manifest.ts` - Manifest operations (pspm.json)
- `src/agents.ts` - Agent detection and configuration (41 agents with project + global skills dirs)
- `src/symlinks.ts` - Agent symlink management (project and global scope); `getRegistrySkillPath` supports namespace-aware paths
- `src/github.ts` - GitHub package support
- `src/wellknown.ts` - Well-known URL skill discovery (RFC 8615)
- `src/update-notifier.ts` - Background update checker (24h interval)
- `src/errors.ts` - CLI error types

### Commands (src/commands/)

| Command | Description |
|---------|-------------|
| `login` | Authenticate via browser or API key |
| `logout` | Clear stored credentials |
| `whoami` | Show current user info |
| `init` | Create pspm.json manifest |
| `migrate` | Migrate from old directory structure |
| `add` | Add and install skills |
| `remove` | Remove installed skill |
| `list` | List installed skills |
| `install` | Install from lockfile or add packages |
| `link` | Recreate agent symlinks |
| `update` | Update skills to latest versions |
| `outdated` | Check for outdated skills (`--json`, `--all`) |
| `publish` | Publish skill to registry (requires `--access`) |
| `unpublish` | Remove published version |
| `access` | Change package visibility |
| `deprecate` | Mark version as deprecated |
| `version` | Bump package version (major, minor, patch) |
| `config show` | Show resolved configuration |
| `config init` | Create .pspmrc file |
| `upgrade` | Self-update pspm to latest version (auto-detects package manager) |

### Library (src/lib/)

Core utilities with comprehensive tests:

- `ignore.ts` - `.pspmignore` / `.gitignore` pattern loading and filtering
- `integrity.ts` - SHA256 integrity hash calculation (`calculateIntegrity`)
- `lockfile.ts` - Lockfile types and parsing (v5 with well-known packages), `PSPM_LOCKFILE_SCHEMA_URL` constant for IDE validation
- `manifest.ts` - Manifest types and validation
- `specifier.ts` - Package specifier parsing (multi-namespace: `@user`, `@org`, `@github`)
- `version.ts` - Semver version resolution
- `resolver.ts` - Recursive dependency resolution (supports `@github` namespace via dedicated API)

## SDK Integration

The CLI uses a local SDK generated from the server's OpenAPI spec. API key is optional for public package operations:

```typescript
// src/api-client.ts wraps the SDK
import {
  configure as sdkConfigure,
  getConfig,
  isConfigured,
} from "./sdk/fetcher";
import {
  getSkill,
  publishSkill,
  // ... other generated SDK functions
} from "./sdk/generated";

// CLI-specific helpers — apiKey is optional (public packages don't need it)
export function configure(options: {
  registryUrl: string;
  apiKey?: string;
}): void {
  sdkConfigure({
    baseUrl: options.registryUrl,
    apiKey: options.apiKey,
  });
}
```

### Multi-Namespace Registry Specifiers

The CLI supports three registry namespaces via `RegistrySpecifier` (defined in `src/lib/specifier.ts`):

| Namespace | Format | Example |
|-----------|--------|---------|
| `user` | `@user/{username}/{name}[@version]` | `@user/alice/my-skill@^1.0.0` |
| `org` | `@org/{orgname}/{name}[@version]` | `@org/anyt/code-review@^2.0.0` |
| `github` | `@github/{owner}/{repo}/{skillname}[@version]` | `@github/microsoft/skills/azure-ai` |

Key functions:
- `parseRegistrySpecifier()` - Unified parser for all namespaces (replaces `parseSkillSpecifier`)
- `generateRegistryIdentifier()` - Generates full identifier string (replaces `generateSkillIdentifier`)
- `isRegistrySpecifier()` - Checks if a string starts with `@user/`, `@org/`, or `@github/`
- `getRegistrySkillName()` - Returns the effective skill name (`subname` for `@github`, `name` otherwise)

The old `parseSkillSpecifier` and `SkillSpecifier` are deprecated but retained for backward compatibility (only match `@user` namespace).

### Namespace-Aware Disk Layout

Skills are installed to different paths depending on namespace:
- `@user` -> `.pspm/skills/{username}/{name}`
- `@org` -> `.pspm/skills/_org/{orgname}/{name}`
- `@github` -> `.pspm/skills/_github-registry/{owner}/{repo}/{skillname}`

### API Endpoints
API calls for deprecate, undeprecate, changeAccess, deleteSkill, and deleteSkillVersion use an `owner` parameter (renamed from `username`). URLs follow the pattern:
```
/api/skills/@user/{username}/{name}/versions/{version}/deprecate
/api/skills/@user/{username}/{name}/access
/api/skills/@github/{owner}/{repo}/{name}/versions
/api/skills/@github/{owner}/{repo}/{name}/versions/{version}
```

To regenerate the SDK after API changes:
```bash
pnpm sdk:generate  # From monorepo root
```

## Build Configuration

Uses tsup for ESM bundling:

```typescript
// tsup.config.ts
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node22",
});
```

## Testing

Tests use vitest with path alias support:

```bash
pnpm test                # Run all tests
pnpm test -- --watch     # Watch mode
```

Test files are colocated in `src/lib/*.test.ts` and `src/commands/*.test.ts`.

## Configuration Files

### User Config: `~/.pspmrc`

```ini
registry = https://registry.pspm.dev
authToken = sk_...
username = myuser
```

### Project Config: `.pspmrc`

```ini
registry = https://custom.example.com
```

### Manifest: `pspm.json`

```json
{
  "name": "@user/username/skill",
  "version": "1.0.0",
  "dependencies": {},
  "githubDependencies": {}
}
```

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `PSPM_API_KEY` | Override API key |
| `PSPM_DEBUG` | Enable debug logging |
| `GITHUB_TOKEN` | GitHub token for private repos |

## Path Aliases

The CLI uses `@/` path alias for imports:

```typescript
import { configure } from "@/api-client";
import { resolveConfig } from "@/config";
```

Configured in `tsconfig.json` and `vitest.config.ts`.

<!-- @doc-sync: f49f568 | 2026-03-09 14:49 -->
