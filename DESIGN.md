---
name: Speculib
description: A spatial personal PDF library with restrained dark working surfaces.
colors:
  deep-space: "#040910"
  panel: "rgba(10, 22, 34, 0.94)"
  resource-panel: "rgba(9, 21, 33, 0.94)"
  raised: "#142332"
  line: "#aacfe51c"
  foreground: "#e9f2f7"
  muted: "#9fb4c5"
  accent: "#83d9ee"
  action: "#8bd9eb"
  action-ink: "#09222d"
  action-hover: "#b1ebf5"
  selected-nav: "#173345"
  selected-ink: "#a5e3f1"
  selected-tab: "#203446"
  selected-tab-ink: "#eff8ff"
  science: "#58c9f5"
  machine-learning: "#ffad59"
  philosophy: "#b198ed"
  mathematics: "#63d5c6"
  fiction: "#f17b9a"
  history: "#e7d27c"
  computer-science: "#7fa9ff"
  cooking: "#a4d58b"
typography:
  brand:
    fontFamily: '"Manrope Variable", sans-serif'
    fontSize: "22px"
    fontWeight: 550
    letterSpacing: "-0.035em"
  title:
    fontFamily: '"Manrope Variable", sans-serif'
    fontSize: "15px"
    fontWeight: 600
    letterSpacing: "-0.02em"
  body:
    fontFamily: '"Manrope Variable", sans-serif'
    fontSize: "13px"
  resource-title:
    fontFamily: '"Manrope Variable", sans-serif'
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.55
  label:
    fontFamily: '"Manrope Variable", sans-serif'
    fontSize: "11px"
  action:
    fontFamily: '"Manrope Variable", sans-serif'
    fontSize: "12px"
    fontWeight: 650
rounded:
  panel: "12px"
  control: "7px"
  tab: "4px"
  mode-switch: "8px"
  composer: "9px"
  modal: "14px"
spacing:
  control-gap: "8px"
  panel-gap: "18px"
  viewport-inset: "20px"
  book-gap: "24px"
components:
  button-primary:
    backgroundColor: "{colors.action}"
    textColor: "{colors.action-ink}"
    typography: "{typography.action}"
    rounded: "{rounded.control}"
    padding: "9px 13px"
  button-primary-hover:
    backgroundColor: "{colors.action-hover}"
    textColor: "{colors.action-ink}"
  floating-panel:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.panel}"
  nav-selected:
    backgroundColor: "{colors.selected-nav}"
    textColor: "{colors.selected-ink}"
    rounded: "{rounded.control}"
    padding: "11px 10px"
  tab-selected:
    backgroundColor: "{colors.selected-tab}"
    textColor: "{colors.selected-tab-ink}"
    rounded: "{rounded.tab}"
    padding: "6px 12px"
---

# Design System: Speculib

## Overview

**Creative North Star: "The Spatial Library"**

A dark, space-inspired desktop library. Colored subject clusters supply the atmosphere and orientation; restrained HUD surfaces keep browsing, reading, and source retrieval familiar. The library remains visible as light points behind the working interface.

Keep the interface compact and quiet for sustained use. The spatial treatment supports real library content: placement is illustrative and subject-based, not a semantic embedding visualization. Preview resources remain explicitly identified; the interface must not imply OCR, embeddings, or generated explanations are available.

**Key Characteristics:**
- Deep-space background with readable translucent work surfaces.
- A visible subject map and independently collapsible side panels.
- Concise controls, restrained cyan actions, and consistent subject identity.

## Colors

The palette pairs cool dark neutrals with a sparse cyan action layer and distinct subject colors. Frontmatter is normative; values are extracted from `src/style.css` and `src/space.ts`.

### Primary
- **Action Cyan:** `accent` marks focus and the brand icon; `action` fills import and send controls, with dark action ink and a lighter hover state.

### Secondary
- **Subject Spectrum:** Science, Machine Learning, Philosophy, Mathematics, Fiction, History, Computer Science, and Cooking use their named frontmatter colors. Unknown subjects deterministically reuse this eight-color palette. Map, legend, and shelf markers share the assignment; colors are identity rather than arbitrary decoration.

### Neutral
- **Deep Space:** viewport and universe background.
- **Floating Panel / Resource Panel:** slightly different translucent dark surfaces for side work areas and the central dock.
- **Raised:** elevated control vocabulary.
- **Foreground / Muted:** readable primary and secondary text.
- **Line:** low-contrast panel edges; selected navigation and tabs use tonal fills with brighter text.

**The Subject Identity Rule.** Reuse each subject's actual color across surfaces; do not recolor clusters for visual balance.

## Typography

**UI Font:** self-hosted Manrope Variable, with sans-serif fallback. The brand uses the largest UI role; there is no hero display hierarchy. Georgia is limited to generated preview cover lettering, not interface headings.

### Hierarchy
- **Brand:** compact identifying wordmark using the frontmatter brand role.
- **Title:** panel headings using the title role; resource headings truncate at a maximum of 45ch.
- **Body:** root interface text uses the body role. Controls and supporting text commonly use 12px; librarian copy uses 11px with generous line height (1.8).
- **Resource Title:** readable compact book titles with the resource-title role.
- **Label:** the label role supports metadata; smaller 9–10px text is reserved for tertiary tags and helper details. Numeric resource counts use tabular figures.

