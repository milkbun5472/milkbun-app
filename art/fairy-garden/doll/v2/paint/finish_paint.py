"""Delete faces painted 皮肤 and export the hat in HeadAnchor space.
Usage: python3 finish_paint.py painted.blend ../hats/hair_x.glb"""
import bpy,sys,bmesh
src,out=sys.argv[-2:]
bpy.ops.wm.open_mainfile(filepath=src)
anchor=bpy.data.objects['HeadAnchor'];inv=anchor.matrix_world.inverted()
hair=next(o for o in bpy.data.objects if o.name.startswith('头发'))
base=next(o for o in bpy.data.objects if o.name.startswith('发底'))
skin=[i for i,m in enumerate(hair.data.materials) if m and m.name.startswith('皮肤')]
bm=bmesh.new();bm.from_mesh(hair.data)
kill=[f for f in bm.faces if f.material_index in skin];bmesh.ops.delete(bm,geom=kill,context='FACES');bm.to_mesh(hair.data);bm.free()
for i in sorted(skin,reverse=True):hair.data.materials.pop(index=i)
for o in (hair,base):
    o.hide_select=False;M=inv@o.matrix_world;o.data=o.data.copy();o.data.transform(M);o.parent=None;o.matrix_world.identity()
bpy.ops.object.select_all(action='DESELECT');hair.select_set(True);base.select_set(True)
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',use_selection=True)
print('removed skin faces',len(kill),'->',out)
