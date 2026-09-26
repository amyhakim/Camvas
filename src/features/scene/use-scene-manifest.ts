'use client';

import { useEffect, useState } from 'react';
import type { SceneManifest } from '@/contracts';
import { SCENES, sceneIdFromSearch } from './catalog';

export function useSceneManifest() {
  const [manifest, setManifest] = useState<SceneManifest | null>(null);
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    const id = sceneIdFromSearch(window.location.search);
    const scene = SCENES.find(scene => scene.id === id)!;
    fetch(scene.manifestUrl, { signal: abort.signal })
      .then(response => {
        if (!response.ok) throw new Error('Scene metadata unavailable');
        return response.json() as Promise<SceneManifest>;
      })
      .then(data => { if (!abort.signal.aborted) setManifest({ ...data, id: scene.id }); })
      .catch(() => { if (!abort.signal.aborted) setLoadError(true); });
    return () => abort.abort();
  }, []);
  return { manifest, loading: !manifest && !loadError, loadError };
}
