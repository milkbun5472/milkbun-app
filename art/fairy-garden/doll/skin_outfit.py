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
C.data.transform(Matrix.Diagonal((s*E('SX',1),s*E('SY',1),s,1)));C.data.transform(Matrix.Translation(Vector((0,E('DY',0),E('Z0',.19)))))
# LIFT: shells made on a longer-legged figure -- everything above LIFT_B moves up by LIFT, ramping from 0
# at LIFT_A (shoes stay on the floor, the trouser legs stretch a little, the top reaches the shoulders)
if E('LIFT',0):
    for v in C.data.vertices:v.co.z+=E('LIFT',0)*min(1.,max(0.,(v.co.z-E('LIFT_A',.05))/(E('LIFT_B',.35)-E('LIFT_A',.05))))
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
        if min(v.co.z for v in comp)<E('SLEEVE_ZMIN',.33):continue
        if E('SLEEVE_LUM',0):   # only light (shirt) pieces are sleeves; dark bodice/strap pieces stay put
            if '_tex' not in globals():
                im=next(n.image for n in C.data.materials[0].node_tree.nodes if n.type=='TEX_IMAGE');_W,_H=im.size;_tex=np.array(im.pixels[:]).reshape(_H,_W,4)
                _uv=bm0.loops.layers.uv.active
            U=np.array([l[_uv].uv[:] for v in comp for l in v.link_loops])
            if len(U) and (_tex[np.clip((U[:,1]*_H).astype(int),0,_H-1),np.clip((U[:,0]*_W).astype(int),0,_W-1),:3]**(1/2.2)).mean()<E('SLEEVE_LUM',0):continue   # skirts / trousers are wide too, but they are not sleeves
        if len(comp)<E('CRUMB',0):
            for v in comp:v.co=Vector((0,0,.5))   # frayed cuff crumbs: collapse out of sight
            continue
        sg=1 if sum(v.co.x for v in comp)>0 else -1;sh=SH*[sg,1,1];ax=(HD-SH)*[sg,1,1];ax/=np.linalg.norm(ax)
        # inner lining layers (closer to the arm axis) are pulled in a bit more so their
        # frayed edge hides inside the cuff
        Q=np.array([v.co[:] for v in comp])-sh;rad=np.linalg.norm(Q-np.outer(Q@ax,ax),axis=1).mean()
        k=SK+(E('LINING_K',0) if rad<E('LINING_R',.075) else 0)
        # one-piece tops (body+sleeves joined): only the part lying over the arm moves
        whole=len(comp)>E('ONEPIECE',4000)
        if whole and '_BTs' not in globals():
            from mathutils.bvhtree import BVHTree as _B
            _BTs=_B.FromObject(B,bpy.context.evaluated_depsgraph_get());_bg={g.name:g.index for g in B.vertex_groups}
            def _armw(co):
                h=_BTs.find_nearest(co)
                if h[0] is None:return 0.
                vs=B.data.polygons[h[2]].vertices;w=0.
                for vi in vs:
                    for g in B.data.vertices[vi].groups:
                        if g.group in (_bg['leftArm'],_bg['rightArm']):w+=g.weight
                return w/len(vs)
        for v in comp:
            t=float(np.dot(np.array(v.co[:])-sh,ax))
            if t>0:
                a=min(1.,max(0.,(_armw(v.co)-E('OP_A',.3))/E('OP_W',.4))) if whole else 1.
                v.co-=Vector(ax*t*k*a)
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
    g=E('GAP_TOP',GAP) if v.co.z>E('GAP_TOP_Z',9) else GAP
    if d<g:v.co=p+n*g+(v.co-p-n*d);moved+=1
print('conformed',moved)
# STRAP_OUT: pinafore straps and the shirt shoulder end up the same distance off the skin after the
# conform, and the shirt wins. Dark (dress) faces over the shoulders are lifted a little further out.
if E('STRAP_OUT',0):
    import bmesh as _b4
    im4=next(n.image for n in C.data.materials[0].node_tree.nodes if n.type=='TEX_IMAGE');W4,H4=im4.size;tx4=np.array(im4.pixels[:]).reshape(H4,W4,4)[:,:,:3]**(1/2.2)
    b4=_b4.new();b4.from_mesh(C.data);b4.faces.ensure_lookup_table();u4=b4.loops.layers.uv.active;lift=set()
    for f in b4.faces:
        c=f.calc_center_median()
        if c.z<E('STRAP_Z',.58) or c.z>E('STRAP_ZMAX',9) or abs(c.x)>E('STRAP_X',.16) or abs(c.x)<E('STRAP_XMIN',0):continue
        u=f.loops[0][u4].uv
        if tx4[min(H4-1,int(u[1]*H4)),min(W4-1,int(u[0]*W4))].mean()<.55:lift.update(v.index for v in f.verts)
    # COLLAR_OUT: light (collar) faces above COLLAR_Z go out further than the straps, so the straps tuck under the collar
    coll=set()
    if E('COLLAR_OUT',0):
        for f in b4.faces:
            c=f.calc_center_median()
            if c.z<E('COLLAR_Z',.64) or abs(c.x)>E('STRAP_X',.16):continue
            u=f.loops[0][u4].uv
            if tx4[min(H4-1,int(u[1]*H4)),min(W4-1,int(u[0]*W4))].mean()>=.55:coll.update(v.index for v in f.verts)
    b4.verts.ensure_lookup_table()
    for i in coll-lift:
        v=b4.verts[i];h=BT.find_nearest(v.co)
        if h[0] is not None:v.co+=h[1]*E('COLLAR_OUT',0)
    for i in lift:
        v=b4.verts[i];h=BT.find_nearest(v.co)
        if h[0] is not None:v.co+=h[1]*E('STRAP_OUT',0)
    b4.to_mesh(C.data);b4.free();print('strap verts lifted',len(lift))
