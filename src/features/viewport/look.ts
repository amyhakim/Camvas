import * as pc from 'playcanvas';
import type { LookSettings } from '@/contracts';
import { lightingAt } from '../look/model';

/** What the look needs each frame: timeline time, the lit subject, where the camera focuses, and the output scale. */
/** `lens` is the shot camera's focal length and the sensor height it uses (mm), for real depth of field. */
export type LookFrame = { time: number; subject: pc.BoundingBox | null; subjectRoot: pc.Entity | null; focus: number; pixelScale: number; floorY: number | null; lens: { focalLength: number; sensorHeight: number }; floor: pc.StandardMaterial | null };
type Rig = { key: pc.Entity; fill: pc.Entity; rimA: pc.Entity; rimB: pc.Entity; beam: pc.Entity; sweep: pc.Entity };

const TONEMAPS = { aces: pc.TONEMAP_ACES, aces2: pc.TONEMAP_ACES2, neutral: pc.TONEMAP_NEUTRAL, filmic: pc.TONEMAP_FILMIC } as const;
/** Captured studios (CC0, Poly Haven, 1k HDR). */
const HDRIS = { studio: '/hdri/studio_small_09-1k.hdr', 'warm-studio': '/hdri/brown_photostudio_02-1k.hdr' } as const;
const color = (hex: string) => new pc.Color().fromString(hex);

/** Deterministic pseudo-random numbers (mulberry32), so dust is identical on every render of the same frame. */
function random(seed: number) {
  return () => { seed |= 0; seed = seed + 0x6d2b79f5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

/**
 * Softbox reflections: a dark equirect environment with a large overhead panel, two tall strip boxes and a coloured
 * back strip, blurred like diffusion fabric. Glossy materials pick these up as the long highlights of product shots.
 */
function studioEnvironment(device: pc.GraphicsDevice, rim: string) {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 512;
  const g = canvas.getContext('2d')!;
  g.fillStyle = '#040405'; g.fillRect(0, 0, 1024, 512);
  const floor = g.createLinearGradient(0, 256, 0, 512); floor.addColorStop(0, '#0b0b0d'); floor.addColorStop(1, '#010101');
  g.fillStyle = floor; g.fillRect(0, 256, 1024, 256);
  g.filter = 'blur(10px)';
  g.fillStyle = '#ffffff'; g.fillRect(380, 18, 264, 70); // overhead panel
  g.fillStyle = '#f2f4ff'; g.fillRect(150, 90, 44, 190); g.fillRect(830, 90, 44, 190); // side strips
  g.fillStyle = '#fff1e0'; g.fillRect(300, 120, 120, 120); // key box, front left
  g.fillStyle = rim; g.fillRect(0, 150, 60, 110); g.fillRect(964, 150, 60, 110); // back strip (wraps)
  const texture = new pc.Texture(device, { name: 'studio-environment', width: 1024, height: 512, format: pc.PIXELFORMAT_SRGBA8, mipmaps: false, projection: pc.TEXTUREPROJECTION_EQUIRECT, addressU: pc.ADDRESS_REPEAT, addressV: pc.ADDRESS_CLAMP_TO_EDGE });
  texture.setSource(canvas);
  const source = pc.EnvLighting.generateLightingSource(texture);
  const atlas = pc.EnvLighting.generateAtlas(source);
  texture.destroy(); source.destroy();
  return atlas;
}

function dotTexture(device: pc.GraphicsDevice) {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
  const g = canvas.getContext('2d')!, gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)'); gradient.addColorStop(.35, 'rgba(255,255,255,.55)'); gradient.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gradient; g.fillRect(0, 0, 64, 64);
  const texture = new pc.Texture(device, { name: 'dust', width: 64, height: 64, format: pc.PIXELFORMAT_SRGBA8, mipmaps: true });
  texture.setSource(canvas);
  return texture;
}

/**
 * Micro surface relief for the detail normal map: fine grain plus a softer mottling, like leather pores and fibre.
 * Tiled across the subject's UVs it breaks the too-clean highlights that make renders read as CG.
 */
function detailTexture(device: pc.GraphicsDevice) {
  const size = 512, height = new Float32Array(size * size);
  let seed = 91;
  const next = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const noise = new Float32Array(size * size).map(next);
  const at = (x: number, y: number) => noise[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    // Box-blurred noise at two scales: pores (fine) and mottling (coarse).
    let fine = 0, coarse = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) fine += at(x + i, y + j);
    for (let j = -4; j <= 4; j += 2) for (let i = -4; i <= 4; i += 2) coarse += at(x + i, y + j);
    height[y * size + x] = fine / 9 * .65 + coarse / 25 * .35;
  }
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const h = (u: number, v: number) => height[((v + size) % size) * size + ((u + size) % size)];
    const dx = (h(x + 1, y) - h(x - 1, y)) * 6, dy = (h(x, y + 1) - h(x, y - 1)) * 6, length = Math.hypot(dx, dy, 1);
    const o = (y * size + x) * 4;
    data[o] = Math.round((-dx / length * .5 + .5) * 255); data[o + 1] = Math.round((-dy / length * .5 + .5) * 255); data[o + 2] = Math.round((1 / length * .5 + .5) * 255); data[o + 3] = 255;
  }
  const texture = new pc.Texture(device, { name: 'look-detail', width: size, height: size, format: pc.PIXELFORMAT_RGBA8, mipmaps: true, addressU: pc.ADDRESS_REPEAT, addressV: pc.ADDRESS_REPEAT, anisotropy: 8 });
  const pixels = texture.lock(); (pixels as Uint8Array).set(data); texture.unlock();
  return texture;
}

