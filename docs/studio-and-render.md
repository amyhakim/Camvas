# Studio, look and render

Camvas can finish a shot as well as plan it: light it, grade it, add titles and music, and render an MP4 in the browser.

## Studio stage
- Scene picker → **Studio stage** (`?scene=studio`). It's a procedural stage: an endless satin-black floor fading into darkness, lit only by the project's look.
- **Add models → Import a .glb from your computer** places your own model as a prop.
  - The file stays in this browser (IndexedDB, keyed by a SHA-256 hash). It is never uploaded; projects store only the reference.
  - Other browsers and collaborators see a load error until they import the same file.

## Props: motion
- A prop's **Motion** section adds a timed **turntable spin** (°/s) and a **float** lift (m) between two times.
  - The turn holds after the window; the float eases in and out.
- The **spin pivot** is how far up the prop's own height it turns. Half its height spins it in place, even when it's tipped on its toe.

## Camera: hand-built shots with cuts
In **Camera move**:
- **Start a shot from this view** turns the Explore camera into a shot.
- **Mark from view** adds a mark at the playhead from the current framing.
- **Cut to view** does the same, and makes that mark a hard cut into a new shot.

Every captured mark stores its aim point. Depth of field focuses there, and aims blend between marks. One timeline can therefore hold a whole multi-shot edit.

## Look (inspector → Look)
- **Presets:** Studio · dark, Studio · bright, Scene light · filmic, or Scene default (off).
- **Studio rig:** key, fill, two coloured rims and a top beam, aimed at a subject and turned by a rig angle. Also softbox reflections and an optional light sweep.
- **Light cues:** from a time on, switch the rig's angle, levels, rim colours and even its subject. Use one per cut for a new lighting set-up, or to move the rig to a second "set" on the stage.
- **Camera:**
  - exposure, depth of field, bloom, vignette, film grain, lens fringing;
  - contrast, saturation, tint and tone mapping (PlayCanvas `CameraFrame`).
- **Atmosphere:** haze (volumetric light beams) and dust in the light.
- **Finish:** letterbox and fades from/to black.
- **Titles:** text cards (top, centre or lower third) with fades.
- Titles, grain, fades and letterbox preview in Shot view and are burned into renders.
- With no look, other scenes render exactly as before.

## Render
Use the toolbar clapperboard, or **Look → Render video…**.
- **Options:** the camera move or the whole timeline; 720p to 4K; 24, 25, 30 or 60 fps; up to 2× supersampling.
- **Process:** each frame is applied exactly, rendered with every model loaded, downscaled, and finished (grain, fades, titles).
- **Encoding:** H.264 + AAC MP4 with the timeline audio mixed offline. It falls back to VP9/Opus WebM if the browser can't encode H.264.
- Everything runs in the browser (WebCodecs + mediabunny). Nothing is uploaded.
