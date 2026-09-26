"""After Lisa's hand cleanup: merge the red pieces she kept back into the hair
(original material), and export the hat in HeadAnchor space.
Usage: python3 finish_cleanup.py M03-清理.blend ../hats/hair_m03.glb"""
import bpy,sys
src,out=sys.argv[-2:]
bpy.ops.wm.open_mainfile(filepath=src)
anchor=bpy.data.objects['HeadAnchor'];inv=anchor.matrix_world.inverted()
hair=next(o for o in bpy.data.objects if o.name.startswith('头发'))
base=next(o for o in bpy.data.objects if o.name.startswith('发底'))
kept=[o for o in bpy.data.objects if o.name.startswith('碎片')]
for o in kept:o.data.materials.clear();o.data.materials.append(hair.data.materials[0])
for o in [hair,base]+kept:
    o.hide_select=False;M=inv@o.matrix_world
    o.data=o.data.copy();o.data.transform(M);o.parent=None;o.matrix_world.identity()
bpy.ops.object.select_all(action='DESELECT')
for o in [hair]+kept:o.select_set(True)
bpy.context.view_layer.objects.active=hair
if kept:bpy.ops.object.join()
hair.name='hair';base.select_set(True)
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',use_selection=True)
print('kept pieces',len(kept),'->',out)
