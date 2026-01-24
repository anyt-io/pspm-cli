# PSPM CLI Guide

PSPM (Prompt Skill Package Manager) is a CLI tool for managing prompt skills across AI coding agents. It provides commands for authentication, configuration, skill management, and publishing.

## Installation

```bash
# Install globally
npm install -g @anytio/pspm

# Or use with npx
npx @anytio/pspm <command>
```

## Options

```bash
pspm [command] [options]

Options:
  -v, --version          Show version
  -h, --help             Show help
```

## Authentication

### Login

Authenticate with an API key:

```bash
pspm login --api-key <key>
```

Or use browser-based OAuth:

```bash
pspm login
```

### Logout

Remove stored credentials:

```bash
pspm logout
```

### Who Am I

Display current user information:

```bash
pspm whoami

# Output:
#   Username: myuser
#   User ID: user_123
#   Registry: https://pspm.dev
```

## Configuration

### Show Configuration

Display resolved configuration and config file locations:

```bash
pspm config show

# Output:
#   Resolved Configuration:
#
#     Registry URL:   https://pspm.dev
#     API Key:        ***
#     Username:       myuser
#
#   Config Locations:
#     User config:    /Users/you/.pspmrc
#     Project config: (none)
#
#   Environment Variables:
#     PSPM_REGISTRY_URL: (not set)
#     PSPM_API_KEY:      (not set)
```

### Initialize Project Config

Create a `.pspmrc` file in the current directory:

```bash
pspm config init
pspm config init --registry https://custom.example.com
```

## Skill Management

### Add Skill

Add a skill to the project and install it:

```bash
pspm add <specifier> [--agent <agents>]

# Registry specifier formats:
pspm add @user/bsheng/vite_slides           # Latest version
pspm add @user/bsheng/vite_slides@2.0.0     # Specific version
pspm add @user/bsheng/vite_slides@^2.0.0    # Semver range

# GitHub specifier formats:
pspm add github:owner/repo                  # Entire repo, default branch
pspm add github:owner/repo@main             # Entire repo, specific branch
pspm add github:owner/repo/path/to/skill    # Subdirectory, default branch
pspm add github:owner/repo/path@v1.0.0      # Subdirectory with tag/ref

# Agent options:
pspm add @user/skill --agent claude-code,cursor  # Link to multiple agents
pspm add github:owner/repo --agent none          # Skip symlink creation
```

### Remove Skill

```bash
pspm remove <name>
pspm rm <name>

# Examples:
pspm remove vite_slides
pspm rm @user/bsheng/vite_slides
```

### List Skills

```bash
pspm list
pspm ls

# JSON output for scripting
pspm list --json

# Example output:
# Installed skills:
#
#   @user/alice/code-review@1.2.0 (registry)
#     -> .claude/skills/code-review
#
#   github:owner/repo/skills/react-tips (main@abc1234)
#     -> .claude/skills/react-tips, .cursor/skills/react-tips
#
# Total: 2 skill(s) (1 registry, 1 github)
```

### Install Skills

Install all skills from the lockfile:

```bash
pspm install
pspm install --frozen-lockfile    # CI/CD mode - fail if lockfile missing
pspm install --dir ./vendor/skills
pspm install --agent claude-code,cursor  # Link to multiple agents
pspm install --agent none                # Skip symlink creation
```

### Link Skills

Recreate agent symlinks without reinstalling (useful after adding agents):

```bash
pspm link
pspm link --agent claude-code,cursor  # Link to specific agents
```

### Update Skills

```bash
pspm update
pspm update --dry-run    # Preview updates without applying
```

## Publishing

### Publish Skill

Publish the current directory as a skill:

```bash
pspm publish
pspm publish --bump patch    # Auto-bump version (major, minor, patch)
pspm publish --bump minor --tag beta
pspm publish --access public # Publish and make public in one step
```

**Required `package.json` fields:**
- `name` - Skill name (e.g., `@user/username/skillname`)
- `version` - Semver version

