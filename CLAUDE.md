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
- `src/api-client.ts` - SDK wrapper (imports from local `src/sdk/`)
- `src/sdk/` - Generated SDK (fetcher.ts + generated/index.ts)
- `src/config.ts` - User/project configuration (~/.pspmrc, .pspmrc)
- `src/lockfile.ts` - Lockfile operations (pspm-lock.json)
- `src/manifest.ts` - Manifest operations (pspm.json)
- `src/agents.ts` - Agent detection and configuration
- `src/symlinks.ts` - Agent symlink management
- `src/github.ts` - GitHub package support
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
| `publish` | Publish skill to registry |
| `unpublish` | Remove published version |
| `access` | Change package visibility |
| `deprecate` | Mark version as deprecated |
| `version` | Bump package version (major, minor, patch) |
| `config show` | Show resolved configuration |
| `config init` | Create .pspmrc file |

### Library (src/lib/)

Core utilities with comprehensive tests:

- `ignore.ts` - `.pspmignore` / `.gitignore` pattern loading and filtering
- `integrity.ts` - SHA256 integrity hash calculation
- `lockfile.ts` - Lockfile types and parsing
- `manifest.ts` - Manifest types and validation
- `specifier.ts` - Package specifier parsing
- `version.ts` - Semver version resolution
- `resolver.ts` - Recursive dependency resolution

## SDK Integration

The CLI uses a local SDK generated from the server's OpenAPI spec:

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

// CLI-specific helpers
export function configure(config: SDKConfig): void {
  sdkConfigure({
    baseUrl: config.registryUrl,
    apiKey: config.apiKey,
  });
}
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

Test files are colocated in `src/lib/*.test.ts`.

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

<!-- @doc-sync: 9c7eea570623d2a3e016cd0544490571877243ca | 2026-01-29 12:00 -->
