# Engines and optional skills

## Design engines — install once per machine (recommended)

`/design` and `@designer` use these as first-class engines. They are installed at user level, not copied into each project: they are large, and one install serves every project.

| Engine | Surface | What it brings | Needs | Install |
|--------|---------|----------------|-------|---------|
| [taste-skill](https://github.com/Leonxlnx/taste-skill) — skill `design-taste-frontend` (MIT) | **Sites:** landing pages, company, product, shop, studio, SaaS and dev-tool sites | A complete kit (system CSS/JS, section library, heroes, motion layer, licensed photographs), a copy layer with a linter for model-written prose, palettes and type pairings dealt by trade, and a **finish gate** that checks the built page in headless Chrome at several widths | Node 22+, Chrome/Edge/Chromium. ~40 MB | In Claude Code: `/plugin marketplace add Leonxlnx/taste-skill` then `/plugin install taste-skill@taste-skill` |
| [ui-ux-pro-max](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill) (MIT) | **App UI:** dashboards, admin, SaaS screens, mobile apps, design systems | A searchable local database — styles, palettes, type pairings, product-type reasoning, 120 UX guidelines, per-stack guidance — a design-system generator that persists `design-system/<slug>/MASTER.md`, and a pre-delivery checklist | Python 3. ~4 MB | In Claude Code: `/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill` then `/plugin install ui-ux-pro-max@ui-ux-pro-max-skill` |

How the harness uses them:

- `/design` classifies the surface and picks the engine; each engine's own steps are followed exactly.
- One design system per project: `context/DESIGN.md` is the index and links to the engine's output.
- The engine's gate plus `.claude/skills/design/references/ui-gate.md` are the external proof for UI (rule `40-quality-gates.md`).
- Missing engine → `/design` falls back to `/frontend-design` + the floor gate and tells you once.

Not adopted from ui-ux-pro-max's repository: `brand`, `slides`, `banner-design` and logo generation — they need external image-model API keys and are outside a development workflow.

Both engines run their own scripts (Node / Python) on your machine. Install them only from the repositories above.

## Figma (in `optional/skills/`) — per project

| Skill | Use for | Needs |
|-------|---------|-------|
| `figma-implement-design` | Turning Figma nodes into code with 1:1 fidelity | Figma MCP server connected |
| `html-to-figma` | Pushing an HTML screen into Figma | Figma MCP + capture script |

Enable: copy the folder into the project's `.claude/skills/`.

## Second opinions, diagrams, accessibility (in `optional/skills/`) — per project

Moved out of the core so their descriptions are not loaded in every session. The core keeps a fallback for each.

| Skill | Use for | Core fallback without it |
|-------|---------|--------------------------|
| `the-judge` | PR-level review on GitHub with inline comments and a findings ledger across rounds | `/audit` |
| `the-jury` | A multi-agent panel that debates a high-stakes decision and commits to a verdict | `@tech-lead`, stress-tested with `/the-fool` |
| `mermaid-studio` | Rendering and validating Mermaid diagrams (many diagram types, themes, image export) | Mermaid written directly in Markdown |
| `web-accessibility` | A full WCAG audit of a web interface | Block 4 of `.claude/skills/design/references/ui-gate.md` |

Enable: copy the folder into the project's `.claude/skills/`. The validator then accepts `/the-jury` and the others as installed skills.

## Stack skills — per project

React, Next.js, NestJS, Rails, React Native, deploy targets (Vercel, Cloudflare, Netlify, Render), AWS, Sentry and more: `npx @tech-leads-club/agent-skills` inside the project.
