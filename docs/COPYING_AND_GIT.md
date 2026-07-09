# Copying And Git

Every extension created from this template should get its own Git repo and remote.

## Important Difference

- `.git/` is Git history, branches, remotes, tags, and repo identity. Do not copy it into a new extension project.
- `.githooks/` is reusable hook script source. Do copy it into new projects.

## Recommended New Project Flow

1. Copy this template without `.git/` and without generated exports.
2. Rename the copied folder for the new extension.
3. Open the copied folder with an AI.
4. Tell the AI the new extension idea.
5. Ask it to read `AGENTS.md`, `docs/AI_HANDOFF.md`, and `docs/NEW_PROJECT_CHECKLIST.md`.
6. Let the AI adapt docs, manifest, popup, options, permissions, and workflow logic.
7. Run `git init` in the copied project when ready.
8. Create a new GitHub repo/remote for that project.
9. Configure the identity guard if desired.
10. Make the first commit for that new project.

## Git Identity Guard In New Projects

The template includes `.git-identity.example` and `.githooks/`.

For a copied project:

```powershell
Copy-Item .git-identity.example .git-identity
git config user.email "your@email.com"
git config core.hooksPath .githooks
```

Then edit `.git-identity` so `GIT_ALLOWED_EMAIL` matches the expected commit email.