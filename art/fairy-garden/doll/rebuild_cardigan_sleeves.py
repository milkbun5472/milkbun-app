"""Give the pink sweater complete sleeve cross-sections for whole-arm gestures.

The C04 source fuses its inner sleeves into the torso. Blending that surface
between torso and shoulder bones flattens it when the arm rises. Separate closed
shoulder caps and rounded sleeves keep their volume while the torso and bag stay
anchored. Reuse the existing knit atlas, dye slots and shared body morph formula.
Run after restoring the continuous surface and lowering its collar; idempotent.
"""
from pathlib import Path
import math
import runpy
import bpy
import bmesh
import numpy as np
from mathutils import Vector

HERE = Path(__file__).resolve().parent


def rebuild_cardigan_sleeves(o):
    if o.get('roundSleeveVersion'):
        return o
    assert o.get('continuousSurfaceVersion') == 1
    assert o.get('loweredCollarVersion') == 1
    rig = o.parent
    mat = o.data.materials[0]
    shape = runpy.run_path(str(HERE / 'body_shape.py'))['deform']
    # Remove the fused outer arm lobes, retaining the front pouch. All remaining
    # sweater surface is torso-owned; sleeves will have their own complete section.
    bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00002)
    for xcut in [-.145,.145]:
        bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),plane_co=(xcut,0,0),plane_no=(1,0,0),dist=1e-6)
    remove=[]
    for f in bm.faces:
        c=f.calc_center_median()
        if abs(c.x)>.145 and .425<c.z<.74 and not(c.x>0 and c.y<-.09 and c.z<.56):remove.append(f)
    bmesh.ops.delete(bm,geom=remove,context='FACES')
    newfaces=bmesh.ops.holes_fill(bm,edges=[e for e in bm.edges if e.is_boundary and min(v.co.z for v in e.verts)>.2],sides=0)['faces']
    uvbm=bm.loops.layers.uv.active;cbm=bm.loops.layers.float_color.active or bm.loops.layers.color.active
    patches=bmesh.ops.triangulate(bm,faces=newfaces)['faces']
    # A concave hem notch can triangulate over an existing triangle in the
    # opposite direction. Cancel that coincident pair, leaving the closed shell.
    bm.verts.index_update()
    face_sets={}
    for face in bm.faces:
        face_sets.setdefault(tuple(sorted(v.index for v in face.verts)),[]).append(face)
    duplicates=[f for faces in face_sets.values() if len(faces)==2 for f in faces]
    if duplicates:bmesh.ops.delete(bm,geom=duplicates,context='FACES_ONLY')
    patches=[f for f in patches if f.is_valid]
    assert not any(len(e.link_faces)>2 for e in bm.edges), 'Side closure must remain manifold'
    for f in patches:
        f.smooth=True
        for loop in f.loops:
            loop[uvbm].uv=(.32,.66)
            if cbm:loop[cbm]=(0,0,0,1)
    # Feather the clean knit into the original cloth through a separate colour
    # channel. A constant atlas sample on only the added faces makes a patch.
    def smooth(a, b, x):
        t = min(1, max(0, (x-a)/(b-a)))
        return t*t*(3-2*t)
    for face in bm.faces:
        for loop in face.loops:
            if not cbm:
                continue
            slot = loop[cbm][0]
            p = loop.vert.co
            blend = smooth(.07, .125, abs(p.x)) * smooth(.405, .445, p.z) * (1-smooth(.685, .715, p.z)) * smooth(-.11, -.065, p.y)
            # Trim and the cream pouch keep their authored texture.
            loop[cbm] = (slot, blend if slot < .3 else 0, 0, 1)
    for edge in bm.edges:edge.smooth=True
    bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free();o.data.normals_split_custom_set([(0,0,0)]*len(o.data.loops))
    # Smooth normals across the authored planar side closure and old fabric.
    normals=[]
    for li,loop in enumerate(o.data.loops):
        p=o.data.vertices[loop.vertex_index].co;n=o.data.corner_normals[li].vector.copy()
        if abs(p.x)>.10 and .44<p.z<.69 and p.y>-.075:
            blend=min(1,max(0,(abs(p.x)-.10)/.035))*min(1,(p.z-.44)/.035,(.69-p.z)/.02)
            target=Vector((1 if p.x>0 else -1,p.y*7,0)).normalized()
            n=n.lerp(target,blend).normalized()
        normals.append(n)
    o.data.normals_split_custom_set(normals)
    for v in o.data.vertices:
        if v.co.z>.4:
            for g in o.vertex_groups:g.remove([v.index])
            o.vertex_groups['body'].add([v.index],1,'REPLACE')
    for sign,side in [(-1,'left'),(1,'right')]:
        axis=Vector((sign*.095,0,-.19)).normalized();u=Vector((0,1,0));v=axis.cross(u).normalized();start=Vector((sign*.153,0,.655));verts=[];faces=[]
        rings=[(-.055,.003),(-.047,.030),(-.030,.051),(-.01,.063),(0.015,.067),(.04,.068),(.065,.068),(.09,.067),(.115,.065),(.14,.061),(.162,.056),(.178,.050),(.182,.048),(.188,.050),(.208,.048),(.214,.045),(.214,.038),(.196,.038)]
        N=40
        for t,r in rings:
            for j in range(N):
                a=j*2*math.pi/N;fold=.0012*math.cos(a*7+t*30)*math.sin(max(0,min(1,t/.18))*math.pi);rib=.00065*math.cos(a*20) if .182<t<.214 else 0;verts.append(start+axis*t+(u*math.cos(a)+v*math.sin(a))*(r*.87+fold+rib))
        for i in range(len(rings)-1):
            for j in range(N):a=i*N+j;b=i*N+(j+1)%N;faces.append((a,b,b+N,a+N))
        faces.append(tuple(reversed(range(N))))
        mesh=bpy.data.meshes.new('SleeveSurface');mesh.from_pydata(verts,[],faces);mesh.update();s=bpy.data.objects.new('outfit_cardigan_'+side+'_sleeve',mesh);bpy.context.collection.objects.link(s);s.parent=rig;s['outfit']='cardigan';s['roundSleeveVersion']=1;s['sleeveSide']=side;s['slotBase']=o['slotBase'].to_dict();mesh.materials.append(mat.copy())
        uv_layer=mesh.uv_layers.new(name='UVMap');color=mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
        for f in mesh.polygons:
            f.use_smooth=True
            for li in f.loop_indices:
                vi=mesh.loops[li].vertex_index;ri,j=divmod(vi,N)
                # One clean, continuous knit patch: do not interpolate between atlas islands.
                phase=(j+(N if j==0 and any(mesh.loops[k].vertex_index%N==N-1 for k in f.loop_indices) else 0))/N
                uv_layer.data[li].uv=(.285+.085*phase,.615+.105*max(0,min(1,(rings[ri][0]+.055)/.269)))
                color.data[li].color=(0,0,0,1)
        group=s.vertex_groups.new(name=side+'Arm');group.add(list(range(len(verts))),1,'REPLACE');mod=s.modifiers.new('Rig','ARMATURE');mod.object=rig
        s.shape_key_add(name='Basis');P=np.array([p[:] for p in verts]);arm=np.ones(len(verts))
        for key in ['height','shoulder','waist','flare','build','head']:
            k=s.shape_key_add(name=key);k.value=0;delta=shape(P,arm,key,True)
            for i,p in enumerate(k.data):p.co=Vector(P[i]+delta[i])
    for key in o.data.shape_keys.key_blocks:key.value=0
    o['roundSleeveVersion'] = 1
    o['repairKnit'] = True
    return o
