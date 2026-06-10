# dashboard-shell-01 — intentional placeholder examples

These blocks (statistics, sales/earning charts, top-product table,
sales-by-country widget, dropdowns, etc.) were brought in with the
`@shadcn-space` dashboard shell. **They are kept on purpose** as worked
examples for future dashboard build-out — they are **not** shipped features
and **not** dead demo code to delete.

What that means for readers and reviewers:

- The data is **mock/hardcoded**. Nothing here is wired to the backend.
- They render below the real Feeds features on `/dashboard`, fenced off under
  the "Analytics widgets" example section (see
  `components/dashboard/page-body` `ExampleSection`).
- When a real dashboard feature lands, replace the relevant block with a
  data-backed component (or remove it). Don't treat the mock numbers as real.

Styling note: per `AGENTS.md`, these blocks use the project's **semantic
CSS-variable tokens** (`bg-primary`, `text-success`, `bg-warning/10`,
`text-destructive`, …) rather than hardcoded palette classes
(`bg-teal-400/10`, `text-blue-500`, …). Keep new placeholder work on the
semantic tokens so it stays legible in both light and dark themes.
