import { Box3, Vector3 } from 'three';

/** Frame the complete path inside the unobstructed part of the viewport (normalized 0..1). */
export function framePath(points: [number, number, number][], subject: [number, number, number], aspect: number, region: { left: number; right: number; top: number; bottom: number }) {
  const bounds = new Box3().setFromPoints(points.map(point => new Vector3(...point))).expandByPoint(new Vector3(...subject));
  const center = bounds.getCenter(new Vector3());
  const radius = Math.max(1, bounds.getSize(new Vector3()).length() / 2);
  const fov = 52;
  const tanV = Math.tan(fov * Math.PI / 360), tanH = tanV * aspect;
  const fitV = Math.atan(tanV * Math.max(.1, region.bottom - region.top));
  const fitH = Math.atan(tanH * Math.max(.1, region.right - region.left));
  const distance = radius * 1.15 / Math.sin(Math.min(fitV, fitH));
  const direction = new Vector3(.6, .3, 1).normalize();
  const right = new Vector3(0, 1, 0).cross(direction).normalize();
  const up = direction.clone().cross(right).normalize();
  // Move camera and orbit target together so the path lands in the clear rectangle.
  const shift = right.multiplyScalar((1 - region.left - region.right) * distance * tanH)
    .addScaledVector(up, (region.top + region.bottom - 1) * distance * tanV);
  return { position: center.clone().addScaledVector(direction, distance).add(shift).toArray(), target: center.add(shift).toArray(), fov };
}