**Optional `package.json` fields:**
- `files` - Files to include (default: `["package.json", "SKILL.md", "runtime", "scripts", "data"]`)

### Unpublish Skill

```bash
pspm unpublish <specifier> --force

# Delete specific version
pspm unpublish @user/bsheng/vite_slides@2.0.0 --force

# Delete all versions
pspm unpublish @user/bsheng/vite_slides --force
```

## Visibility

### Change Package Visibility

Change a package's visibility between public and private:

```bash
# Make current package public
pspm access --public

# Make specific package public
pspm access @user/bsheng/vite_slides --public
```

**Important:** Making a package public is irreversible (following npm conventions). Public packages cannot be made private again.

- **Private packages** (default): Require authentication to download
- **Public packages**: Anyone can download without authentication

## Configuration Files

### User Config: `~/.pspmrc`

INI format configuration file:

```ini
; PSPM Configuration

registry = https://pspm.dev
authToken = sk_...
username = myuser

; Multi-registry: Scope mappings (optional)
@myorg:registry = https://corp.pspm.io

; Multi-registry: Per-registry tokens (optional)
//pspm.dev:authToken = sk_public_token
//corp.pspm.io:authToken = sk_corp_token
```

### Project Config: `.pspmrc`

Project-specific configuration (optional):

```ini
; Project-specific PSPM configuration

registry = https://custom.example.com
```

### Lockfile: `pspm-lock.json`

```json
{
  "lockfileVersion": 3,
  "registryUrl": "https://pspm.dev",
  "packages": {
    "@user/bsheng/vite_slides": {
      "version": "2.0.0",
      "resolved": "https://pspm.dev/...",
      "integrity": "sha256-abc123..."
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

## Configuration Resolution

Configuration is resolved in priority order:

1. **Environment Variables** (`PSPM_REGISTRY_URL`, `PSPM_API_KEY`) - Highest
2. **Project Config** (`.pspmrc` in project directory)
3. **User Config** (`~/.pspmrc`)
4. **Defaults** - Lowest

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `PSPM_REGISTRY_URL` | Override registry URL |
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
│   │   ├── {username}/  # Registry skills
│   │   │   └── {skillname}/
│   │   └── _github/     # GitHub skills
│   │       └── {owner}/
│   │           └── {repo}/
│   │               └── {path}/
│   └── cache/           # Tarball cache
├── .claude/
│   └── skills/          # Symlinks for claude-code agent
└── .cursor/
    └── skills/          # Symlinks for cursor agent (if configured)

~/
└── .pspmrc              # User config
```

## Common Workflows

### CI/CD Integration

```bash
# Use environment variables
export PSPM_API_KEY=sk_ci_key
export PSPM_REGISTRY_URL=https://registry.company.com

pspm install --frozen-lockfile
```

### Using Different Registries

```bash
# Override registry for a single command
PSPM_REGISTRY_URL=https://staging.example.com pspm add @user/bsheng/skill

# Or set in project config
echo "registry = https://staging.example.com" >> .pspmrc
```

### Publishing Workflow

```bash
# Edit package.json with name and version
# Then publish with auto-bump
pspm publish --bump patch
```

## Troubleshooting

| Error | Solution |
|-------|----------|
| "Not logged in" | Run `pspm login --api-key <key>` |
| "Invalid skill specifier" | Use format: `@user/{username}/{name}[@version]` |
| "No lockfile found" | Run `pspm add <specifier>` first |

Enable debug mode for detailed output:

```bash
PSPM_DEBUG=1 pspm <command>
```

## Migration from v0.0.3

If you have an existing `~/.pspm/config.json` from v0.0.3 or earlier, PSPM will automatically migrate your configuration to the new `~/.pspmrc` INI format on first run.

The migration will:
1. Extract credentials from your default profile
2. Create a new `~/.pspmrc` file
3. Remove the old `~/.pspm/config.json`

If you were using multiple profiles, only the default profile is migrated. Use environment variables (`PSPM_REGISTRY_URL`, `PSPM_API_KEY`) to switch between registries.
