import { pavilionBoxes } from './pavilion-geometry.mts';
import { pavilionDoorwayShot } from '../src/features/camera/pavilion-doorway-shot';
import { compileShot } from '../src/features/camera/model';
import { distanceToRouteBox } from '../src/features/camera/route-overview-model';
const shot = pavilionDoorwayShot(), at = compileShot(shot);
let minimum = Infinity, peakSpeed = 0;
const conflicts: unknown[] = [];
for (let i = 0; i <= 4400; i++) {
  const time = i / 100, p = at(time).position;
  if (i) peakSpeed = Math.max(peakSpeed, Math.hypot(...p.map((v, a) => v - at(time - .01).position[a])) * 100);
  for (const box of pavilionBoxes) {
    const d = distanceToRouteBox(p, box); minimum = Math.min(minimum, d);
    if (d < .3 && conflicts.length < 20) conflicts.push({ time, p, id: box.id, distance: d });
  }
}
console.log(JSON.stringify({ minimum, peakSpeed, conflicts }, null, 2));
if (conflicts.length) process.exitCode = 1;
