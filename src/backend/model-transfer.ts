import { gzip as gzipCallback } from 'node:zlib';
import { promisify } from 'node:util';
const gzip = promisify(gzipCallback);

/** Lossless transfer compression only; preserve geometry, materials and licensed source files. */
export async function modelTransfer(data: Uint8Array, type: string, acceptEncoding: string) {
  const gzipAllowed = acceptEncoding.toLowerCase().split(',').some(part => {
    const [encoding, ...parameters] = part.trim().split(';');
    const quality = parameters.find(parameter => parameter.trim().startsWith('q='));
    return encoding === 'gzip' && (!quality || Number(quality.trim().slice(2)) > 0);
  });
  if (!gzipAllowed || data.byteLength < 1024 || !['model/gltf-binary', 'model/gltf+json', 'application/octet-stream'].includes(type)) return { data, compressed: false };
  const compressed = await gzip(data, { level: 4 });
  // Some GLBs contain already-compressed textures. Don't inflate their transfer size.
  return compressed.byteLength < data.byteLength * .95 ? { data: new Uint8Array(compressed), compressed: true } : { data, compressed: false };
}
