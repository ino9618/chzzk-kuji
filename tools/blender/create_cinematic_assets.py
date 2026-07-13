import bpy, math, os
from mathutils import Vector

ROOT='/Users/cream/Documents/API/chzzk-kuji'; OUT=os.path.join(ROOT,'artifacts','blender'); WEB=os.path.join(ROOT,'src','client','assets','models')
os.makedirs(OUT,exist_ok=True); os.makedirs(WEB,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
for c in list(bpy.data.collections): bpy.data.collections.remove(c)
for m in list(bpy.data.materials): bpy.data.materials.remove(m)

def material(name,color,metal=0,rough=.32,emission=None):
 m=bpy.data.materials.new(name);m.use_nodes=True;b=m.node_tree.nodes['Principled BSDF'];b.inputs['Base Color'].default_value=(*color,1);b.inputs['Metallic'].default_value=metal;b.inputs['Roughness'].default_value=rough
 if emission:b.inputs['Emission Color'].default_value=(*emission,1);b.inputs['Emission Strength'].default_value=4
 return m
M={'ink':material('M_Ink',(0.025,.035,.045),.55,.22),'paper':material('M_PremiumPaper',(.86,.9,.95),.08,.28),'foil':material('M_GoldFoil',(1,.48,.04),.9,.15, (1,.18,.01)),'pink':material('M_AnimePink',(1,.12,.32),.25,.22),'green':material('M_CHZZK',(0,1,.56),.2,.2,(0,.6,.25)),'cyan':material('M_Cyan',(0,.68,1),.4,.18),'skin':material('M_Skin',(.93,.55,.43),.05,.42),'metal':material('M_Metal',(.22,.29,.31),.95,.13),'white':material('M_White',(.9,.94,.98),.1,.2)}

def relink(o,col):
 for c in list(o.users_collection):c.objects.unlink(o)
 col.objects.link(o);return o
def cube(name,loc,scale,mat,col,bevel=.06):
 bpy.ops.mesh.primitive_cube_add(location=loc);o=bpy.context.object;o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat);relink(o,col)
 if bevel:md=o.modifiers.new('Bevel','BEVEL');md.width=bevel;md.segments=3
 return o
def sphere(name,loc,scale,mat,col):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=10,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat);return relink(o,col)
def cyl(name,loc,radius,depth,mat,col,rot=(math.pi/2,0,0),verts=48):
 bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=radius,depth=depth,location=loc,rotation=rot);o=bpy.context.object;o.name=name;o.data.materials.append(mat);relink(o,col);md=o.modifiers.new('Bevel','BEVEL');md.width=.035;md.segments=2;return o
def key(obj,frame,loc=None,rot=None,scale=None):
 if loc is not None:obj.location=loc;obj.keyframe_insert('location',frame=frame)
 if rot is not None:obj.rotation_euler=rot;obj.keyframe_insert('rotation_euler',frame=frame)
 if scale is not None:obj.scale=scale;obj.keyframe_insert('scale',frame=frame)

# Ticket opening scene: two stylized hands tear a sealed premium pack, then the foil card advances.
ticket=bpy.data.collections.new('COL_TicketReveal');bpy.context.scene.collection.children.link(ticket)
pack_root=bpy.data.objects.new('TKT_PackRoot',None);ticket.objects.link(pack_root)
left=cube('TKT_PackLeft',(-1.15,0,0),(1.15,.12,1.65),M['ink'],ticket,.09);right=cube('TKT_PackRight',(1.15,0,0),(1.15,.12,1.65),M['ink'],ticket,.09)
left.parent=pack_root;right.parent=pack_root
for x in (-1.7,-.6,.6,1.7):cube('TKT_FoilStripe',(x,-.14,0),(.07,.025,1.45),M['foil'],ticket,.015).parent=pack_root
seal=cube('TKT_Seal',(0,-.2,0),(1.25,.04,.38),M['pink'],ticket,.06);seal.parent=pack_root
card=cube('TKT_PrizeCard',(0,.12,0),(1.18,.075,1.52),M['foil'],ticket,.1)
inner=cube('TKT_CardInset',(0,.02,0),(.88,.035,1.18),M['paper'],ticket,.08);inner.parent=card
badge=cyl('TKT_RankMedallion',(0,-.06,.2),.42,.08,M['pink'],ticket);badge.parent=card
# Graphic rays as premium foil accents.
for i in range(8):
 ray=cube(f'TKT_Ray_{i}',(0,-.11,0),(.035,.02,.9),M['cyan'] if i%2 else M['green'],ticket,.01);ray.rotation_euler.y=i*math.pi/4;ray.parent=card
