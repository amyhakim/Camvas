'use client';

import { Armchair, ArrowRight, Box, Camera, Crosshair, Info } from 'lucide-react';
import type { SceneEntity } from '@/contracts';
import { Button, PropertyRow } from '@/components/ui/primitives';
import { entityPosition } from './data';
import styles from './scene.module.css';

export type ObjectInspectorProps = {
  selected?: SceneEntity;
  frame: number;
  onFrameSelected: () => void;
  onViewCamera: (id: string) => void;
  onCreateMove: () => void;
  onSelectCamera: () => void;
};

export function ObjectInspector({ selected, frame, onFrameSelected, onViewCamera, onCreateMove, onSelectCamera }: ObjectInspectorProps) {
  const position = selected ? entityPosition(selected, frame) : null;
  const ObjectIcon = selected?.type === 'Camera' ? Camera : selected?.type === 'Collection' ? Armchair : Box;

  return <div className={styles.inspectorRoot}>
    {selected && position ? <>
      <div className="inspector-identity"><ObjectIcon size={22} strokeWidth={1.5} /><div><h3>{selected.name}</h3><p>{selected.category} · {selected.type}</p></div></div>
      <Button className="frame-selected" size="sm" onClick={onFrameSelected}><Crosshair size={14} />Frame selected object</Button>
      {selected.type !== 'Camera' && <Button className="frame-selected" variant="primary" size="sm" onClick={onCreateMove}><Camera size={14} />Create camera move</Button>}
      {selected.type === 'Camera' && <Button className="view-through" variant="ghost" size="sm" onClick={() => onViewCamera(selected.id)}>View through camera <ArrowRight size={14} /></Button>}
      <div className="inspector-section"><h4>Properties</h4><dl>
        <PropertyRow label="Type">{selected.type}</PropertyRow>
        <PropertyRow label="Source name"><span className="source-name">{selected.sourceName}</span></PropertyRow>
        {selected.lens ? <>
          <PropertyRow label="Focal length">{selected.lens} mm</PropertyRow>
          <PropertyRow label="Sensor width">{selected.sensorWidth} mm</PropertyRow>
          <PropertyRow label="Animation">{selected.animated ? 'Frames 1–250' : 'Static'}</PropertyRow>
        </> : <>
          <PropertyRow label="Material">{selected.materials.filter(Boolean).join(', ') || 'Default'}</PropertyRow>
          <PropertyRow label="Dimensions">{selected.dimensions.map(value => value.toFixed(2)).join(' × ')} m</PropertyRow>
        </>}
      </dl></div>
      <div className="inspector-section"><h4>Position <span>m · Z-up</span></h4><div className="vector-fields">{position.map((value, index) => <div key={index}><span>{['X', 'Y', 'Z'][index]}</span><output aria-label={`${['X', 'Y', 'Z'][index]} position`}>{value.toFixed(3)}</output></div>)}</div></div>
      <div className="inspector-note"><Info size={14} /><span>{selected.type === 'Splat' ? 'One captured environment. Individual furniture and walls are not segmented; lighting is captured in the scene.' : 'Live scene selection. Camera values follow the playhead.'}</span></div>
    </> : <div className="empty-state"><Crosshair size={24} /><h3>Select an object</h3><p>Click geometry in the viewport to inspect it, or choose a camera below.</p><Button size="sm" onClick={onSelectCamera}>Select shot camera</Button></div>}
  </div>;
}