/** Motes drifting through the light: camera-facing quads rebuilt from the timeline time (no simulation state). */
class DustField {
  readonly entity: pc.Entity;
  private mesh: pc.Mesh;
  private material = new pc.StandardMaterial();
  private texture: pc.Texture;
  private seeds: number[][];
  private positions: Float32Array; private colors: Float32Array;
  constructor(app: pc.Application, private count = 320) {
    const next = random(7);
    this.seeds = Array.from({ length: count }, () => Array.from({ length: 10 }, next));
    this.positions = new Float32Array(count * 12); this.colors = new Float32Array(count * 16);
    const uvs = new Float32Array(count * 8), indices = new Uint16Array(count * 6);
    for (let i = 0; i < count; i++) {
      uvs.set([0, 0, 1, 0, 1, 1, 0, 1], i * 8);
      indices.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
    }
    this.mesh = new pc.Mesh(app.graphicsDevice);
    this.mesh.setPositions(this.positions); this.mesh.setUvs(0, uvs); this.mesh.setColors(this.colors); this.mesh.setIndices(indices);
    this.mesh.update(pc.PRIMITIVE_TRIANGLES);
    this.texture = dotTexture(app.graphicsDevice);
    const m = this.material;
    m.useLighting = false; m.useSkybox = false; m.useFog = false; m.diffuse = new pc.Color(0, 0, 0);
    m.emissive = new pc.Color(1, 1, 1); m.emissiveMap = this.texture; m.emissiveVertexColor = true; m.emissiveIntensity = 3;
    m.blendType = pc.BLEND_ADDITIVE; m.depthWrite = false; m.cull = pc.CULLFACE_NONE;
    m.update();
    this.entity = new pc.Entity('Look dust', app);
    this.entity.addComponent('render', { meshInstances: [new pc.MeshInstance(this.mesh, m)], castShadows: false, receiveShadows: false });
    app.root.addChild(this.entity);
  }
  update(t: number, center: pc.Vec3, radius: number, camera: pc.Entity, amount: number) {
    const right = camera.right, up = camera.up, extent = radius * 2.6, height = radius * 3.2, floor = center.y - radius;
    const visible = Math.round(this.count * Math.min(1, amount * 1.4));
    for (let i = 0; i < this.count; i++) {
      const s = this.seeds[i];
      const rise = (s[1] + t * (.015 + s[5] * .03) / Math.max(.2, radius)) % 1;
      const x = center.x + (s[0] * 2 - 1) * extent + Math.sin(t * (.3 + s[6] * .5) + s[7] * 6.28) * radius * .12;
      const y = floor + rise * height;
      const z = center.z + (s[2] * 2 - 1) * extent + Math.cos(t * (.25 + s[8] * .4) + s[9] * 6.28) * radius * .12;
      const size = radius * (.004 + s[3] * .007);
      const twinkle = .35 + .65 * Math.max(0, Math.sin(t * (1.2 + s[4] * 2.5) + s[7] * 12));
      // Fade in and out at the bottom and top of the column so motes never pop.
      const edge = Math.min(1, rise * 6, (1 - rise) * 6);
      const near = Math.max(0, 1 - Math.hypot(x - center.x, z - center.z) / extent);
      const alpha = i < visible ? twinkle * edge * amount * (.25 + .75 * near) : 0;
      for (let c = 0; c < 4; c++) {
        const sx = c === 0 || c === 3 ? -size : size, sy = c < 2 ? -size : size;
        this.positions.set([x + right.x * sx + up.x * sy, y + right.y * sx + up.y * sy, z + right.z * sx + up.z * sy], i * 12 + c * 3);
        this.colors.set([alpha, alpha * .96, alpha * .9, 1], i * 16 + c * 4);
      }
    }
    this.mesh.setPositions(this.positions); this.mesh.setColors(this.colors); this.mesh.update(pc.PRIMITIVE_TRIANGLES);
  }
  destroy() { this.entity.destroy(); this.mesh.destroy(); this.material.destroy(); this.texture.destroy(); }
}

