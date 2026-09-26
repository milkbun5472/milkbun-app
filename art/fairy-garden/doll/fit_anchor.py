"""Fit the doll's head anchor: a sphere through the bald cranium (the hat rest).
Least-squares sphere on the upper skull (above the ears, all around)."""
import bpy,sys,json,numpy as np
src,out=sys.argv[-2:]
for o in list(bpy.data.objects):bpy.data.objects.remove(o)
bpy.ops.import_scene.gltf(filepath=src)
o=next(x for x in bpy.data.objects if x.type=='MESH')
P=np.array([o.matrix_world@v.co for v in o.data.vertices])
q=P[P[:,2]>.93]                                   # cranium above the brow
A=np.c_[2*q,np.ones(len(q))];b=(q**2).sum(1)
c=np.linalg.lstsq(A,b,rcond=None)[0];C=c[:3];R=float(np.sqrt(c[3]+C@C))
res=np.abs(np.linalg.norm(q-C,axis=1)-R)
anchor={'center':[round(float(x),5) for x in C],'radius':round(R,5),'fit_rms':round(float(np.sqrt((res**2).mean())),5),'samples':int(len(q))}
json.dump(anchor,open(out,'w'),indent=2);print(anchor)
