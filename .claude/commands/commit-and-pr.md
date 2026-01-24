# Commit and PR

Commit changes, fix any code quality issues, push to remote, and create a pull request.

## Arguments

$ARGUMENTS

## Instructions

1. Run code formatting to auto-fix issues:
   ```
   pnpm format
   ```

2. Run code quality checks (lint + format verification):
   ```
   pnpm check
   ```
   - If check fails with unfixable errors, stop and notify the user

3. Run TypeScript type checking:
   ```
   pnpm typecheck
   ```
   - If typecheck has errors:
     - For minor issues (1-3 errors): Fix them automatically
     - For major issues (4+ errors or complex problems): Stop and notify the user with a summary of the issues

4. Run tests:
   ```
   pnpm test
   ```
   - If tests fail, stop and notify the user with a summary of failures

5. Stage all changes (including any auto-fixed files):
   ```
   git add -A
   ```

6. Review what will be committed:
   ```
   git status
   git diff --cached --stat
   ```

7. Create a commit:
   - If $ARGUMENTS provided, use it as the commit message
   - If no arguments, analyze the staged changes and generate an appropriate commit message
   - Follow conventional commit format (feat:, fix:, chore:, docs:, refactor:, test:, etc.)

8. Push to remote with upstream tracking:
   ```
   git push -u origin HEAD
   ```

9. Create a pull request using GitHub CLI:
   ```
   gh pr create --fill
   ```
   - If the push or PR creation fails, notify the user with the error

10. Show the PR URL to the user
