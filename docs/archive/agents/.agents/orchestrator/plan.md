# Implementation Plan: Layout Refactoring for OPPO Note Exporter System

## Objective
Refactor `preview.html` to introduce a modern four-dimensional responsive skeleton layout while preserving the original theme colors, background variables, and functionalities.

## Color Theme Preservation (Mandatory)
We MUST keep the exact CSS variables and transition behaviors defined in the original `preview.html`:
- Dark mode theme base: `--bg-base: #131314;`, `--bg-surface: #1e1f20;`, `--bg-hover: #2e2f30;`, `--border-color: #2e2f30;`, `--primary: #8ab4f8;`, etc.
- Light mode theme variables mapping to `.light-theme`.
- Maintain the visual fidelity of note cards, chart containers, stats, and text readability.

## Four-Dimensional Skeleton Architecture (R2 & R3)
1. **Dimension 1: The Icon Navigation Bar (Far Left)**
   - Always visible icon-only bar.
   - Minimal width (e.g., 64px).
   - Contains navigation items like "Notes / Main Content", "Knowledge Base (知识库)", "Expert Team (专家团)", "Theme Toggle", etc.
2. **Dimension 2: The Secondary Drawer Sidebar (抽屉面板)**
   - Floating or sliding flex container that overlays or pushes the content.
   - Triggers when clicking on "Knowledge Base" (showing folder categories/nodes) or "Expert Team" (expert list).
   - Borderless, clean design, slide-in/out, can be dismissed by clicking close or an overlay/scrim (or clicking main panel).
3. **Dimension 3: Main Content Area (Center)**
   - Houses the fluid card containers (note cards) and/or note reader.
   - Can be split or responsive: note card list + reader view.
4. **Dimension 4: AI Clarify & Refine Panel (Far Right)**
   - Always-visible or collapsible sidebar on the right dedicated to deep alignment and multi-dimensional analysis/chat.
5. **Layout Spacing & Aesthetics (R3)**
   - All panels must be separated by gaps of `16px` to `20px` (utilize CSS grid or flex gaps).
   - Uniform border-radius configuration for panel elements: `12px` to `16px`.
   - Global `height: 100vh; overflow: hidden;` ensuring independent scrolling inside panels and no global window scrollbar.

## Step-by-Step Milestones
1. **Milestone 1: Exploration and Requirements Matching**
   - Parse `preview.html` elements, styles, existing DOM elements, and script bindings.
   - Establish which elements map to Sidebars, Panels, Reader, and AI Chat.
2. **Milestone 2: Design CSS layout & Responsive Skeleton**
   - Inject the new structural grid/flex rules into the `<style>` section of `preview.html`.
   - Ensure variables and light-theme overrides are completely untouched or adapted to layout containers.
3. **Milestone 3: Refactor HTML DOM Structure**
   - Rearrange the DOM elements in `preview.html` to align with the new 4D structure.
   - Add/adapt drawer navigation triggers and slide controls in javascript.
4. **Milestone 5: Verification & Integrity Check**
   - Verify UI rendering, scrolling behavior, click-to-open drawer panel actions, and color theme fidelity.
   - Ensure Forensic Auditor verifies zero cheating.
