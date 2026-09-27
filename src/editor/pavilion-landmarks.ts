import type { SceneLandmark } from '../contracts';

/** Ordered, Y-up camera-eye anchors measured against the original Pavilion GLB. */
const anchors: Pick<SceneLandmark, 'id' | 'label' | 'position'>[] = [
  { id: 'flight:pool-west', label: 'Reflecting pool overview', position: [-14, 3.8, 8] },
  { id: 'flight:pool-west-sweep', label: 'Pool west sweep', position: [-11.5, 3.7, 8.15] },
  { id: 'flight:pool-middle', label: 'Pool sweep', position: [-9, 3.55, 7.9] },
  { id: 'flight:pool-east-approach', label: 'Pool eastern approach', position: [-6.5, 3.4, 7.3] },
  { id: 'flight:pool-east', label: 'Pool edge approach', position: [-5, 3.3, 7] },
  { id: 'flight:marble-approach', label: 'Marble wall approach', position: [-3.8, 3.25, 6.5] },
  { id: 'flight:divider-west', label: 'Marble wall west passage', position: [-2.2, 3.15, 6] },
  { id: 'flight:covered-entry', label: 'Covered court entry', position: [-1.45, 3.05, 3] },
  { id: 'flight:inner-court', label: 'Inner court arrival', position: [-1.35, 3, 1.3] },
  { id: 'flight:lounge-threshold', label: 'Lounge threshold', position: [-.3, 3, -.35] },
  { id: 'flight:lounge-west', label: 'Lounge west passage', position: [.65, 3, -.8] },
  { id: 'flight:lounge-crossing', label: 'Lounge crossing', position: [1.45, 3, -1.15] },
  { id: 'flight:lounge-center', label: 'Lounge center', position: [2.5, 3, -1.6] },
  { id: 'flight:lounge-north', label: 'Lounge north arc', position: [3.25, 3, -1.55] },
  { id: 'flight:chair-east', label: 'Chair east arc', position: [4.05, 3.05, .15] },
  { id: 'flight:chair-south', label: 'Chair south pass', position: [3.3, 3.05, 1.3] },
  { id: 'flight:chair-reveal', label: 'Lounge chair reveal', position: [1.45, 3.05, 2.1] },
  { id: 'flight:interior-focus', label: 'Interior feature pass', position: [.3, 3, 1.65] },
  { id: 'flight:interior-return', label: 'Interior return', position: [-.35, 3, 1.1] },
  { id: 'flight:courtyard-east', label: 'Courtyard east return', position: [-1.25, 3, 2.2] },
  { id: 'flight:courtyard-exit', label: 'Courtyard exit', position: [-1.75, 3.1, 3.35] },
  { id: 'flight:wall-return', label: 'Marble wall return', position: [-2.4, 3.2, 4.6] },
  { id: 'flight:pool-return', label: 'Poolside return', position: [-4.4, 3.35, 5.9] },
  { id: 'flight:pool-long-return', label: 'Long pool departure', position: [-6.4, 3.5, 6.9] },
  { id: 'flight:garden-departure', label: 'Garden departure', position: [-8.6, 3.7, 8.1] },
  { id: 'flight:garden-wide', label: 'Garden wide departure', position: [-10.6, 4, 8.4] },
  { id: 'flight:exterior-framing', label: 'Exterior framing', position: [-12.2, 4.2, 9.35] },
  { id: 'flight:exterior-final', label: 'Exterior final reveal', position: [-14, 4.5, 10.2] },
  { id: 'flight:exterior-aerial', label: 'Exterior aerial finish', position: [-16.5, 5.5, 11.5] },
];

export const PAVILION_FLIGHT_LANDMARKS: SceneLandmark[] = anchors.map(mark => ({ ...mark, entityId: null, kind: 'flight', frame: 1 }));
