# Last Light

A 15-second brick-style coastal departure made for the local Showcam / FlyThru platform.

## Open on localhost:3000

- Finished film and downloads: `http://localhost:3000/cinematics/last-light`
- Authored live scene and timeline: `http://localhost:3000/cinematics/last-light?view=scene`
- Native project editor: `http://localhost:3000/editor?scene=last-light`
- Home screen: **Last Light cinematic** beside the studio link. The car scene is also available in the New Project scene menu.

The existing Next server serves all three views. Start it with `npm run dev` from the repository root if needed. The editor retains its normal 30 fps timeline; the source and final film are 24 fps and 15 seconds long. The editor GLB uses the editor's lighting. The live-scene page preserves the authored lighting and finishing effects used for the final export.

Music plays with the editor's **Play timeline** control and is included when **Include timeline music and sound effects** is selected for rendering. Reopening an older Last Light project adds its originally missing soundtrack without replacing scene edits; an explicitly edited or empty audio track list is preserved. The live player also plays the soundtrack, follows it when seeking, and has a **Sound on / Sound off** toggle. `assets/soundtrack.mp3` is the mastered mix from the finished movie; the WAV is the original synthesis source.

## Editable sources

- `scene.js`: geometry, materials, articulated joints, door hinge, wheel rotation, deterministic dust, four camera shots, and animation evaluator. Coordinates are Y-up, in metres, car forward +X. Character and vehicle performance hold on twos; camera motion evaluates at every output frame.
- `index.html`: live player with play/pause and timeline scrubber.
- `export-glb.js`: bakes the complete hierarchy and performance into glTF 2.0. The manifest supplies Blender-style Z-up metadata while geometry remains glTF Y-up.
- `last-light.showcam.json`: project document for the registered `last-light` scene.
- `assets/`: bundled PlayCanvas runtime and license, reference attribution and diagnostic reference views, original synthesized soundtrack.
- `make_audio.py`: deterministic original music, surf, footsteps, door sounds and engine. Requires NumPy and SciPy.
- `render.mjs`: deterministic browser rendering, GLB export and platform verification. Requires this repository's Playwright and Google Chrome at its standard macOS path.

The downloadable project archive includes the animated GLB and scene manifest. It does not need the original 609 MB Gaussian splat to play or render. That supplied archive remains untouched in Downloads. The car is an independent articulated approximation of its visual appearance.

## Regenerate

From the repository root with the app running on port 3000:

```sh
cp productions/sunset-departure/scene.js public/films/last-light/scene.js
cp productions/sunset-departure/export-glb.js public/films/last-light/export-glb.js
node productions/sunset-departure/render.mjs blocking
node productions/sunset-departure/render.mjs export
node productions/sunset-departure/render.mjs final
```

The renderer samples frames 0–359 at `frame / 24`, at native 1920×1080. Frame PNGs are retained locally in `frames/`. Use the exact FFmpeg command recorded in `delivery/verification.md` to encode. `node productions/sunset-departure/render.mjs platform` checks native scene loading, timeline changes, the live scene, and complete MP4 playback on localhost:3000.

For standalone source playback, serve the unpacked project directory with any HTTP server and open `index.html`. It is a real 3D scene, not video projected onto a surface. A `.blend` file is not included; the portable editable asset is `last-light.glb` and the procedural master is `scene.js`.

## Attribution

Reference: Renderbricks, **LEGO® 10252 Volkswagen Beetle**, https://superspl.at/scene/04caae8c, CC BY 4.0. See `assets/reference-license.txt`. No LEGO or Volkswagen endorsement is implied. PlayCanvas retains its MIT license. Audio is original procedural synthesis with no external music or sample recordings.
