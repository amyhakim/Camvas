# Showcam

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js and TypeScript, chosen by the user. Blender-authored scenes will be rendered in the browser with Three.js / React Three Fiber, as confirmed in the planning conversation.

## Users

Directors and collaborators exploring scene blocking, camera choices, and timing for previs. This audience and purpose come from the user-provided project.md.

## Product Purpose

A spatial planning environment with a scene viewport, synchronized timeline, and object information. The current implementation includes the reusable UI system and live 3D viewer with Orbit, Fly, Shot, real object selection, synchronized camera playback, and local camera-move authoring.

## Operating Context

The user supplied a Barcelona Pavilion Blender scene, textures, and daytime, sunset, and nighttime reference renders. The scene has seven cameras and a camera movement across frames 1–250, within a 1–374 frame range at 24 fps.

## Capabilities and Constraints

The viewer supports playback, inspection, and a first camera-authoring slice adapted from Blockout. Choose actual scene geometry as a subject, select one of 39 camera presets, set duration (1–60 seconds), lens (8–300 mm), sensor, and framing, then generate a separate draft camera track. Framing uses world-space geometry bounds and the starting angle follows the current view. Preview, scrub, inspect the path, and edit camera-mark position, lens, and roll; pan and tilt become editable when subject centering is disabled. Editing marks or changing subject tracking pauses playback. The original Blender cameras and animation remain intact and selectable.

The timeline extends to accommodate longer drafts and holds shorter clips at their final pose. One draft lives in memory: regenerating replaces it and its mark edits, discarding removes it, and reloading clears it. Subjects remain static; paths do not avoid geometry or test occlusion. Geometry editing, saved projects, live Blender synchronization, and a Blender backend are outside this slice.

The user chose a textured preview and their existing Blender scene. Browser rendering may approximate Blender materials. Desktop is the primary layout, with accessible responsive controls. On phones, Generate, Preview, and showing Path close the inspector to expose the scene while retaining timeline transport.

## Brand Commitments

Showcam is the project name. The user explicitly requested the Impeccable skill and a rounded glass aesthetic, with a reusable design system built around it.

## Evidence on Hand

project.md provides the product concept. pabellon_barcelona_v1.scene_ contains the source scene and reference renders. The design-system material study uses labeled still reference imagery; the main viewer renders actual exported geometry. Camera authoring is local procedural generation; no AI generation, live synchronization, or backend is implemented. The adapted Blockout camera tools retain Apache-2.0 license and NOTICE files, source and modification records, and visible credit to Sam Wasserman (wassermanproductions.com).

## Product Principles

- Keep the scene visible while controls remain readable.
- Connect object identity, selection, and timing.
- Preserve structured scene information for future editing.
- Distinguish interface demonstrations from implemented scene capabilities.
