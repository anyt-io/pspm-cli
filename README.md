# PSPM - Prompt Skill Package Manager

A CLI for managing prompt skills across AI coding agents.

## What is PSPM?

PSPM (Prompt Skill Package Manager) is a package manager for prompt skills - small, discoverable capabilities packaged as `SKILL.md` files. Think of it as npm for AI agent skills.

Skills are designed to work with any AI coding agent that supports the SKILL.md format, including Claude Code, Cursor, Windsurf, and others.

## Installation

```bash
npm install -g @anytio/pspm
```

Or use with npx:

```bash
npx @anytio/pspm <command>
```

## Quick Start

```bash
# Login with your API key
pspm login --api-key <your-api-key>

# Add a skill from the registry
pspm add @user/username/skill-name

# Add a skill from GitHub
pspm add github:owner/repo/path@main

# List installed skills
pspm list

# Install all skills from lockfile
pspm install --agent claude-code,cursor
```

## Commands

### Authentication

```bash
pspm login --api-key <key>    # Authenticate with API key
pspm logout                   # Clear stored credentials
pspm whoami                   # Show current user info
```

### Skill Management

```bash
pspm add <specifiers...>      # Add and install one or more skills
pspm remove <name>            # Remove an installed skill (alias: rm)
pspm list                     # List installed skills (alias: ls)
pspm install [specifiers...]  # Install from lockfile, or add specific packages (alias: i)
pspm link                     # Recreate agent symlinks without reinstalling
pspm update                   # Update skills to latest compatible versions
```

**Multiple package support (like npm):**
```bash
pspm add @user/alice/skill1 @user/bob/skill2    # Add multiple packages
pspm install @user/alice/skill1 github:org/repo # Install specific packages
pspm install                                     # Install all from lockfile
```

**Registry specifier formats:**
- `@user/username/skillname` - Latest version
- `@user/username/skillname@2.0.0` - Specific version
- `@user/username/skillname@^2.0.0` - Semver range

**GitHub specifier formats:**
- `github:owner/repo` - Entire repository (default branch)
- `github:owner/repo@main` - Entire repository (specific branch/tag)
- `github:owner/repo/path/to/skill` - Subdirectory within repo
- `github:owner/repo/path/to/skill@v1.0.0` - Subdirectory with tag

**Agent symlink options:**
```bash
pspm add <specifier> --agent claude-code,cursor  # Link to multiple agents
pspm install --agent none                        # Skip symlink creation
pspm link --agent codex                          # Recreate symlinks for specific agent
```

Default is all agents (`claude-code`, `codex`, `cursor`, `gemini`, `kiro`, `opencode`). Use `--agent claude-code` to install for a single agent.

### Publishing

```bash
pspm publish                  # Publish current directory as a skill
pspm publish --bump patch     # Auto-bump version (major, minor, patch)
pspm publish --access public  # Publish and make public in one step
pspm unpublish <spec> --force # Remove a published skill version
```

### Visibility

```bash
pspm access --public          # Make current package public
pspm access <spec> --public   # Make specific package public
```

**Note:** Making a package public is irreversible (like npm). Public packages cannot be made private again.

**Publish Output:**

When publishing, PSPM displays detailed package information similar to npm:

```
pspm notice
pspm notice 📦  my-skill@1.0.0
pspm notice Tarball Contents
pspm notice   5.1kB SKILL.md
pspm notice   1.5kB package.json
pspm notice Tarball Details
pspm notice name:          my-skill
pspm notice version:       1.0.0
pspm notice filename:      my-skill-1.0.0.tgz
pspm notice package size:  2.3kB
pspm notice unpacked size: 6.6kB
pspm notice shasum:        4bb744fcfa90b8b033feed3deaeeb00f3a4503e5
pspm notice integrity:     sha512-DqQJaugblfE5A...
pspm notice total files:   2
pspm notice
pspm notice Publishing to https://pspm.dev with tag latest
+ @user/username/my-skill@1.0.0
Checksum: abc123...
```

### Configuration

```bash
pspm config show              # Show resolved configuration
pspm config init              # Create .pspmrc in current directory
```

## Configuration

PSPM uses a simple npm-like INI configuration format.

### User Config (`~/.pspmrc`)

```ini
; PSPM Configuration
registry = https://pspm.dev
authToken = sk_...
username = myuser

; Multi-registry: Scope mappings
@myorg:registry = https://corp.pspm.io

; Multi-registry: Per-registry tokens
//pspm.dev:authToken = sk_public_token
//corp.pspm.io:authToken = sk_corp_token
```

