'use client';

import { useLayoutEffect, useState, type RefObject } from 'react';
import type { ViewportRegion } from '@/contracts';
import { measureClearRegion } from './viewport-region';

/** The shell owns overlay geometry. The renderer receives normalized plain data only. */
export function useViewportRegion(viewport: RefObject<HTMLDivElement | null>, inspectorOpen: boolean, focusMode: boolean, inspectorTab: string): ViewportRegion {
  const [region, setRegion] = useState<ViewportRegion>({ left: .02, right: .98, top: .1, bottom: .7 });
  useLayoutEffect(() => {
    const element = viewport.current;
    const stage = element?.parentElement;
    if (!element || !stage) return;
    const selectors = ['.object-browser', '.inspector', '.timeline-position', '.viewport-tools'];
    const panels = selectors.map(selector => stage.querySelector(selector));
    const measure = () => {
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const [objects, inspector, timeline, tools] = panels.map(panel => {
        const bounds = panel?.getBoundingClientRect();
        return bounds && bounds.width > 0 && bounds.height > 0 ? bounds : null;
      });
      const next = measureClearRegion(rect, objects, inspector, timeline, tools);
      setRegion(previous => Object.keys(next).every(key => previous[key as keyof ViewportRegion] === next[key as keyof ViewportRegion]) ? previous : next);
    };
    const observer = new ResizeObserver(measure);
    [element, ...panels].forEach(panel => { if (panel) observer.observe(panel); });
    window.addEventListener('resize', measure);
    measure();
    return () => { observer.disconnect(); window.removeEventListener('resize', measure); };
  }, [viewport, inspectorOpen, focusMode, inspectorTab]);
  return region;
}
