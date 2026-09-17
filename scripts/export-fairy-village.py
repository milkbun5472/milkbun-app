import bpy,math,json,sys,re
from pathlib import Path
from mathutils import noise,Vector
# blender --background --python scripts/export-fairy-village.py -- source.blend output.glb [--detail]
# Small interiors retain bevels and full topology; sprawling villages use decimation.
args=sys.argv[sys.argv.index('--')+1:]
SOURCE,DEST=map(Path,args[:2]);P=SOURCE.parent;detail='--detail' in args
ratio=float(next((a.split('=',1)[1] for a in args if a.startswith('--ratio=')),'.28'))
if not 0 < ratio <= 1:raise ValueError('Mesh ratio must be in (0, 1]')
def srgb(v):
 v=max(0,min(1,v));return 12.92*v if v<=.0031308 else 1.055*v**(1/2.4)-.055
bpy.ops.wm.open_mainfile(filepath=str(SOURCE))
def export_group(o):
 while o:
  tag=o.get('export_group') or o.name
  if re.fullmatch(r'(shut|open):[A-Za-z][A-Za-z0-9]*',tag):return tag
  o=o.parent
 return 'Forest hamlet'
# Capture semantic groups before discarding non-mesh authoring parents.
for o in bpy.data.objects:
 if o.type in {'MESH','CURVE'}:o['export_group']=export_group(o)
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
# Bake/join independently inside each visibility group; ordinary scenes keep their single mesh.
bpy.ops.object.select_all(action='SELECT');bpy.context.view_layer.objects.active=next(o for o in bpy.data.objects if o.type=='MESH')
bpy.ops.object.convert(target='MESH')
groups={}
for o in list(bpy.data.objects):groups.setdefault(o.get('export_group','Forest hamlet'),[]).append(o)
results=[]
for name,objects in groups.items():
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.context.view_layer.objects.active=objects[0]
 if len(objects)>1:bpy.ops.object.join()
 o=bpy.context.object;o.name=name
 if not detail:
  mod=o.modifiers.new('Mobile triangle budget','DECIMATE');mod.ratio=ratio;bpy.ops.object.modifier_apply(modifier=mod.name)
 results.append(o)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(DEST),export_format='GLB',use_selection=True,export_animations=False,export_cameras=False,export_lights=False)
faces=sum(len(o.data.polygons) for o in results)
print('VILLAGE_EXPORT',DEST.stat().st_size,faces,'GROUPS',','.join(o.name for o in results),flush=True)
(P/(DEST.stem+'-export-report.json')).write_text(json.dumps({'bytes':DEST.stat().st_size,'faces':faces,'groups':[o.name for o in results],'source':str(SOURCE),'output':str(DEST)},indent=2))
