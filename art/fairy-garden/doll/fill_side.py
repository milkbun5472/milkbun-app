"""Fill the side gaps of a fitted hat by copying nearby locks and swinging
them around the vertical axis toward the side (anchor space)."""
import bpy,sys,os,bmesh,numpy as np,random
from mathutils import Matrix,Vector
src,out=sys.argv[-2:]
for o in list(bpy.data.objects):bpy.data.objects.remove(o)
bpy.ops.import_scene.gltf(filepath=src)
H=[o for o in bpy.data.objects if o.type=='MESH'][0];H.data.transform(H.matrix_world);H.matrix_world.identity()
bm=bmesh.new();bm.from_mesh(H.data);bm.faces.ensure_lookup_table()
seen=set();comps=[]
for f in bm.faces:
    if f in seen:continue
    c=[f];st=[f];seen.add(f)
    while st:
        g=st.pop()
        for e in g.edges:
            for k in e.link_faces:
                if k not in seen:seen.add(k);c.append(k);st.append(k)
    comps.append(c)
def az(p):return (np.degrees(np.arctan2(p[0],-p[1]))+360)%360
ANG=float(os.environ.get('SWING',22));rnd=random.Random(3);added=0
N=int(os.environ.get('FILL_PER_SIDE',5))
for side,centre in ((1,90),(-1,270)):
    cand=[]
    for comp in comps:
        if not 150<len(comp)<3000:continue
        c=np.mean([f.calc_center_median()[:] for f in comp],0)
        a=az(c);d=(a-centre+540)%360-180
        back=(d>0) if side>0 else (d<0)      # donors from behind the side only
        if back and 18<abs(d)<50 and -.4<c[2]<.5 and np.hypot(c[0],c[1])>.85:cand.append((len(comp),d,comp))
    cand.sort(key=lambda x:-x[0])
    for n_,d,comp in cand[:N]:
        rot=-np.sign(d)*ANG*rnd.uniform(.8,1.1)
        g=bmesh.ops.duplicate(bm,geom=comp)
        vs=[x for x in g['geom'] if isinstance(x,bmesh.types.BMVert)]
        bmesh.ops.rotate(bm,verts=vs,cent=Vector((0,0,0)),matrix=Matrix.Rotation(np.radians(rot),4,'Z'))
        for v in vs:v.co*=0.985
        added+=1
bm.to_mesh(H.data);H.data.update();print('locks added',added)
bpy.ops.object.select_all(action='DESELECT');H.select_set(True)
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',use_selection=True)
