"""Add the HeadAnchor empty to a doll GLB (position = skull centre, scale = radius)."""
import bpy,sys,json
src,anc,out=sys.argv[-3:]
for o in list(bpy.data.objects):bpy.data.objects.remove(o)
bpy.ops.import_scene.gltf(filepath=src)
A=json.load(open(anc))
e=bpy.data.objects.new('HeadAnchor',None);bpy.context.collection.objects.link(e)
e.location=A['center'];e.scale=(A['radius'],)*3
e['anchor']='Hairstyles attach here: hair files are authored in this node\'s local space.'
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',use_selection=True,export_extras=True)
print('anchored')
