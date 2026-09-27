# Shared scene graph

Status: proposed project plan.

## Goal

Build a shared scene system for GLB and Gaussian splat assets so users can identify objects, add actors, plan movement, and create camera shots.

Start with the schema in `codex/semantic-path-planning` and the existing scene graph, actor blocking, and Director action code.

## Main tasks

### 1. Load the scene graph

Load a description of the scene alongside its visual asset. Include:

- Objects with stable IDs, names, positions, and bounds.
- Named spaces, such as rooms, courtyards, and terraces.
- Anchors: named positions for actor placement or camera shots.
- Relationships between objects, spaces, actors, and cameras.
- Candidate routes between positions.

Use the same IDs across the graph, project state, and renderer. Convert all planning positions to Y-up coordinates in metres.

### 2. Load collision geometry

Load simple boxes or simplified meshes for walls, floors, furniture, and other obstacles. Align them with the visual asset.

Use this geometry to check actor placement and movement paths. Camera routes need their own clearance rules because cameras can move through three-dimensional space.

Record which parts of the scene have collision data. Missing data means clearance is unknown. Room bounds and object framing bounds are separate from collision geometry.

### 3. Use a VLM to fill missing scene information

Give a vision-language model rendered views plus available camera, depth, and geometry data.

The VLM proposes object labels, named spaces, anchors, and relationships. Validate each proposal before saving it. World positions must be supported by depth or measured geometry. Keep the evidence and review status with accepted additions.

For splats, save this information in a companion scene description. When a matching Blender model exists, reuse its aligned metadata and collision geometry.

### 4. Add actors and blocking

Blocking means an actor's position, orientation, movement, and timing.

When an actor is added:

1. Create a stable actor ID and initial placement.
2. Save the actor in project state.
3. Derive its scene graph node, movement track, and collider.
4. Refresh the viewport and timeline.

Use the same process for actor edits and deletion.

Support instructions such as:

- Place an actor at the entrance anchor.
- Place an actor one metre from a selected chair.
- Move an actor to the terrace over six seconds.
- Turn an actor toward another object.

Resolve scene references into positions, calculate movement, check the path, and save timed marks for playback. If a referenced object moves, flag the dependent blocking for regeneration.

### 5. Use subagents to propose actions

A coordinator divides a request into tasks:

| Subagent | Responsibility |
| --- | --- |
| Scene understanding | Propose missing labels, spaces, and anchors |
| Blocking | Propose actor placements and movement |
| Camera planning | Propose subjects, destinations, timing, and shot settings |

Each subagent reads a scene snapshot and returns structured actions. The coordinator handles dependencies, such as planning actor movement before planning a camera that follows it.

A deterministic executor validates the actions and applies the accepted batch as one undoable edit. A failed batch changes nothing. Reject proposals based on outdated state, and prevent retries from creating duplicate actors.

## State rule

Update project state once, then derive the scene graph, playback poses, and collision transforms from it.

Manual controls and AI actions use the same validation and update functions. Playback calculates poses from saved marks, so seeking to the same time produces the same scene.

## Build order

1. Connect the existing scene graph and semantic-navigation schema.
2. Load companion metadata and colliders for a splat.
3. Connect actor changes to graph and collider updates.
4. Add blocking relative to objects and anchors.
5. Add VLM suggestions.
6. Add action subagents as needed.

The semantic-navigation branch uses the earlier Three.js viewport. Reuse its headless route planner and adapt collision queries to the current PlayCanvas viewport.

## Completion criteria

- GLB and splat scenes support the same object and anchor references.
- Adding, moving, or removing an actor updates the graph, timeline, and colliders consistently.
- Blocking can reference a scene object or anchor and produce editable timed marks.
- Route results distinguish clear, blocked, and unknown collision coverage.
- VLM and subagent output is validated before it changes the scene.
