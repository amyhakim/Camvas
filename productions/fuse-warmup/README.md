# FUSE / Warm welcome

On **http://localhost:3000/**, open **FUSE · Warm Welcome** under **Your projects**. It now opens the **main editor**, with the original Gaussian gym, one animated instructor, a 15-second camera move, and the original soundtrack. Direct link: **http://localhost:3000/editor?scene=fuse-gym&project=fuse-warmup&entry=scene%3Afuse**. Press the timeline Play button or scrub to review the performance. The editor uses its standard 30 fps editing timeline; the delivered movie remains 24 fps.

Select **Instructor** to change position, height or clip timing. Select the authored camera to edit its marks. Use **Audio** to adjust the score. These edits save in this browser and are preserved when reopening. The shipped instructor GLB loads directly from the local server, including in fresh browsers and projects saved with the earlier instructor ID. No manual model import is needed. The native starter lives in `src/features/project/fuse-project.ts`; the environment manifest is `public/scenes/fuse-gym.json`.

The original production preview remains at **http://localhost:3000/fuse-warmup/index.html**; **http://localhost:3000/fuse-warmup/watch.html** plays the finished MP4.

## Deliverables

- `output/fuse-warmup.mp4`: final 1920×1080, 24 fps, 15-second H.264/AAC video.
- `output/preview-frame.png`: representative full-resolution frame.
- `output/blocking-preview.mp4`: 1280×720, 12 fps complete rough motion pass.
- `output/fuse-warmup-audit.json`: per-frame camera, pose, projected bounds and foot positions.
- `VERIFICATION.md`: completed checks and remaining limitations.
- `ATTRIBUTION.md`: source and required credit, including original music provenance.

## Editable project

This directory is the editable project. It includes the original 6,526,775-splat PLY environment (losslessly archived in `assets/FUSEgym.zip`), a locally bundled PlayCanvas engine, character modeling/animation source, scene/camera source, original music generator, separate music and shoe-sound WAV stems, and render automation. No external hosted assets are required for playback or rendering.

- `instructor.mjs`: rounded block character, materials, face, finger gestures, fixed-length analytical limb IK and continuous animation. Exactly one character is instantiated.
- `scene.mjs`: environment placement, instructor origin, warm lighting, analytical soft contact shadows, 47° vertical lens, and eased 0.65 m camera push.
- `music.py`: reproducible original synthesis and composition (NumPy; seed 110927).
- `index.html`: local preview and audio-synchronized transport.
- `render.mjs`: deterministic frame-by-frame capture in Google Chrome, streamed as PNG into FFmpeg. It renders from `http://localhost:3000/fuse-warmup/index.html`.
- `project.json`: production settings and scene-coordinate reference.
- `export-native.mjs`: bakes the procedural performance into the native actor clip. Run `node scripts/export-fuse-instructor.mjs` to regenerate `public/films/fuse-warmup/instructor.glb` and its content-hash metadata.
- `public/films/fuse-warmup/music.mp3` (repository root): editor soundtrack derived from the final mixed WAV.

All character coordinates are metres, Y-up, facing +Z. The unmodified source scan is rotated `[0, 0, 180]` degrees. The instructor origin is `[0, -1.20, -0.8]`. The invisible analytical support plane is Y = −1.20, estimated from sampled central-floor splat positions. It is an animation constraint, not a collision mesh or verified free-space model.

## Timing

0–3 s: welcome wave. 3–5 s: settle into the shoulder-width stance and bring arms forward. 5–8 s and 8–11 s: two controlled squats, each with a brief bottom hold. 11–15 s: relax, smile and thumbs-up. Feet stay planted throughout. A small hip weight shift and breathing motion prevent a completely rigid hold. The camera eases in and out while retaining the whole body and FUSE wall in view.

## Reproduce

From the FlyThru repository root, with dependencies installed and Google Chrome, FFmpeg, Python 3 and NumPy available:

```sh
npm run dev -- --port 3000
```

In another terminal:

```sh
python3 productions/fuse-warmup/music.py
ffmpeg -y -i productions/fuse-warmup/assets/mix-premaster.wav -af loudnorm=I=-16:TP=-1.5:LRA=7 -ar 48000 productions/fuse-warmup/assets/music-final.wav
node productions/fuse-warmup/render.mjs blocking
node productions/fuse-warmup/render.mjs preview
node productions/fuse-warmup/render.mjs final
python3 productions/fuse-warmup/verify.py
node productions/fuse-warmup/review.mjs
```

The local route streams `scene.ply` directly from the ZIP; it does not create another 1.54 GB disk copy. The ZIP is hard-linked to the supplied download, so keep it unchanged. Copy the whole production directory normally when moving to another machine. Rendering uses the complete original PLY, including its spherical-harmonic appearance coefficients. The early reduced survey asset was only a blocking aid. The final render is deterministic in animation time, with 360 frames sampled at `frame / 24`; GPU/browser versions may cause minor pixel differences. Allow several minutes for capture. The original scan is large (~1.54 GB) and requires a capable desktop browser/GPU.

The new Next.js route is `src/app/fuse-warmup/[[...path]]/route.ts`; it streams only files from this production directory and supports byte ranges for movie playback. Keep this directory alongside the repository when moving the editable project. No publication or remote deployment is performed.
