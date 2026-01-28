# Changelog

All notable changes to the PSPM CLI will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-01-27

### Added

- **Local directory support**: Install skills directly from local directories using the `file:` protocol
  - `pspm add file:../my-skill` - Install from relative path
  - `pspm add file:/absolute/path/to/skill` - Install from absolute path
  - `pspm add ../my-skill` - Auto-detected as `file:../my-skill`
  - Local packages are symlinked (not copied) for instant updates during development
  - `localDependencies` section in `pspm.json`
  - `localPackages` section in lockfile (version 5)
  - Local packages stored as symlinks in `.pspm/skills/_local/{name}/`

- **Enhanced `list` command**: Shows local packages with `[local]` indicator and path

### Changed

- Lockfile version bumped to 5 to support `localPackages`
- `install` command now processes local dependencies (Phase 2.5 resolve, Phase 4.5 install)
- `remove` command now handles local package removal

## [0.2.0] - 2026-01-23

### Changed

- **License changed to The Artistic License 2.0** - Same license used by npm, providing a balance between open source availability and artistic control
- **Version reset to 0.2.0** - First public open source release

## [0.1.1] - 2026-01-23

### Added

- **Multiple package support for `add` command**: Install multiple packages in a single command
  - `pspm add pkg1 pkg2 pkg3` - Add multiple packages at once
  - Continues with remaining packages if one fails
  - Shows summary of successes/failures when adding multiple packages

- **Multiple package support for `install` command**: npm-like behavior
  - `pspm install pkg1 pkg2` - Add and install specific packages (delegates to `add`)
  - `pspm install` (no args) - Install from lockfile (original behavior)
  - Mirrors npm's install command behavior

### Changed

- **Validation before agent selection**: Packages are now validated before prompting for agent selection
  - Resolves and validates all packages first
  - Only prompts for agents after validation succeeds
  - Prevents wasted time selecting agents for non-existent packages

- **Default agents changed to all agents**: When using `-y` flag or defaults
  - Previously defaulted to `claude-code` only
  - Now defaults to all built-in agents: `claude-code`, `codex`, `cursor`, `gemini`, `kiro`, `opencode`
  - Use `--agent claude-code` to install for a single agent

## [0.1.0] - 2026-01-23

### Added

- **GitHub dependencies**: Install skills directly from GitHub repositories
  - `pspm add github:owner/repo` - Install entire repository
  - `pspm add github:owner/repo/path` - Install specific subdirectory
  - `pspm add github:owner/repo@ref` - Pin to branch, tag, or commit
  - GitHub packages stored in `.pspm/skills/_github/{owner}/{repo}/`
  - `githubDependencies` section in `pspm.json`
  - `githubPackages` section in lockfile (version 3)

- **Multi-agent symlink support**: Link skills to multiple AI agent configurations
  - `--agent` flag on `add`, `install`, and `link` commands
  - Default agents: `claude-code` (`.claude/skills/`), `cursor` (`.cursor/skills/`), `codex` (`.codex/skills/`)
  - Custom agent configurations in `pspm.json` under `agents` field
  - Relative symlinks for portability across machines
  - `--agent none` to skip symlink creation

- **New `link` command**: Recreate agent symlinks without reinstalling
  - `pspm link` - Recreate symlinks for all installed skills
  - `pspm link --agent claude-code,cursor` - Link to specific agents

- **Enhanced `list` command**: Shows source type and linked agents
  - Displays whether skill is from registry or GitHub
  - Shows which agents have symlinks to each skill

### Changed

- Lockfile version bumped to 3 to support `githubPackages`
- `install` command now processes both registry and GitHub dependencies
- `remove` command now cleans up symlinks from all configured agents

## [0.0.7] - 2026-01-23

### Added

- **Public packages support**: Packages can now be made public, allowing anyone to download without authentication
  - New `pspm access` command to change package visibility
  - `--access` flag on `pspm publish` to set visibility during publish
  - Public packages can be installed without authentication
  - Visibility change is one-way: public packages cannot be made private again (npm-style)

- **Multi-registry authentication**: npm-style configuration for multiple registries
  - Scope-to-registry mappings: `@myorg:registry = https://corp.pspm.io`
  - Per-registry auth tokens: `//pspm.dev:authToken = sk_xxx`
  - Automatic token selection based on registry URL