/**
 * The project look inside the viewport: a studio light rig aimed at the subject, softbox reflections, a faked floor
 * reflection, dust in the light, and CameraFrame post-processing (bloom, depth of field, haze, grading, vignette,
 * fringing). With no look everything is restored, so scenes without one render exactly as before.
 */
export class LookLayer {
  private frame: pc.CameraFrame | null = null;
  private rig: Rig | null = null;
  private dust: DustField | null = null;
  /** Environment atlases by key (procedural softboxes per rim colour, or an HDRI name); `envWanted` is the one to show. */
  private envs = new Map<string, pc.Texture>();
  private envLoads = new Map<string, pc.Asset>();
  private envWanted = '';
  private detail: pc.Texture | null = null;
  private detailed = new Map<pc.StandardMaterial, { map: pc.Texture | null; bumpiness: number; tiling: pc.Vec2; normal: number }>();
  private floorRestore: { material: pc.StandardMaterial; diffuse: pc.Color } | null = null;
  private mirror: { root: pc.Entity; source: pc.Entity; clone: pc.Entity; signature: string } | null = null;
  private staticKey = '';
  private restore: { ambient: pc.Color; toneMapping: number; sunEnabled: boolean; layers: number[]; skyboxIntensity: number };
  constructor(private app: pc.Application, private camera: pc.Entity, private sun: pc.Entity, private changed: () => void) {
    this.restore = { ambient: app.scene.ambientLight.clone(), toneMapping: camera.camera!.toneMapping, sunEnabled: sun.enabled, layers: [...camera.camera!.layers], skyboxIntensity: app.scene.skyboxIntensity };
  }

  get active() { return !!this.frame; }
  /** True while an HDRI is still downloading; renders wait for it. */
  get loading() { return !!this.envWanted && !this.envs.has(this.envWanted); }

