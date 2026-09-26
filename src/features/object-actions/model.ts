/** Coordinates and measurements are CSS pixels in the viewport. */
export function clampMenuPosition(x: number, y: number, width: number, height: number, viewportWidth: number, viewportHeight: number) {
  const inset = 8;
  const finite = (value: number) => Number.isFinite(value) ? value : inset;
  return {
    left: Math.max(inset, Math.min(finite(x), viewportWidth - width - inset)),
    top: Math.max(inset, Math.min(finite(y), viewportHeight - height - inset)),
  };
}
