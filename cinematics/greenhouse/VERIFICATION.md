# Verification — A Little Tending

Completed September 27, 2026. Rendered from **http://localhost:3000/greenhouse/index.html**. The **A Little Tending** card is visible under **Your projects** at http://localhost:3000/ and opens http://localhost:3000/cinematics/greenhouse. Home navigation was exercised in Chrome with no runtime errors.

- Export: H.264 MP4, 1920×1080, exactly 24 fps and 360 frames. Video, audio, and container durations are each 15.000 seconds. AAC stereo audio is 48 kHz. Full FFmpeg video/audio decode completed without errors.
- Source: inspected the actual binary little-endian Gaussian-splat PLY: 945,577 vertices, 59 float properties, including spherical harmonics. SHA-256 matches the PLY in the supplied archive. The source transform was identical in all 360 recorded frames. No baked scene object was animated or used as collision geometry.
- Visual review: reviewed the rough blocking, refined key frames at full size, all 360 exported frames through ten sequential contact sheets, and enlarged crops of all 72 frames covering the two-step beat. Corrected flat character lighting, an unclear water stream, crossed feet, and detached leg positioning before the final render. No new visible character/prop intersections or major occlusion failures were found in the final reviewed frames. The camera stays on the source's strong exterior side.
- Motion: two sequential steps with no crossing. Minimum boot-center separation is 0.360000 units; boot sole width is 0.33. Maximum per-frame drift while planted is 0.000000983 units. Minimum boot origin Y is 1.840000, at the explicit support plane. The stream is visible for 75 frames, and its endpoint stays within the soil radius. These checks do not certify general collision clearance in the splat.
- Audio: original synthesized score and sound effects, clean fades, no vocals or percussion. The encoded mix measures −20.5 LUFS integrated and −8.0 dBFS true peak; no clipping. Audio review used synthesis/source inspection, waveform/level measurements, and decode validation; a subjective human listening review was not performed.
- Browser playback: the delivered MP4 played to the 15-second endpoint on localhost:3000, reported 1920×1080 and 360 total video frames, and had no media or JavaScript errors. Chrome reported seven dropped presentation frames during the screenshot-instrumented playback run; the exported file itself contains all 360 frames.
- Code: `npm run typecheck` passed after the homepage card and cinematic route were added. JavaScript syntax checks and Python compilation passed. The real browser loaded the static scene and project route. A full Next production build was not run against the concurrently used development server.

Evidence is in `output/verification.json`, `ffprobe.json`, `frames-inspection.json`, `encoded-audio-analysis.txt`, `decode-check.txt`, `home-check.json`, `browser-playback.json`, and `review/`.

Remaining limits: the original capture retains soft grass, thin-object splat artifacts, and baked lighting. Character contact shading and the water stream are stylized; there is no fluid simulation or verified scene collision mesh. Instrument voices are synthesized acoustic/plucked and soft piano approximations. The cinematic includes a native FlyThru project with selectable imported character/prop geometry and an editable camera. Individual joint keys remain editable in the procedural source or companion GLB, rather than the native humanoid blocking controls.

Repository handoff: branch `main`, starting commit `210c470`. No commit was created and nothing was staged. This work adds `cinematics/greenhouse/`, `public/greenhouse`, `src/app/cinematics/greenhouse/page.tsx`, and the greenhouse card/count in `src/features/project/project-home.tsx`. Concurrent changes for other films, scenes, and routes were preserved.


## Native Gaussian editor follow-up

The home card now opens a native saved project at `/editor?scene=hozy-greenhouse&project=a-little-tending&entry=scene%3Agreenhouse`. The earlier `/cinematics/greenhouse` link initializes that project once and redirects to the same editor. Existing names, placements, custom shots, explicit audio removals and other scene entries are preserved. A versioned migration adds the missing starter camera and soundtrack once; later deliberate removals remain removed. The standalone rendered film and procedural source remain available.

`node scripts/check-greenhouse-editor.mjs` passed in Chrome on localhost:3000: one home card, live Gaussian rendering in the main editor (no iframe), camera orbit, environment selection, a numeric placement edit, reload persistence, and preservation of that edit when reopening the old link. No runtime errors. Evidence: `output/native-editor.png` and `output/native-editor-check.json`. The test used an isolated browser profile; it did not alter the user's saved project. Native project seeding and the local scene manifest add no changes to the PLY or its original transform.


## Native character and flight integration

The native editor now loads one animated garden sprite, a separate animated watering can, a separate flowerpot, water geometry and contact patches from `assets/garden-animation.glb` (89 nodes, 78 meshes, 96 animation channels). The original splat transform is unchanged. The native backdrop and mesh lighting match the standalone film. Fixed a material-name override that initially caused the opaque can and stream to disappear behind the splat.

`node scripts/check-greenhouse-production.mjs` verifies the older-project migration, five camera marks, camera positions at 0/4/7/9/11/13/15 seconds, the watering hold, actual animated sprite displacement, selectable placement edits and reload persistence, 15-second audio decoding and Web Audio playback scheduling, and access to flight controls. Screenshots of all seven key times were visually inspected, including the corrected can and stream at nine seconds. No browser runtime errors. These native checks supplement the earlier full exported-film inspection; no replacement MP4 export was made for this editor integration.

`npm run typecheck`, `npm run test:modules` (159 tests), and `git diff --check` passed. New migration tests protect user-authored cameras, explicit audio removals, other scenes and saved placements. Native animation remains an imported clip; the UI does not expose individual sprite joint keys. Moving individual imported objects independently can require adjusting the other objects to retain their watering alignment.

The legacy Pavilion GLB regression check `node scripts/check-blockout-map.mjs` also passed: 103,587 fitted blocks from 195 sources, Original/Blocks/Overlay switching, timeline scrubbing, reset and reload, with no browser errors.
