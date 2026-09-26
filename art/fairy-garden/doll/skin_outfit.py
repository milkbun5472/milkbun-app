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
# Shorter sleeves: pieces that reach past the torso side (|x| max >= ARM_X) are pulled up
# along the arm axis (shoulder -> hand) by SLEEVE_K beyond the shoulder; linear, so no bending.
SK=E('SLEEVE_K',0);REACH={1:0.,-1:0.};ROOMY=E('ARM_ROOMY',1.);ARMV=set()
if SK:
    import bmesh
    bm0=bmesh.new();bm0.from_mesh(C.data);bm0.verts.ensure_lookup_table();seen=set();n=0
    SH=np.array([.165,0,.655]);HD=np.array([.275,0,.40])
    for v0 in bm0.verts:
        if v0.index in seen:continue
        comp=[v0];st=[v0];seen.add(v0.index)
        while st:
            u=st.pop()
            for e in u.link_edges:
                k=e.other_vert(u)
                if k.index not in seen:seen.add(k.index);comp.append(k);st.append(k)
        if max(abs(v.co.x) for v in comp)<E('ARM_X',.2):continue
        if len(comp)<E('CRUMB',0):
            for v in comp:v.co=Vector((0,0,.5))   # frayed cuff crumbs: collapse out of sight
            continue
        sg=1 if sum(v.co.x for v in comp)>0 else -1;sh=SH*[sg,1,1];ax=(HD-SH)*[sg,1,1];ax/=np.linalg.norm(ax)
        # inner lining layers (closer to the arm axis) are pulled in a bit more so their
        # frayed edge hides inside the cuff
        Q=np.array([v.co[:] for v in comp])-sh;rad=np.linalg.norm(Q-np.outer(Q@ax,ax),axis=1).mean()
        k=SK+(E('LINING_K',0) if rad<E('LINING_R',.075) else 0)
        for v in comp:
            t=float(np.dot(np.array(v.co[:])-sh,ax))
            if t>0:v.co-=Vector(ax*t*k)
        REACH[sg]=max(REACH[sg],max(float(np.dot(np.array(v.co[:])-sh,ax)) for v in comp))
        n+=1
    bm0.to_mesh(C.data);C.data.update();bm0.free();print('sleeve pieces shortened',n)
# Conform: any clothes vertex that sits inside (or within GAP of) the body is pushed out along
# the body normal, so the doll's shoulders/chest never poke through. Clothes elsewhere untouched.
from mathutils.bvhtree import BVHTree
dg=bpy.context.evaluated_depsgraph_get();BT=BVHTree.FromObject(B,dg);GAP=E('GAP',.006);moved=0
# ARM_ROOMY: clothes over the arms (nearest skin follows an arm bone) are made a little looser around
# the arm axis instead of being conformed -- conforming pushed the dress lining up against the sleeve
# (brown blotches). Everything else is conformed as before.
bgi={g.name:g.index for g in B.vertex_groups}
def arm_of(face):
    w=0.
    for vi in B.data.polygons[face].vertices:
        for g in B.data.vertices[vi].groups:
            if g.group in (bgi.get('leftArm'),bgi.get('rightArm')):w+=g.weight
    return w/len(B.data.polygons[face].vertices)
SHP=np.array([.165,0,.655]);HDP=np.array([.275,0,.40])
for v in C.data.vertices:
    hit=BT.find_nearest(v.co)
    if hit[0] is None:continue
    if (ROOMY!=1 or E('ARM_SKIP',0)) and arm_of(hit[2])>.5:   # ARM_SKIP: leave sleeves as drawn, the shirt-coloured under-layer covers any arm poking through
        sg=1 if v.co.x>0 else -1;sh=SHP*[sg,1,1];ax=(HDP-SHP)*[sg,1,1];ax/=np.linalg.norm(ax)
        q=np.array(v.co[:])-sh;along=ax*np.dot(q,ax);v.co=Vector(sh+along+(q-along)*ROOMY);continue
    if v.co.z>E('CONFORM_TOP',9):continue   # collars stand off the neck; conforming them smeared the lining through
    p,n=hit[0],hit[1];d=(v.co-p).dot(n)
    if d<GAP:v.co=p+n*GAP+(v.co-p-n*d);moved+=1
