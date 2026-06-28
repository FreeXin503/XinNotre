# Project: OPPO便签导出系统 Layout Refactoring

## Architecture
- Root page: `preview.html`
- Color variables, dark/light themes, and UI states.
- 4-Dimensional Skeleton structure:
  - Sidebar Navigation (Leftmost, icon only)
  - Secondary Drawer Panel (Knowledgebase / Experts list, collapsible)
  - Main Content Area (Notes list, fluid cards layout)
  - Right AI Side Panel (Clarify & Refine, persistent or responsive toggle)

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|---|---|---|---|
| 1 | Exploration | Analyze current layout, classes, color themes and structure in `preview.html` | None | PLANNED |
| 2 | Implementation | Refactor HTML structure and CSS styles to introduce the 4D skeleton layout while keeping exact color definitions | Exploration | PLANNED |
| 3 | Verification | Review layout responsive performance, scroll behaviors, panel toggle, borders, border-radii, and gaps | Implementation | PLANNED |
| 4 | Audit & Signoff | Perform forensic audit verification of code authenticity and finalize layout refactoring | Verification | PLANNED |

## Code Layout
- `preview.html`: Main HTML/CSS/JS file to be refactored.
- `notes_data.js`: External data source containing notes, which is referenced in `preview.html`.
