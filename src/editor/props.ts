import type { SceneEntity, SceneProp } from '../contracts';

/** Browser metadata uses Blender coordinates, even for authored Y-up props. */
export function propEntity(prop: SceneProp): SceneEntity {
  const [x, y, z] = prop.position;
  return {
    id: prop.id, name: prop.name, sourceName: prop.source.kind === 'model' ? `Sketchfab · ${prop.source.name}` : `Stand-in ${prop.source.shape}`,
    type: 'Prop', category: 'Prop', materials: prop.color ? [`Tint ${prop.color}`] : [],
    position: [x, -z, y], positionWeb: prop.position, dimensions: [prop.size, prop.size, prop.size],
  };
}
