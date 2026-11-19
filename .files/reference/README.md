# Main branch source reference

`main-990d7ba-source.zip` preserves the incoming main branch's original backend, UI, SQL, password pages, test harness and package configuration byte-for-byte. Its manifest lists each preserved path and SHA-256 digest. Original authorship remains in Git history; this integration does not claim teammates' tasks.

This is reference material, not a second runnable application. The active app is `frontend/` plus `backend/`; only `database/migrations/` is its migration chain. The archive is not served by Express and must not be unpacked over the running application or applied to the live database.

Main's schema/permission and grouping tests are retained under `testing/upstream-main/` and run with `npm test`. Main's issue documents, UI mockups and retrospective are under `.documentation/team-main/`. The integration decisions are in `.documentation/INTEGRATION.md`.
