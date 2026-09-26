# Showcam

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js and TypeScript, chosen by the user. Blender-authored scenes will be rendered in the browser with Three.js / React Three Fiber, as confirmed in the planning conversation.

## Users

Directors and collaborators exploring scene blocking, camera choices, and timing for previs. This audience and purpose come from the user-provided project.md.

## Product Purpose

A spatial planning environment with a scene viewport, synchronized timeline, and object information. The current implementation includes the reusable UI system and live 3D viewer with Orbit, Fly, Shot, real object selection, synchronized camera playback, and local camera-move authoring, saved projects, and timed proxy actor blocking.

## Operating Context

The user supplied a Barcelona Pavilion Blender scene, textures, and daytime, sunset, and nighttime reference renders. The scene has seven cameras and a camera movement across frames 1–250, within a 1–374 frame range at 24 fps.

## Capabilities and Constraints

The viewer supports playback, inspection, and a first camera-authoring slice adapted from Blockout. Choose actual scene geometry as a subject, select one of 39 camera presets, set duration (1–60 seconds), lens (8–300 mm), sensor, and framing, then generate a separate draft camera track. Framing uses world-space geometry bounds and the starting angle follows the current view. Preview, scrub, inspect the path, and edit camera-mark position, lens, and roll; pan and tilt become editable when subject centering is disabled. Editing marks or changing subject tracking pauses playback. The original Blender cameras and animation remain intact and selectable.

The timeline extends to accommodate longer drafts and holds shorter clips at their final pose. One camera draft and up to eight proxy actors are saved in a scene-scoped project in this browser. Regenerating replaces the camera draft and mark edits; discarding removes it from the saved project. Project controls expose a name, save status, validated JSON import/export, and explicit recovery for damaged or unavailable browser storage. Camera subjects remain static; paths do not avoid geometry or test occlusion. Geometry editing, cloud collaboration, live Blender synchronization, and a Blender backend are outside this slice.

Actor blocking adds selectable proxies with editable name, height, feet position, heading, and up to 64 timed marks per actor over 0–60 seconds. The editor evaluates linear positions and shortest-arc headings at `(frame - 1) / fps`, synchronized with the timeline. Actors can be framed, previewed, removed, and restored through project save/import. They are spatial proxies, not rigged animated characters. Moving-actor camera tracking and AI planning remain later slices.

The user chose a textured preview and their existing Blender scene. Browser rendering may approximate Blender materials. Desktop is the primary layout, with accessible responsive controls. On phones, Generate, Preview, and showing Path close the inspector to expose the scene while retaining timeline transport.

## Brand Commitments

Showcam is the project name. The user explicitly requested the Impeccable skill and a rounded glass aesthetic, with a reusable design system built around it.

## Evidence on Hand

project.md provides the product concept. pabellon_barcelona_v1.scene_ contains the source scene and reference renders. The design-system material study uses labeled still reference imagery; the main viewer renders actual exported geometry. Camera authoring is local procedural generation; no AI generation, live synchronization, or backend is implemented. AI integration is planned separately in docs/ai-planning-next.md. The adapted Blockout camera tools retain Apache-2.0 license and NOTICE files, source and modification records, and visible credit to Sam Wasserman (wassermanproductions.com).

## Product Principles

- Keep the scene visible while controls remain readable.
- Connect object identity, selection, and timing.
- Preserve structured scene information for future editing.
- Distinguish interface demonstrations from implemented scene capabilities.
