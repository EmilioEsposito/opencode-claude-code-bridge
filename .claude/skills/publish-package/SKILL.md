---
name: publish-package
description: Use ONLY when preparing, testing, documenting, or verifying npm releases for this repo. Covers version bumps, trusted publishing via GitHub Actions OIDC, tag pushes, and post-publish checks.
---

# Publish this package

## Publishing model

- npm Trusted Publisher is configured on npmjs.com for this repo.
- Releases publish through `.github/workflows/publish.yml`.
- Publishing is triggered by pushing a `v*` git tag.
- Do **not** use local `npm publish` for real releases.
- Do **not** use `npm login` as part of the normal release flow.

## Local preflight

Run the same validation family the workflow uses:

```bash
npm run build --if-present
npm test --if-present
npm run check --if-present
npm run typecheck --if-present
```

If the repo has no validation scripts, at least verify the package contents:

```bash
npm pack --dry-run
```

## Release

```bash
npm version patch   # or minor / major
git push origin main
git push origin --follow-tags
```

`npm version` keeps `package.json`, the release commit, and the `v*` tag aligned.

## What the workflow verifies

- Node 24
- Bun installed (safe even for repos that do not use it)
- `npm ci` when `package-lock.json` exists
- `build`, `test`, `check`, and `typecheck` scripts when present
- tag version matches `package.json` version
- `npm publish` runs with GitHub OIDC credentials

## Post-publish verification

```bash
npm view opencode-claude-code-bridge version
gh run list --repo EmilioEsposito/opencode-claude-code-bridge --workflow publish.yml --limit 5
```

For a specific run:

```bash
gh run view --repo EmilioEsposito/opencode-claude-code-bridge <run-id>
```
