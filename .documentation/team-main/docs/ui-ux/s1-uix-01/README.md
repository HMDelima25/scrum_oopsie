# S1-UIX-01 — Design system

Closes #41. Open `index.html` directly for the component specimen. `tokens.css` preserves the existing application's exact color and geometry variables, without adopting a new framework.

## Usage
- Ocean 700 (#075b7b) on white for primary actions and links; ocean 950 for dark surfaces. Gold is an accent, not small text on white.
- Existing fonts: DM Sans for text, Manrope for headings; use system sans-serif fallback. The specimen uses fallback fonts and needs no network.
- Type: body 16px/1.55, supporting text 14px minimum, section 24px, page 28–44px.
- Spacing: 4, 8, 12, 16, 24, 32, 48px. Controls: at least 44px target height. Radius: control 14px, card 28px, shell 34px for the application; compact specimen cards use 14px.
- Persistent labels, native controls, visible keyboard focus; required and optional fields stated in text. Error copy must describe recovery and use aria-describedby/aria-invalid. Status always has text.
- Tables scroll within their region on small screens; dialogs fit the viewport and scroll internally. Do not shrink text to fit.
- Modal: accessible title, initial focus, Escape/Cancel, focus returned to opener. No background interaction.
- Disabled and read-only differ: disabled actions explain why; read-only identifiers remain selectable.
- Reduced motion disables nonessential transitions. Loading prevents duplicate submission; errors retain entered data.

## Acceptance and boundaries
Colors, typography and core buttons/fields/status/feedback patterns are documented and visible. Component actions in this specimen are disabled by design. Contrast checks and browser review are recorded in `VALIDATION.md`. This is a design deliverable, not authentication or API implementation.

## Provenance
Reused Natalia’s existing ocean-blue/gold design from branch `UI/UX-/-NATALIA` at `4fcd3a9`. Earlier frontend PRs #8–#15 remain historical work; this task-specific submission does not undo them. Base: `main` at `39620f7`. Requirements: assigned GitHub issue and existing professor reference `.files/.examples/index.html` on the Natalia branch.