  apply(timeline: LookSettings | null, state: LookFrame) {
    if (!timeline) { this.clear(); return; }
    const look = lightingAt(timeline, state.time);
    const studio = look.lighting.rig === 'studio';
    const key = JSON.stringify([look, state.pixelScale]);
    if (key !== this.staticKey) { this.staticKey = key; this.configure(look, studio, state.pixelScale); }
    const box = state.subject ?? new pc.BoundingBox(new pc.Vec3(0, .3, 0), new pc.Vec3(.3, .3, .3));
    const center = box.center, radius = Math.max(.12, box.halfExtents.length());
    if (this.rig) this.placeRig(look, center, radius, state.time);
    if (this.dust) this.dust.update(state.time, center, radius, this.camera, look.atmosphere.dust);
    this.updateMirror(studio ? state.subjectRoot : null, state.floorY);
    this.updateDetail(state.subjectRoot, look.camera.detail ?? 0);
    this.updateFloor(studio ? state.floor : null, look.lighting.floor ?? 0);
    const frame = this.frame!;
    if (look.camera.aperture) {
      // Thin-lens optics: the sharp band and the background blur follow focal length, f-stop and focus distance.
      const f = state.lens.focalLength, N = look.camera.aperture, S = Math.max(f * 1.05, state.focus * 1000);
      const coc = .03 * state.lens.sensorHeight / 24, hyperfocal = f * f / (N * coc) + f;
      const near = S * (hyperfocal - f) / (hyperfocal + S - 2 * f), far = hyperfocal > S ? S * (hyperfocal - f) / (hyperfocal - S) : Infinity;
      frame.dof.focusDistance = S / 1000;
      frame.dof.focusRange = Math.min(1000, (far - near) / 1000);
      // Blur disc of a distant background on the sensor, in output pixels (the pass takes roughly a radius).
      const disc = f * f / (N * (S - f)) / state.lens.sensorHeight * 1080 * state.pixelScale;
      frame.dof.blurRadius = Math.min(16 * state.pixelScale, Math.max(.5, disc * .5));
    } else if (look.camera.dof > 0) {
      const focus = Math.max(.05, state.focus);
      frame.dof.focusDistance = focus;
      // Stronger settings narrow the sharp band and widen the blur; blur is in pixels, so scale with the output.
      frame.dof.focusRange = focus * (.04 + (1 - look.camera.dof) * .22);
      frame.dof.blurRadius = (2 + look.camera.dof * 7) * state.pixelScale;
    }
    frame.update();
  }

