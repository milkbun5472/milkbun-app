"""Prepare a hand-cleanup .blend: doll + hair, suspicious loose pieces split
into their own red objects so they can be clicked and deleted in Object mode."""
import bpy,sys,bmesh,numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
doll,hat,out=sys.argv[-3:]
for o in list(bpy.data.objects):bpy.data.objects.remove(o)
bpy.ops.import_scene.gltf(filepath=doll)
body=[o for o in bpy.data.objects if o.type=='MESH'][0];anchor=bpy.data.objects['HeadAnchor']
body.name='玩偶（不用动）';body.hide_select=True
before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=hat)
new=[o for o in bpy.data.objects if o not in before]
for o in new:
    if o.parent is None:o.parent=anchor
bpy.context.view_layer.update()
hair=next(o for o in new if o.type=='MESH' and 'base' not in o.name)
base=next(o for o in new if o.type=='MESH' and 'base' in o.name)
base.name='发底（不用动）';base.hide_select=True;hair.name='头发'
bm=bmesh.new();bm.from_mesh(body.data);bm.transform(body.matrix_world);tree=BVHTree.FromBMesh(bm)
# loose parts of the hair
me=hair.data;mw=hair.matrix_world
bmh=bmesh.new();bmh.from_mesh(me);bmh.faces.ensure_lookup_table()
seen=set();parts=[]
for f in bmh.faces:
    if f in seen:continue
    comp=[f];st=[f];seen.add(f)
    while st:
        g=st.pop()
        for e in g.edges:
            for h in e.link_faces:
                if h not in seen:seen.add(h);comp.append(h);st.append(h)
    parts.append(comp)
sus=[]
for comp in parts:
    pts=[mw@f.calc_center_median() for f in comp]
    d=min(tree.find_nearest(p)[3] for p in pts[::max(1,len(pts)//30)])
    c=sum(pts,Vector())/len(pts)
    near_face=c.y<.06 and c.z<1.0
    if near_face and d<.012 and len(comp)<800:sus.append(comp)
print('parts',len(parts),'suspicious',len(sus))
red=bpy.data.materials.new('可疑-红');red.use_nodes=True
red.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(.9,.05,.05,1);red.diffuse_color=(.9,.05,.05,1)
keep_mat=me.materials[0]
for i,comp in enumerate(sus):
    nb=bmesh.new();vm={}
    for f in comp:
        vs=[]
        for v in f.verts:
            if v not in vm:vm[v]=nb.verts.new(v.co)
            vs.append(vm[v])
        try:nb.faces.new(vs)
        except ValueError:pass
    m=bpy.data.meshes.new(f'碎片{i+1:03d}');nb.to_mesh(m);nb.free();m.materials.append(red)
    o=bpy.data.objects.new(m.name,m);bpy.context.collection.objects.link(o);o.parent=hair.parent;o.matrix_parent_inverse=hair.matrix_parent_inverse.copy();o.matrix_basis=hair.matrix_basis.copy()
    o['keep_material']=keep_mat.name
bmesh.ops.delete(bmh,geom=[f for c in sus for f in c],context='FACES');bmh.to_mesh(me);bmh.free()
hair.hide_select=True;hair.name='头发（不用动）'
for a in bpy.context.screen.areas if bpy.context.screen else []:pass
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=out)
