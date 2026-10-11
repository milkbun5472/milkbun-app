"""Closed, bevelled cloth/leather ribbon shared by crossbody bag continuations."""
import bpy, bmesh
from mathutils import Vector


def strap_ribbon(name, points, normals, section, rig, samples=4, taper=8):
    path=[];ns=[]
    for i in range(len(points)-1):
        a,b,c,d=[Vector(points[max(0,min(len(points)-1,j))]) for j in (i-1,i,i+1,i+2)]
        for k in range(samples):
            t=k/samples
            p=.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t)
            path.append(p);ns.append(Vector(normals[i]).lerp(Vector(normals[i+1]),t).normalized())
    path.append(Vector(points[-1]));ns.append(Vector(normals[-1]))
    verts=[];faces=[];N=len(section)
    for i,p in enumerate(path):
        tangent=(path[min(i+1,len(path)-1)]-path[max(0,i-1)]).normalized()
        side=tangent.cross(ns[i]).normalized();normal=side.cross(tangent).normalized()
        width=min(1,(i+1)/taper,(len(path)-i)/taper)
        for w,h in section:verts.append(tuple(p+side*w*width+normal*h))
    for i in range(len(path)-1):
        for j in range(N):
            a=i*N+j;b=i*N+(j+1)%N;faces.append((a,b,b+N,a+N))
    faces.extend([tuple(reversed(range(N))),tuple((len(path)-1)*N+j for j in range(N))])
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
    o=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(o);o.parent=rig
    for f in mesh.polygons:f.use_smooth=True
    return o
