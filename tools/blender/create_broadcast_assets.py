import bpy, math, os
from mathutils import Vector

ROOT = "/Users/cream/Documents/API/chzzk-kuji"
OUT = os.path.join(ROOT, "artifacts", "blender")
os.makedirs(OUT, exist_ok=True)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for collection in list(bpy.data.collections): bpy.data.collections.remove(collection)
for block in bpy.data.materials: bpy.data.materials.remove(block)

def mat(name, color, metallic=0.0, roughness=0.42, alpha=1.0, emission=None):
    m=bpy.data.materials.new(name); m.diffuse_color=(*color,alpha); m.use_nodes=True
    bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Metallic'].default_value=metallic; bs.inputs['Roughness'].default_value=roughness
    if alpha<1:
        bs.inputs['Alpha'].default_value=alpha; m.surface_render_method='DITHERED'
        if 'Transmission Weight' in bs.inputs: bs.inputs['Transmission Weight'].default_value=.35
    if emission: bs.inputs['Emission Color'].default_value=(*emission,1); bs.inputs['Emission Strength'].default_value=3
    return m

M={
 'dark':mat('M_Dark',(0.025,0.04,0.045),.55,.28), 'panel':mat('M_Panel',(0.07,.10,.11),.25,.36),
 'green':mat('M_CHZZK_Green',(0,.98,.55),.1,.25,emission=(0,.5,.25)), 'yellow':mat('M_Prize_Gold',(1,.58,.05),.5,.22),
 'coral':mat('M_Coral',(1,.16,.24),.12,.3), 'white':mat('M_White',(.82,.9,.87),.05,.32),
 'glass':mat('M_Glass',(.03,.22,.15),.1,.12,.1), 'metal':mat('M_Metal',(.3,.38,.39),.9,.18)
}

def cube(name, loc, scale, material, bevel=.08, collection=None):
    bpy.ops.mesh.primitive_cube_add(location=loc); o=bpy.context.object; o.name=name; o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if bevel: mod=o.modifiers.new('Bevel','BEVEL'); mod.width=bevel; mod.segments=3
    o.data.materials.append(material)
    if collection: [c.objects.unlink(o) for c in list(o.users_collection)]; collection.objects.link(o)
    return o

def cyl(name, loc, radius, depth, material, rot=(0,0,0), verts=48, collection=None):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc, rotation=rot)
    o=bpy.context.object; o.name=name; o.data.materials.append(material)
    mod=o.modifiers.new('Bevel','BEVEL'); mod.width=.045; mod.segments=2
    if collection: [c.objects.unlink(o) for c in list(o.users_collection)]; collection.objects.link(o)
    return o

def uv_sphere(name,loc,scale,material,collection):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, location=loc); o=bpy.context.object; o.name=name; o.scale=scale
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True); o.data.materials.append(material)
    [c.objects.unlink(o) for c in list(o.users_collection)]; collection.objects.link(o); return o

kuji=bpy.data.collections.new('COL_KujiMachine'); bpy.context.scene.collection.children.link(kuji)
roulette=bpy.data.collections.new('COL_Roulette'); bpy.context.scene.collection.children.link(roulette)

# Kuji machine: substantial base, illuminated fascia, transparent capsule chamber.
cube('KUJI_Base',(0,0,-1.75),(2.35,1.45,.42),M['dark'],.16,kuji)
cube('KUJI_Body',(0,.2,-.15),(2.15,1.25,1.35),M['panel'],.18,kuji)
cube('KUJI_Header',(0,-.02,1.55),(2.28,1.33,.38),M['dark'],.16,kuji)
cube('KUJI_Lightbar',(0,-1.37,1.55),(1.55,.08,.16),M['green'],.07,kuji)
cube('KUJI_PrizeDoor',(0,-1.40,-.52),(.92,.08,.48),M['dark'],.08,kuji)
cube('KUJI_PrizeGlow',(0,-1.49,-.52),(.68,.035,.27),M['yellow'],.05,kuji)
cyl('KUJI_Drum',(0,-1.1,.35),1.05,3.0,M['glass'],rot=(0,math.pi/2,0),verts=64,collection=kuji)
cyl('KUJI_DrumRim_L',(-1.55,-1.1,.35),1.12,.16,M['metal'],rot=(0,math.pi/2,0),collection=kuji)
cyl('KUJI_DrumRim_R',(1.55,-1.1,.35),1.12,.16,M['metal'],rot=(0,math.pi/2,0),collection=kuji)
for i in range(16):
    a=i*2.399; r=.62+(i%3)*.1; x=-.9+(i%7)*.3
    y=-1.45+math.cos(a)*r; z=.34+math.sin(a)*r
    cap=uv_sphere(f'KUJI_Capsule_{i+1:02d}',(x,y,z),(.18,.18,.18),[M['green'],M['yellow'],M['coral'],M['white']][i%4],kuji)
    cap.rotation_euler=(a*.2,a*.3,a)
cyl('KUJI_HandleHub',(1.78,-1.37,.38),.23,.18,M['yellow'],rot=(math.pi/2,0,0),collection=kuji)
handle=cube('KUJI_Handle',(1.78,-1.58,.38),(.1,.12,.62),M['metal'],.06,kuji); handle.rotation_euler.y=.55
cyl('KUJI_HandleGrip',(2.1,-1.62,.9),.14,.38,M['coral'],rot=(math.pi/2,0,0),collection=kuji)