  private configure(look: LookSettings, studio: boolean, pixelScale: number) {
    const app = this.app, camera = this.camera.camera!;
    if (!this.frame) this.frame = new pc.CameraFrame(app, camera);
    const f = this.frame, c = look.camera;
    f.rendering.toneMapping = TONEMAPS[c.toneMapping];
    f.rendering.renderFormats = [pc.PIXELFORMAT_111110F, pc.PIXELFORMAT_RGBA16F, pc.PIXELFORMAT_RGBA32F];
    f.rendering.samples = 4;
    f.rendering.sharpness = 0;
    f.bloom.intensity = c.bloom * .03;
    f.bloom.blurLevel = 9;
    f.grading.enabled = true;
    f.grading.brightness = Math.min(3, Math.pow(2, c.exposure));
    f.grading.contrast = c.contrast; f.grading.saturation = c.saturation; f.grading.tint = color(c.tint);
    f.vignette.intensity = c.vignette; f.vignette.inner = .35; f.vignette.outer = 1.25; f.vignette.curvature = .6;
    f.fringing.intensity = c.fringing * 12;
    f.rendering.sharpness = c.sharpen ?? 0;
    const ao = c.ao ?? 0;
    f.ssao.type = ao > 0 ? pc.SSAOTYPE_COMBINE : pc.SSAOTYPE_NONE;
    f.ssao.intensity = ao; f.ssao.samples = 16; f.ssao.power = 4; f.ssao.blurEnabled = true;
    f.dof.enabled = c.dof > 0 || !!c.aperture; f.dof.nearBlur = true; f.dof.highQuality = true; f.dof.blurRings = 5; f.dof.blurRingPoints = 6;
    f.taa.enabled = false;
    const haze = look.atmosphere.haze;
    f.volumetricFog.enabled = haze > 0 && studio;
    f.volumetricFog.light = null; f.volumetricFog.localSpotLights = true; f.volumetricFog.localOmniLights = false;
    f.volumetricFog.density = haze * .05; f.volumetricFog.heightFalloff = 0; f.volumetricFog.localIntensity = .4;
    f.volumetricFog.ambientIntensity = 0; f.volumetricFog.scale = pixelScale > 1.2 ? .5 : .75; f.volumetricFog.steps = 32; f.volumetricFog.localSteps = 24;
    f.volumetricFog.anisotropy = .5; f.volumetricFog.extinction = .6; f.volumetricFog.maxDistance = 30;

    if (studio) {
      this.sun.enabled = false;
      app.scene.ambientLight = new pc.Color(.012, .012, .014);
      if (!this.rig) this.rig = this.buildRig();
      this.showEnvironment(look.lighting.environmentMap ?? 'softboxes', look.lighting.rimColor);
      // Captured HDRIs are already exposed for a real studio; the procedural boxes are brighter.
      app.scene.skyboxIntensity = look.lighting.environment * ((look.lighting.environmentMap ?? 'softboxes') === 'softboxes' ? .5 : 1.1);
      camera.layers = this.restore.layers.filter(id => id !== pc.LAYERID_SKYBOX);
      const l = look.lighting, r = this.rig;
      this.lightStyle(r.key, color(l.keyColor), 1.3 * l.key);
      this.lightStyle(r.fill, new pc.Color(.82, .88, 1), .45 * l.fill);
      this.lightStyle(r.rimA, color(l.rimColor), 2.6 * l.rim);
      this.lightStyle(r.rimB, color(l.rimColor2), 1.8 * l.rim);
      this.lightStyle(r.beam, new pc.Color(1, .97, .92), 1.8 * l.beam);
      r.sweep.light!.color = color(l.keyColor);
      // Soft contact shadows: percentage-closer soft shadows widen with distance from the contact point.
      const softness = l.shadowSoftness ?? 0;
      r.key.light!.shadowType = softness > 0 ? pc.SHADOW_PCSS_32F : pc.SHADOW_PCF5_32F;
      r.key.light!.penumbraSize = 1 + softness * 14; r.key.light!.shadowSamples = 24;
    } else {
      this.destroyRig();
      this.sun.enabled = this.restore.sunEnabled;
      app.scene.ambientLight = this.restore.ambient.clone();
      camera.layers = [...this.restore.layers];
    }
    if (look.atmosphere.dust > 0 && !this.dust) this.dust = new DustField(app);
    if (look.atmosphere.dust <= 0 && this.dust) { this.dust.destroy(); this.dust = null; }
  }

  /** Show an environment atlas, building the procedural one or loading an HDRI the first time it is asked for. */
  private showEnvironment(map: 'softboxes' | 'studio' | 'warm-studio', rim: string) {
    const key = map === 'softboxes' ? `softboxes:${rim}` : map;
    this.envWanted = key;
    let atlas = this.envs.get(key);
    if (!atlas && map === 'softboxes') { atlas = studioEnvironment(this.app.graphicsDevice, rim); this.envs.set(key, atlas); }
    if (atlas) { this.app.scene.envAtlas = atlas; return; }
    if (map === 'softboxes' || this.envLoads.has(key)) return;
    const asset = new pc.Asset(`look:${key}`, 'texture', { url: HDRIS[map] }, { mipmaps: false });
    this.envLoads.set(key, asset);
    asset.once('load', () => {
      const texture = asset.resource as pc.Texture;
      texture.projection = pc.TEXTUREPROJECTION_EQUIRECT;
      const source = pc.EnvLighting.generateLightingSource(texture), built = pc.EnvLighting.generateAtlas(source);
      source.destroy();
      this.envs.set(key, built);
      if (this.envWanted === key) this.app.scene.envAtlas = built;
      this.changed();
    });
    asset.once('error', () => { this.envLoads.delete(key); this.envs.set(key, studioEnvironment(this.app.graphicsDevice, rim)); this.changed(); });
    this.app.assets.add(asset); this.app.assets.load(asset);
  }

