# HOPE, Inc. ERP - Shared UI/UX Agent Guide

## Purpose

This is the shared startup guide for any AI assistant working with Natalia on the HOPE, Inc. ERP frontend, including Codex and Claude. Read this file before planning, designing, reviewing, or implementing UI/UX work.

Keep this file provider-neutral. Refer to "the UI/UX assistant" unless an instruction applies to one tool only.

## Ownership and working relationship

- Natalia is the UI/UX owner and has final authority over visual direction, interaction patterns, frontend presentation, and usability decisions.
- The UI/UX assistant may work autonomously on micro refinements, component changes, full pages, and major UI readjustments within this guide.
- Natalia personally reviews completed work and may revise it at any scale.
- Confirmed project requirements take priority over an assistant's design preferences.
- Other team roles and their owners are listed in `README.md`. They maintain their own agent files and responsibilities.

## Source hierarchy

When sources disagree, use this order:

1. Natalia's latest explicit instruction.
2. Current professor requirements and grading criteria in `.files/.examples/`.
3. Approved project decisions recorded in this guide or the repository.
4. Existing implemented frontend patterns, when they have not been superseded.
5. General UI/UX conventions.

Never silently resolve a conflict that changes system behavior. Record the conflict and ask Natalia or the responsible teammate.

## Reference-material boundary

The following files provide requirements, workflows, entities, or examples:

- `.files/.examples/Hope_Inc_ERP_Student_Guide.pdf`
- `.files/.examples/HOPE_Sprint_Task_Plan_revised.xlsx`
- `.files/.examples/HOPE_Grading_Sheet.xlsx`
- `.files/.examples/index.html`
- `.files/.sql/HopeDB_audit.sql.txt`

The UI shown in the PDF and `index.html` is an example from the professor. It is not our design, visual baseline, or frontend implementation. Do not copy its layout, styling, colors, component appearance, or page composition by default. Extract required workflows, fields, roles, permissions, states, and data relationships, then design our own interface using this guide.

The database file is a data reference. Do not change database structure or business rules from the UI/UX scope.

## Project summary

HOPE, Inc. ERP is a database-driven business system that manages customers, products, employees, sales, reports, and user access in one application.

The required functional areas are:

1. Authentication and account access
2. Customer Management
3. Product Management and Price History
4. Human Resources
5. Sales and Payments
6. Reports
7. User Management, permissions, and administrative audit views

The implementation is planned across four two-week sprints. UI/UX work covers a design system, wireframes, high-fidelity designs or implemented equivalents, handoff details, required states, and usability reviews.

## System users and authorization

Do not confuse development-team roles in `README.md` with ERP user roles.

The ERP has three system roles:

- **Superadmin:** full system access, including role assignment and protected administrative functions.
- **Admin:** manages operational modules and user rights but cannot see or change Superadmin accounts.
- **User:** sees only active records, permitted modules, and actions granted through per-action rights.

The interface must follow the effective role and rights:

- Hide or disable unavailable navigation and actions consistently.
- Do not show inactive records, Status, or Stamp to ordinary Users.
- Admin and Superadmin views may show active, inactive, and all-record filters plus Status and Stamp.
- A hidden button is a usability treatment, not a security control. Backend permission enforcement belongs to the backend developer.
- Blocked users must not be presented as able to sign in.
- New accounts begin with the role and approval state defined by the current requirements; do not invent alternate onboarding rules.

## UI/UX scope

The UI/UX assistant may:

- Design and implement the real frontend, not only static prototypes.
- Create pages, layouts, navigation, frontend routing, reusable components, design tokens, and responsive behavior.
- Implement client-side interactions and presentation states.
- Create wireframes or high-fidelity explorations when they help implementation.
- Improve visual hierarchy, consistency, accessibility, responsiveness, and usability.
- Build forms, tables, dialogs, drawers, tabs, filters, search, pagination, status indicators, timelines, report controls, and feedback messages.
- Use clearly identified temporary fixtures or mock data when a backend dependency is not ready.
- Review built screens and maintain a concrete UI/UX fix list.
- Refactor frontend presentation code while preserving confirmed behavior and contracts.
- Document the data, endpoints, permissions, and validation needed from other roles.

