# Campaign V2 Schema Package

This package contains the parallel v2 campaign data model introduced for Step 1.

## Included schemas
- `relation.schema.json`
- `location.schema.json`
- `locationState.schema.json`
- `session.schema.json`
- `event.schema.json`
- `effect.schema.json`

## Notes
- These schemas are kept separate from the existing `campaign` and `gm-timeline` packages.
- The Step 1 package is schema-first: it adds validation and generated TypeScript types, but no loader, store, route, or UI integration.
- The supplied schemas are preserved as-is, including each schema's local `$defs.relation`.
