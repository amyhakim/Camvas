# Realtime scene collaboration

FlyThru collaboration is a browser-to-browser CRDT room designed for small student teams. Opening the same scene and `?room=` URL joins the same Yjs document through `y-webrtc`. Rooms are scoped to the scene ID and connect after the local project has hydrated. Actor tracks and object placements remain local project data.

## Shared document

The `scene` Y.Map stores independent fields for selected object, active camera, navigation mode, timeline frame/play state, path visibility, and the authored camera shot. Updating fields independently lets Yjs merge concurrent changes without replacing the entire scene snapshot.

The scene GLB, textures, and reference images are never sent through WebRTC. Every client loads identical assets from the application and exchanges only compact serialized edits.

## Awareness

Yjs Awareness carries participant identity and color, normalized viewport cursor position, current object selection, and online presence. Awareness cursors are rate-limited to one update per animation frame and interpolated visually on remote clients.

## Room and network model

Room IDs are random 16-character values placed in the share URL and also used as the y-webrtc room password. Browsers use a signaling server only to discover peers, then synchronize over encrypted WebRTC data channels. Same-browser tabs can also synchronize through BroadcastChannel.

Set `NEXT_PUBLIC_COLLAB_SIGNALING_URLS=wss://signal.example.com` to use a self-hosted y-webrtc signaling service. The public provider is appropriate for the prototype but not a production trust boundary.

## Prototype limits

- Rooms are optimized for small teams rather than large public sessions.
- There is no account-level access control; possession of the room link grants access.
- State lives with connected peers and disappears once all peers leave.
- Cloud checkpoints, revision history, room membership, and asset uploads remain backend work.
- Timeline playback is synchronized at a throttled rate and may drift briefly before converging.

Run `npm run test:collaboration` against a running app to verify two-tab presence, selection, timeline, and cursor synchronization.