  /** Micro detail: a tiled detail normal map on the subject's materials (restored when turned off). */
  private updateDetail(subject: pc.Entity | null, amount: number) {
    const wanted = new Set<pc.StandardMaterial>();
    if (subject && amount > 0) {
      this.detail ??= detailTexture(this.app.graphicsDevice);
      for (const component of subject.findComponents('render') as pc.RenderComponent[]) for (const instance of component.meshInstances) {
        const material = instance.material;
        if (!(material instanceof pc.StandardMaterial) || !material.normalMap) continue;
        wanted.add(material);
        if (!this.detailed.has(material)) this.detailed.set(material, { map: material.normalDetailMap, bumpiness: material.normalDetailMapBumpiness, tiling: material.normalDetailMapTiling.clone(), normal: material.bumpiness });
        // The model's own normal map carries the stitching and grain; strengthen it, then add fine pores on top.
        const normal = this.detailed.get(material)!.normal * (1 + amount * 1.2);
        if (material.normalDetailMap !== this.detail || material.normalDetailMapBumpiness !== amount * .7 || material.bumpiness !== normal) {
          material.normalDetailMap = this.detail; material.normalDetailMapBumpiness = amount * .7; material.normalDetailMapTiling = new pc.Vec2(64, 64); material.bumpiness = normal; material.update();
        }
      }
    }
    for (const [material, original] of this.detailed) if (!wanted.has(material)) {
      material.normalDetailMap = original.map; material.normalDetailMapBumpiness = original.bumpiness; material.normalDetailMapTiling = original.tiling; material.bumpiness = original.normal; material.update();
      this.detailed.delete(material);
    }
  }

  /** Studio floor tone: black by default, up to a dark graphite that shows contact shadows and light pools. */
  private updateFloor(material: pc.StandardMaterial | null, tone: number) {
    if (!material) { this.restoreFloor(); return; }
    if (!this.floorRestore) this.floorRestore = { material, diffuse: material.diffuse.clone() };
    const base = this.floorRestore.diffuse, v = base.r + tone * .16;
    if (Math.abs(material.diffuse.r - v) > 1e-4) { material.diffuse = new pc.Color(v, v, v * 1.04); material.update(); }
  }
  private restoreFloor() {
    if (!this.floorRestore) return;
    this.floorRestore.material.diffuse = this.floorRestore.diffuse.clone(); this.floorRestore.material.update(); this.floorRestore = null;
  }

  private lightStyle(entity: pc.Entity, value: pc.Color, intensity: number) {
    entity.light!.color = value; entity.light!.intensity = intensity; entity.enabled = intensity > 0;
  }

  private spot(name: string, inner: number, outer: number, shadows: boolean, scattering: number) {
    const entity = new pc.Entity(name, this.app);
    entity.addComponent('light', {
      type: 'spot', innerConeAngle: inner, outerConeAngle: outer, range: 10, falloffMode: pc.LIGHTFALLOFF_INVERSESQUARED,
      castShadows: shadows, shadowType: pc.SHADOW_PCF5_32F, shadowResolution: 2048, shadowBias: .02, normalOffsetBias: .03, volumetricScattering: scattering,
    });
    this.app.root.addChild(entity);
    return entity;
  }
  private buildRig(): Rig {
    return {
      key: this.spot('Look key', 8, 55, true, .04), fill: this.spot('Look fill', 20, 80, false, 0),
      rimA: this.spot('Look rim', 8, 42, false, .08), rimB: this.spot('Look rim 2', 8, 42, false, .05),
      beam: this.spot('Look beam', 5, 22, true, 1), sweep: this.spot('Look sweep', 6, 16, false, 0),
    };
  }
  /** Positions are relative to the subject's bounds, turned by the rig angle; spots point along their −Y axis. */
  private placeRig(look: LookSettings, center: pc.Vec3, radius: number, time: number) {
    const r = this.rig!, d = Math.max(.7, radius * 4.2), turn = new pc.Quat().setFromEulerAngles(0, look.lighting.angle * pc.math.RAD_TO_DEG, 0);
    const aim = (entity: pc.Entity, x: number, y: number, z: number, target = center) => {
      const offset = turn.transformVector(new pc.Vec3(x, y, z));
      entity.setPosition(center.x + offset.x, center.y + offset.y, center.z + offset.z);
      entity.lookAt(target); entity.rotateLocal(90, 0, 0);
      entity.light!.range = d * 6;
    };
    aim(r.key, -.9 * d, .95 * d, .9 * d);
    aim(r.fill, 1.1 * d, .35 * d, .9 * d);
    aim(r.rimA, -.85 * d, .6 * d, -1 * d);
    aim(r.rimB, 1 * d, .75 * d, -.85 * d);
    aim(r.beam, 0, 2.1 * d, -1.25 * d);
    const sweep = look.lighting.sweep;
    const u = sweep ? (time - sweep.start) / sweep.duration : -1;
    r.sweep.enabled = !!sweep && u > 0 && u < 1;
    if (sweep && r.sweep.enabled) {
      // Sweeps across the front, left to right, easing in and out of brightness.
      aim(r.sweep, pc.math.lerp(-1.3, 1.3, u) * d, .45 * d, 1.05 * d, new pc.Vec3(center.x + pc.math.lerp(-.6, .6, u) * radius, center.y, center.z));
      r.sweep.light!.intensity = 2.4 * sweep.intensity * Math.sin(Math.PI * u);
    }
  }

