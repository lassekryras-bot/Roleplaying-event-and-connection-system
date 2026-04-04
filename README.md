# Roleplaying Event and Connection System

## Frontend canonical location

The production frontend lives in **`/web/src/app`** (Next.js App Router).

- Canonical routes: `web/src/app/**`
- Deprecated/archived legacy routes: `archive/root-next-app/app/**`
- Deprecated/removed Vite entrypoint: `web/src/main.tsx` (removed)

## Canonical frontend commands

Run all frontend commands from the repository root using `--prefix web`:

```bash
npm --prefix web install
npm --prefix web run dev
npm --prefix web run build
npm --prefix web run start
npm --prefix web run test
```

`test` is the canonical CI check command for the frontend and currently runs:

- `npm --prefix web run lint`
- `npm --prefix web run typecheck`
- `npm --prefix web run test:unit`

## Backend API (separate from frontend)

A separate Node API MVP still exists under `src/` and can be started with:

```bash
npm start
```

## Backend test layers

Backend tests are split into three layers with dedicated commands:

- **Unit tests** (`tests/unit/**/*.test.js`): fast checks for isolated behavior.
  - Command: `npm run test:unit`
- **Integration tests** (`tests/integration/**/*.test.js`): endpoint and system-level checks across modules.
  - Command: `npm run test:integration`
- **Behavior tests** (`tests/behavior/**`): higher-level scenario coverage driven by behavior test scripts.
  - Command: `npm run test:behavior`

Use `npm test` to run all backend layers in deterministic order: unit → integration → behavior.

## Branch protection guidance

To prevent regressions, configure your default branch protection rule to require status checks from **both** CI jobs before merge:

- `backend`
- `frontend`

This repository also publishes a `merge-readiness` job that fails unless both checks passed, but branch protection should still explicitly require `backend` and `frontend` so both are visible and mandatory.

In GitHub: **Settings → Branches → Branch protection rules → Require status checks to pass before merging**, then select `backend` and `frontend` (and optionally `merge-readiness`).

## Coverage in CI and local development

Coverage is enforced for both stacks in CI, and CI fails when thresholds are missed.

### Backend (Node API)

Run locally:

```bash
npm run test:coverage
```

What this does:

- Prints a concise backend coverage summary in logs.
- Emits raw V8 coverage artifacts under `artifacts/backend/v8-coverage` for CI inspection.
- Enforces thresholds from `coverage-thresholds.json` for:
  - Global backend coverage.
  - Key files: `src/api/createServer.js` and `src/visibility/filterThreadForRole.js`.

If a threshold is missed, the command exits non-zero and prints each failed metric.

### Frontend (Next.js app)

Run locally:

```bash
npm --prefix web run test:coverage
```

What this does:

- Runs Vitest with V8 coverage.
- Generates reports under `artifacts/frontend/coverage` (`text-summary`, `json-summary`, and `lcov`).
- Enforces global thresholds and key-file thresholds (including `src/components/security/VisibilityGuard.tsx` and `src/app/page.tsx`) from `coverage-thresholds.json`.

### Ratcheting policy

Coverage thresholds are ratcheted: they can stay the same or increase, but must not be lowered without explicit approval.

Run locally:

```bash
npm run coverage:ratchet
```

Policy details:

- The ratchet check compares `coverage-thresholds.json` against the baseline (PR base branch in CI, previous commit locally).
- Any decrease fails CI unless explicit approval is provided by setting:
  - `COVERAGE_THRESHOLD_REDUCTION_APPROVED=true`

Contributors should treat threshold reductions as exceptional and document the reason in the PR when approved. **No coverage threshold decrease is allowed unless explicit approval is recorded in the PR.**
