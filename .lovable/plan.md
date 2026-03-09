

# Remaining Refinement Work

## What's Done
The design system, sidebar, layout, Dashboard, Control Centre, Camps, Players, Coaches, Attendance, My Camps, and StatCard have all been refined with the new design language.

## What's Still Using Old Patterns
These 10 pages still use the V2-V4 `CardHeader`/`CardTitle` layout style instead of the refined `page-header`, `section-label`, `stat-grid` patterns:

1. **Login Page** — needs brand refinement (subtle background, better spacing)
2. **Roster Page** — needs `page-header`, `stat-grid`, better table styling
3. **Payroll Page** — needs consistent header/summary layout
4. **Invoices Page** — needs consistent header/summary layout
5. **Fixtures Page** — needs `page-header`, cleaner card layout
6. **Session Plans Page** — needs `page-header`, better category filter styling
7. **Equipment Page** — needs `page-header`, better assignment display
8. **Coach Session Plans Page** — needs cleaner mobile-first layout
9. **Communications Page** — needs `page-header`, better template cards
10. **Proposals Page** — needs `page-header`, better table styling
11. **Reports Page** — needs `page-header`, better filter bar, chart styling

## Approach
Apply the same patterns already established in the refined pages:
- Replace `CardHeader`/`CardTitle` page wrappers with `page-header` div
- Add `stat-grid` summary cards where appropriate
- Use `section-label` for section headings
- Apply consistent badge styling for statuses
- Use the refined table pattern (Card wrapping Table, no CardContent padding)
- Better empty states with icon + text
- Consistent button placement (top-right of header)

## Implementation
Rewrite each page following the conventions already set in Dashboard, Camps, Players, Coaches — no new patterns needed, just consistency.