**The Quiet Hierarchy Rule.** Establish priority through weight, spacing, and contrast before increasing type size.

## Layout

The desktop grid expresses the confirmed approximate 20/60/20 balance as `minmax(210px, 1fr) minmax(0, 3fr) minmax(280px, 1fr)`. Its 59px app bar sits above the workspace; default workspace padding is `78px 20px 20px`, with an 18px column gap. Each side collapses independently to a 44px rail.

The center is transparent above the resource dock. Its map stage occupies 37% of the center height, constrained to 220–370px, with 18px bottom padding. The resource dock fills the remaining space and scrolls internally. Side shelves and librarian content also scroll internally; the page itself does not scroll.

Book grids use auto-fill columns with a 135px minimum, 24px gaps, and `21px 24px 24px` padding. Covers are 182px high and at most 180px wide. List mode uses one column and 61px-wide, 84px-high covers.

At widths of 1700px and above, outer horizontal inset becomes 26px, gap 24px, book minimum width 155px, book gap 27px, and cover height 215px. At 1200px and below, sides become 200px/260px, gap 12px, padding `72px 12px 12px`; map basis becomes 32% with a 180px minimum and 14px bottom padding; book minimum width becomes 120px and cover height 160px. At 950px and below, sides become 175px/230px with 10px gaps/insets, status and map legend hide, toolbars wrap, and book minimum width becomes 115px. Collapsed rails remain 44px at every breakpoint. The body has an 820px minimum width: narrower phone layouts are not implemented.

Explore removes the work panels and exposes the same 3D library, with concise exit and flight controls and covers revealed on approach.

## Elevation & Depth

Depth comes primarily from the spatial canvas, dark tonal layers, translucent surfaces, and thin borders. Working panels have no drop shadow or backdrop blur. Covers use a physical-book shadow (`3px 8px 16px #0005`); map legend text uses a subtle readability shadow (`0 1px 5px #000`). Avoid spreading cover-style elevation to ordinary controls.

Motion is functional and brief: button color transitions use 0.16s, cover lift uses 0.18s ease-out and moves upward 3px, and cover overlays fade over 0.16s. Reduced-motion preference removes CSS transitions/animations and autonomous star drift while preserving deliberate exploration.

## Shapes

Floating work areas use the panel radius. Controls use gently curved corners, with tighter tabs, rounded mode groups, and slightly larger modal corners as captured in frontmatter. Borders are thin (1px); tiny circular shelf and legend markers echo map points. Preview covers have an asymmetric book silhouette (`2px 5px 5px 2px`). Icons are restrained line SVGs, not decorative HUD ornament.

## Components

### Buttons

Primary actions are compact cyan controls with dark ink, the action typography role, and a minimum height of 38px. Hover lightens the fill. Ordinary buttons remain transparent with tonal hover fills. Disabled buttons use 0.4 opacity and the default cursor. Keyboard focus uses a 2px accent outline offset by 3px.

### Cards / Containers

Side navigation, librarian, resource dock, and reader use thin edges and the panel radius. Preserve the open map area above the dock. Resource items have cover, title, author, and subject links rather than independent dashboard card shells.

### Inputs / Fields

Search is a 37px-high dark inset field with 7px corners and `0 10px` padding. Its border shifts toward cyan on focus within. The composer uses 9px corners and an 85px-high textarea; its send control is 29px square. Reader page fields and editing inputs retain familiar native form behavior. Editing dialogs are at most 440px wide (90vw), with 26px padding and 14px corners.

### Navigation

Library/Explore is a centered segmented switch. Sidebar rows use concise text, icons, counts, and subject markers; selection uses tonal cyan rather than a large glowing treatment. Panel toggles are 28px square. Collapsing hides panel content but retains the toggle in a 44px rail.

### Resource Controls and Subject Links

Filter tabs sit inside a dark rounded track with a distinct selected fill. View controls and sort remain compact native controls. Subject tags are small underlined text links, not filled pills. Hovering or focusing a cover reveals its open action; hovering lifts the cover slightly.

### Spatial Library

The complete library appears as light points in subject clusters. The map stage stays visually open; Explore reveals covers nearby and permits 3D flight. Preserve honest context for illustrative placement and preview content. Source matches open their physical PDF pages; whole resources open at page one.

## Do's and Don'ts

### Do:
- **Do** keep the library map visible around readable work surfaces.
- **Do** preserve independent panel collapse and clear keyboard focus.
- **Do** bind subject markers, legends, and spatial nodes to the same subject colors.
- **Do** distinguish real source content from labeled previews and illustrative placement.

### Don't:
- **Don't** add slogans, decorative introductions, fake telemetry, coordinates, or workspace breadcrumbs.
- **Don't** replace the spatial library with a generic card dashboard.
- **Don't** imply semantic embeddings, OCR, LLM explanations, or evidence beyond the local library exist.
- **Don't** claim a phone layout below the implemented desktop minimum.
