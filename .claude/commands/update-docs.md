# Update Documentation

Update project documentation based on recent code changes.

## Arguments

$ARGUMENTS

## Instructions

You are updating the documentation for the pspm-cli project. Follow these steps:

### Step 1: Analyze Recent Changes

1. Check for uncommitted changes:
   ```bash
   git status --porcelain
   ```

2. Get recent commits since last documentation update:
   ```bash
   git log --oneline -10
   ```

3. Review what has changed in the source code:
   ```bash
   git diff HEAD~5..HEAD --stat -- src/
   ```

### Step 2: Update CLAUDE.md

Read and update `/CLAUDE.md`:

1. **Development Commands**: Ensure all scripts from package.json are documented
2. **Architecture**: Update if new modules were added or existing ones reorganized
3. **Key Patterns**: Update if implementation patterns changed

Keep the documentation concise and focused on what an AI assistant needs to know.

### Step 3: Update README.md (if needed)

Check if README.md needs updates:

1. **Installation**: Ensure installation instructions are current
2. **Usage**: Update command examples if CLI changed
3. **Features**: Add any new features

Only update if there are actual changes to document.

### Step 4: Update CLI_GUIDE.md (if needed)

If CLI commands or options changed:

1. Update command documentation
2. Update examples
3. Keep formatting consistent

### Step 5: Show Summary

Display what was updated:
- List of files updated
- Brief description of changes made
- Any areas that need manual review

## Notes

- Keep documentation accurate and up-to-date
- Don't add documentation for things that haven't been implemented
- Preserve existing accurate documentation
- Focus on user-facing changes for README.md
- Focus on implementation details for CLAUDE.md
