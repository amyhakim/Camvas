import type { AudioSource } from '../../contracts';

/** Shipped production soundtracks. IDs resolve only to these fixed local assets. */
export function builtinAudio(id: string): { source: AudioSource; file: string } | null {
  if (id === 'greenhouse') return {
    file: '/greenhouse/assets/mix.mp3',
    source: {
      provider: 'builtin', id, name: 'A Little Tending — garden music & sounds', artist: 'A Little Tending production',
      artistUrl: '/greenhouse/ATTRIBUTION.md', pageUrl: '/greenhouse/watch.html',
      license: 'Original production audio', licenseUrl: '/greenhouse/ATTRIBUTION.md', duration: 15,
    },
  };
  if (id === 'fuse-warmup') return { file: '/films/fuse-warmup/music.mp3', source: {
    provider: 'builtin', id, name: 'Warm Welcome — 110 BPM fitness groove', artist: 'FUSE Warm Welcome production',
    artistUrl: '/fuse-warmup/ATTRIBUTION.md', pageUrl: '/fuse-warmup/watch.html',
    license: 'Original production audio', licenseUrl: '/fuse-warmup/ATTRIBUTION.md', duration: 15,
  } };
  if (id !== 'last-light') return null;
  return {
    file: '/films/last-light/assets/soundtrack.mp3',
    source: {
      provider: 'builtin', id, name: 'Last Light — music & coastal sounds', artist: 'Last Light production',
      artistUrl: '/cinematics/last-light', pageUrl: '/cinematics/last-light',
      license: 'Original production audio', licenseUrl: '/films/last-light/verification.md', duration: 15,
    },
  };
}
