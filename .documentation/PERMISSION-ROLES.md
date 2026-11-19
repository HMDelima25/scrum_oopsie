# Roles and permissions

The three system roles remain Superadmin, Admin and User. The account named `admin` is the initial Superadmin. Only Superadmin approves accounts and designates Admins. Admin manages User accounts; named permission roles do not change this hierarchy or bypass approval.

In User Management, open Roles, then Add role. Enter a unique name and description, select the applicable permissions, and save. The 41 checkboxes comprise five module view gates and 36 actions/report rights. Turning a view gate off clears and disables its dependent checkboxes. Select all and Clear update every checkbox.

Open a User record, then Assign rights. Select a saved permission role to apply its grants, or Custom permissions to edit that account individually. Named-role checkboxes are read-only in this dialog; edit the role itself to update every assigned User. Saving custom grants detaches that User from its named role. Superadmin has fixed full access.

Role edits propagate to assigned Users in the same database transaction. Deactivating a role revokes its grants; reactivating restores them. Pending and blocked accounts remain unable to sign in. Permissions are read from the database on every authenticated request, so an existing session cannot keep revoked access. Open screens update their controls during automatic refresh; an open form loses Save when the corresponding right is revoked. Server checks remain authoritative between refreshes.

Migration: `20261108000700_permission_roles.sql`, applied to the configured Supabase project. The role table and functions are service-only; browser clients use the authenticated backend. Role creation/changes and propagated User changes are audited. Concurrent edits and assignment changes support the existing If-Match record version check.

Verification: `test/permission-roles.test.js` exercises all 41 catalogue entries against actual protected endpoints with the permission both disabled and enabled, including successful writes. It also checks role persistence, assignment, propagation, revocation, custom overrides, approval restrictions, invalid payloads, concurrent edits and anonymous denial. The complete suite passes 104 tests. Browser checks covered all 41 checkbox controls, save/reopen, role assignment, parent gate clearing, 390x650 dialog fit, and live action/page revocation in an existing isolated User session. Live verification found 23 accessible server tables, seven migrations, no named roles pre-created, and unchanged real account designations/statuses.
