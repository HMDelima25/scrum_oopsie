# S1-UIX-04 — Hi-fi mockups and Developer handoff

Closes #44. Open `index.html` (or serve this folder) to review the recovered visual designs plus supplementary access-state and per-user Rights designs. This is an isolated design preview under docs, not a production frontend deployment.

## What was reused
The existing UI-UX application is preserved under `mockups/`, including shared dependencies and later-sprint routes to avoid broken navigation. Every HTML route has a visible design-preview notice. Login no longer redirects on arbitrary/empty credentials; recovery no longer claims an email was sent. No backend source is changed. Existing role-editor interactions remain illustrative and store only temporary frontend state.

## Screen handoff
| Screen | Review location | Required integration |
|---|---|---|
| Login/register/recovery | mockups/index.html | Auth endpoints; only navigate on confirmed session |
| Main page | mockups/modules/dashboard/index.html | Session role/rights; no unlabelled fixture statistics in production |
| User Management | mockups/modules/user-management/index.html | User list/add/edit/status; Admin restrictions |
| Per-user Rights | rights.html | Load/save rights for selected user; module gates and 36 action controls |
| First password/reset | states.html | One-time token validation; confirmation then login |

## API inventory verified at main 39620f7
| Existing route | Current request / response use | Design dependency |
|---|---|---|
| POST /api/auth/register | {name,email,password}; returns pending User | Story asks first/last/email + invitation; resolve before wiring |
| POST /api/auth/login | {email,password}; returns user and session cookie | Surface blocked/pending/invalid errors; do not emulate session |
| POST /api/auth/logout | Ends session | Redirect only after success |
| GET /api/auth/me | Current user + rights | Use as shared navigation source |
| POST /api/auth/forgot-password | {email}; debug token, no real email delivery | Do not display “sent” until delivery exists |
| POST /api/auth/reset-password | {token,newPassword} | Confirmation mismatch checked in UI; token validity on server |
| GET /api/admin/users | {data:[users]} | Filters depend on viewer; UI must not reintroduce hidden records |
| POST /api/admin/users | {name,email,password,role,status} | Requires contract agreement for invitation approach |
| PUT /api/admin/users/:id | {name,email,role,status} | Backend owns approval/designation/last-Superadmin checks |
| PATCH /api/admin/users/:id/status | {status} | Confirm Block; Unblock returns approved |
| GET/PUT /api/admin/users/:id/rights | GET rights; PUT {rights} | Agree reference-key mapping; audit success is prerequisite |

## Requirements and unresolved gaps
- The recovered registration asks for a password and the old role editor assigns role templates; these are historical designs, not proof the revised user stories are satisfied. `states.html` and `rights.html` provide the missing designs.
- The reference has 36 action rights plus five module-view gates. Actions: Customer 3, Product 6, HR 13, Sales 7, Reports 7. Module controls are separate; disabling one greys/disables its children. Use a count and mixed selection state; All/None act on the draft. Cancel/Escape discard changes.
- Admin manages Users only; Superadmins hidden, other Admins have no actions if displayed. Superadmin sees User Management and System Settings. User sees only permitted modules/actions. All authorization remains server-enforced.
- Server rights routes are declared before requireAdmin; Developer must review protection. Audit insertion currently does not block a successful response on failure. Rights refresh/session invalidation must be verified by the Developer/Tester, not inferred from mockups.
- No dedicated invitation/set-password endpoint exists; no frontend-only workaround should assign the first password during login. Backend rate limiting and real email delivery are not established by this design.

## Presentation acceptance
Desktop keeps existing ocean-blue/gold shell; mobile gives forms priority and scrolls wide tables within their region. Dialogs need title, initial focus, Escape, focus return, scroll containment. Field errors need persistent labels and described-by associations. Loading prevents duplicate submission; errors retain entries; all outcomes use live text announcements.

## Review scope
Only Sprint 1 design work is submitted. Later-sprint Customer/Product/HR/Sales designs retained in the snapshot are reference dependencies. These previews do not claim API integration, authentication security, persistent changes, or representative-user testing. See VALIDATION.md for performed checks and remaining gaps.

## Provenance
Reused Natalia’s existing ocean-blue/gold design from branch `UI/UX-/-NATALIA` at `4fcd3a9`. Earlier frontend PRs #8–#15 remain historical work; this task-specific submission does not undo them. Base: `main` at `39620f7`. Requirements: assigned GitHub issue and existing professor reference `.files/.examples/index.html` on the Natalia branch.
