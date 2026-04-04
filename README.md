# Roleplaying-event-and-connection-system

MVP client implementation includes:

- loading skeletons for threads list, thread detail, and timeline board
- optimistic navigation transition state between primary routes
- centralized fetch wrapper with retry + shared network error handling
- toast notification helpers for failed calls, successful refreshes, and role switches
- client-side performance marks for initial page load and route transitions (logged in MVP mode)

## Added source files

- `src/App.tsx`
- `src/lib/fetchClient.ts`
- `src/lib/navigation.ts`
- `src/lib/performance.ts`
- `src/lib/toast.ts`
- `src/features/threads/ThreadsListPage.tsx`
- `src/features/threads/ThreadDetailPage.tsx`
- `src/features/timeline/TimelineBoardPage.tsx`
## MVP you can run now

This repository now includes a runnable MVP HTTP API for the Living Campaign Engine.

### 1) Start the API

```bash
npm start
```

Server default:
- `http://localhost:3000`

### 2) Try the endpoints

Health:

```bash
curl http://localhost:3000/health
```

List threads (player-safe view):

```bash
curl -H "x-role: PLAYER" http://localhost:3000/threads
```

Thread detail as GM:

```bash
curl -H "x-role: GM" http://localhost:3000/threads/thread-1
```

Thread detail as Player:

```bash
curl -H "x-role: PLAYER" http://localhost:3000/threads/thread-1
```

Timeline events:

```bash
curl http://localhost:3000/timeline/events
```

### 3) Run tests

```bash
npm test
```

`npm test` runs:
- unit + integration tests via `node --test`
- behavior scenario execution from the `.feature` file