# Roulette: real wedge geometry, rim, pointer, axle, and broadcast-ready stand.
wheel=bpy.data.objects.new('RLT_WheelRoot',None); roulette.objects.link(wheel)
segments=12; radius=2.55; depth=.32
for i in range(segments):
    a0=2*math.pi*i/segments; a1=2*math.pi*(i+1)/segments
    verts=[(0,0,-depth/2),(radius*math.cos(a0),radius*math.sin(a0),-depth/2),(radius*math.cos(a1),radius*math.sin(a1),-depth/2),(0,0,depth/2),(radius*math.cos(a0),radius*math.sin(a0),depth/2),(radius*math.cos(a1),radius*math.sin(a1),depth/2)]
    faces=[(0,2,1),(3,4,5),(0,1,4),(0,4,3),(1,2,5),(1,5,4),(2,0,3),(2,3,5)]
    mesh=bpy.data.meshes.new(f'RLT_WedgeMesh_{i:02d}'); mesh.from_pydata(verts,[],faces); mesh.update()
    o=bpy.data.objects.new(f'RLT_Wedge_{i+1:02d}',mesh); roulette.objects.link(o); o.data.materials.append([M['green'],M['panel'],M['coral'],M['yellow']][i%4]); o.parent=wheel
bpy.ops.mesh.primitive_torus_add(major_radius=2.57,minor_radius=.14,major_segments=64,minor_segments=10,location=(0,0,0)); rim=bpy.context.object; rim.name='RLT_OuterRim'; rim.data.materials.append(M['metal']); [c.objects.unlink(rim) for c in list(rim.users_collection)]; roulette.objects.link(rim); rim.parent=wheel
cyl('RLT_Hub',(0,0,.28),.48,.64,M['yellow'],rot=(0,0,0),collection=roulette).parent=wheel
cube('RLT_Stand',(0,0,-3.25),(1.45,.78,.32),M['dark'],.14,roulette)
cube('RLT_Post',(0,.38,-2.2),(.25,.35,1.25),M['metal'],.09,roulette)
# Pointer points down at the top segment.
bpy.ops.mesh.primitive_cone_add(vertices=4,radius1=.42,radius2=.08,depth=.9,location=(0,0,3.05),rotation=(math.pi,0,0)); pointer=bpy.context.object;pointer.name='RLT_Pointer';pointer.data.materials.append(M['coral']);[c.objects.unlink(pointer) for c in list(pointer.users_collection)];roulette.objects.link(pointer)
for frame,rotation in [(1,0),(55,-math.pi*5.3),(90,-math.pi*6)]: wheel.rotation_euler.z=rotation; wheel.keyframe_insert('rotation_euler',index=2,frame=frame)
# Blender 5.x stores action curves in layered slots; default interpolation is
# already Bezier, so no legacy fcurve mutation is required here.

# Studio camera and lighting.
bpy.ops.object.camera_add(location=(7,-10,5.8)); cam=bpy.context.object; cam.name='CAM_Preview'; bpy.context.scene.camera=cam
def track(obj,point): obj.rotation_euler=(Vector(point)-obj.location).to_track_quat('-Z','Y').to_euler()
track(cam,(0,0,0)); cam.data.lens=52
bpy.ops.object.light_add(type='AREA',location=(4,-5,7)); bpy.context.object.data.energy=1050; bpy.context.object.data.shape='DISK'; bpy.context.object.data.size=5; track(bpy.context.object,(0,0,0))
bpy.ops.object.light_add(type='AREA',location=(-5,-2,3)); bpy.context.object.data.energy=800; bpy.context.object.data.color=(0,.95,.5); bpy.context.object.data.size=4; track(bpy.context.object,(0,0,0))
bpy.ops.object.light_add(type='AREA',location=(2,4,5)); bpy.context.object.data.energy=900; bpy.context.object.data.color=(1,.32,.12); bpy.context.object.data.size=3; track(bpy.context.object,(0,0,0))
world=bpy.context.scene.world or bpy.data.worlds.new('World'); bpy.context.scene.world=world; world.color=(.006,.009,.01)
scene=bpy.context.scene; scene.render.engine='BLENDER_EEVEE'; scene.render.resolution_x=960; scene.render.resolution_y=720; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'; scene.render.film_transparent=False
scene.view_settings.look='AgX - Medium High Contrast'

def render_collection(show,hide,path,cam_loc,target):
    show.hide_render=False; hide.hide_render=True; cam.location=cam_loc; track(cam,target); scene.render.filepath=path; bpy.ops.render.render(write_still=True)

render_collection(kuji,roulette,os.path.join(OUT,'kuji_blender_preview.png'),(7,-11,5.6),(0,0,-.1))
render_collection(roulette,kuji,os.path.join(OUT,'roulette_blender_preview.png'),(8,-13.5,5.8),(0,0,0))
kuji.hide_render=False; roulette.hide_render=False
for obj in bpy.context.scene.objects:
    if obj.type=='MESH': obj.select_set(True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'broadcast_lottery_assets.blend'))
bpy.ops.ed.undo_push(message='Create broadcast lottery assets')
_result={'ok':True,'objects':len(bpy.context.scene.objects),'blend':os.path.join(OUT,'broadcast_lottery_assets.blend'),'previews':[os.path.join(OUT,'kuji_blender_preview.png'),os.path.join(OUT,'roulette_blender_preview.png')]}
