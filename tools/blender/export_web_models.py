import bpy, os

ROOT='/Users/cream/Documents/API/chzzk-kuji'
OUT=os.path.join(ROOT,'src','client','assets','models')
os.makedirs(OUT,exist_ok=True)

def export_collection(collection_name, filename, include_animation=False):
    bpy.ops.object.select_all(action='DESELECT')
    collection=bpy.data.collections[collection_name]
    selected=[]
    for obj in collection.all_objects:
        obj.hide_set(False)
        obj.select_set(True)
        selected.append(obj)
        if obj.type=='MESH':
            bpy.context.view_layer.objects.active=obj
            bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
            if not any(mod.type=='TRIANGULATE' for mod in obj.modifiers):
                obj.modifiers.new('Web_Triangulate','TRIANGULATE')
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(OUT,filename), export_format='GLB', use_selection=True,
        export_apply=True, export_animations=include_animation, export_materials='EXPORT',
        export_cameras=False, export_lights=False, export_yup=True,
    )
    return {'file':filename,'objects':len(selected),'bytes':os.path.getsize(os.path.join(OUT,filename))}

exports=[export_collection('COL_KujiMachine','kuji-machine.glb'),export_collection('COL_Roulette','roulette.glb',True)]
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(ROOT,'artifacts','blender','broadcast_lottery_assets.blend'))
bpy.ops.ed.undo_push(message='Export web GLB models')
_result={'ok':True,'exports':exports}
