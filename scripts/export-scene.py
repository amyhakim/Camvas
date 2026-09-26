"""Export a browser-ready scene without saving or changing the source .blend.
Run with Blender --background --factory-startup --disable-autoexec <source> --python scripts/export-scene.py.
"""
import bpy
import json
import math
import os
from pathlib import Path
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'scenes'
OUT.mkdir(parents=True, exist_ok=True)
source = bpy.data.scenes['1- time: midday']
bpy.context.window.scene = source
source.frame_set(1)
# Exclude expensive individual pebbles; the original textured pool bed remains.
for obj in source.objects:
    for ps in obj.particle_systems:
        ps.settings = ps.settings.copy()
        if obj.name == 'pebbles_scatter':
            ps.settings.count = 0
            for mod in obj.modifiers:
                if mod.type == 'PARTICLE_SYSTEM':
                    mod.show_viewport = False
                    mod.show_render = False
        elif obj.name == 'tree_scatter_plane':
            ps.settings.count = 32
        elif obj.name == 'lotus_scattering_plane':
            ps.settings.count = 65
    for mod in obj.modifiers:
        if mod.type == 'DYNAMIC_PAINT':
            mod.show_viewport = False
            mod.show_render = False
# The original tree is over 120k vertices; reduce its mesh once, then share it.
tree = bpy.data.objects.get('tree_scatter')
if tree:
    decimate = tree.modifiers.new('Browser foliage detail', 'DECIMATE')
    decimate.ratio = 0.16
source.frame_set(1)
bpy.context.view_layer.update()
depsgraph = bpy.context.evaluated_depsgraph_get()

# Keep export data in an independent scene, with no exporter-specific mutations to the source file.
web_scene = bpy.data.scenes.new('Showcam Pavilion')
web_scene.unit_settings.system = 'METRIC'
web_scene.render.fps = 24
web_scene.frame_start = 1
web_scene.frame_end = 374
web_scene.render.resolution_x = 1280
web_scene.render.resolution_y = 720
mesh_cache = {}
material_cache = {}
metadata = []
object_entries = {}

colors = {
    'metal': ((.56,.61,.60,1), .85, .23),
    'glass_architectural': ((.64,.79,.73,.18), .1, .08),
    'water': ((.18,.31,.25,.78), .35, .17),
    'white_mat': ((.77,.77,.70,1), 0, .72),
    'matte_white': ((.7,.7,.65,1), 0, .72),
    'black_glossy': ((.09,.10,.08,1), .15, .27),
    'leather_white': ((.8,.77,.68,1), 0, .62),
    'trunk': ((.14,.09,.045,1), 0, .92),
    'leafs': ((.34,.49,.17,1), 0, .88),
    'grass': ((.43,.48,.24,1), 0, 1),
    'Material': ((.56,.52,.4,1), 0, .9),
    'white_lotus': ((.9,.88,.76,1), 0, .6),
    'white_lotus_orange': ((.9,.54,.06,1), 0, .7),
    'white_lotus_leafs': ((.25,.41,.1,1), 0, .7),
}

def material(original):
    key = original.name if original else 'Stone fallback'
    if key in material_cache:
        return material_cache[key]
    mat = bpy.data.materials.new('web_' + key)
    mat.use_nodes = True
    principled = mat.node_tree.nodes.get('Principled BSDF')
    color, metallic, roughness = colors.get(key, ((.66,.63,.51,1), 0, .65))
    principled.inputs['Base Color'].default_value = color
    principled.inputs['Metallic'].default_value = metallic
    principled.inputs['Roughness'].default_value = roughness
    principled.inputs['Alpha'].default_value = color[3]
    if color[3] < 1:
        mat.surface_render_method = 'BLENDED'
    # Reuse real image maps; leave legacy procedural/lighting networks behind.
    images = [n.image for n in original.node_tree.nodes if n.type == 'TEX_IMAGE' and n.image and n.image.size[0]] if original and original.node_tree else []
    if images and key not in ['water', 'glass_architectural']:
        image = images[0]
        # Use the source's file; glTF embeds it in the GLB.
        tex = mat.node_tree.nodes.new('ShaderNodeTexImage')
        tex.image = image
        mat.node_tree.links.new(tex.outputs['Color'], principled.inputs['Base Color'])
        if key == 'leafs':
            mat.node_tree.links.new(tex.outputs['Alpha'], principled.inputs['Alpha'])
            mat.surface_render_method = 'DITHERED'
            mat['alphaClip'] = True
    mat.use_backface_culling = False
    material_cache[key] = mat
    return mat

def vector_web(v): return [float(v[0]), float(v[2]), float(-v[1])]

