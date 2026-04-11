# GM Timeline Schema Package

This package bundles the MVP JSON Schema files for the GM timeline tool.

## Included schemas
- timeline.schema.json
- session.schema.json
- place.schema.json
- hook.schema.json
- thread-ref.schema.json
- session-index.schema.json
- place-index.schema.json
- hook-index.schema.json
- thread-index.schema.json
- shared-defs.schema.json

## Entry points
- `gm-timeline.bundle.schema.json` — package-level bundle manifest
- `package.manifest.json` — lightweight manifest for loaders/build scripts

## Notes
- Sessions are lightweight runtime/planning containers.
- Places hold persistent campaign context and relevant hook IDs.
- Hooks hold checks, read-aloud sections, and linked thread IDs.
- Index files support refresh/search without requiring a database.

## Suggested folder layout
```text
schemas/
  gm-timeline.bundle.schema.json
  shared-defs.schema.json
  timeline.schema.json
  session.schema.json
  place.schema.json
  hook.schema.json
  thread-ref.schema.json
  session-index.schema.json
  place-index.schema.json
  hook-index.schema.json
  thread-index.schema.json
```
