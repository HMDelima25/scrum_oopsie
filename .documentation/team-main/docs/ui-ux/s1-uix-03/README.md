# S1-UIX-03 — Main page, Users and Rights wireframes

Closes #43. Open `index.html`. The low-fidelity review board includes main-page hierarchy, the Users table and the complete five-module rights dialog. 36 action rights are taken from the existing reference catalogue; five module-view gates are separate and are not counted as extra action rights.

## Role matrix
| Viewer | Main-page navigation | User records/actions |
|---|---|---|
| User | Only granted modules/actions | No User Management or System Settings |
| Admin | Permitted modules + User Management | Users editable; Superadmins hidden; any other Admin shown is read-only |
| Superadmin | Full navigation + User Management + System Settings | Approval/designation available; last-Superadmin denial explained |

## Rights behavior
Opening loads the selected user's current rights, not role-template rights. Module checkbox controls availability of its actions. Unticking disables and greys children; re-enable restores draft choices until Cancel/Save. All enables modules and all actions; None disables all. Partial selection gets a text count and indeterminate indicator. Cancel and Escape discard edits; successful save returns focus to the opener and announces the result. Failed save preserves the draft and offers retry. Backend validates and persists every change, refreshes effective permissions on the next request, and records actor/target/change in audit_log.

## Responsive/keyboard
At mobile width, navigation collapses to a labeled menu; cards and rights groups stack. Tables scroll within a labeled region. Dialog fits viewport with internal scrolling, visible footer and focus trapping; Escape returns focus. User row detail opens by keyboard as well as pointer; action menu is reachable without right-click.

## Handoff gaps
Current GET /api/admin/users filters Admins to User records, which satisfies the no-edit boundary but omits read-only Admin rows. Rights endpoints accept nested objects, while reference identifiers are dotted keys; agree an explicit mapping before integration. The current list does not expose Superadmins to Superadmin viewers, so last-Superadmin messages are an error-state requirement, not a currently available table workflow.

## Provenance
Reused Natalia’s existing ocean-blue/gold design from branch `UI/UX-/-NATALIA` at `4fcd3a9`. Earlier frontend PRs #8–#15 remain historical work; this task-specific submission does not undo them. Base: `main` at `39620f7`. Requirements: assigned GitHub issue and existing professor reference `.files/.examples/index.html` on the Natalia branch.
