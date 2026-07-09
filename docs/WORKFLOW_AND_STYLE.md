# Workflow And Style

## Collaboration

- Align before large structural changes.
- Make focused, easy-to-review edits.
- Explain tradeoffs when browser behavior or permissions have hidden consequences.
- Do not commit, push, export, or release unless the user explicitly asks.
- Do not generate the local release folder unless the user explicitly asks for a local release/export.
- Do not generate zip files unless the user explicitly asks for a zip.

## Coding Style

- Plain JavaScript, HTML, and CSS by default.
- Keep helpers modular and named by responsibility.
- Avoid broad timing assumptions; prefer small observable state checks.
- Keep UI customization centralized in `popup_ui.js` and `options.html`/`options.js`.
- Do not introduce a framework unless the project clearly needs it.

## RaBiTool Automation Rules

- Treat Reclame Aqui and Excel Web automation as UI automation, not API integration, unless the owner changes direction.
- Keep RA page actions in `project/background/reclame_aqui.js` or focused helpers.
- Keep Excel Web destination actions in `project/background/excel_sheet.js` or focused helpers.
- Report exact failed stages back to the popup.
- Prefer waiting for visible/selectable DOM states over fixed sleeps.
- Document confirmed selectors, button labels, URLs, and Excel ranges in durable docs using fake/private-safe examples.


## Documentation

- Keep `docs/AI_HANDOFF.md` current after meaningful behavior changes.
- Keep examples fake and public-safe.
- Document target websites, selectors, edge cases, and release steps in this project.
- For UI work, document durable alignments about visual references and expected behavior, not chat transcripts.

## Git

- This project has its own local repo; add a remote later when the owner is ready.
- Use the email-based identity guard in `.githooks/` when the project needs commit/push protection.
- Do not rewrite history unless explicitly requested.

## Owner Workflow Commands

- `memcheck`: thoroughly update durable project docs/meta memory with distilled alignments, decisions, functionality, plans, workflow rules, and pitfalls needed by future AIs/devices. Do not commit or push by default.
- `gitcheck`: perform `memcheck`, then inspect the worktree, run relevant checks, verify Git identity guard when present, stage, commit, and push to the configured remote unless the owner says not to.
- `gitcheck` commit messages must use a concise title sentence followed by one or more `-` bullet points with more specific details.
- `localrelease`: refresh the generated local release folder from `project/` using `scripts/Export-LocalRelease.ps1`. Do not create zip files unless the user explicitly asks for a zip.
