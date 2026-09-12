"""Run with Blender --background --factory-startup --threads 4 --python this_file.
Offline cloth study only; exports a static glTF mesh, never a runtime simulation.
"""
import argparse
import math
import os
import sys
import bpy
from mathutils.bvhtree import BVHTree

parser = argparse.ArgumentParser()
parser.add_argument('--output', required=True)
parser.add_argument('--frames', type=int, default=60)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
output = os.path.abspath(args.output)
os.makedirs(output, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.frame_end = args.frames
scene.render.fps = 24

# Canonical sample-room double bed: 1.50 m wide, top at 0.45 m.
bpy.ops.mesh.primitive_cube_add(location=(0, -.03, .34875))
mattress = bpy.context.object
mattress.name = 'MattressCollision'
mattress.dimensions = (1.41, 1.86, .2025)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
bevel = mattress.modifiers.new('Rounded mattress edge', 'BEVEL')
bevel.width = .055
bevel.segments = 4
bpy.ops.object.modifier_apply(modifier=bevel.name)
mattress.modifiers.new('Cloth collision', 'COLLISION')
mattress.collision.thickness_outer = .004

def smooth01(value):
    t = max(0, min(1, value))
    return t * t * (3 - 2 * t)

def duvet_height(x, y, along):
    # Runtime rotates the glTF by 180 degrees about Y, including X.
    x = -x
    hem = math.sin(x * 9 + .7) * .009 + math.sin(x * 17) * .003
    side = smooth01((abs(x) - .74 + .085) / .085)
    end = smooth01((.09 - along * 1.209) / .09)
    fold = math.sin(x * 8 + y * 3) * .011 + math.sin(x * 17 - y * 5) * .006
    fold += math.exp(-((x + .17 + y * .22) / .12) ** 2) * .026
    fold += math.exp(-((x - .32 + y * .34) / .09) ** 2) * .019
    roll = math.exp(-((along - .93 - math.sin(x * 4 + 1) * .018) * 20) ** 2) * .036
    return .485 + fold + roll - max(side * (.13 + math.sin(y * 8) * .013), end * (.16 + hem))

# Match the existing white duvet rather than draping through it at runtime.
support_vertices, support_faces = [], []
for j in range(35):
    along = (j / 34) ** 1.5
    for i in range(31):
        across = i / 30 * 2 - 1
        x = math.copysign(1 - (1 - abs(across)) ** 1.5, across) * .74
        hem = math.sin(-x * 9 + .7) * .009 + math.sin(-x * 17) * .003
        y = .935 - along * 1.209 + hem * (1 - along) ** 3
        support_vertices.append((x, y, duvet_height(x, y, along)))
for j in range(34):
    for i in range(30):
        a = j * 31 + i
        support_faces.append((a, a + 31, a + 32, a + 1))
support_mesh = bpy.data.meshes.new('WhiteDuvetCollisionMesh')
support_mesh.from_pydata(support_vertices, [], support_faces)
support = bpy.data.objects.new('WhiteDuvetCollision', support_mesh)
scene.collection.objects.link(support)
support.modifiers.new('Duvet collision', 'COLLISION')
support.collision.thickness_outer = .006

bpy.ops.mesh.primitive_cube_add(location=(0, .05, .19125))
frame = bpy.context.object
frame.name = 'BedFrameCollision'
frame.dimensions = (1.40, 1.85, .1125)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
frame.modifiers.new('Frame collision', 'COLLISION')
frame.collision.thickness_outer = .006

# Rest lengths include small excess fabric; nonuniform initial folds break symmetry.
nx, ny = 64, 48
vertices, faces = [], []
for j in range(ny + 1):
    v = j / ny
    y = .08 + v * 1.12
    for i in range(nx + 1):
        u = i / nx
        x = (u - .5) * 1.72
        lift = min(1, v * 8)
        base = duvet_height(x, y, max(0, min(1, (.935 - y) / 1.209))) + .012
        z = base + lift * (.04 + .008 * math.sin(u * 25 + v * 2) + .004 * math.sin(v * 21 - u * 3))
        vertices.append((x, y, z))
for j in range(ny):
    for i in range(nx):
        a = j * (nx + 1) + i
        faces.append((a, a + 1, a + nx + 2, a + nx + 1))
mesh = bpy.data.meshes.new('WovenThrowGrid')
mesh.from_pydata(vertices, [], faces)
mesh.update()
cloth = bpy.data.objects.new('DrapedWovenThrow', mesh)
scene.collection.objects.link(cloth)
uv = mesh.uv_layers.new(name='UVMap')
for polygon in mesh.polygons:
    for loop in polygon.loop_indices:
        vertex = mesh.vertices[mesh.loops[loop].vertex_index].co
        uv.data[loop].uv = (vertex.x + 1.01, vertex.y + .18)
bpy.context.view_layer.objects.active = cloth
cloth.select_set(True)
mattress.select_set(False)
modifier = cloth.modifiers.new('Offline cloth settling', 'CLOTH')
modifier.settings.quality = 8
modifier.settings.mass = .25
modifier.settings.tension_stiffness = 40
modifier.settings.compression_stiffness = 40
modifier.settings.shear_stiffness = 20
modifier.settings.bending_stiffness = .35
modifier.settings.air_damping = 3
anchor = cloth.vertex_groups.new(name='Fold held on mattress')
anchor.add([i for i in range(nx + 1) if abs(vertices[i][0]) < .60], 1.0, 'REPLACE')
modifier.settings.vertex_group_mass = anchor.name
modifier.collision_settings.use_collision = True
modifier.collision_settings.distance_min = .004
modifier.collision_settings.use_self_collision = True
modifier.collision_settings.self_distance_min = .006
modifier.point_cache.frame_end = args.frames
for frame in range(1, args.frames + 1):
    scene.frame_set(frame)
    bpy.context.view_layer.update()
    # Force evaluation in background mode at every step.
    cloth.evaluated_get(bpy.context.evaluated_depsgraph_get())
    if frame % 10 == 0:
        print(f'Cloth frame {frame}/{args.frames}', flush=True)

evaluated = cloth.evaluated_get(bpy.context.evaluated_depsgraph_get())
static_mesh = bpy.data.meshes.new_from_object(evaluated)
asset = bpy.data.objects.new('DrapedThrowStatic', static_mesh)
scene.collection.objects.link(asset)
bpy.ops.object.select_all(action='DESELECT')
asset.select_set(True)
bpy.context.view_layer.objects.active = asset
smooth = asset.modifiers.new('Relax simulation pinches', 'SMOOTH')
smooth.factor = .35
smooth.iterations = 4
bpy.ops.object.modifier_apply(modifier=smooth.name)
decimate = asset.modifiers.new('Web geometry budget', 'DECIMATE')
decimate.ratio = .42
bpy.ops.object.modifier_apply(modifier=decimate.name)
smooth = asset.modifiers.new('Relax reduced edges', 'SMOOTH')
smooth.factor = .2
smooth.iterations = 2
bpy.ops.object.modifier_apply(modifier=smooth.name)
support_tree = BVHTree.FromPolygons(support_vertices, support_faces)
# Reduction/smoothing may move a few top vertices through the support. Restore
# local contact clearance, not an arbitrary lift of the whole cloth asset.
for vertex in asset.data.vertices:
    if vertex.co.z < .33:
        continue
    hit, normal, face_index, distance = support_tree.ray_cast((vertex.co.x, vertex.co.y, 2), (0, 0, -1), 3)
    if hit is not None:
        vertex.co.z = max(vertex.co.z, hit.z + .012)
solidify = asset.modifiers.new('Thin woven thickness', 'SOLIDIFY')
solidify.thickness = .004
solidify.offset = 0
bpy.ops.object.modifier_apply(modifier=solidify.name)
for polygon in asset.data.polygons:
    polygon.use_smooth = True
material = bpy.data.materials.new('Sage woven throw')
material.diffuse_color = (.24, .30, .18, 1)
material.use_nodes = True
shader = material.node_tree.nodes.get('Principled BSDF')
shader.inputs['Base Color'].default_value = material.diffuse_color
shader.inputs['Roughness'].default_value = .9
asset.data.materials.append(material)
asset.data.calc_loop_triangles()
print(f'Static asset: {len(asset.data.vertices)} vertices / {len(asset.data.loop_triangles)} triangles', flush=True)
bpy.ops.export_scene.gltf(filepath=os.path.join(output, 'draped-throw.glb'), export_format='GLB', use_selection=True)
bpy.context.preferences.filepaths.save_version = 0
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(output, 'draped-throw-source.blend'))
