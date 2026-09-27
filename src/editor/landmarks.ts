import type { ProjectDocument, SceneLandmark } from '../contracts';
export const MAX_LANDMARKS = 32;

export function landmarkLabel(label: string, landmarks: SceneLandmark[], id: string) {
  const clean = label.trim().replace(/\s+/g, ' ');
  if (!clean || clean.length > 48) throw new Error('Use a label between 1 and 48 characters.');
  if (landmarks.some(mark => mark.id !== id && mark.label.toLocaleLowerCase() === clean.toLocaleLowerCase())) throw new Error('Give each landmark a different label.');
  return clean;
}
export function nextLandmarkLabel(landmarks: SceneLandmark[]) {
  let index = 1;
  while (landmarks.some(mark => mark.label.toLocaleLowerCase() === `landmark ${index}`)) index++;
  return `Landmark ${index}`;
}
/** Named points are plain renderer Y-up coordinates, never screen pixels. */
export function landmarkContext(landmarks: SceneLandmark[]) {
  return landmarks.map(({ id, label, entityId, kind, frame, position }) => ({ id, label, entityId, kind, frame, position: position.map(value => Math.round(value * 1000) / 1000) }));
}

/** Moving or removing a route anchor leaves the camera draft playable but withdraws its anchor claim. */
export function withLandmarkEdit(project: ProjectDocument, landmarks: SceneLandmark[]): ProjectDocument {
  const changedAnchor = project.shot?.anchorIds?.some(id => {
    const before = project.landmarks?.find(mark => mark.id === id), after = landmarks.find(mark => mark.id === id);
    return !before || !after || before.kind !== after.kind || before.position.some((value, axis) => value !== after.position[axis]);
  });
  return { ...project, landmarks, ...(changedAnchor && project.shot
    ? { shot: { ...project.shot, anchorIds: undefined, name: `${project.shot.name.replace(/ · replan$/, '')} · replan` } } : {}) };
}
