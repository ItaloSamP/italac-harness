# UI gate — the floor every interface must pass

Read this before reporting any UI as done. Check in a real browser (`/playwright-skill`), not by reading markup. Distilled from the taste-skill checklist and the ui-ux-pro-max pre-delivery checklist (both MIT); when one of those engines is installed, its own gate runs as well and is stricter.

Report each block as PASS / FAIL with the evidence (screenshot path, measured value, command output).

## 1. It renders everywhere
- [ ] Widths **1440, 1024, 768, 390 and 320**: no horizontal scroll, nothing cut, nothing overlapping, nothing under a fixed bar.
- [ ] Every image, chart and visual actually draws (no empty box, no broken source). Space is reserved so nothing jumps while loading.
- [ ] Mobile: one column where it should be, tap targets ≥ 44×44 px with ≥ 8 px between them, safe areas respected.

## 2. One system
- [ ] One button pair, one card style, one radius scale, one link look, one heading scale.
- [ ] Colors and spacing come from tokens — no ad-hoc hex or pixel values per screen.
- [ ] One icon family. No emoji used as icons.
- [ ] Left and right content edges line up down the page.

## 3. Every state exists
- [ ] Empty, loading, error, success, disabled, long content, no permission — each designed, each reachable.
- [ ] Forms: visible labels (not placeholder-only), the error next to its field, a confirmation only after a real send.
- [ ] Every link and button goes somewhere real.

## 4. Accessible
- [ ] Text contrast ≥ 4.5:1, checked separately in light and dark mode when both exist.
- [ ] Everything reachable and operable by keyboard; focus ring visible and never hidden under a sticky bar.
- [ ] Every control has an accessible name; meaningful images have alt text, decorative ones are hidden from assistive tech.
- [ ] Headings descend one level at a time; `lang`, title and description set.
- [ ] Color is never the only signal.
- [ ] Reduced-motion: everything rests and nothing stays hidden.

## 5. Motion with a reason
- [ ] Interactive elements visibly answer hover, press and focus.
- [ ] No fade-in on every section, no parallax on text, no scroll-jacking.
- [ ] Anything moving longer than 5 seconds can be paused.

## 6. Copy
- [ ] The first screen says what this is and for whom, with one concrete fact.
- [ ] Headings name things; buttons are a verb and an object.
- [ ] No filler words standing in for facts ("seamless", "powerful", "unlock", "next-level", "world-class"), no stock openers ("In today's fast-paced world").
- [ ] Nothing invented: no fake reviews, customers, numbers or logos. No lorem ipsum, no `[placeholder]`, no leftover template tokens.

## 7. Fast enough
- [ ] Images sized and compressed for their slot, lazy-loaded below the fold.
- [ ] No layout shift when content loads.
- [ ] Long lists virtualised or paginated.

## 8. Your eyes
- [ ] Next to a professional product in the same category it does not look like a template: the hierarchy is deliberate and the subject of the page is what you see first.