### Project Config (`.pspmrc`)

Project-specific configuration (optional):

```ini
; Project-specific PSPM configuration
registry = https://custom-registry.example.com
```

### Lockfile (`pspm-lock.json`)

```json
{
  "lockfileVersion": 3,
  "registryUrl": "https://pspm.dev",
  "packages": {
    "@user/username/skillname": {
      "version": "1.0.0",
      "resolved": "https://pspm.dev/...",
      "integrity": "sha256-..."
    }
  },
  "githubPackages": {
    "github:owner/repo/path": {
      "version": "abc1234",
      "resolved": "https://github.com/owner/repo",
      "integrity": "sha256-...",
      "gitCommit": "abc1234567890...",
      "gitRef": "main"
    }
  }
}
```

### Configuration Resolution

Configuration is resolved in priority order:

1. **Environment Variables** (`PSPM_REGISTRY_URL`, `PSPM_API_KEY`) - Highest
2. **Project Config** (`.pspmrc` in project directory)
3. **User Config** (`~/.pspmrc`)
4. **Defaults** - Lowest

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PSPM_REGISTRY_URL` | Override registry URL |
| `PSPM_API_KEY` | Override API key |
| `PSPM_DEBUG` | Enable debug logging |
| `GITHUB_TOKEN` | GitHub token for private repos and higher rate limits |

## Error Handling

PSPM provides clear, actionable error messages:

**Version Conflict:**
```
pspm error code E403
pspm error 403 403 Forbidden - You cannot publish over the previously published versions: 1.0.0.
Error: [BAD_REQUEST] Version 1.0.0 must be greater than existing version 1.0.0
```

**Validation Errors:**
```
Error: Validation failed:
  - name: Skill name must start with a letter and contain only lowercase letters, numbers, and hyphens
  - version: Invalid semver version
```

**Authentication Errors:**
```
Error: Not logged in. Run 'pspm login --api-key <key>' first, or set PSPM_API_KEY env var.
```

## Directory Structure

```
project/
├── .pspmrc              # Project config (optional)
├── pspm.json            # Manifest with dependencies
├── pspm-lock.json       # Lockfile
├── .pspm/
│   ├── skills/          # Installed skills
│   │   ├── username/    # Registry skills
│   │   │   └── skillname/
│   │   │       └── SKILL.md
│   │   └── _github/     # GitHub skills
│   │       └── owner/
│   │           └── repo/
│   │               └── path/
│   │                   └── SKILL.md
│   └── cache/           # Tarball cache
├── .claude/
│   └── skills/          # Symlinks for claude-code agent
│       ├── skillname -> ../../.pspm/skills/username/skillname
│       └── repo -> ../../.pspm/skills/_github/owner/repo
└── .cursor/
    └── skills/          # Symlinks for cursor agent (if configured)

~/
└── .pspmrc              # User config
```

## Creating a Skill

A skill is a directory containing at minimum a `package.json` and `SKILL.md`:

```
my-skill/
├── package.json         # Required: name, version
├── SKILL.md             # Required: skill instructions
├── runtime/             # Optional: runtime files
├── scripts/             # Optional: scripts
└── data/                # Optional: data files
```

**package.json:**
```json
{
  "name": "@user/myusername/my-skill",
  "version": "1.0.0",
  "description": "A helpful skill for...",
  "files": ["package.json", "SKILL.md", "runtime", "scripts", "data"]
}
```

**SKILL.md:**
```markdown
---
name: my-skill
description: A helpful skill that does X
---

# Instructions

When activated, this skill helps you...
```

## CI/CD Integration

```bash
# Use environment variables
export PSPM_API_KEY=sk_ci_key
export PSPM_REGISTRY_URL=https://registry.example.com/api/skills

# Install with frozen lockfile (fails if lockfile is outdated)
pspm install --frozen-lockfile
```

## Using Different Registries

Use environment variables to switch between registries:

```bash
# Development
PSPM_REGISTRY_URL=https://staging.example.com pspm add @user/bsheng/skill

# Production
PSPM_REGISTRY_URL=https://prod.example.com pspm publish
```

Or set the registry in your project's `.pspmrc`:

```ini
; .pspmrc
registry = https://custom-registry.example.com
```

## License

This project is licensed under [The Artistic License 2.0](LICENSE), the same license used by npm.
