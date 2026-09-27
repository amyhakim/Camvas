# FUSE / Warm welcome — verification

Delivered September 27, 2026. Open **FUSE · Warm Welcome** under **Your projects** at http://localhost:3000/. Finished-film player: http://localhost:3000/fuse-warmup/watch.html.

- **Export:** H.264, YUV 4:2:0, 1920×1080, constant 24 fps, exactly 360 frames and 15.000 seconds. AAC stereo, 48 kHz, 15.000 seconds. MP4 fast-start enabled.
- **Full decode:** FFmpeg decoded the entire video and audio without errors. All 360 video frames have distinct decoded hashes; no missing or duplicate encoded frames.
- **Motion and framing:** Exactly two squat cycles; bottom holds begin near 6.08 and 9.08 seconds. All 360 audited frames contain the whole instructor. The combined projected body bounds are X 949.9–1389.2 and Y 204.8–851.8 in the 1920×1080 image. Foot-anchor drift is 0.000 m. Soles are constrained to the estimated Y = −1.20 support plane.
- **Visual inspection:** Reviewed the complete encoded sequence in six contact sheets containing every frame, plus full-resolution wave, squat and final-gesture views. The shoulder gaps and unclear thumb found in blocking were corrected. The instructor remains in the central aisle; no visible equipment intersections, floor penetration, large joint discontinuities or foreground occlusion errors were observed from the authored camera. The static gym, equipment, wood, overhead lights and FUSE lettering remain visible.
- **Audio:** Encoded AAC measures −16.0 LUFS integrated, −1.4 dB true peak and zero clipped samples. Original 110 BPM score and subtle synthesized shoe accents have a 0.22-second fade-in and 0.8-second fade-out. Source and stereo WAV stems are included. Audio was checked through synthesis/source inspection, waveform/loudness measurements and browser playback; a subjective listening pass was not available.
- **Browser:** Chrome on localhost:3000 played to the 15-second end, with 360 decoded frames, no corrupted frames, no media error and no page errors. It reported 3 presentation drops during the automated run; these are playback scheduling drops, not missing frames in the encoded file. Prefix/suffix video range requests, unsatisfiable ranges, and missing-file responses passed. The home-page project card was separately verified.
- **Source:** All 6,526,775 original Gaussians and their spherical-harmonic coefficients are used. The archived PLY matches the supplied ZIP CRC. SHA-256 of the PLY: `ddd419934b8a994e0757a1c3b0d4db8507302f61b83e1a9a89dd4d7d82cd8eb6`. The original ZIP is retained in the editable project as a hard link, streamed without a redundant extracted disk copy.
- **Project checks:** TypeScript passed; all 151 module tests passed; source syntax and diff whitespace checks passed. The older `test:projects` script could not launch its absent pinned Playwright browser. Production-specific tests used installed Google Chrome. A production Next.js build was not run.

## Remaining limits

The instructor is an intentionally stylized segmented procedural character, with analytical IK rather than motion capture or soft-tissue simulation. Contact shadows and floor support are approximations. The scan contains mild existing softness and capture artifacts, especially around distant screens and edge equipment; this shot avoids poorly reconstructed viewpoints. The visual scan and sampled floor do not establish collision clearance. The home-page card now opens a native Showcam project with an actor animation clip, authored camera marks and timeline music. The procedural source remains included for editing individual joints and gestures. Native editor lighting and contact patches approximate the dedicated renderer; the delivered MP4 remains the fully reviewed render. The 1.54 GB source requires a capable desktop browser; the finished MP4 is much lighter.

## Evidence and handoff

`output/verification.json`, `output/fuse-warmup-audit.json`, `output/frame-hashes.txt`, `output/audio-measurement.txt`, `output/browser-playback.json`, and `preview/final-all-frames-01.jpg` through `06.jpg` retain the measurements and review images. `README.md` contains editing and reproduction directions; `ATTRIBUTION.md` contains the required gym credit and original music provenance.

Branch: **main**. **No commit or remote publication** was made. Existing unrelated edits were preserved; FUSE production files and native project integration were added. A small viewport fix recognizes models with authored clips as animatable.


## Native editor integration

The main editor opens `/editor?scene=fuse-gym&project=fuse-warmup&entry=scene%3Afuse`, using the original ZIP-backed Gaussian environment, exactly one actor with a 15-second authored GLB clip, 31 camera marks and one original soundtrack. Soft shoe contact patches are included in the model. No collision geometry is inferred from the scan. The built-in project seeds only when absent and does not replace user edits. Its model asset resolves directly from the local server, independently of browser model storage and project hydration. Both the initial and current native instructor references are supported.

Native integration checks completed: full 15-second timeline playback, measured nonzero music output, wave/both squat/final-gesture frame inspection, fresh-browser direct-link loading, saved-edit preservation, zero browser page errors, TypeScript, and all 156 module tests. No new MP4 render was claimed for the editor integration.

Browser evidence: `output/editor-verification.json` and `output/editor-{opening,wave,squat-one,squat-two,thumbs-up}.png`. The original finished MP4 and its prior export checks are unchanged. Native editor playback and the delivered render are separate verification targets.

### Missing-model recovery

Reproduced the reported missing-import error with the initial native instructor ID in a fresh browser. The model resolver now serves the bundled instructor for both shipped IDs, preserving saved project bytes and leaving unrelated imported models unchanged. Regression evidence is in `output/model-recovery.json` and `output/editor-model-recovered.png`.
