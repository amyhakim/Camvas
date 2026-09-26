import * as pc from 'playcanvas';
import { OccupancyBoxes } from '../collision/model';
import type { CollisionLayer, CollisionOptions, Vector3Tuple } from '../../contracts';

/** Read a complete coarse LOD, independently of view-dependent rendering and resident tiles. */
export async function generateSplatCollision(app: pc.Application, root: pc.Entity, options: CollisionOptions, view: Vector3Tuple, source: { entityId: string; sourceUrl: string; offset: Vector3Tuple }, signal: AbortSignal, progress: (message: string) => void): Promise<CollisionLayer> {
  if (!Number.isFinite(options.radius) || options.radius < 1 || options.radius > 12) throw new Error('Choose a review radius of 1–12 scene units.');
  const region = { min: view.map(v => v - options.radius) as Vector3Tuple, max: view.map(v => v + options.radius) as Vector3Tuple };
  const occupancy = new OccupancyBoxes(region, options.cellSize);
  const transform = root.getWorldTransform().clone();
  const resource = root.gsplat?.resource;
  if (!resource) throw new Error('Wait for the capture to load, then generate boxes.');
  const octree = (resource as unknown as { octree?: { nodes: { lods: { count: number; fileIndex: number; file: string; offset: number }[] }[] } }).octree;
  const groups = new Map<string, { offset: number; count: number }[]>();
  if (octree) {
    for (const node of octree.nodes) {
      const lod = [...node.lods].reverse().find(lod => lod.count > 0 && lod.fileIndex >= 0);
      if (lod) groups.set(lod.file, [...(groups.get(lod.file) ?? []), { offset: lod.offset, count: lod.count }]);
    }
  } else groups.set(source.sourceUrl, [{ offset: 0, count: resource.numSplats }]);
  const sampleTotal = [...groups.values()].flat().reduce((n, range) => n + range.count, 0);
  if (!groups.size || groups.size > 64 || sampleTotal > 5000000) throw new Error('This capture is too large for browser box generation. Export a coarser splat layer first.');
  const point = new pc.Vec3();
  let done = 0;
  const check = () => { if (signal.aborted) throw new DOMException('Box generation cancelled', 'AbortError'); };
  for (const [url, ranges] of groups) {
    check();
    progress(`Reading coarse splat data · ${++done}/${groups.size}`);
    const asset = new pc.Asset('Collision samples', 'gsplat', { url });
    try {
      await new Promise<void>((resolve, reject) => {
        const finish = (error?: Error) => { clearTimeout(timeout); signal.removeEventListener('abort', cancel); asset.off('load', loaded); asset.off('error', failed); error ? reject(error) : resolve(); };
        const cancel = () => finish(new DOMException('Box generation cancelled', 'AbortError'));
        const loaded = () => finish();
        const failed = (message: string) => finish(new Error(`Could not read splat data: ${message}`));
        const timeout = setTimeout(() => finish(new Error('Splat download timed out. Check your connection and retry.')), 60000);
        signal.addEventListener('abort', cancel, { once: true });
        asset.once('load', loaded); asset.once('error', failed);
        app.assets.add(asset); app.assets.load(asset);
      });
      check();
      const loaded = asset.resource as pc.GSplatResourceBase;
      let centers = loaded.centers;
      if (!centers && loaded.gsplatData instanceof pc.GSplatSogData) {
        await loaded.gsplatData.generateCenters(); check(); centers = loaded.gsplatData.getCenters();
      } else if (!centers) centers = loaded.gsplatData.getCenters();
      if (!centers) throw new Error('The capture did not provide readable splat positions. Try compatibility mode.');
      progress(`Finding occupied cells · ${done}/${groups.size}`);
      for (const { offset, count } of ranges) {
        if (offset < 0 || count < 0 || (offset + count) * 3 > centers.length) throw new Error('The splat index does not match its position data.');
        for (let i = offset; i < offset + count; i++) {
          point.set(centers[i * 3], centers[i * 3 + 1], centers[i * 3 + 2]);
          transform.transformPoint(point, point); occupancy.add([point.x, point.y, point.z]);
          if (i % 20000 === 0) { await new Promise<void>(resolve => setTimeout(resolve, 0)); check(); }
        }
      }
    } finally { asset.unload(); app.assets.remove(asset); }
  }
  check(); progress('Merging occupied cells…');
  return { version: 1, ...source, region, cellSize: options.cellSize, sampleCount: occupancy.sampleCount, reviewed: false, boxes: occupancy.finish() };
}
