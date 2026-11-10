# Updating the live HOPE website

Render runs a built copy from GitHub, not files directly from your computer.

## Current source

- Local project: `C:\Natalia\softeng\HOPE-supabase-backend`
- Original repository: `https://github.com/HMDelima25/scrum_oopsie`
- Contribution branch: `codex/natalia-current-code` (PR #83 targets main).
- Configured deployment branch: `main`.
- Live website: `https://hope-erp-cgko.onrender.com`
- The main source is prepared, while the last working deployment remains live. Its initial build was canceled because PR #83 is not merged yet.
- Current connection: public Git URL, requiring manual deployment. Automatic deployment requires the original repository owner's Render GitHub authorization; fork access is not sufficient.

## Normal update flow

1. Edit and save the local files.
2. Check the change locally. Run appropriate tests before publishing.
3. Commit the intended files and push your contribution branch to the `origin` remote (the original repository).
4. Open/update the PR, resolve integration differences, and merge after review.
5. Once the changes are in main, select Manual Deploy > Deploy latest commit in the existing Render service. After the original owner connects Render's GitHub app, On Commit can replace this manual step. The new version becomes live after a successful build and health check; saving or committing locally alone does not publish a change.

Example commands from the project root (replace the sample file path and message with your intended changes):

```powershell
git status
git branch --show-current
git add frontend/path/to/changed-file.js
git commit -m "Describe the change"
git push origin codex/natalia-current-code
```

You can also ask your coding assistant to commit and push the intended changes. Confirm the branch before pushing. Pushing to the contribution branch does not change main or the live website; the PR must be reviewed and merged first. Do not merge automatically just to trigger a deployment.

Supabase stores the live records and sessions. GitHub stores code. Database edits do not require a code deployment; database schema changes still need a separately reviewed migration. The root `.env` stays private and ignored. Hosting settings belong in Render's Environment page; code pushes do not upload the local `.env` or automatically update hosted settings.

For a failed deployment, inspect Render's build/runtime logs before retrying. The Free plan can sleep when idle; that wake-up delay is separate from the build and deployment time.