  /** A mirrored copy of the subject under a translucent floor reads as a glossy reflection. */
  private updateMirror(subject: pc.Entity | null, floorY: number | null) {
    if (!subject || floorY === null) { this.clearMirror(); return; }
    // A prop swaps its placeholder for the real model when it loads; re-copy whenever its meshes change.
    const renders = subject.findComponents('render') as pc.RenderComponent[];
    const signature = renders.flatMap(component => component.meshInstances.map(instance => instance.mesh.id)).join(',');
    if (this.mirror && (this.mirror.source !== subject || this.mirror.signature !== signature)) this.clearMirror();
    if (!this.mirror) {
      if (!renders.length) return;
      const root = new pc.Entity('Look reflection', this.app), clone = subject.clone() as pc.Entity;
      clone.name = 'reflection';
      for (const component of clone.findComponents('render') as pc.RenderComponent[]) { component.castShadows = false; component.receiveShadows = false; }
      root.addChild(clone); this.app.root.addChild(root);
      this.mirror = { root, source: subject, clone, signature };
    }
    const { root, clone, source } = this.mirror;
    root.setLocalPosition(0, 2 * floorY, 0); root.setLocalScale(1, -1, 1);
    clone.setLocalPosition(source.getPosition()); clone.setLocalRotation(source.getRotation()); clone.setLocalScale(source.getLocalScale());
  }
  private clearMirror() { this.mirror?.root.destroy(); this.mirror = null; }

  private destroyRig() { if (this.rig) Object.values(this.rig).forEach(entity => entity.destroy()); this.rig = null; }
  clear() {
    if (!this.frame && !this.rig && !this.dust && !this.envs.size && !this.detailed.size) return;
    this.frame?.destroy(); this.frame = null;
    this.destroyRig(); this.dust?.destroy(); this.dust = null; this.clearMirror();
    this.updateDetail(null, 0); this.restoreFloor();
    if ([...this.envs.values()].includes(this.app.scene.envAtlas as pc.Texture)) this.app.scene.envAtlas = null;
    this.envs.forEach(texture => texture.destroy()); this.envs.clear(); this.envWanted = '';
    this.envLoads.forEach(asset => { asset.off(); asset.unload(); this.app.assets.remove(asset); }); this.envLoads.clear();
    const camera = this.camera.camera!;
    camera.toneMapping = this.restore.toneMapping; camera.layers = [...this.restore.layers];
    this.sun.enabled = this.restore.sunEnabled;
    this.app.scene.ambientLight = this.restore.ambient.clone();
    this.app.scene.skyboxIntensity = this.restore.skyboxIntensity;
    this.staticKey = '';
  }
  destroy() { this.clear(); this.detail?.destroy(); this.detail = null; }
}
