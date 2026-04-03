# Living Campaign Engine — Concept Documentation

## Purpose
This document explains the high-level concept behind the Living Campaign Engine and how story data is organized to support dynamic tabletop roleplaying campaigns.

## Core Concept
The system helps Game Masters (GMs) run evolving campaigns where player choices affect how the world changes over time.

Instead of writing one fixed storyline, the GM builds a connected story graph made of small units that can grow, merge, and escalate.

## Story Structure
The story model has three connected layers:

- **Thread**: Small story connection (clue, conflict, rumor, NPC behavior, item trail).
- **Pattern**: A meaningful cluster of related threads.
- **Cloth**: A major campaign arc made of multiple patterns.

In short:

**Threads → Patterns → Cloth**

## Why this model works
- Encourages player agency while preserving GM control.
- Makes character backstories mechanically useful.
- Supports mystery and investigation play.
- Makes escalation easy when players ignore a threat.
- Allows campaign arcs to remain coherent over long play.

## Core Data Domains

### 1) Timeline
A chronological record of:
- World events
- Character events
- Plot events
- Triggered outcomes

The timeline includes past, present ("Now"), and future possible outcomes.

### 2) Character Backstories
Player-provided story seeds:
- Origin
- Important people
- Key past events
- Secrets, fears, goals

These become attachable inputs for threads and patterns.

### 3) Main Plot / Antagonist Layer
GM-defined pressure system:
- Villain(s)
- Plan phases
- Resources/minions
- Critical milestones
- Success/failure consequences

## Visibility Model
Every major story element can have two views:

- **GM Truth**: Full internal reality (private)
- **Player Summary**: What players currently know (public-safe)

This enables mystery, reveal pacing, and controlled information flow.

## Living Campaign Behavior
The campaign is "living" because elements can change state over time.

Example progression:
- Dormant thread
- Active thread
- Escalated thread
- Resolved or transformed outcome

Future possible events can be attached to current threads to model consequences of player action or inaction.

## MVP Relationship to UI
This concept document defines the narrative framework.

The UI document (`MVP_UI_DOCUMENTATION.md`) defines how this framework is presented in screens and workflows.

## AI Note
This documentation draft was generated with AI assistance and should be treated as a collaborative starting point for design and implementation.
