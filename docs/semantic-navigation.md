# Semantic navigation

The first practical version uses a small, explicit semantic graph rather than trying to label every triangle in the Gaussian or rendered mesh. It gives AI a constrained list of meaningful destinations while deterministic geometry code owns motion safety.

## Runtime flow

1. `PAVILION_SEMANTIC_GRAPH` describes named spaces, destination anchors, and candidate waypoint edges in Three.js Y-up metres.
2. The user—or Gemini through `/api/plan`—chooses an anchor ID such as `lounge` or `east-terrace`. Gemini never returns coordinates.
3. The viewport tests each candidate edge against the loaded scene mesh. Seven parallel bidirectional rays approximate a camera/drone safety sphere with 35 cm clearance.
4. A* finds the shortest available path from the live camera position to the anchor node, then removes unnecessary waypoints only when the shortcut is also clear.
5. The renderer samples and collision-checks a centripetal Catmull–Rom curve. If the curve cuts a corner, the generated shot uses linear interpolation through the safe waypoints.
6. The route becomes a normal editable `CameraShot`, so preview, timeline, collaboration, and path visualization continue to use the existing interfaces.

The pavilion graph is intentionally small and hand-authored for a fast, reliable demo. Add or tune spaces, anchors, nodes, and candidate edges in `src/features/navigation/pavilion.ts`. Keep coordinates in Three.js Y-up metres and place nodes in open flyable space, not on surfaces.

## Gemini request

Include a compact anchor list in `POST /api/plan`:

```json
{
  "projectId": "demo",
  "revision": "rev-1",
  "prompt": "Fly from the entrance into the lounge",
  "sceneDescription": "Barcelona Pavilion",
  "subject": {
    "subjectId": "chair",
    "subjectName": "Chair",
    "min": [0, 0, 0],
    "max": [1, 1, 1],
    "cameraPosition": [-22, 2, 9]
  },
  "semanticAnchors": [
    { "id": "entrance", "label": "West entrance", "spaceId": "west-court", "tags": ["arrival", "exterior"] },
    { "id": "lounge", "label": "Main lounge", "spaceId": "main-pavilion", "tags": ["chairs", "interior"] }
  ]
}
```

When anchors are supplied, the validated response includes `destinationAnchorId`. The browser should pass that ID to the same deterministic route planner used by the manual safe-flight control.

## Safety boundary

This is a previsualization safety check, not a certified autonomous-drone controller. The current ray bundle is conservative but not continuous-volume collision detection, and only static loaded meshes are considered. A production physical-drone pipeline still needs calibrated scale and localization, dynamic obstacle sensing, geofencing, velocity/acceleration limits, emergency stop behavior, and a flight-controller-level collision system.

The next performance upgrade is a Three.js mesh BVH or an offline navigation-volume build. The semantic graph contract can remain unchanged: replace only the edge-clearance implementation after profiling shows the current raycasts are the bottleneck.
