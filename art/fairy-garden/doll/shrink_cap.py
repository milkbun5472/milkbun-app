"""Lower the doll's skull cap into an under-hair core. Face, eyes, ears, jaw and
the widest part of the head are untouched: only vertices above the brow (and
the upper back) move radially toward the skull centre, blended smoothly.
Usage: CAP=.12 python3 shrink_cap.py in.glb head-anchor.json out.glb"""
import bpy,sys,os,json,numpy as np
from mathutils import Vector
src,anc,out=sys.argv[-3:]
for o in list(bpy.data.objects):bpy.data.objects.remove(o)
bpy.ops.import_scene.gltf(filepath=src)
A=json.load(open(anc));C=Vector(A['center']);R=A['radius']
CAP=float(os.environ.get('CAP',.12));Z0=float(os.environ.get('Z0',.93));Z1=float(os.environ.get('Z1',1.08))
def sm(t):t=max(0,min(1,t));return t*t*(3-2*t)
for o in bpy.data.objects:
    if o.type!='MESH':continue
    mw=o.matrix_world;inv=mw.inverted();n=0
    for v in o.data.vertices:
        p=mw@v.co;d=p-C
        if d.length>R*1.6:continue           # body, far parts
        w=sm((p.z-Z0)/(Z1-Z0))
        # upper back also, but never the face front below the brow
        if w<=0:continue
        p2=C+d*(1-CAP*w);v.co=inv@p2;n+=1
    o.data.update();print(o.name,'moved',n)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',use_selection=True,export_extras=True)