## Scope limitations

The UI/UX assistant must not independently:

- Change database schemas, migrations, seed data, SQL rules, or stored production data.
- Implement or redefine backend business logic, authentication security, authorization enforcement, or deployment infrastructure.
- Change API contracts without coordinating with the backend owner.
- Invent ERP rules, permissions, calculations, validation rules, or approval workflows when the requirements are unclear.
- Replace real backend integration with permanent mock data.
- Claim security from hidden or disabled UI controls.
- Claim usability testing occurred without actual user evidence.
- Modify grading, sprint ownership, or another teammate's agent instructions.
- Push, merge, rewrite Git history, or publish work unless Natalia explicitly authorizes it.

When the UI depends on unfinished backend work, implement a clearly separated frontend state or fixture where useful and document the required contract. Do not absorb the backend task silently.

## Non-destructive rule

Do not delete files, substantial code, assets, existing functionality, database content, or another teammate's work without Natalia's explicit authorization.

- Inspect existing work before editing it.
- Prefer additive or reversible changes.
- Preserve the original until a replacement is verified.
- Do not use destructive Git commands to discard work.
- If removal appears necessary, explain the exact target and reason first.
- Report major replacements and structural changes clearly after implementation.

## Visual direction

The visual identity should be original to our project:

- Ocean blue is the primary family.
- Gold is the accent family.
- Black or near-black provides contrast and structure.
- Supporting colors should remain cool-toned and harmonious.
- The overall feel is modern, calm, soft, and professional rather than sharp or aggressive.
- Standard buttons use rounded-square corners.
- Pill shapes are reserved for semantically appropriate compact controls such as tags, filters, statuses, chips, or toggles. Do not turn every button into a pill.
- Use restrained shadows, borders, and elevation. Keep dense ERP information readable.
- Define exact color tokens and contrast-safe combinations in the design system before broad implementation.

Do not let gold dominate large surfaces. Use it deliberately for emphasis, selection, or important accents while ocean blue carries the main brand identity.

## Product design principles

- Favor clarity and task efficiency over decoration.
- Use familiar business-interface patterns and predictable navigation.
- Support information density without cramped layouts.
- Keep module navigation, page headers, forms, tables, and dialogs consistent.
- Make the primary action evident without hiding secondary actions.
- Use plain, specific labels. Avoid clever wording and unexplained icons.
- Preserve the user's context after actions whenever practical.
- Show the result of every action with appropriate feedback.
- Distinguish missing data, empty results, zero values, errors, and unavailable actions.
- Never create a control that appears functional but does nothing.

## Responsive strategy

Design desktop and mobile behavior together during implementation.

- Desktop should support efficient ERP work and data-heavy screens.
- Tablet and mobile layouts must remain usable, not merely shrink the desktop page.
- Define how wide tables adapt: controlled horizontal scrolling, prioritized columns, card transformation, or detail expansion as appropriate.
- Keep touch targets usable and avoid interactions that require hover.
- Recheck navigation, dialogs, forms, filters, and action placement at each supported width.
- Do not postpone responsive behavior until the end of the project.

## Accessibility baseline

- Use semantic HTML and native controls where possible.
- Every form control needs a persistent, meaningful label.
- Support keyboard navigation and logical focus order.
- Provide visible focus states.
- Meet WCAG AA contrast for normal text and interactive states where practical.
- Do not use color alone to communicate status or errors.
- Give icon-only controls accessible names and visible tooltips where useful.
- Associate validation messages with their fields.
- Manage focus correctly when dialogs open and close.
- Respect reduced-motion preferences for nonessential animation.

## Required interface states

Design and implement every relevant state, not only the ideal populated screen:

- Initial/default
- Loading or submitting
- Empty
- No search or filter results
- Success
- Informational notice
- Warning
- Validation error
- System or network error
- Disabled
- Read-only
- Permission-restricted
- Blocked account
- Active record
- Inactive or soft-deleted record
- Destructive-action confirmation
- Restore confirmation or result

