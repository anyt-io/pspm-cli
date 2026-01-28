# PSPM - Prompt Skill Package Manager

A CLI for managing prompt skills across AI coding agents.

**Website:** [https://pspm.dev](https://pspm.dev)

## What is PSPM?

PSPM (Prompt Skill Package Manager) is a package manager for prompt skills - small, discoverable capabilities packaged as `SKILL.md` files. Think of it as npm for AI agent skills.

Skills are designed to work with any AI coding agent that supports the SKILL.md format, including Claude Code, Cursor, Windsurf, and others.

## Why PSPM?

**Easy Sharing** - Share your prompt skills with teammates or the community. Publish to the registry and let others install with a single command.

**Version Control** - Full semver support just like npm. Pin exact versions, use ranges (`^1.0.0`, `~1.2.0`), or reference GitHub tags directly. Lock versions with `pspm-lock.json` for reproducible installations.

**Public & Private Skills** - Keep proprietary skills private within your organization, or publish them publicly for anyone to use. Private skills require authentication to download.

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
pspm login

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

### Authentication

```bash
pspm login --api-key <key>    # Authenticate with API key
pspm login                    # Authenticate via browser
pspm logout                   # Clear stored credentials
pspm whoami                   # Show current user info
```

### Project Initialization

```bash
pspm init                     # Create pspm.json manifest (interactive)
pspm init -y                  # Create pspm.json with defaults
pspm migrate                  # Migrate from old directory structure
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

**Local specifier formats:**
- `file:../my-skill` - Relative path (symlinked, not copied)
- `file:/absolute/path/to/skill` - Absolute path
- `../my-skill` - Auto-detected as `file:../my-skill`

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
pspm deprecate <spec> [msg]   # Mark a version as deprecated
```

### Visibility

```bash
pspm access --public          # Make current package public
pspm access <spec> --public   # Make specific package public
```

**Note:** Making a package public is irreversible (like npm). Public packages cannot be made private again.

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
  "lockfileVersion": 5,
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
  },
  "localPackages": {
    "file:../my-skill": {
      "version": "local",
      "path": "../my-skill",
      "resolvedPath": "/absolute/path/to/my-skill",
      "name": "my-skill"
    }
  }
}
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PSPM_API_KEY` | Override API key |
| `PSPM_DEBUG` | Enable debug logging |
| `GITHUB_TOKEN` | GitHub token for private repos and higher rate limits |

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
│   │   ├── _github/     # GitHub skills
│   │   │   └── owner/
│   │   │       └── repo/
│   │   │           └── path/
│   │   │               └── SKILL.md
│   │   └── _local/      # Local skills (symlinks)
│   │       └── my-skill -> /absolute/path/to/my-skill
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

A skill is a directory containing at minimum a `pspm.json` and `SKILL.md`:

```
my-skill/
├── pspm.json            # Required: name, version
├── SKILL.md             # Required: skill instructions
├── runtime/             # Optional: runtime files
├── scripts/             # Optional: scripts
└── data/                # Optional: data files
```

**pspm.json** (created with `pspm init`):
```json
{
  "name": "@user/myusername/my-skill",
  "version": "1.0.0",
  "description": "A helpful skill for...",
  "files": ["pspm.json", "SKILL.md", "runtime", "scripts", "data"]
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
# Use environment variable for authentication
export PSPM_API_KEY=sk_ci_key

# Install with frozen lockfile (fails if lockfile is outdated)
pspm install --frozen-lockfile
```

## License

This project is licensed under [The Artistic License 2.0](LICENSE), the same license used by npm.
