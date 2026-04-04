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

## Backend API (separate from frontend)

A separate Node API MVP still exists under `src/` and can be started with:

```bash
npm start
```

## Branch protection guidance

To prevent regressions, configure your default branch protection rule to require status checks from **both** CI jobs before merge:

- `backend`
- `frontend`

In GitHub: **Settings → Branches → Branch protection rules → Require status checks to pass before merging**, then select both checks.
