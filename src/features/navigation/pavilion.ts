import type { NavigationEdge, NavigationNode, SemanticSceneGraph } from '../../contracts';

const nodes: NavigationNode[] = [
  { id: 'west-entry', spaceId: 'west-court', position: [-22.167, 1.977, 9.444] },
  { id: 'west-pool', spaceId: 'west-court', position: [-15.984, 1.336, 8.193] },
  { id: 'pool-corridor-west', spaceId: 'pool-gallery', position: [-17.126, 1.663, 11.48] },
  { id: 'pool-corridor-east', spaceId: 'pool-gallery', position: [-7.864, 1.663, 11.48] },
  { id: 'central-lounge', spaceId: 'main-pavilion', position: [-3.736, 2.373, 3.431] },
  { id: 'north-interior', spaceId: 'main-pavilion', position: [0.758, 2.728, 8.302] },
  { id: 'east-hall', spaceId: 'east-pavilion', position: [10.346, 2.343, 1.058] },
  { id: 'east-gallery', spaceId: 'east-pavilion', position: [12, 2.3, 8] },
  { id: 'east-terrace', spaceId: 'east-terrace', position: [23.979, 1.429, 12.78] },
];

// Candidate visibility edges are collision-checked against the loaded scene before A* may use them.
const edges: NavigationEdge[] = [
  ['west-entry', 'west-pool'], ['west-entry', 'pool-corridor-west'], ['west-pool', 'pool-corridor-west'],
  ['pool-corridor-west', 'pool-corridor-east'], ['pool-corridor-east', 'central-lounge'], ['pool-corridor-east', 'north-interior'],
  ['central-lounge', 'north-interior'], ['central-lounge', 'east-hall'], ['north-interior', 'east-gallery'],
  ['east-hall', 'east-gallery'], ['east-hall', 'east-terrace'], ['east-gallery', 'east-terrace'],
].map(([from, to]) => ({ from, to, clearance: .35 }));

export const PAVILION_SEMANTIC_GRAPH: SemanticSceneGraph = {
  id: 'barcelona-pavilion-v1',
  label: 'Barcelona Pavilion',
  spaces: [
    { id: 'west-court', label: 'West court and reflecting pool', bounds: { min: [-30, 0, 2], max: [-10, 5, 15] } },
    { id: 'pool-gallery', label: 'Pool-side gallery', bounds: { min: [-20, 0, 7], max: [-4, 5, 14] } },
    { id: 'main-pavilion', label: 'Main pavilion lounge', bounds: { min: [-8, 0, -3], max: [6, 5, 11] } },
    { id: 'east-pavilion', label: 'East pavilion', bounds: { min: [5, 0, -5], max: [21, 5, 10] } },
    { id: 'east-terrace', label: 'East terrace', bounds: { min: [18, 0, 7], max: [28, 5, 16] } },
  ],
  anchors: [
    { id: 'entrance', label: 'West entrance', spaceId: 'west-court', nodeId: 'west-entry', position: [-22.167, 1.977, 9.444], lookAt: [-16, 1.6, 8.5], tags: ['entrance', 'arrival', 'exterior'] },
    { id: 'reflecting-pool', label: 'Reflecting pool', spaceId: 'west-court', nodeId: 'west-pool', position: [-15.984, 1.336, 8.193], lookAt: [-11, 1, 7], tags: ['pool', 'water', 'courtyard'] },
    { id: 'lounge', label: 'Main lounge', spaceId: 'main-pavilion', nodeId: 'central-lounge', position: [-3.736, 2.373, 3.431], lookAt: [0, 1.4, 1], tags: ['lounge', 'chairs', 'interior'] },
    { id: 'north-gallery', label: 'North glass gallery', spaceId: 'main-pavilion', nodeId: 'north-interior', position: [0.758, 2.728, 8.302], lookAt: [4, 1.5, 5], tags: ['glass', 'gallery', 'interior'] },
    { id: 'east-hall', label: 'East hall', spaceId: 'east-pavilion', nodeId: 'east-hall', position: [10.346, 2.343, 1.058], lookAt: [15, 1.5, 2], tags: ['hall', 'columns', 'interior'] },
    { id: 'east-terrace', label: 'East terrace', spaceId: 'east-terrace', nodeId: 'east-terrace', position: [23.979, 1.429, 12.78], lookAt: [19, 1.5, 8], tags: ['terrace', 'exterior', 'wide'] },
  ],
  nodes,
  edges,
};
