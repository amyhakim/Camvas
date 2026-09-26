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
