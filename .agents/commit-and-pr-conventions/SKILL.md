---
name: commit-and-pr-conventions
description: Follow the adopted commit and pull-request conventions. Use whenever creating a commit or opening, editing, reviewing, or preparing to squash-merge a PR, including requests to commit, push, or open a PR.
---

Treat the PR title and initial body as the exact commit message that squash-and-merge will land.

## Commit message

- Follow Conventional Commits: `<type>[optional scope][!]: <description>`.
- Separate subject, body, and footers with blank lines.
- For standalone commits, wrap body lines at 72 characters. Explain why the change was needed, how it solves it, and material side effects.
- Add applicable Conventional Commit footers and `Co-authored-by: Name <email>` trailers for collaborators.
- Choose the type by the affected surface, not by whether the change fixes a defect.
- Use `ci` for CI, workflow, and automation changes, including fixes to that automation.
- Use `fix` for product or runtime bugs and non-feature changes to externally consumed public API boundaries.
- Use `feat` for features, `build` for build or dependencies, `chore` for non-product tools or configuration, `docs` for documentation only, `style` for non-semantic edits, `refactor` for internal restructuring, `test` for tests.
- Mark breaking changes with `!` or a `BREAKING CHANGE` footer without changing an otherwise accurate type.
- Keep every non-squashed development commit coherent and conventional.

```text
test(e2e): set up E2E infrastructure

Run E2E tests in a real Obsidian instance using
`obsidian-integration-testing`. Add a test vault and the first test
for checking hashtag click behavior.
```

```text
ci: add E2E test workflow
```

## Commit scope

Use one of the following scopes when creating a commit message/PR title:

- `tagger`: the tagger UI and its logic.
- `gallery`: the gallery UI and its logic - photos rendering and styles.
- `code-block`: the code block functionality - photos selection, parsing, grouping.
- `agents`: agent instructions and reusable skills.

Never combine scopes or invent a catch-all scope; explain secondary effects in the body.
Do not use types or cross-cutting aspects as scopes.
Use no scope for genuinely repository-wide changes.

## Pull request

- Set the title to the intended squash commit subject exactly.
- Set the initial body to the intended squash commit body and footers exactly. Exclude PR-only preambles, checklists, and implementation journals.
- Do not manually wrap the PR body; GitHub handles display wrapping.
- Keep permanent history concise: record motivation, material behavior, and side effects.
- Put experiments, alternatives, extensive validation, and implementation chronology in follow-up comments.
- Post a follow-up comment with the lines changed, split at least into production code (what ships to users), tests, and other files, with CI, build scripts, and developer tooling counted as other files, so a reviewer sees where the change's weight lies before reading it; how to count and present them is yours, and refresh it when the diff changes materially.
- Update the title and initial body as the implementation evolves.
- Before opening, updating, or merging, read `title + blank line + body` as one commit message and correct any mismatch.
