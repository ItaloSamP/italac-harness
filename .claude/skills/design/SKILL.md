---
name: design
description: Design workflow for anything a user will look at — classifies the surface (marketing/company site, app UI, single component), picks the right design engine (the taste-skill kit for sites, ui-ux-pro-max for app UI and design systems, frontend-design as fallback), produces the design system and design spec, builds, and runs the UI gate in a real browser. Use for "design this", "cria a tela", "landing page", "dashboard", "melhora o visual", "design system", "redesign", for the design phase of /kickoff, and whenever /build reaches UI work with visual weight. Do NOT use for a throwaway mock (use /prototype).
---

# Design — pick the engine, keep one system, pass the gate

Design quality here does not come from taste improvised per screen. It comes from three things: a **design system decided once**, an **engine with real knowledge** behind each decision, and a **gate that checks the result in a browser**.

Run inline for a single screen. For a whole design phase or several screens, dispatch `@designer` with this skill named in the brief.

## Step 1 — Classify the surface

| Surface | Signs | Engine |
|---------|-------|--------|
| **Site** | Landing page, company/product/shop/studio site, anything that sells or presents to visitors | `design-taste-frontend` (taste-skill) |
| **App UI** | Dashboard, admin, SaaS screens, mobile app, forms-and-tables product UI | `ui-ux-pro-max` |
| **Component** | One component or a small fix inside an existing UI | The project's existing system; `ui-ux-pro-max` domain search for the specific concern |

A product usually has both: a site that sells it and an app that is it. Use each engine on its own surface, and share the brand tokens (Step 3).

## Step 2 — Check the engines are installed

Look at the available skills for `design-taste-frontend` and `ui-ux-pro-max` (plugin installs appear with a prefix, e.g. `taste-skill:design-taste-frontend`, `ui-ux-pro-max:ui-ux-pro-max`).

- Present → use it, following **its own** SKILL.md exactly. These engines are rigid on purpose; do not skip their steps.
- Missing → say so once, with the install line from `optional/README.md` of the harness, and continue with `/frontend-design` plus the gate in Step 6. Never block the task on an install.

Requirements: taste-skill needs Node 22+ and Chrome/Edge; ui-ux-pro-max needs Python 3.

## Step 3 — One design system per project

Before any screen, there is exactly one source of truth for tokens (color, type scale, spacing, radius, motion):

1. `context/DESIGN.md` exists → read it. It wins. Extend it, do not fork it.
2. Otherwise generate it:
   - **App UI:** ui-ux-pro-max `--design-system` with product type, industry and style keywords, persisted with `--persist --output-dir <project root>` → `design-system/<slug>/MASTER.md`. Read an existing `MASTER.md` before regenerating; never pass `--force` without the user's say-so.
   - **Site:** taste-skill deals the palette and type pairing by trade (`start.mjs deal`). Take the deal; do not re-roll by preference.
3. Write `context/DESIGN.md` as the **index**: brand tokens, which engine owns which surface, and links to `design-system/<slug>/MASTER.md` and the taste deal. Later agents read `context/DESIGN.md` first.
4. Second engine on the same product → feed it the brand tokens already decided, so site and app look like one company.

## Step 4 — Design spec (design phase, or more than two screens)

Write `.specs/docs/design-<slug>.md` so developers build without guessing:

- Flows: entry → steps → outcome, including the unhappy paths.
- Screen inventory: one line per screen with its single job.
- **States per screen:** empty, loading, error, success, disabled, long content, no permission.
- Components and which already exist in the project.
- Responsive behaviour at 390 / 768 / 1024 / 1440.
- Copy: the real text for headings, buttons, empty and error states.

## Step 5 — Build

Follow the engine's run. Rules that hold with every engine:

- **Copy first, real copy.** Specific facts from the brief. No filler superlatives, no invented reviews, customers, numbers or look-alike logos. Assumed facts are marked as assumed.
- **Stack:** build in the project's stack; the engine's stack guidance (`--stack` in ui-ux-pro-max) decides idiom.
- **Kit files are not edited** to silence a check — fix the page.
- Backend, data or contract needs → `NEEDS: @developer`.

## Step 6 — UI gate (the external proof)

A UI is not done until it passed a gate **on the real surface**: a browser for web; for native mobile the project's declared simulator or device command, and without one the result is NOT VERIFIED:

| Engine used | Gate |
|-------------|------|
| taste-skill | Its finish gate (`gate.mjs`) armed at the start and green at the end, plus its copy lint and perf rows |
| ui-ux-pro-max | Its Pre-Delivery Checklist (`references/pro-rules.md`) |
| Any / fallback | `references/ui-gate.md` in this skill — always, as the floor |

Evidence goes under `.specs/logs/`: gate output and screenshots at each width. A gate that cannot run (no browser, no dev server) is reported as **not verified** — never as passed.

## Output

```
Design: <surface> — engine: <taste-skill | ui-ux-pro-max | frontend-design (fallback)>
System: context/DESIGN.md (+ design-system/<slug>/MASTER.md)
Spec: .specs/docs/design-<slug>.md | n/a
Gate: <command or checklist> → PASS | FAIL (<open items>) | NOT VERIFIED (<why>)
Evidence: .specs/logs/<files>
```
