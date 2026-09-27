/** Public discovery data; no renderer objects or third-party HTML enter the client. */
export type SuperSplatScene = {
  id: string; name: string; description: string; author: string;
  thumbnailUrl: string; sourceUrl: string; sizeBytes: number; license: string | null;
};

export const SUPERSPLAT_SCENE_ID = /^supersplat-([a-f0-9]{8})-v([1-9]\d{0,5})$/;
export function superSplatReference(id: string) {
  const match = SUPERSPLAT_SCENE_ID.exec(id);
  return match ? { hash: match[1], version: Number(match[2]) } : null;
}
