# Roleplaying-event-and-connection-system

## Accessibility status audit (April 3, 2026)

Current repository contents are documentation-only and do not include a frontend application, route components, or frontend test harness (no `/threads`, `/threads/[id]`, `/timeline`, and no React/Vue/Svelte test setup).

Because those assets are not present, semantic landmark updates, heading hierarchy fixes, keyboard navigation behavior, ARIA label implementation, and automated axe route coverage cannot be applied directly in this repository yet.

## Required implementation scope once frontend code is available

When the frontend app is added, apply these accessibility requirements:

1. **Semantic landmarks**
   - Use one `<main>` per page.
   - Ensure navigation regions use `<nav aria-label="…">`.
   - Use a page-level `<header>` and section headers where appropriate.

2. **Heading hierarchy per page**
   - One visible `<h1>` that matches page purpose.
   - No heading level skips (`h1 -> h2 -> h3` in order).

3. **Focus-visible styles**
   - All links, buttons, toggle controls, inputs, and custom interactive elements must have clearly visible `:focus-visible` styling with sufficient contrast.

4. **Keyboard navigation**
   - Thread list supports Arrow Up/Down, Home/End, Enter/Space activation.
   - Timeline cards support Arrow Left/Right (or Up/Down if vertical), Home/End, Enter/Space activation.
   - Ensure roving tabindex or equivalent pattern is implemented accessibly.

5. **ARIA labels**
   - Role switch includes clear accessible name (e.g., `aria-label="Switch role"` if no visible label).
   - Filters group and controls expose labels and current state (`aria-pressed`, `aria-checked`, etc.).

6. **Automated accessibility checks (axe)**
   - Add route-level tests covering:
     - `/threads`
     - `/threads/[id]`
     - `/timeline`
   - Fail CI on serious/critical violations.

## Manual QA checklist (keyboard-only and screen-reader smoke checks)

Use this checklist in PR validation before release:

### Keyboard-only smoke checks

- [ ] Starting from browser chrome, tab into app and reach a skip link or first meaningful control.
- [ ] Focus order is logical on `/threads`.
- [ ] Thread list can be fully operated by keyboard only (move, select, open).
- [ ] Focus never becomes hidden behind sticky panes/modals.
- [ ] `/threads/[id]` timeline cards can be navigated and activated by keyboard only.
- [ ] `/timeline` filters and role switch can be toggled via keyboard.
- [ ] All interactive elements show visible focus ring on `Tab`.
- [ ] No keyboard traps in dialogs, drawers, popovers.

### Screen-reader smoke checks (NVDA/JAWS/VoiceOver)

- [ ] Page announces one clear `<h1>` that matches route purpose.
- [ ] Landmark navigation exposes `header`, `nav`, and `main`.
- [ ] Role switch has an understandable name, role, and state.
- [ ] Filter controls announce label + selected state correctly.
- [ ] Thread list item names are descriptive (not generic “button”).
- [ ] Timeline cards announce title, metadata, and actionable controls.
- [ ] Dynamic updates (loading/new events) are announced appropriately.

### Regression expectations

- [ ] Axe checks for `/threads`, `/threads/[id]`, `/timeline` pass in CI.
- [ ] Any new custom component includes keyboard interaction and `focus-visible` behavior.
