# Non-enumerating auth responses

All public auth endpoints return non-enumerating responses: the caller cannot
distinguish "account exists" from "account does not exist" by inspecting the
HTTP status, response body, or side effects (notifications).

## Context

During Slice 1 (Auth + tenancy), the register endpoint was initially designed to
return a **409 Conflict** when an email was already registered (Issue 2's
"explicit duplicate-email" trade-off). Meanwhile, `resendConfirmation` and
`login` were non-enumerating from the start. This inconsistency meant that the
register endpoint alone leaked account existence.

## Decision

Standardise on **non-enumerating** responses across all public auth endpoints.
For register specifically, a duplicate email now returns the same 201 Created
with a synthetic response (random UUID, no confirmation link) that is
indistinguishable from a genuine registration. No notification is sent for the
duplicate attempt, eliminating both direct and indirect enumeration vectors.

This **reverses Issue 2's original "explicit duplicate-email" choice** in favour
of consistency and reduced account enumeration.

## Alternatives

(a) Keep the 409 Conflict — clearer UX ("you already have an account") but
enables account enumeration. (b) Return 201 with the *real* userId but no
notification — still enumerating via the userId.

## Trade-offs

Gained a coherent, non-enumerating stance across login, register, and
resend-confirmation. Lost the helpful "you already have an account" message for
users who forget they registered. Maps to Principle 4 (multi-tenant isolation).