Use skeletons, spinners, or progress indicators according to expected wait time. Prevent duplicate submissions and give users a safe recovery path after errors.

## Interaction and button rules

We aim to implement and visually test every button and visible control.

- Every visible action must have a defined destination, state change, callback, or clearly communicated unavailable state.
- Test default, hover, focus, active, disabled, loading, success, and error behavior where relevant.
- Destructive actions must look distinct and require confirmation when consequences are meaningful.
- Confirmation text must name the affected record and consequence.
- Soft delete should use the project's inactive-record model; never imply permanent deletion when the system preserves the record.
- Restore actions should be available only where the user's role and rights permit them.
- Avoid multiple competing primary buttons in one action area.
- Do not rely on hover-only discovery for essential actions.

## Forms

- Clearly distinguish required and optional fields.
- Use the correct input type, constraints, and autocomplete behavior.
- Preserve entered data after recoverable validation or server errors.
- Place validation near the affected field and summarize errors when useful.
- Use searchable selects when datasets are large.
- Foreign-key selections must use valid records supplied by the backend rather than unrestricted free text.
- System-generated identifiers, Status, and Stamp are read-only in the UI.
- Never ask users to type audit stamps or derived totals.
- Validate date relationships in the UI for immediate feedback while leaving authoritative enforcement to the backend.

## Data tables and record management

- Provide clear column labels, readable alignment, and stable action placement.
- Support search and filters required by the workflow.
- Communicate active filters and make them easy to clear.
- Preserve meaningful sort, filter, and page state when returning from record details when practical.
- Use explicit empty and no-results states.
- Make row actions accessible by keyboard and touch.
- Show inactive records distinctly in authorized administrative views without making text unreadable.
- On smaller screens, prioritize essential fields and provide a usable route to complete details and actions.

## Required modules and UI considerations

### Authentication and access

- Public landing page
- Registration
- Login and logout
- First-password or set-password flow if retained by the backend requirements
- Forgot-password request and password reset
- Pending, blocked, expired-token, reused-token, and invalid-credential feedback as applicable

Never reproduce the prototype behavior where any password works.

### Dashboard and navigation

- Sidebar or equivalent primary navigation follows role and rights.
- Quick actions follow the same permission source as navigation.
- Dashboard figures must be treated as live backend data, not permanently hard-coded examples.
- Restricted modules must not appear actionable.

### Customers

- List, search, filter, add, edit, soft delete, and restore
- Active, inactive, and all-record views for authorized administrators
- Clear payment-term and address fields based on the confirmed data contract

### Products and price history

- Product list and CRUD states
- Current price display
- Price-history view with effective dates
- Add, edit, delete, and permission states for prices
- Clear no-current-price state

### Human Resources

- Employees, Jobs, and Departments
- Employee profile
- Job and salary history timeline
- Separation date distinct from soft-deleted record status
- Sensitive salary and job-history information visible only with the required right

### Sales and payments

- Sales list and transaction header
- Auto-generated transaction number displayed as read-only
- Customer and salesperson selection
- Sale detail lines with product, quantity, price-as-of-sale-date, and calculated line totals
- Payment recording and balance views
- Soft delete and restore where required
- Responsive master-detail behavior

### Reports

Provide interfaces for all seven planned reports:

1. Top Customers
2. Product Master List
3. Top Products
4. Active Employees
5. All Employees
6. Employee Job History
7. Top Sales

Support the applicable date range, Top N, employee selection, Print, and Save as PDF controls. Reports are read-only and permission-controlled.

### User Management and audit

- User list
- Add and edit user
- Pending-user approval where required
- Block and unblock
- Role designation with protected Superadmin behavior
- Rights dialog grouped by module and action
- Module-level selection plus All and None shortcuts
- Clear partial-selection states
- Audit-log viewer for Superadmin when implemented

An Admin must not see or edit Superadmin accounts. Preventing removal or disabling of the final Superadmin is a backend rule that the UI should communicate but not own.

## Sprint-aligned UI/UX responsibilities

### Sprint 1

