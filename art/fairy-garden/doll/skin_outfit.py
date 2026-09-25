"""Skin a clothes-only shell onto the rigged v2 doll.
1) place: centre the shell, scale by S (SY extra depth), bottom at Z0 (Blender Z-up, doll space);
2) copy the body's bone weights to the clothes (nearest body surface, interpolated);
3) export the clothes + the same armature (bone names leftArm/rightArm/leftLeg/rightLeg/body).
At runtime the outfit's skeleton is rebound to the doll's bones by name.
Usage: S=.53 SY=1.25 Z0=.19 python3 skin_outfit.py v2/doll-rigged.glb shell.glb out.glb"""
import bpy,sys,os,numpy as np
from mathutils import Matrix,Vector
doll,src,out=sys.argv[-3:];E=lambda k,d:float(os.environ.get(k,d))
for o in list(bpy.data.objects):bpy.data.objects.remove(o)
bpy.ops.import_scene.gltf(filepath=doll)
A=next(o for o in bpy.data.objects if o.type=='ARMATURE');B=next(o for o in bpy.data.objects if o.type=='MESH')
before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=src)
C=next(o for o in bpy.data.objects if o not in before and o.type=='MESH');C.name='Outfit'
C.parent=None;C.data.transform(C.matrix_world);C.matrix_world.identity()
P=np.array([v.co[:] for v in C.data.vertices]);c=(P.min(0)+P.max(0))/2;s=E('S',.53)
C.data.transform(Matrix.Translation(Vector((-c[0],-c[1],-P[:,2].min()))))
C.data.transform(Matrix.Diagonal((s,s*E('SY',1),s,1)));C.data.transform(Matrix.Translation(Vector((0,E('DY',0),E('Z0',.19)))))
# Conform: any clothes vertex that sits inside (or within GAP of) the body is pushed out along
# the body normal, so the doll's shoulders/chest never poke through. Clothes elsewhere untouched.
from mathutils.bvhtree import BVHTree
dg=bpy.context.evaluated_depsgraph_get();BT=BVHTree.FromObject(B,dg);GAP=E('GAP',.006);moved=0
for v in C.data.vertices:
    hit=BT.find_nearest(v.co)
    if hit[0] is None:continue
    p,n=hit[0],hit[1];d=(v.co-p).dot(n)
    if d<GAP:v.co=p+n*GAP+(v.co-p-n*d);moved+=1
print('conformed',moved)
for g in B.vertex_groups:C.vertex_groups.new(name=g.name)
dt=C.modifiers.new('w','DATA_TRANSFER');dt.object=B;dt.use_vert_data=True;dt.data_types_verts={'VGROUP_WEIGHTS'}
dt.vert_mapping='POLYINTERP_NEAREST';dt.layers_vgroup_select_src='ALL';dt.layers_vgroup_select_dst='NAME'
bpy.context.view_layer.objects.active=C;bpy.ops.object.modifier_apply(modifier='w')
# Torso pieces (vest, shirt body) must not follow the arms: a piece whose mean arm weight is
# Torso pieces are the ones that never reach out past the torso side (|x| max < ARM_X);
# they give all their arm weight back to 'body' (else the vest hem is dragged by the hand).
import bmesh
bm=bmesh.new();bm.from_mesh(C.data);bm.verts.ensure_lookup_table();seen=set();gi={g.name:g.index for g in C.vertex_groups}
def w(v,n):
    for g in C.data.vertices[v].groups:
        if g.group==gi[n]:return g.weight
    return 0.
fixed=0
for v0 in bm.verts:
    if v0.index in seen:continue
    comp=[v0.index];st=[v0];seen.add(v0.index)
    while st:
        u=st.pop()
        for e in u.link_edges:
            k=e.other_vert(u)
            if k.index not in seen:seen.add(k.index);comp.append(k.index);st.append(k)
    arm=np.array([w(i,'leftArm')+w(i,'rightArm') for i in comp])
    ax=max(abs(C.data.vertices[i].co.x) for i in comp)
    if ax<E('ARM_X',.2) and arm.max()>0:
        for i in comp:
            a=w(i,'leftArm')+w(i,'rightArm')
            if a<=0:continue
            C.vertex_groups['leftArm'].remove([i]);C.vertex_groups['rightArm'].remove([i])
            C.vertex_groups['body'].add([i],min(1.,w(i,'body')+a),'REPLACE')
        fixed+=1
print('torso pieces freed from arms',fixed)
m=C.modifiers.new('Rig','ARMATURE');m.object=A;C.parent=A
for o in list(bpy.data.objects):
    if o not in (A,C):bpy.data.objects.remove(o)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',use_selection=True,export_skins=True,export_animations=False,export_extras=True)
print('skinned',len(C.data.vertices))
