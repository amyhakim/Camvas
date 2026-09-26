---
version: 1
slug: "src-app-page-tsx"
primary_target: "src/app/page.tsx"
related_targets: ["src/app/design-system/page.tsx"]
---

# Viewer and design system

Mode: Operate. Build a reusable Next.js UI foundation, interactive specimen, and live viewer of the supplied Blender pavilion scene. The user explicitly chose rounded glass and code-first implementation. Prior conversation established Next.js, playback/inspection, and textured browser rendering. The user explicitly expanded this task to actual live 3D rendering and moving through the scene; GLB export and navigation are implemented. The user subsequently requested the first Blockout camera-authoring slice within this same visual world: subject-based presets, editable camera marks, and local preview alongside the preserved Blender cameras.

## Direction contract

THESIS: A director's light table: the scene occupies the canvas while translucent controls sit at its perimeter. Readability remains stable over moving imagery.

OWN-WORLD: Smoked charcoal glass, warm white Manrope, amber selection, rounded 24px floating panels and 12px controls. Thin highlight rims and soft downward shadows separate glass from scene. The user refined the direction toward more transparent glass: deep charcoal at 60/64/72% with 32px blur and brighter inset rims. Dense data retains the darkest glass.

STORY: Open the pavilion, select actual scene geometry, inspect its properties, and scrub the imported camera animation. Use Create camera move or Inspector → Camera move to choose one of 39 presets, duration, lens, sensor, and framing; generate a draft from actual world-space subject bounds and the current view angle. Preview or scrub the separate draft track, inspect its path, and refine its marks while the imported cameras remain selectable. Open the component reference to reuse this vocabulary.

FIRST VIEWPORT: Full-window live 3D stage without a top header or outer frame. Floating tool strip at upper center, scene identity upper left, camera and compact utilities upper right, object browser at left and inspector at right, glass timeline floating along the bottom. On phones, the scene still fills the window; the inspector starts closed and opens as a bounded floating sheet. Signature interaction: choosing real geometry links its selection outline, list row, and inspector; Orbit, Fly, and Shot expose spatial navigation and synchronized source or draft camera playback; the clarity control switches all glass to an opaque accessible mode. Motion is 160–220ms ease-out, reduced-motion aware.

FORM: Director's light table, sixth grounded candidate; seed d679047d. Other considered grounded systems: viewfinder, editing console, location scout contact sheet, call sheet, lens bench, director's light table, material library. User-pinned rounded glass takes precedence over catalog alternatives; use shared-scale specimen comparisons in the component reference and a precise timing axis in the timeline. No additional style approval is needed: the explicit brief and code-first reply authorize implementation.

AUTHORING EXTENSION: Keep the existing glass inspector as the authoring surface, with Object / Camera move sections, labeled controls, an amber Generate action, and progressive disclosure for framing, sensor, and camera marks. Duration is 1–60 seconds and lens is 8–300 mm. Marks expose position, lens, and roll; pan and tilt require Keep subject centered to be disabled. Mark selection seeks and pauses; edits and tracking changes pause playback. Generate selects the draft at its first frame; Preview restarts playback. Path switches to Orbit and fits the curve, marks, and subject between visible panels and above the timeline, recalculating after viewport resize. On phones, Generate, explicit Preview, and showing Path close the inspector to leave the shot or overview visible with transport available.

SCOPE: One in-memory draft, with regeneration replacing mark edits and reload clearing the move. A static subject snapshot; no collision or occlusion avoidance. The timeline extends for longer drafts, with final-pose holds for shorter clips. The original Blender camera animation is preserved. The local procedural camera tools are adapted from Apache-2.0 Blockout with retained license, NOTICE, source/modification records, and visible Sam Wasserman credit. No new visual world or token changes are part of this extension.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance. Camera-authoring product and behavior documentation is recorded in `.impeccable/review/camera-authoring/documentation.md`; visual and interaction verification remains the responsibility of the finish review.
