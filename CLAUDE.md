# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PSPM (Prompt Skill Package Manager) is a CLI tool for managing prompt skills across AI coding agents. It functions like npm for AI agent skills, allowing users to install, publish, and manage `SKILL.md` files.

## Development Commands

```bash
# Development
pnpm dev              # Run CLI directly with tsx (no build needed)
pnpm build            # Build with tsup to dist/
pnpm link             # Build and link globally for testing

# Code Quality
pnpm typecheck        # TypeScript type checking
pnpm lint             # Biome linting
pnpm check            # Biome check (lint + format validation)
pnpm format           # Format with Biome
pnpm knip             # Check for unused dependencies/exports

# Testing
pnpm test             # Run tests once with Vitest
pnpm test:watch       # Run tests in watch mode
```

## Architecture

### Entry Point & Commands
- `src/index.ts` - CLI entry point using Commander.js, defines all commands
- `src/commands/` - Individual command implementations (add, install, publish, etc.)
- `src/commands/config/` - Config subcommands (show, init)

### Core Modules
- `src/config.ts` - Configuration management (INI format in `~/.pspmrc` and `.pspmrc`)
- `src/api-client.ts` - SDK wrapper and API calls to the registry
- `src/agents.ts` - Agent configurations for skill symlinks (Claude Code, Cursor, Codex, etc.)
- `src/github.ts` - GitHub specifier fetching and caching
- `src/lockfile.ts` - Lockfile (`pspm-lock.json`) read/write operations
- `src/manifest.ts` - Package manifest (`pspm.json`) handling
- `src/symlinks.ts` - Agent symlink creation/management

### Library Modules (`src/lib/`)
- `specifier.ts` - Parse registry (`@user/username/skill`) and GitHub (`github:owner/repo`) specifiers
- `version.ts` - Semver version resolution, `findHighestSatisfying()` for multi-range resolution
- `resolver.ts` - Recursive dependency resolution with BFS, topological sort, cycle detection
- `integrity.ts` - SHA integrity hash generation
- `lockfile.ts` - Lockfile types (v1-v4) and helpers
- `manifest.ts` - Manifest types and validation

### SDK (`src/sdk/`)
- `fetcher.ts` - HTTP client configuration for registry API
- `generated/index.ts` - Generated API client functions

## Key Patterns

### Package Specifiers
- Registry: `@user/{username}/{skillname}[@{version}]`
- GitHub: `github:{owner}/{repo}[/{path}][@{ref}]`

### Agent Symlinks
Skills are installed to `.pspm/skills/` and symlinked to agent directories:
- `.claude/skills/` (Claude Code)
- `.cursor/skills/` (Cursor)
- `.codex/skills/` (Codex)
- `.gemini/skills/` (Gemini CLI)
- `.kiro/skills/` (Kiro CLI)
- `.opencode/skills/` (OpenCode)

### Dependency Resolution
- **Recursive resolution**: Registry packages resolve transitive dependencies automatically
- **Highest satisfying version**: When multiple packages need the same dependency, picks highest version satisfying all ranges
- **5-depth limit**: Prevents excessively deep dependency trees
- **Topological installation**: Dependencies installed before dependents
- **Lockfile v4**: Stores resolved dependency graph in `pspm-lock.json`

### Configuration Cascade
Priority order (highest to lowest):
1. Environment variables (`PSPM_REGISTRY_URL`, `PSPM_API_KEY`)
2. Project config (`.pspmrc` in project directory)
3. User config (`~/.pspmrc`)
4. Defaults

## Code Style

- Uses Biome for formatting and linting
- Tab indentation, double quotes
- ESM modules (`"type": "module"`)
- TypeScript strict mode enabled
