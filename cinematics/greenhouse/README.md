# A Little Tending

A 15-second continuous cinematic: one blocky garden sprite takes two small side steps, raises a separate watering can, waters a separate flowerpot, lowers the can, and nods. The camera pushes in, holds during watering, and widens. Original gentle plucks, soft piano tones, bells, quiet garden ambience, and watering sounds accompany the shot.

Open **http://localhost:3000/** and choose **A Little Tending** under Your projects, or open **http://localhost:3000/cinematics/greenhouse** directly. The standalone editable preview is **http://localhost:3000/greenhouse/index.html**. The home card opens the native Gaussian scene editor, where you can navigate, select and reposition the environment, select the animated garden sprite and watering props, edit the flight camera, scrub/play the 15-second animation with audio, and save placement changes. Use **Flight path** for the camera marks and **Scene objects** for the sprite, watering can, flowerpot, and stream. The standalone cinematic preview uses Play and the time slider. The exported film is **http://localhost:3000/greenhouse/output/A-Little-Tending.mp4**. `public/greenhouse` is a local symlink to this folder; the home card creates or upgrades the named greenhouse project while preserving existing edits.

The complete portable bundle is `A-Little-Tending-project.zip`. Deliverables are `output/A-Little-Tending.mp4`, `output/preview.png`, this complete editable folder, `ATTRIBUTION.md`, and `VERIFICATION.md`. The source environment is 223 MB; allow a little time for first load.

To open the standalone project after unpacking, run `node server.mjs` in this folder, then visit **http://localhost:3000/index.html**. Port 3000 must be free for the standalone server. Viewing uses the vendored PlayCanvas engine and needs no package installation.

To regenerate everything, install Node.js, FFmpeg/FFprobe, Python 3 with NumPy, and Chrome. Run `npm install` in this folder, then `npm run produce`. On macOS the scripts use the installed Google Chrome; elsewhere run `npx playwright install chromium`, or set `CHROME_PATH` to a Chrome executable. The producer uses the existing FlyThru URL on port 3000 when available, or starts its own server on that same port. It synthesizes audio, renders exactly 360 frames directly into an H.264 video, mixes AAC audio, decodes the completed MP4, writes contact sheets covering every exported frame, and validates timing and motion. No online assets or paid generation services are required. Rendering takes several minutes and needs a WebGL2-capable browser.

Individual commands, from this folder:

```sh
python3 audio.py
node capture.mjs final-blocking
node capture.mjs frames
node export.mjs
python3 verify.py
```

For the standalone server, set `CINEMATIC_URL=http://localhost:3000/index.html` when running `capture.mjs`. Its default is the FlyThru URL above.

Edit `garden.mjs` for character geometry, prop placement, support height, step timing, arm/can motion, stream, and nod. Edit `scene.mjs` for the camera, lighting, and playback. Edit `audio.py` for the score, voices, effects, mix, and fades. The animation evaluates deterministically at any time; the preview supports backward scrubbing. The MP4 adds short picture fades, while the editable viewport remains unfaded for inspection. `export.mjs` controls encoding and metadata. Audio stems are `assets/music.wav`, `assets/ambience.wav`, `assets/watering.wav`, and `assets/mix.wav`.

The environment is the original Gaussian-splat PLY, with its spherical-harmonic data retained. It is a static visual asset, never collision geometry. Its viewer orientation is 180° around Z, at unit scale and zero translation. The sprite uses an explicit invisible horizontal support plane at Y=1.84, with world-planted feet and soft contact patches. Do not rely on this plane for navigation elsewhere in the capture. The native editor loads `assets/garden-animation.glb` as a companion to the unchanged capture. Its timeline is 30 fps, retaining the 15-second duration; the delivered film remains 24 fps.

Read `ATTRIBUTION.md` before redistributing. The finished cinematic remains a source-code-editable PlayCanvas project. The homepage seeds a native FlyThru project containing the Gaussian environment, imported sprite/prop animation, camera flight and soundtrack. Camera and placement edits persist in browser storage. Joint motion is imported animation, not humanoid actor-blocking tracks: edit it in `garden.mjs` or the GLB. Rebuild the companion from the repository root with `node scripts/export-greenhouse-companion.mjs` while localhost:3000 runs. `native-project.json` is a native collection backup; `native-scene-manifest.json` records its scene dependencies. Source splat softness, thin-object artifacts, and baked lighting remain inherent limits.
