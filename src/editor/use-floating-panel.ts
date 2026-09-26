import { useLayoutEffect, useRef, useState, type PointerEvent, type KeyboardEvent } from 'react';

/** One position for the launcher and expanded panel, bounded above the timeline. */
export function useFloatingPanel(open: boolean) {
  const surface = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const gesture = useRef<{ pointer: number; x: number; y: number; left: number; top: number } | null>(null);
  const moved = useRef(false);
  function clamp(x: number, y: number) {
    const element = surface.current, stage = element?.parentElement;
    if (!element || !stage) return { x, y };
    const bounds = element.getBoundingClientRect(), parent = stage.getBoundingClientRect();
    const timeline = stage.querySelector('.timeline-position')?.getBoundingClientRect();
    const bottom = timeline && timeline.height ? timeline.top - parent.top - 12 : parent.height - 12;
    return { x: Math.max(12, Math.min(x, parent.width - bounds.width - 12)), y: Math.max(12, Math.min(y, bottom - bounds.height)) };
  }
  useLayoutEffect(() => {
    const element = surface.current;
    if (!element) return;
    const constrain = () => setPosition(previous => {
      if (!previous) return previous;
      const next = clamp(previous.x, previous.y);
      return next.x === previous.x && next.y === previous.y ? previous : next;
    });
    const observer = new ResizeObserver(constrain);
    observer.observe(element); if (element.parentElement) observer.observe(element.parentElement);
    const timeline = element.parentElement?.querySelector('.timeline-position');
    if (timeline) observer.observe(timeline);
    constrain();
    return () => observer.disconnect();
  }, [open]);
  const pointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0 || !surface.current) return;
    const bounds = surface.current.getBoundingClientRect(), parent = surface.current.parentElement!.getBoundingClientRect();
    moved.current = false;
    gesture.current = { pointer: event.pointerId, x: event.clientX, y: event.clientY, left: bounds.left - parent.left, top: bounds.top - parent.top };
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const pointerMove = (event: PointerEvent<HTMLElement>) => {
    const start = gesture.current;
    if (!start || start.pointer !== event.pointerId) return;
    const dx = event.clientX - start.x, dy = event.clientY - start.y;
    if (!moved.current && Math.hypot(dx, dy) < 5) return;
    moved.current = true; setPosition(clamp(start.left + dx, start.top + dy));
  };
  const pointerUp = (event: PointerEvent<HTMLElement>) => {
    gesture.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const keyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Home') { event.preventDefault(); setPosition(null); return; }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key) || !surface.current) return;
    event.preventDefault(); event.stopPropagation();
    const bounds = surface.current.getBoundingClientRect(), parent = surface.current.parentElement!.getBoundingClientRect(), step = event.shiftKey ? 32 : 16;
    setPosition(clamp(bounds.left - parent.left + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0), bounds.top - parent.top + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0)));
  };
  return { surface, moved, style: position ? { left: position.x, top: position.y, bottom: 'auto' } : undefined, handlers: { onPointerDown: pointerDown, onPointerMove: pointerMove, onPointerUp: pointerUp, onPointerCancel: pointerUp, onLostPointerCapture: () => { gesture.current = null; }, onKeyDown: keyDown } };
}
