'use client';

import { useLayoutEffect, useState, type RefObject } from 'react';
import type { ViewportRegion } from '@/contracts';
import { avoidFloatingOverlay, measureClearRegion } from './viewport-region';

/** The shell owns overlay geometry. The renderer receives normalized plain data only. */
export function useViewportRegion(viewport: RefObject<HTMLDivElement | null>, inspectorOpen: boolean, focusMode: boolean, inspectorTab: string, selection: string | null, directorOpen = false): ViewportRegion {
  const [region, setRegion] = useState<ViewportRegion>({ left: .02, right: .98, top: .1, bottom: .7 });
  useLayoutEffect(() => {
    const element = viewport.current;
    const stage = element?.parentElement;
    if (!element || !stage) return;
    const selectors = ['.object-browser', '.inspector', '.timeline-position', '.viewport-tools', '.object-tool-position', '.scene-dock', '.director-floating'];
    const panels = selectors.map(selector => stage.querySelector(selector));
    const measure = () => {
      const rect = element.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const [objects, inspector, timeline, navigation, objectTools, dock, assistant] = panels.map(panel => {
        const bounds = panel?.getBoundingClientRect();
        return bounds && bounds.width > 0 && bounds.height > 0 ? bounds : null;
      });
      const stageBottom = stage.getBoundingClientRect().bottom;
      stage.style.setProperty('--scene-dock-bottom', `${timeline ? stageBottom - timeline.top + (directorOpen ? 12 : 40) : 24}px`);
      const tools = objectTools && objectTools.bottom > (navigation?.bottom ?? 0) ? objectTools : navigation;
      const base = measureClearRegion(rect, objects, inspector, dock && dock.height > 0 && dock.top < (timeline?.top ?? Infinity) ? dock : timeline, tools);
      const next = directorOpen && assistant ? avoidFloatingOverlay(base, rect, assistant) : base;
      setRegion(previous => Object.keys(next).every(key => previous[key as keyof ViewportRegion] === next[key as keyof ViewportRegion]) ? previous : next);
    };
    const observer = new ResizeObserver(measure);
    [element, ...panels].forEach(panel => { if (panel) observer.observe(panel); });
    const movements = new MutationObserver(measure);
    if (panels[6]) movements.observe(panels[6], { attributes: true, attributeFilter: ['style'] });
    window.addEventListener('resize', measure);
    measure();
    return () => { movements.disconnect(); observer.disconnect(); window.removeEventListener('resize', measure); };
  }, [viewport, inspectorOpen, focusMode, inspectorTab, selection, directorOpen]);
  return region;
}
