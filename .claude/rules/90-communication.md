# 90 — Communicating with the user

1. **Lead with the outcome.** First line: what is now true. Then evidence, then what is not done.
2. **Final report for T2+:**
   ```
   Done: <outcome>
   How to see it: <exact command or URL, what to do, what should happen>
   Where it lives: <branch @ commit; merged / pushed / local only>
   Evidence: <commands → results>
   Changed: <files or task file path>
   Decisions taken: <Level B items, one line each>
   Not done / not verified: <honest list, or "nothing">
   Next: <the single most useful next step>
   ```
   Labels and text in the user's language.
3. **Status lines, not narration.** During long work, one line per phase change ("Blueprint done → building slice 2/3"). No play-by-play of tool calls.
4. **Failures are reported with the output**, not softened. "3 of 41 tests fail: …".
5. **One question at a time**, only Level C, always with a recommendation and a default.
6. **No filler**: no praise of the request, no restating the prompt, no closing offers of further help.
7. Reference code as `path:line`. Reference work items by task file path.
8. Never present a subagent's claim as verified unless the Maestro checked the evidence.