- **Auth-optional downloads**: `pspm add` and `pspm install` no longer require authentication for public packages
  - Private packages still require authentication
  - Clear error messages when authentication is needed

### Changed

- Configuration format extended to support multi-registry authentication
- SDK `apiKey` is now optional to support public package downloads
- Directory structure changed: skills now installed to `.pspm/skills/` (previously `.skills/`)
- Lockfile path changed to `pspm-lock.json` (previously `skill-lock.json`)

## [0.0.6] - 2026-01-22

### Changed

- Fixed presigned R2 download URLs to skip auth headers
- Use versionInfo.downloadUrl instead of manual URL construction

## [0.0.5] - 2026-01-22

### Changed

- **BREAKING: Simplified configuration to npm-like INI format**
  - Config file moved from `~/.pspm/config.json` to `~/.pspmrc`
  - Uses INI format (like `.npmrc`) instead of JSON
  - Automatic migration from old config on first run
  - Project config `.pspmrc` now uses INI format

- **BREAKING: Removed profile system**
  - Removed commands: `config list`, `config add`, `config use`, `config set`, `config delete`
  - Removed `--profile` global flag
  - Removed `PSPM_PROFILE` environment variable
  - Use `PSPM_REGISTRY_URL` and `PSPM_API_KEY` env vars to switch registries

### Simplified Config Format

**Before (v0.0.4):**
```json
{
  "version": 2,
  "defaultProfile": "default",
  "profiles": {
    "default": {
      "registryUrl": "https://pspm.dev",
      "apiKey": "sk_...",
      "username": "myuser"
    }
  }
}
```

**After (v0.0.5):**
```ini
; PSPM Configuration
registry = https://pspm.dev
authToken = sk_...
username = myuser
```

### Migration

Existing users will have their config automatically migrated on first run. Only the default profile credentials are preserved. If you used multiple profiles, use environment variables instead:

```bash
# Instead of: pspm add --profile production
PSPM_REGISTRY_URL=https://prod.example.com pspm add @user/skill
```

## [0.0.4] - 2026-01-22

### Added

- **npm-style publish output**: Display detailed package information when publishing, including:
  - Package name and version
  - Tarball contents with file sizes
  - Tarball details (filename, package size, unpacked size, shasum, integrity hash, total files)
  - Publishing destination URL
- **Improved error messages**: npm-style E403 error codes for version conflicts

### Changed

- Publish output now uses `pspm notice` prefix for consistency with npm
- Success message format changed to `+ @user/username/skill@version`
- Default registry URL simplified from `https://pspm.dev/api/skills` to `https://pspm.dev`

## [0.0.3] - 2026-01-21

### Added

- Browser-based OAuth login flow with local callback server
- Support for CLI token exchange via `/api/api-keys/cli-token-exchange`
- Structured error handling with `extractApiErrorMessage` helper
- Debug mode via `PSPM_DEBUG` environment variable

### Fixed

- CLI URL duplication issue when registry URL already contains path
- Server error handling now uses `app.onError` for reliable error responses
- API error messages now properly extract and display validation details

### Changed

- Migrated from oRPC client to generated SDK using Orval
- Improved error message formatting for validation errors

## [0.0.2] - 2026-01-20

### Added

- Multi-profile configuration support
- Project-level `.pspmrc` configuration file
- Environment variable overrides (`PSPM_PROFILE`, `PSPM_REGISTRY_URL`, `PSPM_API_KEY`)
- `config` subcommands: `list`, `show`, `add`, `use`, `set`, `delete`, `init`
- Lockfile support with `skill-lock.json`
- `--frozen-lockfile` option for CI/CD environments
- `update` command for updating skills to latest compatible versions
- `unpublish` command for removing published skill versions

### Changed

- Configuration format updated to version 2 with profile support
- Skills now installed to `.skills/{username}/{name}/` directory structure

## [0.0.1] - 2026-01-19

### Added

- Initial release
- Core commands: `login`, `logout`, `whoami`
- Skill management: `add`, `remove`, `list`, `install`
- Publishing: `publish` with `--bump` option
- Basic configuration with `~/.pspm/config.json`
- Semver range support for skill specifiers
