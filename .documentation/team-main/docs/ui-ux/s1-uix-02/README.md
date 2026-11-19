# S1-UIX-02 — Authentication wireframes

Closes #42. Open `index.html`. Five low-fidelity screens cover login, registration, first-password setup, forgot password and reset password. All controls are deliberately disabled; annotations specify transitions and outcomes.

## Layout and accessibility
Desktop uses adjacent screen cards for review; mobile stacks them in flow order. Production authentication uses the existing two-panel composition, with the form first on mobile. Persistent field labels, email/password input types, visible focus and non-color status text are required. Field errors associate through aria-describedby; submitting states use aria-live and prevent resubmission.

## Screen contracts
| Screen | Input | Success | Recoverable states |
|---|---|---|---|
| Register | First/last name, email | Pending User; approval message | Required, invalid/duplicate email, network |
| Login | Email, password | Fetch session/rights, permitted main page | Invalid, blocked, pending, rate limited, network |
| Forgot | Email | Neutral eligibility message | Invalid email, retry; no false sent message |
| Set password | Invitation token, new/confirmed password | Return to login | Expired/reused/invalid token, mismatch |
| Reset | Reset token, new/confirmed password | Return to login; old password invalidated by server | Expired/reused/invalid token, mismatch |

Logging out ends the server session before redirecting. Protected pages redirect only after authentication failure. Server owns hashing, token lifecycle, session invalidation and rate limiting.

## Current backend differences — not silently resolved
At main 39620f7, POST /api/auth/register expects `{name,email,password}`. The assigned story specifies first/last name/email and a one-time set-password link. No dedicated set-password route exists. Password reset currently generates a debug token rather than sending email. Wireframes retain the assigned story and flag these gaps for the Developer; no API changes are included.

## Provenance
Reused Natalia’s existing ocean-blue/gold design from branch `UI/UX-/-NATALIA` at `4fcd3a9`. Earlier frontend PRs #8–#15 remain historical work; this task-specific submission does not undo them. Base: `main` at `39620f7`. Requirements: assigned GitHub issue and existing professor reference `.files/.examples/index.html` on the Natalia branch.
