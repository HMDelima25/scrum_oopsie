# HOPE, Inc. Frontend Application Foundation

## Status

The code in this directory is the real, primary HOPE, Inc. ERP frontend application. It will grow from the authentication flow into the complete website and defines the brand, visual system, responsive strategy, accessible interaction baseline, and implementation conventions.

The current application is buildless because the final technology stack has not been approved. Buildless does not mean temporary. Continue implementing here unless the team explicitly approves a framework migration. Any approved migration must preserve established behavior and design decisions rather than replacing them without review.

## Established visual language

- Ocean blue carries the primary brand identity.
- Gold is used for deliberate emphasis and active details.
- Near-black and midnight blue create structure and high-contrast feature surfaces.
- Large surfaces use rounded-square geometry rather than universal pill shapes.
- Layering, blur, glow, and asymmetry are controlled accents rather than decoration on every page.
- Operational screens should translate the authentication page's character into practical, readable ERP layouts.

The CSS custom properties in `styles.css` are the current source of truth for color and geometry tokens. New work should reuse them before introducing another value.

## Extension rules

When adding a page:

1. Start from the shared brand, type, color, radius, focus, and spacing patterns.
2. Use semantic HTML before adding custom behavior.
3. Reuse existing button, field, message, dialog, and focus-state patterns.
4. Implement desktop and mobile behavior together.
5. Include loading, empty, error, validation, disabled, and permission states where relevant.
6. Keep backend-dependent behavior isolated and identify the required API contract.
7. Test visible controls with keyboard and pointer input.
8. Avoid copying an entire page when a reusable component can own the pattern.

## Suggested growth path

As modules are implemented, evolve the main application without discarding the established foundation:

```text
UI-UX/
  index.html
  styles.css
  script.js
  pages/
  assets/
    icons/
    images/
  components/
  modules/
    auth/
    customers/
    products/
    hr/
    sales/
    reports/
    users/
```

Create these directories when real files need them. Do not add empty structure only for appearance.

## Backend boundary

The frontend owns presentation, client-side feedback, interaction behavior, and immediate validation. The backend remains authoritative for authentication, authorization, business rules, persistent data, audit records, and security enforcement.

Temporary frontend-only behavior must never pretend that data was persisted or that authentication succeeded. Replace each pending integration message once the responsible backend contract is available.

## Framework migration rule

Before adopting a framework, record the decision and migration approach. Preserve:

- Visible behavior and copy
- Responsive layouts
- Keyboard and focus behavior
- Form labels and validation relationships
- Design tokens and established component geometry
- Permission and record-state presentation

Run the old and migrated flows through equivalent checks before removing superseded code. Do not delete the buildless foundation until the replacement is verified and Natalia explicitly approves its removal.