def add_mesh(original, matrix, entity_id, source_name, instance=False):
    depsgraph = bpy.context.evaluated_depsgraph_get()
    evaluated = original.evaluated_get(depsgraph)
    dimensions = [float(v) for v in evaluated.dimensions]
    original_materials = [slot.material for slot in original.material_slots]
    # Object-level slot overrides in this legacy file differ from mesh slots.
    slot_names = tuple(mat.name if mat else '' for mat in original_materials)
    key = (original.name, slot_names)
    if key not in mesh_cache:
        mesh = bpy.data.meshes.new_from_object(evaluated, preserve_all_data_layers=True, depsgraph=depsgraph)
        mesh.materials.clear()
        for original_material in original_materials:
            mesh.materials.append(material(original_material))
        if not mesh.materials:
            mesh.materials.append(material(None))
        mesh_cache[key] = mesh
    mesh = mesh_cache[key]
    obj = bpy.data.objects.new(f'web_{entity_id}_{source_name}', mesh)
    obj.matrix_world = matrix
    obj['entityId'] = entity_id
    obj['sourceName'] = source_name
    web_scene.collection.objects.link(obj)
    if entity_id not in object_entries:
        parent_source = bpy.data.objects.get(entity_id)
        is_chair = parent_source and parent_source.instance_collection and parent_source.instance_collection.name == 'chair'
        entry = {
            'id': entity_id,
            'name': ('Lounge chair · ' + entity_id) if is_chair else source_name,
            'sourceName': entity_id,
            'type': 'Collection' if is_chair else 'Mesh',
            'materials': list(slot_names),
            'position': list(parent_source.matrix_world.translation) if is_chair else list(matrix.translation),
            'positionWeb': vector_web(parent_source.matrix_world.translation if is_chair else matrix.translation),
            'dimensions': dimensions,
            'category': 'Furniture' if is_chair else ('Landscape' if instance else 'Architecture'),
        }
        object_entries[entity_id] = entry
    else:
        entry = object_entries[entity_id]
        entry['materials'] = list(dict.fromkeys(entry['materials'] + list(slot_names)))

skip = {'lotus_scattering_plane','pebbles_scatter'}
instances = [(inst.object.original, inst.matrix_world.copy(), inst.is_instance, inst.parent.original if inst.parent else None, tuple(inst.persistent_id)) for inst in depsgraph.object_instances]
print('Evaluated instances:',len(instances), flush=True)
for obj, matrix, is_instance, parent, persistent_id in instances:
    if obj.type != 'MESH' or obj.hide_render or obj.name in skip:
        continue
    if is_instance:
        entity_id = parent.name if parent and parent.instance_collection and parent.instance_collection.name == 'chair' else f'{parent.name if parent else obj.name}:{"-".join(str(v) for v in persistent_id[:3])}'
    else:
        entity_id = obj.name
    add_mesh(obj, matrix, entity_id, obj.name, is_instance)

# Export all cameras and sample the actual source movement. Camera nodes retain identity.
for original in sorted((o for o in source.objects if o.type == 'CAMERA'), key=lambda o:o.name):
    camera = bpy.data.objects.new('web_' + original.name, original.data.copy())
    web_scene.collection.objects.link(camera)
    camera['entityId'] = original.name
    camera['sourceName'] = original.name
    camera.rotation_mode = 'QUATERNION'
    samples = []
    animated = original.name == 'Camera.002'
    for frame in (range(1,251) if animated else [1]):
        source.frame_set(frame)
        matrix = original.matrix_world.copy()
        loc, rot, scale = matrix.decompose()
        camera.location, camera.rotation_quaternion, camera.scale = loc, rot, scale
        samples.append({'frame':frame,'position':list(loc),'quaternion':[rot.x,rot.y,rot.z,rot.w]})
        if animated:
            camera.keyframe_insert(data_path='location',frame=frame)
            camera.keyframe_insert(data_path='rotation_quaternion',frame=frame)
    source.frame_set(1)
    camera.matrix_world = original.matrix_world.copy()
    direction = original.matrix_world.to_quaternion() @ Vector((0,0,-1))
    object_entries[original.name] = {
        'id':original.name,'name':original.name,'sourceName':original.name,'type':'Camera','materials':[],
        'position':list(original.matrix_world.translation),
        'positionWeb':vector_web(original.matrix_world.translation),
        'dimensions':[0,0,0],'category':'Camera',
        'lens':original.data.lens,'sensorWidth':original.data.sensor_width,
        'animated':animated, 'forwardWeb':vector_web(direction), 'samples':samples,
    }

bpy.context.window.scene = web_scene
web_scene.frame_set(1)
# World-space bounds include all submeshes belonging to an instance.
entity_bounds = {}
for obj in web_scene.objects:
    if obj.type != 'MESH': continue
    entity_id = obj['entityId']
    points = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    if entity_id not in entity_bounds: entity_bounds[entity_id] = [[float('inf')]*3, [float('-inf')]*3]
    low, high = entity_bounds[entity_id]
    for point in points:
        for axis in range(3): low[axis] = min(low[axis],point[axis]); high[axis] = max(high[axis],point[axis])
for entity_id, (low,high) in entity_bounds.items():
    object_entries[entity_id]['dimensions'] = [high[i]-low[i] for i in range(3)]
metadata = sorted(object_entries.values(),key=lambda o: (o['type']!='Camera',o['category']!='Furniture',o['name']))
manifest = {'name':'Barcelona Pavilion','sourceScene':'1- time: midday','fps':24,'frameStart':1,'frameEnd':374,'animationEnd':250,'activeCameraId':'Camera.002','aspect':1280/720,'objects':metadata,'simplifications':['Shared simplified tree geometry,32 tree placements','65 lotus placements','Textured pool bed replaces individual pebbles','Browser PBR materials approximate legacy Cycles shaders']}
(OUT/'pavilion.json').write_text(json.dumps(manifest,indent=2))
bpy.ops.export_scene.gltf(filepath=str(OUT/'pavilion.glb'),export_format='GLB',use_active_scene=True,export_extras=True,export_cameras=True,export_lights=False,export_animations=True,export_frame_range=True,export_force_sampling=True,export_materials='EXPORT')
print('EXPORTED', len(metadata), 'entities,',len(mesh_cache),'shared meshes,', (OUT/'pavilion.glb').stat().st_size,'bytes',flush=True)
