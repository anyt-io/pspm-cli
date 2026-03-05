# PSPM - Prompt Skill Package Manager

The package manager for the open agent skills ecosystem.

Supports **Claude Code**, **Cursor**, **Codex**, **Gemini CLI**, **Windsurf**, and [30+ more agents](#supported-agents).

**Website:** [pspm.dev](https://pspm.dev)

## Install a Skill

```bash
npx @anytio/pspm add vercel-labs/agent-skills
```

### Source Formats

```bash
# GitHub shorthand (owner/repo)
pspm add vercel-labs/agent-skills

# Full GitHub URL
pspm add https://github.com/vercel-labs/agent-skills

# Direct path to a skill in a repo
pspm add https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design

# GitHub with prefix (explicit format)
pspm add github:owner/repo
pspm add github:owner/repo/path/to/skill@v1.0.0

# Registry (with semver versioning)
pspm add @user/username/skill-name
pspm add @user/username/skill-name@^2.0.0

# Well-known URL (RFC 8615 discovery)
pspm add https://acme.com

# Local path (for development)
pspm add ./my-local-skills
pspm add ../shared-skills
pspm add file:../my-local-skills
```

### Options

| Option | Description |
|--------|-------------|
| `-g, --global` | Install to user home directory instead of project |
| `--agent <agents>` | Comma-separated agents for symlinks (e.g., `claude-code,cursor`) |
| `-y, --yes` | Skip agent selection prompt and use defaults |

### Examples

```bash
# Add multiple skills at once
pspm add @user/alice/skill1 @user/bob/skill2

# Add from GitHub URL (copy-paste from browser)
pspm add https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design

# Add from GitHub shorthand
pspm add vercel-labs/agent-skills/skills/web-design

# Install to specific agents only
pspm add @user/alice/my-skill --agent claude-code,cursor

# Install globally (available across all projects)
pspm add vercel-labs/agent-skills -g

# Skip prompts (CI-friendly)
pspm add @user/alice/my-skill -y --agent claude-code

# Add from well-known endpoint
pspm add https://acme.com
```

### Installation Scope

| Scope | Flag | Skills Location | Symlink Location |
|-------|------|-----------------|------------------|
| **Project** | (default) | `.pspm/skills/` | `./<agent>/skills/` |
| **Global** | `-g` | `~/.pspm/skills/` | `~/<agent>/skills/` |

## Installation

```bash
npm install -g @anytio/pspm
```

Or use with npx (no install needed):

```bash
npx @anytio/pspm <command>
```

## Quick Start

```bash
# Initialize a new skill project
pspm init

# Add a skill from the registry
pspm add @user/username/skill-name

# Add a skill from GitHub
pspm add github:owner/repo/path@main

# List installed skills
pspm list

# Install all skills from lockfile
pspm install
```

## Commands

| Command | Description |
|---------|-------------|
| `pspm add <specifiers...>` | Add skills from registry, GitHub, local paths, or well-known URLs |
| `pspm install [specifiers...]` | Install from lockfile, or add specific packages (alias: `i`) |
| `pspm remove <name>` | Remove an installed skill (alias: `rm`) |
| `pspm list` | List installed skills (alias: `ls`) |
| `pspm update` | Update skills to latest compatible versions |
| `pspm outdated [packages...]` | Check for outdated skills |
| `pspm search [query]` | Search and discover skills from the registry (alias: `find`) |
| `pspm audit` | Verify integrity of installed skills |
| `pspm link` | Recreate agent symlinks without reinstalling |
| `pspm init` | Create pspm.json manifest |
| `pspm publish` | Publish skill to registry |
| `pspm login` | Authenticate via browser or API key |
| `pspm upgrade` | Update pspm itself to the latest version |

### `pspm install`

Install all skills from the lockfile, or add and install specific packages.

```bash
# Install all from lockfile
pspm install

# Install with frozen lockfile (CI/CD - fails if lockfile is outdated)
pspm install --frozen-lockfile

# Install to a custom directory
pspm install --dir ./custom-path

# Install specific packages
pspm install @user/alice/skill1 github:org/repo
```

### `pspm search`

Search and discover skills from the registry.

```bash
# Search by keyword
pspm search typescript

# Output as JSON
pspm search react --json

# Sort by recent or name
pspm search --sort recent --limit 10
```

### `pspm audit`

Verify integrity of installed skills and check for issues.

```bash
# Run audit
pspm audit

# Output as JSON (for CI)
pspm audit --json
```

Checks for: missing packages, deprecated versions, corrupted installations (missing SKILL.md).

### `pspm list`

```bash
# List all installed skills
pspm list

# Output as JSON
pspm list --json
```

### `pspm outdated`

```bash
# Check for outdated skills
pspm outdated

# Include up-to-date packages
pspm outdated --all

# Check specific packages
pspm outdated @user/alice/skill1

# Output as JSON
pspm outdated --json
```

### `pspm update`

```bash
# Update all skills to latest compatible versions
pspm update

# Preview what would change
pspm update --dry-run
```

## Source Formats

### Registry Specifiers

PSPM has a built-in registry with full semver support, just like npm.

```bash
@user/username/skillname          # Latest version
@user/username/skillname@2.0.0    # Exact version
@user/username/skillname@^2.0.0   # Compatible range (>=2.0.0 <3.0.0)
@user/username/skillname@~2.1.0   # Patch range (>=2.1.0 <2.2.0)
```

### GitHub Specifiers

All of these formats are supported:

```bash
# Shorthand (most common)
owner/repo                                  # Entire repo (default branch)
owner/repo/path/to/skill                    # Subdirectory within repo

# Full GitHub URL (copy-paste from browser)
https://github.com/owner/repo
https://github.com/owner/repo/tree/main/path/to/skill

# Explicit prefix (with version/ref support)
github:owner/repo                           # Entire repo (default branch)
github:owner/repo@main                      # Specific branch or tag
github:owner/repo/path/to/skill             # Subdirectory within repo
github:owner/repo/path/to/skill@v1.0.0      # Subdirectory with tag
```

### Local Specifiers

```bash
./my-local-skills        # Relative path (no prefix needed)
../shared-skills         # Parent directory
file:../path/to/skill    # Explicit file: prefix (also supported)
```

### Well-Known URLs

Any HTTPS URL serving a `/.well-known/skills/index.json` endpoint. See [Well-Known Skills Discovery](../../docs/well-known-skills-discovery.md).

```bash
https://acme.com         # Discovers skills at acme.com/.well-known/skills/
```

## Agent Symlinks

PSPM installs skills to a central `.pspm/skills/` directory and creates symlinks in each agent's expected location.

```bash
# Install for specific agents
pspm add <specifier> --agent claude-code,cursor

# Skip symlink creation
pspm install --agent none

# Recreate symlinks for a specific agent
pspm link --agent codex

# Interactive agent selection (default without -y)
pspm add <specifier>
```

## Supported Agents

| Agent | `--agent` value | Skills Directory |
|-------|----------------|------------------|
| AdaL | `adal` | `.adal/skills/` |
| Amp | `amp` | `.agents/skills/` |
| Antigravity | `antigravity` | `.agent/skills/` |
| Augment | `augment` | `.augment/skills/` |
| Claude Code | `claude-code` | `.claude/skills/` |
| Cline | `cline` | `.agents/skills/` |
| CodeBuddy | `codebuddy` | `.codebuddy/skills/` |
| Codex | `codex` | `.agents/skills/` |
| Command Code | `command-code` | `.commandcode/skills/` |
| Continue | `continue` | `.continue/skills/` |
| Cortex Code | `cortex` | `.cortex/skills/` |
| Crush | `crush` | `.crush/skills/` |
| Cursor | `cursor` | `.agents/skills/` |
| Droid | `droid` | `.factory/skills/` |
| Gemini CLI | `gemini-cli` | `.agents/skills/` |
| GitHub Copilot | `github-copilot` | `.agents/skills/` |
| Goose | `goose` | `.goose/skills/` |
| iFlow CLI | `iflow-cli` | `.iflow/skills/` |
| Junie | `junie` | `.junie/skills/` |
| Kilo Code | `kilo` | `.kilocode/skills/` |
| Kimi Code CLI | `kimi-cli` | `.agents/skills/` |
| Kiro CLI | `kiro-cli` | `.kiro/skills/` |
| Kode | `kode` | `.kode/skills/` |
| MCPJam | `mcpjam` | `.mcpjam/skills/` |
| Mistral Vibe | `mistral-vibe` | `.vibe/skills/` |
| Mux | `mux` | `.mux/skills/` |
| Neovate | `neovate` | `.neovate/skills/` |
| OpenClaw | `openclaw` | `skills/` |
| OpenCode | `opencode` | `.agents/skills/` |
| OpenHands | `openhands` | `.openhands/skills/` |
| Pi | `pi` | `.pi/skills/` |
| Pochi | `pochi` | `.pochi/skills/` |
| Qoder | `qoder` | `.qoder/skills/` |
| Qwen Code | `qwen-code` | `.qwen/skills/` |
| Replit | `replit` | `.agents/skills/` |
| Roo Code | `roo` | `.roo/skills/` |
| Trae | `trae` | `.trae/skills/` |
| Trae CN | `trae-cn` | `.trae/skills/` |
| Universal | `universal` | `.agents/skills/` |
| Windsurf | `windsurf` | `.windsurf/skills/` |
| Zencoder | `zencoder` | `.zencoder/skills/` |

## Publishing Skills

### Authentication

```bash
pspm login                        # Authenticate via browser
pspm login --api-key <key>        # Authenticate with API key
pspm logout                       # Clear stored credentials
pspm whoami                       # Show current user info
```

### Versioning

```bash
pspm version major                # 1.0.0 -> 2.0.0
pspm version minor                # 1.0.0 -> 1.1.0
pspm version patch                # 1.0.0 -> 1.0.1
pspm version patch --dry-run      # Preview without writing
```

### Publishing

```bash
pspm publish --access public      # Publish as public (irreversible)
pspm publish --access private     # Publish as private (requires Pro)
pspm publish --access private --bump patch   # Bump and publish
```

`--access` is required. Before uploading, `pspm publish` shows a preview of included files and package size. Max package size is **10MB**.

### Managing Published Skills

```bash
pspm unpublish <spec> --force     # Remove a version (within 72 hours)
pspm deprecate <spec> [message]   # Mark as deprecated
pspm deprecate <spec> --undo      # Remove deprecation
pspm access --public              # Make package public (irreversible)
pspm access <spec> --private      # Make package private
```

## Creating a Skill

A skill is a directory containing at minimum a `SKILL.md`:

```markdown
---
name: my-skill
description: A helpful skill that does X
---

# My Skill

Instructions for the agent to follow when this skill is activated.

## When to Use

Describe when this skill applies.

## Steps

1. First, do this
2. Then, do that
```

For publishing to the registry, also include `pspm.json` (created with `pspm init`):

```json
{
  "name": "@user/myusername/my-skill",
  "version": "1.0.0",
  "description": "A helpful skill for...",
  "files": ["pspm.json", "SKILL.md"]
}
```

## Ignoring Files (.pspmignore)

Control which files are excluded when publishing:

```
# .pspmignore
*.test.ts
__tests__/
.env*
*.log
```

- If `.pspmignore` exists, use it for ignore patterns
- Otherwise, fall back to `.gitignore` if present
- Always ignores `node_modules`, `.git`, and `.pspm-publish`

## Directory Structure

```
project/
+-- pspm.json               # Manifest with dependencies
+-- pspm-lock.json           # Lockfile (version pinning + integrity)
+-- .pspmrc                  # Project config (optional)
+-- .pspm/
|   +-- skills/              # Installed skills (central store)
|   |   +-- username/        # Registry skills
|   |   |   +-- skillname/
|   |   |       +-- SKILL.md
|   |   +-- _github/         # GitHub skills
|   |   |   +-- owner/
|   |   |       +-- repo/
|   |   +-- _wellknown/      # Well-known skills
|   |   |   +-- acme.com/
|   |   |       +-- skill-name/
|   |   +-- _local/          # Local skill symlinks
|   +-- cache/               # Tarball cache
+-- .claude/
|   +-- skills/              # Symlinks for Claude Code
+-- .cursor/
    +-- skills/              # Symlinks for Cursor (if configured)
```

## CI/CD Integration

```bash
# Set API key via environment variable
export PSPM_API_KEY=sk_ci_key

# Install with frozen lockfile (fails if lockfile is outdated)
pspm install --frozen-lockfile

# Audit installed skills
pspm audit --json
```

## Configuration

### User Config (`~/.pspmrc`)

```ini
registry = https://registry.pspm.dev
authToken = sk_...
username = myuser
```

### Project Config (`.pspmrc`)

```ini
registry = https://custom-registry.example.com
```

### Lockfile (`pspm-lock.json`)

Tracks exact versions, resolved URLs, and integrity hashes for reproducible installs:

```json
{
  "lockfileVersion": 5,
  "registryUrl": "https://registry.pspm.dev",
  "packages": { ... },
  "githubPackages": { ... },
  "localPackages": { ... },
  "wellKnownPackages": { ... }
}
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PSPM_API_KEY` | Override API key for authentication |
| `PSPM_DEBUG` | Enable debug logging |
| `GITHUB_TOKEN` | GitHub token for private repos and higher rate limits |

## Self-Update

```bash
pspm upgrade
```

Auto-detects your package manager (pnpm, npm, yarn, bun). The CLI also checks for updates every 24 hours and notifies you when a newer version is available.

## License

This project is licensed under [The Artistic License 2.0](LICENSE), the same license used by npm.
