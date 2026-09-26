import type { SurfaceAnnotation, Vector3Tuple } from '../contracts';

/** Keep spatial context small while retaining the region's bounds and target mesh. */
export function annotationContext(marks: SurfaceAnnotation[]) {
  return marks.filter(mark => mark.points.length).map(mark => {
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (const point of mark.points) point.forEach((value, axis) => { min[axis] = Math.min(min[axis], value); max[axis] = Math.max(max[axis], value); });
    const round = (value: number) => Math.round(value * 1000) / 1000;
    return { id: mark.id, entityId: mark.entityId, kind: mark.kind, frame: mark.frame, center: min.map((value, axis) => round((value + max[axis]) / 2)) as Vector3Tuple, min: min.map(round), max: max.map(round), pointCount: mark.points.length };
  });
}
