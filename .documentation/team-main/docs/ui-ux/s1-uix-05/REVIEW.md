# S1-UIX-05 — Sprint 1 usability review and fix list

Closes #45. Reviewer: UI/UX assistant working with Natalia Ortiz. Date: November 7, 2026 (Asia/Manila).

## Method and evidence

This is an expert walkthrough and source review, not representative-user testing. No participant sessions, completion rates, or satisfaction scores are claimed. No live account, database, or permission changes were made.

Reviewed Natalia's built screens from `UI/UX-/-NATALIA` at `4fcd3a9`, recovered in the companion #44 design submission, and backend routes/controllers from `main` at `39620f7`. The previous frontend PRs #8–#15 remain merged historical submissions. Current main has no UI-UX directory, so frontend findings concern the recoverable design, not a currently deployed frontend.

Browser walkthrough used the in-app browser with requested desktop (1440×900) and phone (390×844) viewports. Inspected design-system/wireframe/rights/state boards and the recovered login, recovery, registration and User Management screens. Exercised login submission, recovery Continue/close, registration open/close, Add User open/Cancel, and Users → Roles. Static boards have disabled controls intentionally. Desktop/phone inspection was focused, not exhaustive: no claim that every old control or viewport passes.

Source anchors:
- [Original authentication behavior](https://github.com/HMDelima25/scrum_oopsie/blob/4fcd3a9/UI-UX/script.js)
- [Original authentication fields](https://github.com/HMDelima25/scrum_oopsie/blob/4fcd3a9/UI-UX/index.html)
- [Original User Management runtime](https://github.com/HMDelima25/scrum_oopsie/blob/4fcd3a9/UI-UX/shared/utilities/dashboard-module.js)
- [Reference rights catalogue](https://github.com/HMDelima25/scrum_oopsie/blob/4fcd3a9/.files/.examples/index.html)
- [Current auth controller](https://github.com/HMDelima25/scrum_oopsie/blob/39620f7/src/controllers/auth.controller.js)
- [Current admin routes](https://github.com/HMDelima25/scrum_oopsie/blob/39620f7/src/routes/admin.routes.js)
- [Current admin controller](https://github.com/HMDelima25/scrum_oopsie/blob/39620f7/src/controllers/admin.controller.js)

## Findings and actionable fix list

Priority: P1 blocks trustworthy access/task completion; P2 causes confusion or adds friction. Owners below are responsibility suggestions, not reassignment of GitHub issues.

| ID | Priority / finding | Reproduce or evidence | Required change / acceptance check | Owner / status |
|---|---|---|---|---|
| UX-01 | P1: Login redirects without authenticating | Original script submits even with blank credentials and redirects after 320ms | Production must wait for successful API/session response; bad, pending and blocked accounts stay on login with clear messages | Developer integration open. Companion #44 preview removes redirect; browser verified preview message |
| UX-02 | P1: Recovery claims email was sent without delivery | Original recovery Continue displays “Confirmation email sent”; current backend logs/returns a debug token | Do not claim sending until delivery is confirmed; design neutral eligibility feedback, invalid/expired/reused-token recovery | Developer email delivery open. Companion #44 preview wording corrected; walkthrough verified it says preview only |
| UX-03 | P2: Registration asks for extra personal/account fields | Open Create account: username, birthdate, password and confirmation beyond first/last/email story | Remove unneeded fields from final registration design; resolve invitation vs current password-required API before implementation | UI/UX + Developer open; #42 wireframe specifies required fields |
| UX-04 | P1: First-password flow differs from assigned story | No dedicated invitation/set-password route; auth controller sets missing hash during login | Approved one-time invitation flow, clear expiry/reuse states and successful return to login; server rejects invalid tokens | Developer open; #42 and #44 contain the missing screen/state designs |
| UX-05 | P1: Role-template editor is not per-user Rights | User Management → Roles → Add/Edit Role operates role templates | Provide Assign rights on selected user with five gates + 36 actions; module off greys/disables children; All/None, Cancel, failed-save retry | UI/UX design supplied in #43/#44; integration open |
| UX-06 | P1: Admin-facing Add User offers Administrator | Open Add user in recovered Admin workspace; role list includes Administrator | Admin may create/manage Users only; Superadmin-only designation controls; server still enforces restrictions | UI/UX final implementation open; wireframe/handoff states correct matrix |
| UX-07 | P2: Admin record shows an action affordance | Users list includes Operations Admin with Open row actions | If other Admin rows are displayed to Admin, remove their action control; hide Superadmins completely | UI/UX implementation open; #43 matrix documents expected behavior |
| UX-08 | P2: Dashboard navigation has placeholders | Dashboard source uses # for Products/HR/Sales; Reports is a shortcut without a report route | Route supported destinations; unavailable future modules have explicit unavailable state, never a dead link | UI/UX open; later modules are outside Sprint 1 completion claims |
| UX-09 | P2: Recovered phone dialogs need a full layout/focus pass | At phone width, registration is long and screen content remains visually busy behind the overlay | Solid readable dialog surface; internal scroll, visible Cancel/close, no background scroll; keyboard focus trapped/restored; test all fields/footer at 320/390/768px | UI/UX open; focused phone review does not establish a full pass |
| UX-10 | P1: Rights-save success can overstate audit completion | updateUserRights logs an audit error but still returns success | Developer ensures rights persistence and required audit record succeed consistently; UI displays failure and retains draft when operation fails | Developer open; not repaired from UI/UX scope |
| UX-11 | P1: Rights endpoints precede admin protection | admin.routes.js declares GET/PUT rights before router.use(requireAdmin) | Developer verifies session/admin/target protection on both routes, including unauthenticated and ordinary User requests | Developer/Tester open; source finding, not a live exploit test |
| UX-12 | P2: Displayed status vocabulary differs from API | Mockup shows Active/Inactive and invitation status; API uses pending/approved/blocked | Agree mapping: pending → Pending approval, approved → Approved, blocked → Blocked. Keep approval and soft-delete distinct | UI/UX + Developer open; #42/#43 use approval vocabulary |

## Positive observations

- Existing visual palette and typography are consistent across the recovered screens.
- Users/Roles tabs and Add User dialog are discoverable on desktop; Cancel returns to the table.
- The design reference contains the complete 36-action catalogue; companion wireframes preserve it and distinguish module-view gates.
- New review boards stack screen cards and rights groups at phone width; the Users table uses a scroll region.

## Follow-up verification before story acceptance

1. With real backend test accounts, verify register → pending → approval/invitation → set password → login → logout. Include invalid, blocked, pending, duplicate email, missing fields, rate limit, network and invalid/expired/reused tokens.
2. Compare Superadmin/Admin/User navigation and Quick Actions with effective rights. Verify denied direct URLs on the server; hiding a link is not security.
3. For a selected user, load rights, change a partial group, turn a module off/on, All, None, Cancel/Escape and Save. Confirm actor/target audit entry and next-request effect. Induce a failed save and retain the draft.
4. Check every final form/dialog with keyboard, screen reader labels, focus return, 320/390/768/1440px widths, long values and empty/no-results/error states. Verify mobile footer and destructive confirmation remain reachable.
5. Ask representative employees to attempt account recovery and locate/change allowed rights. Record actual observations before using “user-tested” or reporting completion rates.

This review completes the review-and-fix-list deliverable. It does not close the listed implementation defects, claim teammate approval, or certify live security behavior. Merge and teammate review are still required by the assigned issue's Definition of Done.
