"""Smooth the newly exposed brow while preserving the source eyes and cheeks.

A thin fitted continuation sits above the retained skin. Two constrained holes
leave the original textured eyes visible; the lower edge recedes into the skin.
It is shown only with replacement hair, through ScalpSupport.
"""
import math
import numpy as np
from mathutils import Vector
from mathutils.geometry import delaunay_2d_cdt


# Lower edge of the brow patch. The eyes and cheeks below it are covered by
# the FaceSupport shell (face.py), so no hole is cut around the eyes here.
Z0=1.200


def smooth(t):
    t=max(0,min(1,t));return t*t*(3-2*t)


def surface(x,z,shading=False):
    rx=.215+.033*smooth((z-1.15)/.15)
    sphere=.257*math.sqrt(max(.01,1-((z-1.19)/.30)**2))
    blend=smooth((z-1.16)/.10)
    ry=(.2505+.1075*(z-1.10))*(1-blend)+sphere*blend
    y=.014-ry*max(.002,1-abs((x+.004)/rx)**2.2)**(1/2.2)
    if shading:return y
    y-=.003*smooth((z-Z0)/.020)
    y+=.006*(1-smooth((z-Z0)/.015))
    y+=.012*smooth((abs(x+.004)-.187)/.024)
    return y


def make_patch(color):
    points=[(-.211,Z0),(.203,Z0),(.227,1.45),(-.235,1.45)]
    edges=[(0,1),(1,2),(2,3),(3,0)]
    eyes=[]
    for cx,cz,rx,rz in eyes:
        start=len(points)
        for i in range(64):
            a=2*math.pi*i/64;points.append((cx+rx*math.cos(a),cz+rz*math.sin(a)))
        edges.extend((start+i,start+(i+1)%64) for i in range(64))
    for z in np.arange(Z0+.003,1.45,.005):
        for x in np.arange(-.209,.202,.005):
            if all(((x-cx)/rx)**2+((z-cz)/rz)**2>1.03 for cx,cz,rx,rz in eyes):points.append((x,z))
    v,_,f,*_=delaunay_2d_cdt([Vector(p) for p in points],edges,[],0,1e-7,False)
    faces=[]
    for face in f:
        center=sum((v[i] for i in face),Vector((0,0)))/len(face);x,z=center
        if z<Z0 or z>1.45:continue
        if any(((x-cx)/rx)**2+((z-cz)/rz)**2<1 for cx,cz,rx,rz in eyes):continue
        faces.append(face)
    used=sorted(set(i for f in faces for i in f));mapping={i:j for j,i in enumerate(used)}
    verts=[];normals=[]
    for i in used:
        x,z=v[i];verts.append((x,surface(x,z),z));eps=.0001
        dx=(surface(x+eps,z,True)-surface(x-eps,z,True))/(2*eps)
        dz=(surface(x,z+eps,True)-surface(x,z-eps,True))/(2*eps)
        normals.append(Vector((dx,-1,dz)).normalized())
    return verts,[tuple(mapping[i] for i in f) for f in faces],[(*color,1)]*len(verts),normals
