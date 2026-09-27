import * as pc from 'playcanvas';
import type { SemanticCandidate, SemanticView } from '@/contracts/semantics';

/** Capture original appearance plus numbered geometry correspondences, not UI chrome. */
export async function captureSemanticViews(app: pc.Application, cameras: pc.Entity[], candidates: SemanticCandidate[], signal: AbortSignal, limit = 4, render: () => void = () => app.render()): Promise<SemanticView[]> {
  const width = 960, height = 640, device = app.graphicsDevice;
  const views: SemanticView[] = [];
  for (const [index, source] of cameras.slice(0, limit).entries()) {
    signal.throwIfAborted();
    const texture = new pc.Texture(device, { width, height, format: pc.PIXELFORMAT_RGBA8, mipmaps: false });
    const target = new pc.RenderTarget({ colorBuffer: texture, depth: true, origin: pc.RENDERTARGET_ORIGIN_TOP });
    const camera = new pc.Entity('Semantic evidence view', app);
    camera.addComponent('camera', { enabled: false, fov: source.camera?.fov ?? 52, nearClip: .05, farClip: 400, aspectRatioMode: pc.ASPECT_MANUAL, aspectRatio: width / height, clearColor: new pc.Color(.65, .72, .71) });
    camera.camera!.toneMapping = source.camera!.toneMapping;
    camera.camera!.renderTarget = target;
    camera.setPosition(source.getPosition()); camera.setRotation(source.getRotation());
    app.root.addChild(camera);
    const enabled = (app.root.findComponents('camera') as pc.CameraComponent[]).filter(c => c.enabled);
    try {
      enabled.forEach(c => { c.enabled = false; });
      camera.camera!.enabled = true;
      render();
      camera.camera!.enabled = false;
      enabled.forEach(c => { c.enabled = true; });
      const reader = device as pc.GraphicsDevice & { readTextureAsync?: (t: pc.Texture, x: number, y: number, w: number, h: number, options: { renderTarget: pc.RenderTarget }) => Promise<Uint8Array> };
      const pixels = reader.readTextureAsync ? await reader.readTextureAsync(texture, 0, 0, width, height, { renderTarget: target })
        : await (texture.impl as { read: (x: number, y: number, w: number, h: number, o: { immediate: boolean }) => Promise<Uint8Array> }).read(0, 0, width, height, { immediate: true });
      signal.throwIfAborted();
      const output = document.createElement('canvas'); output.width = width; output.height = height;
      const ctx = output.getContext('2d')!;
      const flipped = new Uint8ClampedArray(pixels.length);
      for (let row = 0; row < height; row++) flipped.set(pixels.subarray(row * width * 4, (row + 1) * width * 4), (reader.readTextureAsync ? height - row - 1 : row) * width * 4);
      ctx.putImageData(new ImageData(flipped, width, height), 0, 0);
      const objects: SemanticView['objects'] = [];
      ctx.font = 'bold 13px sans-serif';
      for (const [i, candidate] of candidates.entries()) {
        const center = new pc.Vec3(...candidate.min.map((n, a) => (n + candidate.max[a]) / 2));
        if (center.clone().sub(camera.getPosition()).dot(camera.forward) <= .05) continue;
        const screen = camera.camera!.worldToScreen(center);
        const x = screen.x / device.clientRect.width, y = screen.y / device.clientRect.height;
        if (x < .01 || x > .99 || y < .02 || y > .98) continue;
        objects.push({ id: candidate.id, number: i + 1, x, y });
        const label = String(i + 1), w = ctx.measureText(label).width + 8;
        ctx.fillStyle = 'rgba(10,20,25,.8)'; ctx.fillRect(x * width - w / 2, y * height - 10, w, 18);
        ctx.fillStyle = '#fff3ad'; ctx.fillText(label, x * width - w / 2 + 4, y * height + 3);
      }
      views.push({ id: `view-${index + 1}`, image: output.toDataURL('image/jpeg', .85), objects });
    } finally {
      camera.camera!.enabled = false;
      enabled.forEach(c => { c.enabled = true; });
      camera.destroy(); target.destroy(); texture.destroy();
    }
  }
  return views;
}
