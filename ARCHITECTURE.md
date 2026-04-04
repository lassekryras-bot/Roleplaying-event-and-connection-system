# Living Campaign Engine — Software Architecture

## Purpose
This document defines the initial software architecture and recommended tech stack for implementing the Living Campaign Engine.

It complements:
- `CONCEPT_DOCUMENTATION.md` (domain concept)
- `MVP_UI_DOCUMENTATION.md` (screen and workflow behavior)

---

## 1) Architecture Goals
- Support GM-led world building without railroading player choice.
- Enforce strict separation of GM-only and player-visible information.
- Make thread/pattern/cloth relationships easy to query and evolve.
- Keep MVP implementation simple, but extensible for long-running campaigns.
- Enable safe multi-user collaboration (GM, helper GM, players).

---

## 2) High-Level System Design

### Clients
- **GM Web App**: full authoring and campaign control.
- **Player Web App**: player-safe character + thread + timeline view.

### Application Layer
- **API Service** (single backend for MVP):
  - Project and membership management
  - Story entity CRUD
  - Visibility filtering
  - Timeline query and ordering
  - Invite workflow

### Data Layer
- **Primary DB**: PostgreSQL
- **ORM**: Prisma
- **Migrations**: Prisma migration flow

### Optional Real-Time Layer (MVP+)
- WebSocket events for timeline and thread updates.

---

## 3) Domain Boundaries

### Project & Membership Domain
Responsibilities:
- Project creation/selection
- Invites and role assignment
- Access control per project

Core roles:
- GM
- Helper GM
- Player

### Story Domain
Responsibilities:
- Manage Characters, Events, Threads
- Manage Pattern collections of Threads
- Manage Cloth collections of Patterns
- Support linked entities across domains

### Visibility Domain
Responsibilities:
- Enforce `gm_truth` vs `player_summary`
- Filter read payloads based on role
- Prevent accidental leakage to player endpoints

### Timeline Domain
Responsibilities:
- Order events by timeline position/time
- Maintain centered "Now" semantics
- Return future possible outcomes for planning/escalation

---

## 4) Recommended Tech Stack

## Frontend
- **Framework**: Next.js (React + TypeScript)
- **UI**: Tailwind CSS + reusable component system
- **Forms**: React Hook Form + Zod validation
- **Data fetching**: TanStack Query
- **State**: lightweight UI state store (Zustand)

## Backend
- **Runtime**: Node.js
- **Framework**: NestJS (or Fastify if leaner preference)
- **Language**: TypeScript
- **Validation**: Zod or class-validator
- **Auth**: JWT-based sessions (or managed provider)

## Data / Infra
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Containerization**: Docker
- **CI/CD**: GitHub Actions
- **Observability**: structured logs + Sentry

---

## 5) Data Architecture (MVP)

Core entities:
- `Project`
- `Membership`
- `Character`
- `Event`
- `Thread`
- `Pattern`
- `Cloth`
- Link tables:
  - `ThreadLink` (thread ↔ character/event/npc/item/location)
  - `PatternThread`
  - `ClothPattern`

Visibility fields on narrative entities:
- `gm_truth` (private)
- `player_summary` (shareable)

---

## 6) API Architecture (MVP)

Suggested endpoint groups:
- `/projects`
- `/memberships` and `/invites`
- `/characters`
- `/events`
- `/threads`
- `/patterns`
- `/cloths`
- `/timeline`

Design rules:
- Write endpoints require GM/helper permissions.
- Player endpoints return filtered fields only.
- Never return `gm_truth` to non-GM roles.

---

## 7) Authorization Model

Policy baseline:
- **GM**: full project + story control
- **Helper GM**: configurable edit scope
- **Player**: read-only to player-safe data; optional own-character edits

Enforcement strategy:
- Role checks in API middleware/guards
- Query-layer field filtering for read payloads
- Explicit tests for visibility boundaries

---

## 8) Timeline & Escalation Strategy

MVP timeline supports:
- Past events
- Current "Now" anchor
- Future possible events

Escalation (MVP-simple):
- Thread has state: `dormant | active | escalated | resolved`
- Future events can reference source thread
- GM manually advances state

MVP+ options:
- Trigger-based auto-escalation
- Deadline and consequence automation

---

## 9) Deployment Architecture

Minimum environments:
- Local development
- Staging
- Production

Recommended deployment split:
- Frontend: Vercel (or equivalent)
- Backend API: Render/Fly.io/AWS
- Database: managed PostgreSQL provider

Operational requirements:
- Automated backups
- Migration gating in CI
- Error alerting and traceable request logs

---

## 10) Quality & Testing Strategy

Required test layers:
- Unit tests for domain logic
- API tests for role permissions and visibility
- Integration tests for thread/pattern/cloth linkage
- Smoke tests for critical flows:
  - New project setup
  - Invite flow
  - Create thread + link entities
  - Player view does not expose GM Truth

Test specification conventions (required):
- Unit and low-level contract checks remain in **node:test**.
- High-level integration narratives must run as **Gherkin-compatible scenarios**.
- Scenarios should use explicit **Given / When / Then** steps.
- Integration and behavior scenario names must start with **`should...`** (for example: `should hide GM truth from player endpoints`).

### Example Cucumber scenarios
```gherkin
Feature: Thread visibility

  Scenario: should hide gm truth from player thread detail
    Given a thread exists with gm_truth and player_summary
    And I am authenticated as a Player in the same project
    When I request the thread detail endpoint
    Then I should receive player_summary
    And I should not receive gm_truth

  Scenario: should allow gm to view gm truth in thread detail
    Given a thread exists with gm_truth and player_summary
    And I am authenticated as a GM in the same project
    When I request the thread detail endpoint
    Then I should receive gm_truth
    And I should receive player_summary
```

---

## 11) Suggested Implementation Phases

1. Foundation (repo, CI, auth skeleton)
2. Project + membership + invites
3. Character/Event/Thread CRUD
4. Linking model + Thread detail
5. Pattern and Cloth grouping
6. Timeline board endpoints and UI
7. Visibility hardening and tests
8. Observability and deployment polish

---

## AI Note
This architecture draft was generated with AI assistance and should be reviewed and adapted to team constraints, hosting preferences, and security requirements.
