import bpy,math,json,sys
from pathlib import Path
from mathutils import noise,Vector
# blender --background --python scripts/export-fairy-village.py -- source.blend output.glb [--detail]
# Small interiors retain bevels and full topology; sprawling villages use decimation.
args=sys.argv[sys.argv.index('--')+1:]
SOURCE,DEST=map(Path,args[:2]);P=SOURCE.parent;detail='--detail' in args
def srgb(v):
 v=max(0,min(1,v));return 12.92*v if v<=.0031308 else 1.055*v**(1/2.4)-.055
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
# Export a lightweight rendering of the editable art source. Original stays untouched.
for o in list(bpy.data.objects):
 if o.type not in {'MESH','CURVE'} or o.hide_render or o.name.startswith(('Distant forest','Firefly')):bpy.data.objects.remove(o,do_unlink=True)
for m in bpy.data.materials:
 if not m.use_nodes:continue
 bs=m.node_tree.nodes.get('Principled BSDF')
 if not bs:continue
 col=tuple(m.diffuse_color)[:3];size=64;im=bpy.data.images.new('pigment_'+m.name,width=size,height=size);pix=[]
 woody=any(x in m.name.lower() for x in ['wood','oak','walnut'])
 for y in range(size):
  for x in range(size):
   u,v=x/size,y/size;k=.97+noise.noise_vector(Vector((u*(25 if woody else 7),v*(2 if woody else 7),.47)))[0]*.13
   pix.extend([srgb(c*k) for c in col]+[1])
 im.pixels=pix;im.pack()
 for key in ['Base Color','Normal']:
  for link in list(bs.inputs[key].links):m.node_tree.links.remove(link)
 tex=m.node_tree.nodes.new('ShaderNodeTexImage');tex.image=im;m.node_tree.links.new(tex.outputs['Color'],bs.inputs['Base Color'])
for o in bpy.data.objects:
 bpy.context.view_layer.objects.active=o
 for mod in list(o.modifiers):
  if detail and o.type=='MESH':bpy.ops.object.modifier_apply(modifier=mod.name)
  else:o.modifiers.remove(mod)
 if o.type=='MESH' and not o.data.uv_layers:
  uv=o.data.uv_layers.new(name='Ground UV')
  for poly in o.data.polygons:
   for idx in poly.loop_indices:
    co=o.data.vertices[o.data.loops[idx].vertex_index].co;uv.data[idx].uv=(co.x*.1,co.y*.1)
bpy.ops.object.select_all(action='SELECT');bpy.context.view_layer.objects.active=next(o for o in bpy.data.objects if o.type=='MESH')
bpy.ops.object.convert(target='MESH');bpy.ops.object.join();o=bpy.context.object;o.name='Forest hamlet'
if not detail:
 mod=o.modifiers.new('Mobile triangle budget','DECIMATE');mod.ratio=.28;bpy.ops.object.modifier_apply(modifier=mod.name)
bpy.ops.export_scene.gltf(filepath=str(DEST),export_format='GLB',use_selection=True,export_animations=False,export_cameras=False,export_lights=False)
print('VILLAGE_EXPORT',DEST.stat().st_size,len(o.data.polygons),flush=True)
(P/'game-export-report.json').write_text(json.dumps({'bytes':DEST.stat().st_size,'faces':len(o.data.polygons),'source':str(SOURCE),'output':str(DEST)},indent=2))
