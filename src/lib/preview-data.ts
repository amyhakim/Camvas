export const FRAME_START = 1;
export const FRAME_END = 374;
export const FPS = 24;

export function formatTimecode(frame: number) {
  const elapsed = Math.max(0, Math.round(frame) - FRAME_START);
  return `00:${String(Math.floor(elapsed / FPS)).padStart(2, '0')}:${String(elapsed % FPS).padStart(2, '0')}`;
}

// Measured from the supplied Blender scene; markers on the still are illustrative.
export const previewObjects = [
  { id: 'Camera.002', label: 'Camera.002', detail: 'Animated camera', type: 'Camera', material: '—', position: [-17.126, -11.480, 1.663], lens: '36 mm', sensor: '36 mm', dimensions: null },
  { id: 'Group', label: 'Lounge chair', detail: 'Group · collection instance', type: 'Collection', material: 'Leather / metal', position: [0.964, -1.064, 1.506], lens: null, sensor: null, dimensions: null },
  { id: 'water_plane_still', label: 'Reflecting pool', detail: 'water_plane_still', type: 'Mesh', material: 'water', position: [-14.135, -6.551, 1.293], lens: null, sensor: null, dimensions: '21.01 × 9.92 m' },
] as const;

export type PreviewObjectId = typeof previewObjects[number]['id'];
