# Team access and login activities

The configured HOPE Supabase database has five approved team Superadmin accounts, provisioned privately from the names in README:

| Name | Username |
| --- | --- |
| Honey Mae D. Delima | honey |
| Natalia Gabrielle A. Ortiz | natalia |
| Felijun Jomero | felijun |
| Rex Matthew G. Florentino | rex |
| Christian Daryll Dave Ramos | christian |

Passwords are stored only as bcrypt hashes in the database. No password defaults, provisioning passwords or server keys are committed. The existing full-name Natalia registration was reused; the separate pending registration was left unchanged. The original `admin` account remains available.

User Management contains Users, Roles and Activities. Users displays usernames. Roles includes the three built-in system roles alongside editable permission profiles; opening a built-in role lists its assigned accounts. Built-in authority is changed through account roles in Users, not through permission-profile editing.

Activities records approved password and Google authentication events from this deployment onward. It stores the account name and role at login time, and a database-generated timestamp. Dates and times display in Asia/Manila. The initial order is newest first; search, filtering, sorting and grouping use the shared table controls. The protected API pages through the history; the UI gathers those pages without discarding older entries. Superadmins can view all entries; Admins can view User entries only; standard Users cannot read the log. Activity rows are append-only. Earlier logins are not invented or backfilled from account creation dates.

Migration `20261108001700_login_activities_actor_names.sql` adds the activity table and resolves transactional audit actors to full account names. New business record stamps and audit entries show that name, including for username-only accounts. Historical audit records and imported stamps remain unchanged.

Run `npm test` for successful/failed authentication, activity ordering and pagination, access restrictions, snapshot preservation, immutable history, role membership and full-name business audit tests. Run `npm run doctor` to verify the required account, session and activity tables exist.