# PAINT_ARM: any dark face lying over the arm (nearest skin follows an arm bone, above the waist) is
# repainted with the shirt colour -- its UVs point at one light texel of the sleeve. Used where the
# dress lining shows through shortened sleeves ('穿模的地方直接涂袖子的颜色').
if E('PAINT_ARM',0):
    import bmesh
    im=next(n.image for n in C.data.materials[0].node_tree.nodes if n.type=='TEX_IMAGE');W,H=im.size;tex=np.array(im.pixels[:]).reshape(H,W,4)[:,:,:3]**(1/2.2)
    bm2=bmesh.new();bm2.from_mesh(C.data);bm2.faces.ensure_lookup_table();uvl=bm2.loops.layers.uv.active
    col=lambda uv:tex[min(H-1,max(0,int(uv[1]*H))),min(W-1,max(0,int(uv[0]*W)))]
    arm_faces=[];best=None
    for f in bm2.faces:
        if f.material_index!=0 or f.calc_center_median().z<E('PAINT_ZMIN',.46):continue
        if abs(f.calc_center_median().x)<E('PAINT_XMIN',0):continue   # pinafore straps sit on the shoulder: never paint them
        h=BT.find_nearest(f.calc_center_median())
        if h[0] is None or arm_of(h[2])<=.5:continue
        c=np.mean([col(l[uvl].uv) for l in f.loops],0);arm_faces.append((f,c))
        if best is None or c.mean()>best[1].mean():best=(f,c)
    target=best[0].loops[0][uvl].uv.copy() if best else None;n=0
    # PAINT_COLLAR: dark lining that the conform pushes through the collar (above this height) -> shirt colour
    if E('PAINT_COLLAR',0):
        for f in bm2.faces:
            if f.material_index==0 and f.calc_center_median().z>E('PAINT_COLLAR',0):
                c=np.mean([col(l[uvl].uv) for l in f.loops],0)
                if c.mean()<E('COLLAR_LUM',.7):arm_faces.append((f,np.zeros(3)))   # collar specks are lighter: own cutoff
    for f,c in arm_faces:
        if c.mean()<E('PAINT_ARM',.55):
            for l in f.loops:l[uvl].uv=target
            n+=1
    bm2.to_mesh(C.data);bm2.free();print('painted arm faces',n)
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
    # UNDER_TEX: the under-layer takes the outfit's own material and a real fabric texel (the one closest to
    # the median colour of the pieces over the upper arm), so it has the same colour and shade as the
    # garment instead of a flat stand-in ('肉眼还是看得出来下面垫了一层粉色').
    if E('UNDER_TEX',0):
        import bmesh as _bm
        im=next(n.image for n in C.data.materials[0].node_tree.nodes if n.type=='TEX_IMAGE');W_,H_=im.size;tx=np.array(im.pixels[:]).reshape(H_,W_,4)[:,:,:3]
        b3=_bm.new();b3.from_mesh(C.data);b3.faces.ensure_lookup_table();uv3=b3.loops.layers.uv.active
        SH3=np.array([.165,0,.655])
        cand=[]
        for f in b3.faces:
            if f.material_index!=0:continue
            c3=f.calc_center_median()
            if abs(c3.x)>.17 and .45<c3.z<.66 and np.hypot(abs(c3.x)-SH3[0],c3.z-SH3[2])<.15:
                u=f.loops[0][uv3].uv;cand.append((tx[min(H_-1,int(u[1]*H_)),min(W_-1,int(u[0]*W_))],u.copy()))
        if cand:
            med=np.median([c for c,_ in cand],0);uvt=min(cand,key=lambda t:((t[0]-med)**2).sum())[1]
            for f in b3.faces:
                if f.material_index==1:
                    f.material_index=0
                    for l in f.loops:l[uv3].uv=uvt
            b3.to_mesh(C.data);print('under-layer textured',len(cand))
        b3.free()
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
