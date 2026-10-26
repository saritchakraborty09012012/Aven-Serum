import bpy
import bmesh
import math
import os
from mathutils import Vector

ROOT = r"D:\SARIT\NOVEXA- NoirDemons\serum website by deep seek"
MODEL_DIR = os.path.join(ROOT, "public", "models")
RENDER_DIR = os.path.join(ROOT, "public", "renders")
BLEND_DIR = os.path.join(ROOT, "assets", "blender")
os.makedirs(MODEL_DIR, exist_ok=True)
os.makedirs(RENDER_DIR, exist_ok=True)
os.makedirs(BLEND_DIR, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 96
scene.cycles.use_denoising = True
scene.cycles.max_bounces = 24
scene.cycles.diffuse_bounces = 4
scene.cycles.glossy_bounces = 10
scene.cycles.transmission_bounces = 16
scene.cycles.transparent_max_bounces = 8
scene.render.resolution_x = 1000
scene.render.resolution_y = 1250
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.film_transparent = False
scene.view_settings.view_transform = "AgX"
scene.view_settings.look = "AgX - Medium High Contrast"


def set_input(node, names, value):
    for name in names:
        if name in node.inputs:
            node.inputs[name].default_value = value
            return True
    return False


def principled_material(name, color, roughness, transmission=0.0, ior=1.45, metallic=0.0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.use_backface_culling = False
    nodes = material.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    set_input(bsdf, ["Base Color"], (*color, 1.0))
    set_input(bsdf, ["Roughness"], roughness)
    set_input(bsdf, ["Metallic"], metallic)
    set_input(bsdf, ["IOR"], ior)
    set_input(bsdf, ["Transmission Weight", "Transmission"], transmission)
    set_input(bsdf, ["Alpha"], 1.0)
    if transmission > 0:
        set_input(bsdf, ["Coat Weight"], 0.12)
        set_input(bsdf, ["Coat Roughness"], 0.08)
    material.diffuse_color = (*color, 1.0)
    return material


glass_mat = principled_material("Glass_Amber", (0.26, 0.073, 0.016), 0.035, transmission=1.0, ior=1.515)
serum_mat = principled_material("Serum_Liquid", (0.52, 0.115, 0.006), 0.055, transmission=0.72, ior=1.36)
cap_mat = principled_material("Cap_Cream", (0.80, 0.63, 0.53), 0.38, transmission=0.0, ior=1.46)
bulb_mat = principled_material("Bulb_Cream", (0.83, 0.67, 0.53), 0.46, transmission=0.0, ior=1.44)
pipette_mat = principled_material("Pipette_Glass_Amber", (0.45, 0.19, 0.056), 0.075, transmission=0.94, ior=1.46)
detail_mat = principled_material("Cap_Detail", (0.72, 0.55, 0.45), 0.4, transmission=0.0, ior=1.46)


def make_lathe(name, profile, material, segments=96):
    vertices = []
    faces = []
    count = len(profile)
    for segment in range(segments):
        angle = (2.0 * math.pi * segment) / segments
        cos_a = math.cos(angle)
        sin_a = math.sin(angle)
        for radius, height in profile:
            vertices.append((radius * cos_a, radius * sin_a, height))
    for segment in range(segments):
        next_segment = (segment + 1) % segments
        for index in range(count - 1):
            a = segment * count + index
            b = segment * count + index + 1
            c = next_segment * count + index + 1
            d = next_segment * count + index
            faces.append((a, b, c, d))
    mesh = bpy.data.meshes.new(name + "_Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    return obj


# Outer glass wall and inner cavity in one continuous cross-section.
glass_profile = [
    (0.0000, 0.000),
    (0.2900, 0.000),
    (0.3150, 0.005),
    (0.3200, 0.020),
    (0.3200, 0.585),
    (0.3170, 0.625),
    (0.3070, 0.665),
    (0.2870, 0.702),
    (0.2570, 0.735),
    (0.2210, 0.760),
    (0.1830, 0.779),
    (0.1540, 0.792),
    (0.1430, 0.804),
    (0.1420, 0.855),
    (0.1460, 0.869),
    (0.1600, 0.873),
    (0.1620, 0.881),
    (0.1560, 0.891),
    (0.1410, 0.893),
    (0.1360, 0.889),
    (0.1280, 0.877),
    (0.1260, 0.855),
    (0.1260, 0.812),
    (0.1340, 0.798),
    (0.1630, 0.785),
    (0.2010, 0.764),
    (0.2400, 0.735),
    (0.2720, 0.697),
    (0.2940, 0.650),
    (0.2980, 0.600),
    (0.2980, 0.085),
    (0.2950, 0.065),
    (0.2800, 0.054),
    (0.2500, 0.049),
    (0.0000, 0.049),
]
bottle = make_lathe("Bottle_Glass", glass_profile, glass_mat)
bottle["is_product"] = True

serum_profile = [
    (0.0000, 0.050),
    (0.2500, 0.050),
    (0.2820, 0.055),
    (0.2890, 0.070),
    (0.2890, 0.505),
    (0.2870, 0.528),
    (0.2780, 0.543),
    (0.2450, 0.552),
    (0.1500, 0.558),
    (0.0500, 0.561),
    (0.0000, 0.562),
]
serum = make_lathe("Serum_Liquid", serum_profile, serum_mat)
serum["is_product"] = True

cap_profile = [
    (0.0000, 0.854),
    (0.1550, 0.854),
    (0.1680, 0.861),
    (0.1720, 0.874),
    (0.1730, 0.895),
    (0.1730, 1.020),
    (0.1710, 1.034),
    (0.1640, 1.043),
    (0.1460, 1.047),
    (0.0000, 1.048),
]
cap = make_lathe("Cap_Collar", cap_profile, cap_mat)
cap["is_product"] = True

bulb_profile = [
    (0.0000, 1.042),
    (0.0700, 1.044),
    (0.0900, 1.052),
    (0.1070, 1.075),
    (0.1180, 1.108),
    (0.1230, 1.150),
    (0.1210, 1.198),
    (0.1130, 1.246),
    (0.0980, 1.292),
    (0.0760, 1.334),
    (0.0490, 1.366),
    (0.0250, 1.384),
    (0.0000, 1.390),
]
bulb = make_lathe("Dropper_Bulb", bulb_profile, bulb_mat)
bulb["is_product"] = True

pipette_profile = [
    (0.0000, 0.085),
    (0.0050, 0.085),
    (0.0090, 0.105),
    (0.0110, 0.135),
    (0.0110, 0.930),
    (0.0160, 0.950),
    (0.0170, 1.024),
    (0.0000, 1.024),
]
pipette = make_lathe("Pipette_Glass", pipette_profile, pipette_mat)
pipette["is_product"] = True

# A fine seam around the collar, like a moulded cap detail.
bpy.ops.mesh.primitive_torus_add(
    align="WORLD",
    major_segments=96,
    minor_segments=10,
    location=(0, 0, 0.912),
    major_radius=0.1725,
    minor_radius=0.0028,
)
seam = bpy.context.object
seam.name = "Cap_Seam"
seam.data.materials.append(detail_mat)
for polygon in seam.data.polygons:
    polygon.use_smooth = True
seam["is_product"] = True

# A second, subtler ring just below the cap's rounded top.
bpy.ops.mesh.primitive_torus_add(
    align="WORLD",
    major_segments=96,
    minor_segments=10,
    location=(0, 0, 1.031),
    major_radius=0.1690,
    minor_radius=0.0022,
)
top_ring = bpy.context.object
top_ring.name = "Cap_Top_Seam"
top_ring.data.materials.append(detail_mat)
for polygon in top_ring.data.polygons:
    polygon.use_smooth = True
top_ring["is_product"] = True

# Apply object transforms so the GLB has clean origins and scale.
for obj in [bottle, serum, cap, bulb, pipette, seam, top_ring]:
    obj.select_set(False)
    obj.location = (0, 0, 0)
    obj.rotation_euler = (0, 0, 0)
    obj.scale = (1, 1, 1)

# Export only the product objects.
bpy.ops.object.select_all(action="DESELECT")
for obj in [bottle, serum, cap, bulb, pipette, seam, top_ring]:
    obj.select_set(True)
bpy.context.view_layer.objects.active = bottle
bpy.ops.export_scene.gltf(
    filepath=os.path.join(MODEL_DIR, "ambar-bottle.glb"),
    export_format="GLB",
    use_selection=True,
    export_apply=True,
    export_yup=True,
    export_materials="EXPORT",
    export_cameras=False,
    export_lights=False,
)
print("GLB exported")

# ---------------------------------------------------------------------------
# Poster render scene
# ---------------------------------------------------------------------------
backdrop_mat = principled_material("Backdrop_Warm", (0.71, 0.46, 0.32), 0.62)
floor_mat = principled_material("Floor_Cream", (0.79, 0.61, 0.48), 0.52)
plinth_mat = principled_material("Plinth_Cream", (0.88, 0.71, 0.57), 0.44)
pool_mat = principled_material("Pool_Amber", (0.62, 0.17, 0.018), 0.08, transmission=0.5, ior=1.36)


def add_plane(name, size, location, rotation, material):
    bpy.ops.mesh.primitive_plane_add(size=size, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    return obj


add_plane("Backdrop", 20, (0, 2.7, 3.2), (math.radians(90), 0, 0), backdrop_mat)
add_plane("Floor", 20, (0, 0, -0.001), (0, 0, 0), floor_mat)

bpy.ops.mesh.primitive_cylinder_add(vertices=128, radius=0.74, depth=0.07, location=(0, 0, -0.036))
plinth = bpy.context.object
plinth.name = "Poster_Plinth"
plinth.data.materials.append(plinth_mat)
for polygon in plinth.data.polygons:
    polygon.use_smooth = True

bpy.ops.mesh.primitive_cylinder_add(vertices=128, radius=0.55, depth=0.004, location=(0, 0, 0.002))
pool = bpy.context.object
pool.name = "Poster_Pool"
pool.data.materials.append(pool_mat)
for polygon in pool.data.polygons:
    polygon.use_smooth = True

world = bpy.data.worlds.new("Warm Studio")
world.use_nodes = True
world_bg = world.node_tree.nodes.get("Background")
world_bg.inputs["Color"].default_value = (0.16, 0.075, 0.035, 1)
world_bg.inputs["Strength"].default_value = 0.55
scene.world = world


def add_area(name, location, energy, color, size):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.color = color
    data.shape = "DISK"
    data.size = size
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    direction = Vector((0, 0, 0.72)) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    return obj


add_area("Key_Softbox", (-3.2, -3.4, 4.1), 620, (1.0, 0.78, 0.58), 3.8)
add_area("Rim_Amber", (2.6, 1.4, 2.8), 380, (1.0, 0.31, 0.07), 2.4)
add_area("Fill_Warm", (2.2, -3.8, 1.2), 160, (1.0, 0.83, 0.68), 3.0)

camera_data = bpy.data.cameras.new("Poster_Camera")
camera = bpy.data.objects.new("Poster_Camera", camera_data)
bpy.context.collection.objects.link(camera)
camera.location = (2.25, -5.35, 2.05)
camera_data.lens = 85
camera_data.sensor_width = 36
look_at = Vector((0, 0, 0.70)) - camera.location
camera.rotation_euler = look_at.to_track_quat("-Z", "Y").to_euler()
scene.camera = camera

scene.render.filepath = os.path.join(RENDER_DIR, "ambar-bottle-poster.png")
scene.render.image_settings.color_mode = "RGB"
scene.render.image_settings.compression = 15
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BLEND_DIR, "ambar-bottle.blend"))
bpy.ops.render.render(write_still=True)
print("Poster rendered")
