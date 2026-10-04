"""Make a phone-sized, skinned derivative; never modify the supplied GLB."""
import bpy, sys, argparse, hashlib, json
from pathlib import Path
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
from cat_asset import rig_pet
p=argparse.ArgumentParser();p.add_argument('--species',choices=['cat','dog'],default='dog');p.add_argument('--source',required=True);p.add_argument('--evidence',required=True)
args=p.parse_args(sys.argv[sys.argv.index('--')+1:])
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.ops.import_scene.gltf(filepath=args.source);objects=list(bpy.context.scene.objects)
for o in objects:
 if o.type!='MESH':continue
 tris=sum(len(p.vertices)-2 for p in o.data.polygons)
 if tris>26000:
  m=o.modifiers.new('手机用减面','DECIMATE');m.ratio=26000/tris;m.use_collapse_triangulate=True
  bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=m.name)
for image in bpy.data.images:
 if max(image.size)>1024:
  w,h=image.size;r=1024/max(w,h);image.scale(round(w*r),round(h*r))
objects=rig_pet(objects,HERE,args.species)
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(HERE/(args.species+'.glb')),export_format='GLB',use_selection=True,export_extras=True,export_animations=False,export_image_format='WEBP',export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=7)
out=Path(args.evidence);out.mkdir(parents=True,exist_ok=True);bpy.ops.wm.save_as_mainfile(filepath=str(out/(args.species+'-rig.blend')))
report={'sourceSha256':hashlib.sha256(Path(args.source).read_bytes()).hexdigest(),'sourceBytes':Path(args.source).stat().st_size,'modelBytes':(HERE/(args.species+'.glb')).stat().st_size,'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in objects if o.type=='MESH'),'rigged':True,'bones':sum(len(o.data.bones) for o in objects if o.type=='ARMATURE')}
if args.species=='dog':
 report['dogBytes']=report.pop('modelBytes');(HERE/'dog-report.json').write_text(json.dumps(report,indent=2)+'\n')
else:
 r=json.loads((HERE/'asset-report.json').read_text());r['catBytes']=report['modelBytes'];r['catTriangles']=report['triangles'];(HERE/'asset-report.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n')
print(report)