print('conformed',moved)
# Under-layer (UNDER=1): a shirt-coloured copy of the body skin under the clothes (torso from
# ULOW to the collar, arms from the shoulder to just inside the cuff), pushed out by UGAP.
# It gives the cuff a solid inside and hides skin peeking through armpits/shoulder cracks.
if E('UNDER',0):
    import bmesh
    SH=np.array([.165,0,.655]);HD=np.array([.275,0,.40])
    bb=bmesh.new();bb.from_mesh(B.data);bb.verts.ensure_lookup_table();bb.normal_update()
    def keep(co):
        x,y,z=co;sg=1 if x>0 else -1;sh=SH*[sg,1,1];ax=(HD-SH)*[sg,1,1];ax/=np.linalg.norm(ax)
        t=float(np.dot(np.array(co)-sh,ax));isarm=abs(x)>.15+(z-.46)*(-.15)
        if isarm and t>0:return t<((REACH[sg] or E('UREACH',0))-E('UIN',.012))
        return E('ULOW',.40)<z<E('UTOP',.70)
    kill=[f for f in bb.faces if not all(keep(v.co[:]) for v in f.verts)]
    bmesh.ops.delete(bb,geom=kill,context='FACES')
    for v in bb.verts:v.co+=v.normal*E('UGAP',.004)
    mat=bpy.data.materials.new('under');mat.use_nodes=True
    col=[int(os.environ.get('UCOL','efe7da')[i:i+2],16)/255 for i in (0,2,4)]
    mat.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=(*[c**2.2 for c in col],1)
    mat.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.9
    U=bpy.data.meshes.new('under');bb.to_mesh(U);bb.free();UO=bpy.data.objects.new('under',U);bpy.context.collection.objects.link(UO)
    UO.data.materials.clear();UO.data.materials.append(mat)
    print('under faces',len(U.polygons))
    C.data.materials.append(mat);mi=len(C.data.materials)-1
    for pl in U.polygons:pl.material_index=0
    bpy.ops.object.select_all(action='DESELECT');C.select_set(True);UO.select_set(True);bpy.context.view_layer.objects.active=C
    UO.data.materials.clear();UO.data.materials.append(C.data.materials[0]);UO.data.materials.append(mat)
    for pl in U.polygons:pl.material_index=1
    # remap: after join, materials unify by slot object; simplest: join then fix
    bpy.ops.object.join()
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
# Skirts (SKIRT_K < 1): below SKIRT_Z the cloth follows the legs only a little, the rest goes to 'body',
# otherwise a dress splits in two when the doll walks.
SKK=E('SKIRT_K',1.)
if SKK<1:
    gi={g.name:g.index for g in C.vertex_groups};n=0
    for v in C.data.vertices:
        if v.co.z>=E('SKIRT_Z',.34):continue
        ws={g.group:g.weight for g in v.groups}
        leg=sum(ws.get(gi[k],0) for k in ('leftLeg','rightLeg'))
        if leg<=0 or sum(ws.get(gi[k],0) for k in ('leftArm','rightArm'))>0:continue
        for k in ('leftLeg','rightLeg'):
            if gi[k] in ws:C.vertex_groups[k].add([v.index],ws[gi[k]]*SKK,'REPLACE')
        C.vertex_groups['body'].add([v.index],ws.get(gi['body'],0)+leg*(1-SKK),'REPLACE');n+=1
    print('skirt verts',n)
m=C.modifiers.new('Rig','ARMATURE');m.object=A;C.parent=A
for o in list(bpy.data.objects):
    if o not in (A,C):bpy.data.objects.remove(o)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',use_selection=True,export_skins=True,export_animations=False,export_extras=True)
print('skinned',len(C.data.vertices))
