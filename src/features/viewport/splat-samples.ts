import * as pc from 'playcanvas';

/** Complete coarse capture, independent of visible tiles; callers own fitting. */
export async function readSplatSamples(app: pc.Application, root: pc.Entity, source: { sourceUrl: string }, signal: AbortSignal, progress: (message: string) => void, visit: (x: number, y: number, z: number) => void) {
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
    // A non-streamed capture is already complete: borrow its resource, never reload/unload it.
    // Streamed files use independent loader keys, including external SOG textures.
    const token = crypto.randomUUID();
    const independentUrl = (value: string) => { const address = new URL(value, url); address.searchParams.set('showcam-sampling', token); return address.href; };
    const samplingOptions = { crossOrigin: 'anonymous' as const, mapUrl: (filename: string) => independentUrl(filename) };
    const asset = octree ? new pc.Asset('Splat samples', 'gsplat', { url: independentUrl(url) }, {}, samplingOptions) : null;
    try {
      if (asset) await new Promise<void>((resolve, reject) => {
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
      const loaded = (asset ? asset.resource : resource) as pc.GSplatResourceBase;
      let centers = loaded.centers;
      if (!centers && loaded.gsplatData instanceof pc.GSplatSogData) {
        await loaded.gsplatData.generateCenters(); check(); centers = loaded.gsplatData.getCenters();
      } else if (!centers) centers = loaded.gsplatData.getCenters();
      if (!centers) throw new Error('The capture did not provide readable splat positions. Try compatibility mode.');
      progress(`Reading splat positions · ${done}/${groups.size}`);
      for (const { offset, count } of ranges) {
        if (offset < 0 || count < 0 || (offset + count) * 3 > centers.length) throw new Error('The splat index does not match its position data.');
        for (let i = offset; i < offset + count; i++) {
          point.set(centers[i * 3], centers[i * 3 + 1], centers[i * 3 + 2]);
          transform.transformPoint(point, point); visit(point.x, point.y, point.z);
          if (i % 20000 === 0) { await new Promise<void>(resolve => setTimeout(resolve, 0)); check(); }
        }
      }
    } finally { if (asset) { asset.unload(); app.assets.remove(asset); } }
  }
  check();
}
