"""Shrink a v2 asset for the web: decimate each mesh to at most TRIS triangles, resize every
texture to TEX px (square max), export WEBP textures + Draco geometry. Skins, bone weights,
extras (HeadAnchor, dollRig) are kept. Sources stay untouched; outputs go to v2/web/.
Usage: TRIS=30000 TEX=1024 python3 compress_asset.py in.glb out.glb"""
import bpy,sys,os
src,out=sys.argv[-2:];TRIS=int(os.environ.get('TRIS',30000));TEX=int(os.environ.get('TEX',1024))
for o in list(bpy.data.objects):bpy.data.objects.remove(o)
bpy.ops.import_scene.gltf(filepath=src)
for o in bpy.data.objects:
    if o.type!='MESH':continue
    n=sum(len(p.vertices)-2 for p in o.data.polygons)
    if n>TRIS:
        m=o.modifiers.new('dec','DECIMATE');m.ratio=TRIS/n;m.use_collapse_triangulate=True
        bpy.context.view_layer.objects.active=o
        # the armature modifier must stay last/unapplied: move decimate to the top and apply it
        while o.modifiers.find('dec')>0:bpy.ops.object.modifier_move_up(modifier='dec')
        bpy.ops.object.modifier_apply(modifier='dec')
    print('MESH',o.name,n,'->',sum(len(p.vertices)-2 for p in o.data.polygons))
for im in bpy.data.images:
    w,h=im.size
    if max(w,h)>TEX:s=TEX/max(w,h);im.scale(max(1,int(w*s)),max(1,int(h*s)));print('IMG',im.name,(w,h),'->',tuple(im.size))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',use_selection=True,export_extras=True,export_skins=True,export_animations=False,
    export_image_format='WEBP',export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=7)
print('wrote',out,os.path.getsize(out)//1024,'KB')
