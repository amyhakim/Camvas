'use client';

import { useEffect, useState } from 'react';
import { ensureGreenhouseProject, GREENHOUSE_EDITOR_URL } from '@/features/project/greenhouse-project';

/** Existing cinematic links open the saved Gaussian scene editor. */
export default function GreenhouseCinematic() {
  const [error, setError] = useState('');
  useEffect(() => {
    try {
      ensureGreenhouseProject(window.localStorage);
      window.location.replace(GREENHOUSE_EDITOR_URL);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not open the saved project.');
    }
  }, []);
  return <main style={{ padding: 32 }}>{error
    ? <><p role="alert">{error}</p><a href="/editor?scene=hozy-greenhouse">Open the greenhouse scene</a></>
    : <p role="status">Opening Hozy Greenhouse in the editor…</p>}</main>;
}
