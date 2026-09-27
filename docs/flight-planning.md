# Drone shooting guide: intent → geometry → choreography → validation

## Automated background flow (implemented)

The editor's **Astra · automatic drone shot** panel now uses this flow instead of the landmark-first background proposal:

1. Read the viewing intent and current, reviewed semantic regions. Subjects identify what to show; their bounds are not free camera space.
2. Capture original GLB mesh bounds in renderer Y-up metres. Do not use visual Blockout batches as proof of clearance. Existing landmarks are not constraints.
3. Ask Astra for ordered visual beats and fresh camera control points, with separate gaze subjects/look-ahead modes and lens settings. Openings must be supported by gaps in geometry; glass remains solid. Reusing an entry for exit is acceptable.
4. Generate a centripetal curve, arc-length pacing, eased starts/stops, rate-limited gaze and a stationary gradual closing zoom. No snap zoom.
5. Validate the saved playback representation, including positions between control points. Require conservative 0.3 m static-box clearance, peak travel <=2.05 m/s, turn <=35 degrees/s, finite-difference acceleration <=3 m/s² and zoom <=10 mm/s. Curve length, limits, or unknown geometry can reject a route.
6. Capture original-appearance images at visual beats, intervening transitions and the final view without changing the active camera. Ask Astra to review framing, intent order and visible crossings. This is sampled evidence, not proof of continuous visibility or physical flight safety.
7. Feed numerical/visual failures back for at most three proposals. Unresolved uncertainty, failed review, capture errors or stale state prevent saving. There is no forced approval.
8. Recheck the project identity and intent, validate the project codec, write a browser-local prior-project backup, then apply the shot as one undoable edit. A browser-local review record retains intent, plan, metrics and review notes. Source assets and labels remain unchanged.

Empty scenes with reviewed labels start once in the background after loading; the panel can disable this. Existing saved shots are preserved until **Generate smooth shot** is requested. Cancel and edits to project/intent invalidate in-flight work. Undo does not immediately regenerate the same automatic job. No scene data is sent until a job starts; model jobs send labels, bounds and rendered frames through the existing local Codex app-server integration to `gpt-6-astra` at medium effort.

Semantic labeling starts once in the background when a supported mesh scene loads without a semantic layer. It captures four original-scene views and grounds AI suggestions in source object bounds, saving one undoable edit. Opening the labels panel is not required and closing it does not cancel the job. Existing layers are preserved (including deliberately emptied layers); retry/regenerate and cancel remain available. Document edits invalidate an in-flight snapshot. Suggestions are not automatically marked reviewed: review labels and extents before they are eligible for camera planning.

Current limits: automatic saving supports segmented static GLB scenes only. Splats, actors, props, animated source meshes, stale/unreviewed semantics, missing or truncated geometry are blocked explicitly. Dynamic collision is not implemented by this flow. The model proposes routes; the deterministic generator rejects unsafe/rough proposals and does not guarantee a route can be found within three attempts.

Tests: `node --import tsx --test src/editor/automatic-flight-workflow.test.ts` and `node --import tsx scripts/check-automatic-flight.mts`. The browser test uses real renders with mocked model responses; it does not claim real-model quality or spend model credits.

## Historical landmark-first guide

The remaining guide describes the earlier explicit-landmark planner and existing authored Pavilion fixtures. It is not a requirement for the automated intent-first flow above.

Use this sequence for manually reviewed, explicitly landmark-constrained camera flights.

## 1. Landmarks: where the camera can be

Place ordered **flight landmarks** at camera-eye positions in renderer Y-up metres. Include an establishing view, required passages, transitions between spaces, and the final view. Each landmark has a stable ID, label, and position. A subject or feature to look at is a separate gaze target; its position is not automatically a safe camera position.

Give Astra the ordered landmark IDs and positions, the scene graph's known subjects, and any actor and prop blocking tracks. Treat names inferred from generic source meshes as uncertain. For a splat interior, the capture and estimated floor do not supply segmented walls, openings, or collision geometry.

## 2. Narrative: why the camera visits them

Before generating a path, Astra proposes a short arc: **establish → approach → transition → reveal → settle**. It creates a semantic anchor for each beat by pairing a narrative purpose with an *existing* flight landmark ID. The semantic anchor coincides with that landmark's position; it does not invent or move geometry.

For each beat, state:

| Field | Meaning |
| --- | --- |
| Landmark ID | Exact camera-eye waypoint to visit, in the planned order |
| Visual purpose | What the audience should discover or feel at this point |
| Arrival time | When the drone reaches the waypoint |
| Gaze target | Existing scene entity or explicit world-space point the camera should show |
| Future blocking state | Where relevant actors and props will be at that arrival time, evaluated from their tracks |
| Uncertainty | Missing geometry, uncertain label, possible occlusion, or passage needing review |

Use the scene graph for stable identity and relationships throughout planning. Evaluate time-dependent actor, prop, and camera state at the beat times and at any blocking marks near them. Astra does not need to reason over every frame. It should check the *transition* between successive beats too: good endpoint views do not establish a clear or well-framed flight between them.

The short semantic mapping back to the graph is: **shot visits landmark in order; shot looks at subject at a beat; beat precedes beat; actor or prop occupies a position at a specified time**. These are proposed planning relationships. Preserve their IDs and times, and do not present inferred labels, occlusion, or clearance as verified source geometry.

## 3. Drone showing: how the shot tells the story

After the choreography is reviewed, generate timed camera positions and gaze targets that visit every required landmark in order. Use pace, pauses, lens, and gaze changes to express the beats. The path between landmarks may contain bend points, but the required landmarks must remain exact timed samples. Preview the beginning, each transition, and the final reveal against the rendered scene.

Where segmented geometry exists, sample the complete playback path between landmarks against available bounds and review camera clearance and speed. Recheck after relevant placements, props, or blocking change. In a splat scene, a visual preview can reveal apparent wall crossings but cannot prove collision clearance without additional geometry. Revise uncertain segments or ask for a new landmark before claiming the route is ready.

## Astra planning prompt

> Plan the drone choreography from the ordered flight landmarks in the viewer state. First give a five-beat narrative arc and a compact beat table with exact landmark IDs, arrival times, gaze targets, and actor or prop states at those times. Give a short list of proposed scene-graph relationships. Do not move landmarks or update the shot in this planning response. Identify any missing waypoint or transition that needs visual review. Then generate the drone path through every required landmark and preview the transitions before treating the shot as ready.

## Pavilion example and current limits

The Pavilion project stores 29 `flight` landmarks. A narrative starts at `flight:pool-west`, enters through `flight:covered-entry`, crosses the house through the lounge waypoints, reveals the chair, returns through `flight:courtyard-exit`, and finishes at `flight:exterior-aerial`. Every listed landmark remains a required waypoint in that order.

The current saved shot stores ordered `anchorIds`, and the exported graph records `planned-via` edges. Its sampled route includes each anchor. Moving or removing a referenced landmark clears that anchor claim and marks the draft for replanning. Once the scene and project are ready, the editor starts one read-only Astra planning turn from the graph when at least two flight landmarks exist. It shows the structured choreography proposal in Camera without changing the saved shot. A changed graph or blocking track makes the proposal stale; the user can request a new one. The planner consumes landmarks and relationships supplied by the scene graph owner and does not create or label them. Automatic shot generation from a proposal and automatic collision rechecks are still future work. The existing Pavilion route and static GLB checks do not validate later project edits or future actor blocking.