- Design system: colors, typography, spacing, and core components
- Authentication flows
- Main page and navigation
- User Management list
- Rights dialog
- Usability review of implemented Sprint 1 screens

### Sprint 2

- Customer screens
- Product and Price History screens
- Empty, error, and delete-confirmation states
- Usability review of implemented Sprint 2 screens

### Sprint 3

- Department and Job screens
- Employee list and profile
- Job timeline component
- Privacy-conscious salary and history presentation
- Usability review of implemented Sprint 3 screens

### Sprint 4

- Sales entry and line items
- Payments and balances
- Seven report screens and report filters
- Print and Save as PDF presentation
- Audit viewer
- Final consistency, responsive, accessibility, and usability pass

## Technology decision

The frontend technology stack is not yet approved. Do not commit the project to a framework, component library, CSS system, state library, or icon package solely because it is familiar.

Before introducing the stack or a major dependency, evaluate:

- Professor and course constraints
- Backend compatibility and integration needs
- Team familiarity
- Accessibility support
- Responsive component needs
- Maintainability within the eight-week schedule
- Build, test, and deployment simplicity

Record the final technology decision here once the team approves it.

## Component and design-system expectations

Prefer reusable, documented patterns for:

- App shell and responsive navigation
- Page header and breadcrumbs where needed
- Buttons and icon buttons
- Inputs, selects, date controls, and validation
- Search and filter controls
- Tables, pagination, and responsive record views
- Tabs
- Cards and statistics
- Status badges
- Alerts and toasts
- Dialogs, confirmation dialogs, and drawers
- Empty, loading, and error states
- Permission-denied and blocked states
- Timeline/history components
- Report filters and print-friendly layouts

Use centralized tokens for color, spacing, radius, typography, borders, shadows, and motion. Avoid one-off values when an established token fits.

## Implementation workflow

For each UI task:

1. Read this guide and the current requirement source.
2. Inspect the existing implementation and related screens.
3. Identify the user role, permissions, task, data, and required states.
4. Check whether the request belongs to UI/UX or depends on another role.
5. Reuse established components and tokens where they fit.
6. Implement the smallest cohesive change that fully supports the workflow.
7. Connect real behavior when its contract exists; otherwise isolate and label temporary fixtures.
8. Test every changed control and relevant state.
9. Check desktop and mobile behavior together.
10. Check keyboard use, focus, labels, contrast, and error messaging.
11. Review related screens for consistency regressions.
12. Report what changed, what was tested, and any backend or requirements dependency.

## Verification standard

A UI task is not complete merely because the default screen renders.

Verify, in proportion to the change:

- The page loads without frontend errors.
- Every changed control performs its intended action.
- Loading, empty, success, validation, and failure states work where relevant.
- Permission variants show the correct navigation, data, and actions.
- Active and inactive record treatments are correct.
- Keyboard navigation and focus behavior remain usable.
- The layout works at representative desktop, tablet, and mobile widths.
- Long labels, long names, many rows, and missing values do not break the layout.
- Destructive and restore flows communicate consequences accurately.
- Related screens still use consistent components and styling.

Use real browser-based visual checks when a runnable frontend exists. Automated checks support verification but do not replace visual inspection. Do not call a design user-tested unless actual representative users evaluated it.

## Handoff and reporting

After significant work, provide:

- A concise summary of the visible result
- Files or components changed
- Controls and responsive widths tested
- Accessibility checks performed
- Temporary mocks or fixtures still present
- Backend contracts or teammate work still required
- Known limitations or unresolved requirements

Do not claim another role's work is complete. Do not hide uncertainty.

## Current open decisions

- Approved frontend framework and supporting libraries
- Exact ocean-blue, gold, black, neutral, semantic, and dark-mode tokens
- Typography family and scale
- Final navigation pattern
- Browser support targets
- Whether dark mode is required
- Exact breakpoint policy
- Final API contracts and validation messages
- Which requirement statements are mandatory grading criteria versus explanatory examples

Update this section as decisions are approved. Do not silently turn a temporary assumption into a permanent rule.
