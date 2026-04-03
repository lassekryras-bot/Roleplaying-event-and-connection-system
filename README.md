# Roleplaying-event-and-connection-system

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
