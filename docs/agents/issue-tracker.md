# Issue tracker: GitHub

Issues and PRDs live in GitHub Issues for
`lemonicefate/entexplainpage`. Use `gh` for operations.

## Conventions

- Create, read, comment, label and close issues with `gh issue`.
- Infer the repository from `git remote`.
- PRs are not treated as a triage request surface.
- When a skill says “publish to the issue tracker”, create a GitHub issue.
- When a skill says “fetch the relevant ticket”, read the full issue body,
  comments and labels.

## Blocking relationships

Use GitHub native issue dependencies when available. Create blocker issues
first, then link dependent issues with the GitHub issue dependencies endpoint.

If native dependencies are unavailable, place a `Blocked by: #...` line in
the dependent issue body.

A ticket is ready only when all blockers are closed.
