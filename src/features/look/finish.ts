import type { LookSettings, TitleCard } from '../../contracts';
import { fadeAt, titleOpacity } from './model';

/**
 * The finishing pass, drawn with Canvas 2D over the rendered image: film grain, letterbox bars, fades from and to
 * black, and title cards. The live shot view and exported renders call the same function, so what you see is
 * what renders. Everything depends only on the frame, so repeated renders are identical.
 */
export type FinishState = { look: LookSettings | null; titles: TitleCard[]; time: number; end: number; frame: number };
const TITLE_FONT = '"Manrope Variable", "Segoe UI", system-ui, sans-serif';
let grainTiles: HTMLCanvasElement[] | null = null;

function tiles() {
  if (grainTiles) return grainTiles;
  let seed = 1337;
  const next = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  grainTiles = Array.from({ length: 6 }, () => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    const g = canvas.getContext('2d')!, image = g.createImageData(256, 256);
    for (let i = 0; i < image.data.length; i += 4) {
      // Roughly gaussian grain around mid grey (sum of three uniforms).
      const v = Math.round((next() + next() + next()) / 3 * 255);
      image.data[i] = image.data[i + 1] = image.data[i + 2] = v; image.data[i + 3] = 255;
    }
    g.putImageData(image, 0, 0);
    return canvas;
  });
  return grainTiles;
}

/** The picture area inside letterbox bars. */
export function letterboxRect(width: number, height: number, ratio: number | null) {
  if (!ratio || width / height >= ratio) return { x: 0, y: 0, width, height };
  const inner = Math.round(width / ratio);
  return { x: 0, y: Math.round((height - inner) / 2), width, height: inner };
}

export function drawFinish(g: CanvasRenderingContext2D, width: number, height: number, state: FinishState) {
  const { look } = state;
  const grain = look?.camera.grain ?? 0;
  if (grain > 0) {
    const set = tiles(), tile = set[state.frame % set.length];
    const pattern = g.createPattern(tile, 'repeat')!;
    // Grain size follows the output height so a 4K render has the same texture as 1080p.
    const scale = Math.max(1, height / 1080);
    pattern.setTransform(new DOMMatrix().translateSelf((state.frame * 97) % 256, (state.frame * 61) % 256).scaleSelf(scale, scale));
    g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = grain * .32; g.fillStyle = pattern; g.fillRect(0, 0, width, height); g.restore();
  }
  const fade = fadeAt(look, state.time, state.end);
  if (fade > 0) { g.save(); g.globalAlpha = fade; g.fillStyle = '#000'; g.fillRect(0, 0, width, height); g.restore(); }
  const picture = letterboxRect(width, height, look?.finish.letterbox ?? null);
  if (picture.y > 0) { g.fillStyle = '#000'; g.fillRect(0, 0, width, picture.y); g.fillRect(0, picture.y + picture.height, width, height - picture.y - picture.height); }
  for (const title of state.titles) {
    const alpha = titleOpacity(title, state.time);
    if (alpha <= 0) continue;
    const unit = picture.height / 1080;
    const hero = title.align !== 'lower';
    const big = Math.round((hero ? 96 : 64) * unit), small = Math.round((hero ? 36 : 28) * unit);
    const baseline = title.align === 'center' ? picture.y + picture.height / 2 + (title.subtitle ? -big * .1 : big * .32)
      : title.align === 'upper' ? picture.y + picture.height * .2 + big * .5
      : picture.y + picture.height * .86 - (title.subtitle ? small * 1.7 : 0);
    // A slow 3% rise while the card is on screen.
    const drift = (1 - Math.min(1, (state.time - title.start) / Math.max(.1, title.duration))) * big * .12;
    g.save(); g.globalAlpha = alpha; g.textAlign = 'center'; g.fillStyle = '#fff';
    g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 24 * unit;
    g.font = `800 ${big}px ${TITLE_FONT}`; (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${Math.round(big * .06)}px`;
    g.fillText(title.text.trim().toUpperCase(), width / 2, baseline + drift);
    if (title.subtitle) {
      g.globalAlpha = alpha * .86; g.font = `600 ${small}px ${TITLE_FONT}`; (g as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${Math.round(small * .28)}px`;
      g.fillText(title.subtitle.trim().toUpperCase(), width / 2, baseline + drift + small * 2.1);
    }
    g.restore();
  }
}