# Stylized hands built from palm and rounded fingers, parented for tearing.
for side in (-1,1):
 root=bpy.data.objects.new('TKT_Hand_L' if side<0 else 'TKT_Hand_R',None);ticket.objects.link(root)
 palm=sphere('TKT_Palm',(side*2.55,.5,-.25),(.62,.24,.82),M['skin'],ticket);palm.parent=root
 for i in range(4):
  finger=cyl(f'TKT_Finger_{side}_{i}',(side*(2.05+i*.08),.38,.65-i*.28),.13,.78,M['skin'],ticket,rot=(0,0,math.pi/2));finger.parent=root
 thumb=cyl(f'TKT_Thumb_{side}',(side*1.85,.32,-.28),.16,.72,M['skin'],ticket,rot=(0,0,math.pi/2));thumb.rotation_euler.z=side*.5;thumb.parent=root
 key(root,1,loc=(0,0,0),rot=(0,0,0));key(root,38,loc=(side*.15,0,0),rot=(0,side*.08,side*.08))
key(left,1,loc=(-1.15,0,0),rot=(0,0,0));key(left,36,loc=(-1.15,0,0),rot=(0,0,0));key(left,62,loc=(-2.5,.15,.15),rot=(0,-.35,.22))
key(right,1,loc=(1.15,0,0),rot=(0,0,0));key(right,36,loc=(1.15,0,0),rot=(0,0,0));key(right,62,loc=(2.5,.15,.15),rot=(0,.35,-.22))
key(seal,1,scale=(1,1,1));key(seal,35,scale=(1,1,1));key(seal,48,scale=(.05,.05,.05))
key(card,1,loc=(0,.12,0),scale=(.78,.78,.78));key(card,48,loc=(0,.12,0),scale=(.78,.78,.78));key(card,80,loc=(0,-.8,.1),scale=(1.15,1.15,1.15))

# Upright premium roulette with a dart impact and decelerating wheel.
roulette=bpy.data.collections.new('COL_CinematicRoulette');bpy.context.scene.collection.children.link(roulette)
wheel=bpy.data.objects.new('RLT_WheelRoot',None);roulette.objects.link(wheel);segments=12;radius=2.7;depth=.34
for i in range(segments):
 a0=2*math.pi*i/segments;a1=2*math.pi*(i+1)/segments;verts=[(0,-depth/2,0),(radius*math.cos(a0),-depth/2,radius*math.sin(a0)),(radius*math.cos(a1),-depth/2,radius*math.sin(a1)),(0,depth/2,0),(radius*math.cos(a0),depth/2,radius*math.sin(a0)),(radius*math.cos(a1),depth/2,radius*math.sin(a1))];faces=[(0,1,2),(3,5,4),(0,3,4),(0,4,1),(1,4,5),(1,5,2),(2,5,3),(2,3,0)]
 mesh=bpy.data.meshes.new(f'RLT_WedgeMesh_{i}');mesh.from_pydata(verts,[],faces);mesh.update();o=bpy.data.objects.new(f'RLT_Wedge_{i+1:02d}',mesh);roulette.objects.link(o);o.data.materials.append([M['green'],M['ink'],M['pink'],M['foil']][i%4]);o.parent=wheel
