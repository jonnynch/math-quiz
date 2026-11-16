
# GitHub Copilot Instructions

## Project overview
- This is a vanilla HTML, CSS and JavaScript maths quiz application.
- It is deployed on Cloudflare Workers.
- Read `AGENTS.md` before making changes.
- Read the relevant documents under `docs/` before modifying related features.

## Important development rules
- Preserve the existing architecture. Do not introduce frameworks, backend services or dependencies unless explicitly requested.
- Keep existing functionality and backward compatibility, especially localStorage data and saved profiles.
- Make only changes required by the task. Avoid unrelated refactoring.
- Follow existing coding style and naming conventions.
- Do not change production configuration or deploy the application.
- Never merge a pull request or push directly to the production branch.
- Work only on the current feature branch unless explicitly instructed otherwise.

## Testing restrictions — important
- NEVER run `npm test`.
- NEVER run `npm run test` or any command that triggers the complete test suite.
- Do not run the full test suite indirectly through another script, build command, or task.
- Do not run the full test suite even if you believe the changes require it.
- Full test execution is reserved for GitHub Actions CI.
- You may inspect test files and make appropriate test updates.
- You may run a specific targeted test only when it does not trigger the full suite and is relevant to the changes.
- If unsure whether a command triggers the full suite, do not run it. Ask first.
- Do not claim tests passed unless you actually ran them.

## Before finishing
- Review the Git diff for unintended changes.
- Check for accidental changes to unrelated files.
- Report files changed and explain the changes.
- Report any targeted tests actually run.
- Explicitly state that the full test suite was not run locally.
- Leave full test verification to GitHub Actions CI.
