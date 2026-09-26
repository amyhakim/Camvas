import type { ActorTrack } from '../../contracts';
export const WALKING_ACTOR: ActorTrack = {
  id: 'actor:fixture', name: 'Walker', color: '#edc58c', height: 1.75,
  marks: [{ time: 0, position: [0, 1, 0], heading: 170 * Math.PI / 180 }, { time: 4, position: [8, 1, -4], heading: -170 * Math.PI / 180 }],
};
