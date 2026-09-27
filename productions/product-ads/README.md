# Product ads (spec pieces)

Three 1080p24 product ads rendered entirely in Camvas's **Studio** scene: no camera, set or product was filmed. They are the opening hook of the hackathon video.

| Video | Length | What it shows |
|---|---|---|
| [delivery/chuck-taylor-ad-1080p24.mp4](delivery/chuck-taylor-ad-1080p24.mp4) | 12 s | Lace macro, a thrown pair, toe-down slow spin, patch macro, hero pair |
| [delivery/coke-ice-cold-ad-1080p24.mp4](delivery/coke-ice-cold-ad-1080p24.mp4) | 12 s | Cans thrown in and clinking, condensation macros, hero line-up |
| [delivery/jordan-ad-photoreal-1080p24.mp4](delivery/jordan-ad-photoreal-1080p24.mp4) | 10 s | Air Jordan 1: macros, tip-down/heel-up rotation, hero on a reflective floor |

Frame-by-frame overviews are in [contact-sheets/](contact-sheets/).

## Reopen or re-render

1. Start the app (`npm run dev`) and open the studio (`http://localhost:3000/editor?scene=studio`, or **Open studio** on the home page).
2. Load a file from [projects/](projects/) with **Import whole project**. The three `*.camvas.json` projects that use Sketchfab models download them automatically.
3. Render: **Render video**, then pick Full HD, supersampling and 180° motion blur.

`jordan-ad.camvas.json` uses a locally imported single-shoe GLB that is not in the repo. Use `jordan-ad-scanned-model.camvas.json` instead, which loads the same model from Sketchfab.

## Credits

Models and music are Creative Commons Attribution; see [CREDITS.txt](CREDITS.txt). Credit them wherever these videos are posted. These are unofficial spec ads, not affiliated with or endorsed by the brands shown.
