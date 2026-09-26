'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const PreferencesContext = createContext({ opaque: false, setOpaque: (_value: boolean) => {} });

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [opaque, setOpaqueState] = useState(false);
  useEffect(() => {
    try {
      const saved = localStorage.getItem('showcam-transparency');
      setOpaqueState(saved ? saved === 'reduced' : window.matchMedia('(prefers-reduced-transparency: reduce)').matches);
    } catch { /* Storage can be unavailable in private browsing. */ }
  }, []);
  function setOpaque(value: boolean) {
    setOpaqueState(value);
    try { localStorage.setItem('showcam-transparency', value ? 'reduced' : 'full'); } catch { /* The current session still works. */ }
  }
  useEffect(() => { document.documentElement.dataset.transparency = opaque ? 'reduced' : 'full'; }, [opaque]);
  return <PreferencesContext.Provider value={{ opaque, setOpaque }}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() { return useContext(PreferencesContext); }
