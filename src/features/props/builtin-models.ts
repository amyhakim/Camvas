import instructorAsset from '../../../public/films/fuse-warmup/instructor.json';

/** Fixed shipped assets can load across browsers without an IndexedDB import. */
export function builtinModelUrl(uid: string): string | null {
  // The first native FUSE starter predates the added contact patches. Keep its
  // saved reference compatible with the same performance, without rewriting user edits.
  if (uid === instructorAsset.uid || uid === 'local-2d752d0c9fb75931e67afad7') {
    return '/films/fuse-warmup/instructor.glb';
  }
  return null;
}
