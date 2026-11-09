# Professor SQL reference import

Source: `C:/Natalia/softeng/HOPE, Inc. ERP/.files/.sql/HopeDB_audit.sql.txt`.
Imported into Supabase project `tlsqkmjrmcnlgucjniuv` on November 7, 2026, at the user’s request.

The original file includes destructive DROP/CREATE commands and a different audit implementation. Only its business INSERT statements were imported, using explicit column lists against the existing secured schema. No source file was moved or removed. Accounts, roles, permissions, audit protections and existing schema were preserved. The import ran in one transaction, checked that business tables were empty, and recorded `202611070004_reference_data` in `app_migration`. Repeating it fails instead of overwriting or duplicating data.

| Table | Imported records |
|---|---:|
| employee |32|
| department |8|
| job |14|
| jobhistory |54|
| customer |82|
| product |57|
| pricehist |79|
| sales |124|
| salesdetail |313|
| payment |165|
| Total |928|

The import was tested against the current schema in isolated PostgreSQL before execution. An authoritative Supabase re-read confirmed every count, 2 existing accounts, 41 permissions, and 928 additional audit rows. Anonymous database and application access remain denied. All seven report queries succeeded; 27 employees are active.

Migration: `database/migrations/20261107000400_reference_data.sql`. Current live verification: `docs/evidence/live-verification.json`.
