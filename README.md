# Roleplaying Event and Connection System

This repository contains the early implementation and documentation for the Living Campaign Engine: a roleplaying campaign tool with a Next.js frontend, a separate Node API MVP, and supporting design docs for concept, UI, and architecture.

## Start Here

- The production frontend lives in `web/src/app` and uses the Next.js App Router.
- Canonical frontend scripts live in `web/package.json`.
- The repository root `index.html` and `app.js` files are archived prototype files and should not be used for active frontend development.
- The backend MVP API lives under `src/`.

## Documentation

- `README.md`: repo entry point, run commands, testing, and contributor-facing setup notes.
- `CONCEPT_DOCUMENTATION.md`: product and domain model for threads, patterns, cloth, and living campaign behavior.
- `ARCHITECTURE.md`: technical architecture, boundaries, stack choices, and data model direction.
- `MVP_UI_DOCUMENTATION.md`: MVP screens, workflows, and visibility behavior.
- `CONTRIBUTING.md`: PR expectations, CI requirements, and coverage policy reminders.

## Quick Start

### VS Code MVP Flow

If you want to try the MVP locally in VS Code:

1. Make sure Node.js `20+` is installed.
2. Run `node -v` and `npm -v` in a VS Code terminal to confirm both commands are available.
3. Open the repository folder in VS Code.
4. Open two terminals.
5. In terminal 1, run `npm start` to launch the backend API on `http://localhost:3001`.
6. In terminal 2, run `npm --prefix web install` once if you have not installed frontend dependencies yet.
7. In terminal 2, run `npm --prefix web run dev` to launch the frontend on `http://localhost:3000`.
8. Open `http://localhost:3000/login`.

If VS Code says `npm` is not recognized, install the current Node.js LTS release and restart VS Code so the updated PATH is loaded.

If Windows PowerShell blocks `npm` with an execution-policy error for `npm.ps1`, use `npm.cmd` instead. The included VS Code tasks already use `npm.cmd`.

You can also use the included VS Code tasks:

- `Terminal` -> `Run Task...` -> `MVP: Run frontend + backend`
- Or run `Backend: MVP API` and `Frontend: Next dev` separately

For tests in VS Code, use `Terminal` -> `Run Task...` and pick one of:

- `Backend: Test unit`
- `Backend: Test integration (node)`
- `Backend: Test integration (gherkin)`
- `Backend: Test contract`
- `Backend: Test behavior`
- `Backend: Test all`
- `Frontend: Test unit`
- `Frontend: Test`
- `Tests: All`

`Tasks: Run Test Task` will use `Tests: All` as the default workspace test task.

Demo login accounts:

- `Adminplayer` / `1234`
- `Admingm` / `1234`
- `Admingmhelper` / `1234`

After signing in, the MVP pages are:

- `/project`
- `/threads`
- `/timeline`

### Frontend

Run frontend commands from the repository root with `--prefix web`:

```bash
npm --prefix web install
npm --prefix web run dev
npm --prefix web run build
npm --prefix web run start
npm --prefix web run test
```

### Backend

Start the separate Node API MVP with:

```bash
npm start
```

By default the backend listens on `http://localhost:3001` so it matches the frontend API configuration in `web/src/lib/api.ts`.

## Frontend Notes

The canonical frontend lives in `web/src/app/**`.

- Use `npm --prefix web run dev` for local frontend development.
- Use `npm --prefix web run build` for production build validation.
- Do not run frontend development from the root static prototype files.

The canonical frontend CI check is:

```bash
npm --prefix web run test
```

It currently runs:

- `npm --prefix web run lint`
- `npm --prefix web run typecheck`
- `npm --prefix web run test:unit`

## Backend API

The repository still includes a separate backend MVP focused on projects, memberships, invites, and role-based visibility behavior.

### Discoverable Endpoints

- `GET /projects`: list projects available to the authenticated role.
- `GET /memberships?project_id=<id>&user_id=<id>`: list memberships, with optional filtering.
- `POST /invites`: create an invite using `{ project_id, email, role }`.
- `POST /projects/:projectId/memberships`: create project-scoped memberships.
- `POST /projects/:projectId/invites`: create project-scoped invites.

Role expectations enforced in tests:

- Invite writes allow `GM` and `HELPER`.
- Invite writes deny `PLAYER`.

## Testing

### Backend Test Layers

- Unit tests: `tests/unit/**/*.test.js`
  Command: `npm run test:unit`
- Integration tests: `tests/integration/**/*.test.js`
  Command: `npm run test:integration:node`
- Gherkin integration scenarios: `tests/integration/features/*.feature`
  Command: `npm run test:integration:gherkin`
- Full integration suite:
  Command: `npm run test:integration`
- Contract tests: `tests/contract/**/*.test.js`
  Command: `npm run test:contract`
- Behavior tests: `tests/behavior/**`
  Command: `npm run test:behavior`

Run the full backend test sequence with:

```bash
npm test
```

That runs:

1. `npm run test:unit`
2. `npm run test:integration`
3. `npm run test:contract`
4. `npm run test:behavior`

For smoke-only behavior coverage, including invite flow smoke scenarios:

```bash
npm run test:behavior:smoke
```

## Coverage

Coverage is enforced in CI for both backend and frontend.

### Backend Coverage

Run locally:

```bash
npm run test:coverage
```

This command:

- Prints a concise backend coverage summary in logs.
- Emits raw V8 coverage artifacts under `artifacts/backend/v8-coverage`.
- Enforces thresholds from `coverage-thresholds.json` for global backend coverage.
- Enforces thresholds for key files including `src/api/createServer.js` and `src/visibility/filterThreadForRole.js`.

### Frontend Coverage

Run locally:

```bash
npm --prefix web run test:coverage
```

This command:

- Runs Vitest with V8 coverage.
- Generates reports under `artifacts/frontend/coverage`.
- Enforces global and key-file thresholds from `coverage-thresholds.json`.

### Coverage Ratchet Policy

Coverage thresholds may stay the same or increase, but must not be lowered without explicit approval.

Run locally:

```bash
npm run coverage:ratchet
```

The ratchet check compares `coverage-thresholds.json` against the baseline used for the current environment:

- PR base branch in CI
- Previous commit locally

Any decrease fails unless explicit approval is recorded by setting:

```bash
COVERAGE_THRESHOLD_REDUCTION_APPROVED=true
```

## Branch Protection Guidance

Configure the default branch protection rule to require both CI jobs before merge:

- `backend`
- `frontend`

The repository also publishes a `merge-readiness` job that only passes if both checks succeed, but branch protection should still explicitly require `backend` and `frontend`.
