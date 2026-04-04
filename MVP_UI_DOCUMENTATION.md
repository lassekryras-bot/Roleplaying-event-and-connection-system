# Living Campaign Engine — MVP UI Documentation

## Overview
This document defines the MVP user interface for the story graph tool used in roleplaying campaigns and living campaign management.

Core goals:
- Help GMs prepare and run campaigns without railroading players.
- Keep player-facing information separate from GM-only truth.
- Make campaign setup and first-session preparation fast and structured.

---

## Screen 1: Project Page

### Purpose
Campaign-level setup, membership, and core constraints.

### Features
- Select active project/campaign.
- GM can invite players.
- GM can invite helper GMs (co-GMs).
- Add/edit story outline.
- Add character creation instructions for players.
- Define campaign limitations and constraints.

### Example constraints
- "Must have a connection to faction X."
- Allowed/disallowed archetypes.
- House rules and tone boundaries.

---

## Screen 2: Entity Editor

### Purpose
Create and edit core campaign entities.

### Tabs
1. **Characters**
2. **Events**
3. **Threads**

### Characters (tab)
- Name
- Role (PC / NPC)
- Description
- Goals
- Relationships
- Linked threads
- Status (active/inactive)

### Events (tab)
- Title
- Timeline position (past / now / future possible)
- Description
- Participants
- Consequences
- Linked threads

### Threads (tab)
- Thread title
- Type (main / side / rumor / mystery)
- Status (UI labels: open / in progress / resolved; canonical domain states: dormant / active / escalated / resolved)
  - UI → domain mapping: open → dormant, in progress → active, resolved → resolved
  - Domain → UI mapping: dormant → open, active → in progress, escalated → in progress, resolved → resolved
- Timeline anchor
- Linked entities (character/event/NPC/item/location)

---

## Screen 3: Thread Detail

### Purpose
Show full detail for one thread.

### Required fields
- Hook
- State
- GM Truth (private)
- Player Summary (public-safe)
- Linked entities

### Linked entity types
- Characters
- Events
- NPCs
- Items
- Locations
- Other threads

---

## Screen 4: Player Page

### Purpose
Give players a clean, safe campaign view.

### Features
- Character data overview.
- Visible threads overview.
- Current actionable hooks.

### Visibility rules
- Players can only see player-safe content.
- GM Truth must never be exposed on player-facing pages.

---

## Screen 5: Main Board (Shared Timeline)

### Purpose
Shared campaign timeline for GM and players.

### Timeline model
- "Now" is centered.
- Past appears before now.
- Future possible events appear after now.

### New campaign behavior
On a new campaign, only one action is available:
- Click a pulsing start node at "Now".

This starts a GM guided setup flow for first-session preparation.

### GM setup flow (first session prep)
1. Define starting point (where PCs are at campaign start).
2. Add initial context and nearby entities.
3. Create starter threads for this moment in time:
   - Who players can talk to.
   - What players can discover.
   - Rumors players can hear.

---

## MVP Permissions

### GM
- Full edit access.
- Manage members and invites.
- Edit GM Truth and Player Summary.

### Helper GM
- Partial or full edit access (configurable).
- No player account privileges.

### Player
- View player-safe story data.
- Manage own character data (if enabled).

---

## AI Note
This documentation draft was generated with AI assistance and reviewed for campaign design clarity. Treat it as a living spec: update terminology, workflows, and permissions as implementation evolves.
