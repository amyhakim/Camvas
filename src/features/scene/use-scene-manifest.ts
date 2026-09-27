'use client';

import { useEffect, useState } from 'react';
import type { SceneManifest } from '@/contracts';
import { playbackManifest } from './timing';
import { sceneManifestUrl, sceneIdFromSearch } from './catalog';

export function useSceneManifest() {
  const [manifest, setManifest] = useState<SceneManifest | null>(null);
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    const id = sceneIdFromSearch(window.location.search);
    fetch(sceneManifestUrl(id)!, { signal: abort.signal })
      .then(response => {
        if (!response.ok) throw new Error('Scene metadata unavailable');
        return response.json() as Promise<SceneManifest>;
      })
      .then(data => { if (!abort.signal.aborted) setManifest(playbackManifest({ ...data, id })); })
      .catch(() => { if (!abort.signal.aborted) setLoadError(true); });
    return () => abort.abort();
  }, []);
  return { manifest, loading: !manifest && !loadError, loadError };
}
