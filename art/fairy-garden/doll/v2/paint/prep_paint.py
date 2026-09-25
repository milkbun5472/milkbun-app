"""Paint kit: doll (locked) + hair (editable, faces coloured 头发 / 皮肤（会被删）)."""
import bpy,sys
doll,hat,out=sys.argv[-3:]
for o in list(bpy.data.objects):bpy.data.objects.remove(o)
bpy.ops.import_scene.gltf(filepath=doll)
body=[o for o in bpy.data.objects if o.type=='MESH'][0];anchor=bpy.data.objects['HeadAnchor']
body.name='玩偶（锁住）';body.hide_select=True
before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=hat)
new=[o for o in bpy.data.objects if o not in before]
for o in new:
    if o.parent is None:o.parent=anchor
hair=next(o for o in new if o.type=='MESH' and 'base' not in o.name)
base=next(o for o in new if o.type=='MESH' and 'base' in o.name)
hair.name='头发（刷这个）';base.name='发底（锁住）';base.hide_select=True
for s in bpy.data.screens:
    for a in s.areas:
        if a.type=='VIEW_3D':
            for sp in a.spaces:
                if sp.type=='VIEW_3D':sp.shading.type='MATERIAL'
bpy.context.view_layer.objects.active=hair;hair.select_set(True)
import os,tempfile
for im in bpy.data.images:
    if im.size[0]>2048:
        im.scale(2048,2048);f=os.path.join(tempfile.mkdtemp(),im.name.replace('/','_')+'.png');im.filepath_raw=f;im.file_format='PNG';im.save();im.unpack(method='REMOVE') if im.packed_file else None;im.filepath=f;im.reload();im.pack()
bpy.ops.wm.save_as_mainfile(filepath=out)
print('saved',out)
