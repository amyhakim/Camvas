import type { ViewportRegion } from '../contracts';

type Rect = { left: number; right: number; top: number; bottom: number; width: number; height: number };
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** A phone inspector is a bottom sheet, not a right-hand occluder. */
export function measureClearRegion(rect: Rect, objects: Rect | null, inspector: Rect | null, timeline: Rect | null, tools: Rect | null): ViewportRegion {
  const sheet = inspector && inspector.width > rect.width * .6;
  const left = clamp(((objects?.right ?? rect.left) - rect.left + 20) / rect.width, 0, .85);
  const top = clamp(((tools?.bottom ?? rect.top) - rect.top + 20) / rect.height, 0, .85);
  const right = clamp((((!sheet && inspector?.left) || rect.right) - rect.left - 20) / rect.width, left + .1, 1);
  const bottomEdge = Math.min(timeline?.top ?? rect.bottom, sheet ? inspector.top : rect.bottom);
  const bottom = clamp((bottomEdge - rect.top - 24) / rect.height, top + .1, 1);
  return { left, right, top, bottom };
}

/** Fit subjects in the largest remaining rectangle around a freely positioned assistant. */
export function avoidFloatingOverlay(base: ViewportRegion, rect: Rect, overlay: Rect): ViewportRegion {
  const left = (overlay.left - rect.left - 16) / rect.width;
  const right = (overlay.right - rect.left + 16) / rect.width;
  const top = (overlay.top - rect.top - 16) / rect.height;
  const bottom = (overlay.bottom - rect.top + 16) / rect.height;
  if (right <= base.left || left >= base.right || bottom <= base.top || top >= base.bottom) return base;
  const options = [
    { ...base, right: Math.min(base.right, left) },
    { ...base, left: Math.max(base.left, right) },
    { ...base, bottom: Math.min(base.bottom, top) },
    { ...base, top: Math.max(base.top, bottom) },
  ].filter(region => region.right - region.left >= .1 && region.bottom - region.top >= .1);
  return options.sort((a, b) => (b.right - b.left) * (b.bottom - b.top) - (a.right - a.left) * (a.bottom - a.top))[0] ?? base;
}