bpy.ops.mesh.primitive_torus_add(major_radius=2.72,minor_radius=.17,major_segments=64,minor_segments=10,rotation=(math.pi/2,0,0));rim=relink(bpy.context.object,roulette);rim.name='RLT_OuterRim';rim.data.materials.append(M['metal']);rim.parent=wheel
hub=cyl('RLT_Hub',(0,-.35,0),.5,.72,M['foil'],roulette);hub.parent=wheel
cube('RLT_Base',(0,.1,-3.55),(1.5,.8,.3),M['ink'],roulette,.15);cube('RLT_Post',(0,.35,-2.6),(.25,.35,1.25),M['metal'],roulette,.08)
pointer=cube('RLT_TopPointer',(0,-.05,3.25),(.18,.25,.48),M['pink'],roulette,.08);pointer.rotation_euler.x=.78
dart_root=bpy.data.objects.new('RLT_DartRoot',None);roulette.objects.link(dart_root)
shaft=cyl('RLT_DartShaft',(0,0,0),.08,1.45,M['metal'],roulette,rot=(0,0,math.pi/2));shaft.parent=dart_root
tip=cyl('RLT_DartTip',(-.9,0,0),.13,.5,M['foil'],roulette,rot=(0,0,math.pi/2),verts=16);tip.parent=dart_root
for z in (-.16,.16):fin=cube('RLT_DartFin',(.78,0,z),(.28,.04,.11),M['pink'],roulette,.02);fin.parent=dart_root
key(wheel,1,rot=(0,0,0));key(wheel,50,rot=(0,-math.pi*9,0));key(wheel,78,rot=(0,-math.pi*10.25,0))
key(dart_root,1,loc=(5,-3,3.5),rot=(0,-.35,-.35));key(dart_root,54,loc=(5,-3,3.5),rot=(0,-.35,-.35));key(dart_root,68,loc=(1.75,-.55,1.65),rot=(0,-.18,-.72));key(dart_root,90,loc=(1.75,-.55,1.65),rot=(0,-.18,-.72))

# Studio preview setup.
bpy.ops.object.camera_add(location=(7,-12,5));cam=bpy.context.object;bpy.context.scene.camera=cam;cam.data.lens=55
def track(o,p):o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()
track(cam,(0,0,0));bpy.ops.object.light_add(type='AREA',location=(4,-6,7));bpy.context.object.data.energy=1200;bpy.context.object.data.size=5;track(bpy.context.object,(0,0,0));bpy.ops.object.light_add(type='AREA',location=(-5,-2,3));bpy.context.object.data.energy=850;bpy.context.object.data.color=(0,1,.55);bpy.context.object.data.size=4;track(bpy.context.object,(0,0,0))
scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=960;scene.render.resolution_y=720;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.world.color=(.004,.006,.009);scene.view_settings.look='AgX - Medium High Contrast';scene.render.fps=24
def preview(show,hide,frame,path,camloc,target):show.hide_render=False;hide.hide_render=True;scene.frame_set(frame);cam.location=camloc;track(cam,target);scene.render.filepath=path;bpy.ops.render.render(write_still=True)
preview(ticket,roulette,80,os.path.join(OUT,'ticket_cinematic_preview.png'),(7,-12,4.5),(0,0,0))
preview(roulette,ticket,78,os.path.join(OUT,'roulette_cinematic_preview.png'),(7,-13,4.8),(0,0,0))

def export_collection(col,filename):
 bpy.ops.object.select_all(action='DESELECT')
 for o in col.all_objects:
  o.select_set(True)
  if o.type=='MESH':
   bpy.context.view_layer.objects.active=o;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
   if not any(m.type=='TRIANGULATE' for m in o.modifiers):o.modifiers.new('Web_Triangulate','TRIANGULATE')
 bpy.ops.export_scene.gltf(filepath=os.path.join(WEB,filename),export_format='GLB',use_selection=True,export_apply=True,export_animations=True,export_materials='EXPORT',export_cameras=False,export_lights=False,export_yup=True)
 return {'file':filename,'bytes':os.path.getsize(os.path.join(WEB,filename))}
exports=[export_collection(ticket,'kuji-machine.glb'),export_collection(roulette,'roulette.glb')]
ticket.hide_render=False;roulette.hide_render=False;bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'broadcast_lottery_assets.blend'));bpy.ops.ed.undo_push(message='Create cinematic ticket and dart roulette assets')
_result={'ok':True,'objects':len(scene.objects),'exports':exports,'previews':[os.path.join(OUT,'ticket_cinematic_preview.png'),os.path.join(OUT,'roulette_cinematic_preview.png')]}
