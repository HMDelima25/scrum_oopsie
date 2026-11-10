# Updating the live HOPE website

Render runs a built copy from GitHub, not files directly from your computer.

## Current source

- Local project: `C:\Natalia\softeng\HOPE-supabase-backend`
- GitHub fork: `https://github.com/riellealia/scrum_oopsie`
- Deployment branch: `codex/hope-railway-deploy` (the historical branch name still contains Railway; Render is the actual host).
- Live website: `https://hope-erp-cgko.onrender.com`
- Render Auto-Deploy: On Commit, using the connected GitHub app for this repository.

## Normal update flow

1. Edit and save the local files.
2. Check the change locally. Run appropriate tests before publishing.
3. Commit the intended files and push this deployment branch to the `fork` remote.
4. Render automatically downloads that commit, builds it and runs the health check. The new version becomes live after a successful deployment. Check the deployed commit in Render; saving or committing locally alone does not publish a change.

Example commands from the project root (replace the sample file path and message with your intended changes):

```powershell
git status
git branch --show-current
git add frontend/path/to/changed-file.js
git commit -m "Describe the change"
git push fork codex/hope-railway-deploy
```

You can also ask your coding assistant to commit and push the intended changes. Confirm the branch before pushing. Changes in the original team's main repository, or other branches of your fork, are not automatically merged into this deployment branch.

Supabase stores the live records and sessions. GitHub stores code. Database edits do not require a code deployment; database schema changes still need a separately reviewed migration. The root `.env` stays private and ignored. Hosting settings belong in Render's Environment page; code pushes do not upload the local `.env` or automatically update hosted settings.

For a failed deployment, inspect Render's build/runtime logs before retrying. The Free plan can sleep when idle; that wake-up delay is separate from the build and deployment time.
