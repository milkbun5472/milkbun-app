"""A clean front face shell: smooth skin, crisp eyes and soft round blush.

The retained source skin is lumpy where the old fringe used to sit, which
made the eyes look rimmed and broke the blush apart. This shell is sampled
from the source face itself (ray cast from the front), then relaxed so the
lumps disappear, and sinks back into the source skin at its border. Eyes are
separate thin discs lying on the shell. Shown only with replacement hair.
"""
import math
import numpy as np
import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree
from hair_geometry import Sculpt,linear

SKIN='f4d4bb';EYE='4a3530';BLUSH='eea08f'
EYES=[(-.101,1.117,.0235,.052),(.097,1.117,.0235,.052)]
CHEEKS=[(-.150,1.078,.040),(.146,1.078,.040)]


def _smooth(t):
    t=np.clip(t,0,1);return t*t*(3-2*t)


def make_face(body,scalp,step=.002):
    # The brow above the eyes lives on the scalp support, not the source skin.
    bm=bmesh.new();bm.from_mesh(body.data);bm.transform(body.matrix_world)
    tmp=scalp.data.copy();tmp.transform(scalp.matrix_world);bm.from_mesh(tmp);bpy.data.meshes.remove(tmp);bm.normal_update()
    tree=BVHTree.FromBMesh(bm);bm.free()
    xs=np.arange(-.27,.27+1e-9,step);zs=np.arange(.998,1.382+1e-9,step)
    Y=np.full((len(zs),len(xs)),np.nan)
    for j,z in enumerate(zs):
        for i,x in enumerate(xs):
            hit,n,_,_=tree.ray_cast(Vector((x,-1,z)),Vector((0,1,0)),2)
            if hit is not None and n.y<-.20:Y[j,i]=hit.y
    # Source skin colour under every cell, so the shell rim matches exactly.
    mesh=body.data;npoly=len(mesh.polygons)
    image=next(n.image for n in mesh.materials[0].node_tree.nodes if n.type=='TEX_IMAGE' and any(l.to_socket.name=='Base Color' for out in n.outputs for l in out.links))
    tw,th=image.size;tex=np.array(image.pixels[:],np.float32).reshape(th,tw,4)
    uvl=mesh.uv_layers.active.data
    SRC=np.zeros(Y.shape+(3,));SRC[:]=linear(SKIN)
    for j,z in enumerate(zs):
        for i,x in enumerate(xs):
            h=tree.ray_cast(Vector((x,-1,z)),Vector((0,1,0)),2)
            if h[0] is None or h[2]>=npoly:continue
            poly=mesh.polygons[h[2]];u=np.mean([uvl[k].uv[:] for k in poly.loop_indices],0)
            c=tex[min(th-1,int(u[1]*th)),min(tw-1,int(u[0]*tw)),:3]
            SRC[j,i]=np.where(c<=.04045,c/12.92,((c+.055)/1.055)**2.4)
    X0,Z0=np.meshgrid(xs,zs)
    # Taller above the eyes (reaching under the fringe) than below them.
    rz=np.where(Z0>1.150,.230,.150);rxe=np.where(Z0>1.10,.265,.235)
    ell=np.sqrt((X0/rxe)**2+((Z0-1.150)/rz)**2)
    hit=~np.isnan(Y)
    # Eye sockets return no usable front hit; fill holes enclosed by skin.
    outside=np.zeros_like(hit);outside[0,:]|=~hit[0,:];outside[-1,:]|=~hit[-1,:]
    outside[:,0]|=~hit[:,0];outside[:,-1]|=~hit[:,-1]
    while True:
        grown=outside.copy()
        for dj,di in ((1,0),(-1,0),(0,1),(0,-1)):
            sh=np.roll(np.roll(outside,dj,0),di,1)
            if dj==1:sh[0,:]=False
            if dj==-1:sh[-1,:]=False
            if di==1:sh[:,0]=False
            if di==-1:sh[:,-1]=False
            grown|=sh&~hit
        if (grown==outside).all():break
        outside=grown
    valid=~outside
    # Relax the depth field: heavy smoothing removes the old fringe lumps and
    # the protruding source eyes, keeping the overall round cheek and brow.
    S=np.where(hit,Y,np.nanmean(Y))
    for _ in range(300):
        acc=S.copy();cnt=np.ones_like(S)
        for dj,di in ((1,0),(-1,0),(0,1),(0,-1)):
            sh=np.roll(np.roll(S,dj,0),di,1);vm=np.roll(np.roll(valid,dj,0),di,1)
            acc+=np.where(vm,sh,0);cnt+=vm
        S=np.where(valid,acc/cnt,0)
    # Distance to the border of the valid region, in cells.
    d=np.zeros_like(Y);cur=valid.copy();k=0
    while cur.any() and k<40:
        k+=1;nb=cur.copy()
        for dj,di in ((1,0),(-1,0),(0,1),(0,-1)):nb&=np.roll(np.roll(cur,dj,0),di,1)
        d[cur&~nb]=k;cur=nb
    d[cur]=k+1
    X,Z=np.meshgrid(xs,zs)
    fade=np.minimum(_smooth((d-1)/10.),_smooth((1-ell)/.50))
    # The source cheeks carry small raised blush pads; keep the shell fully
    # over them so they cannot poke through the new blush.
    for cx,cz,r in CHEEKS:
        pad=np.exp(-((X0-cx)**2+(Z0-cz+.012)**2)/(.055**2))
        fade=np.where(ell<1,np.maximum(fade,np.minimum(1,pad*1.6)*_smooth((1-ell)/.30)),fade)
    # Stand slightly proud of the source in the middle, sink behind it at the rim.
    # Envelope: wherever source bumps (old socket rims, lumps) stand in front
    # of the relaxed surface, push the shell forward by a widely blurred
    # amount, so it passes smoothly over them instead of letting them through.
    need=np.where(valid,np.maximum(0,S-np.nan_to_num(Y,nan=0)),0)
    for _ in range(6):
        m=need.copy()
        for dj in (-2,-1,0,1,2):
            for di in (-2,-1,0,1,2):m=np.maximum(m,np.roll(np.roll(need,dj,0),di,1))
        need=m
    for _ in range(160):
        need=(need*4+np.roll(need,1,0)+np.roll(need,-1,0)+np.roll(need,1,1)+np.roll(need,-1,1))/8
    # The rim follows the actual source skin, tucked just behind it.
    Ysrc=np.where(hit,np.nan_to_num(Y,nan=0),S)
    Yf=np.where(valid,(S-need*1.15-.0018)*fade+(Ysrc+.003)*(1-fade),np.nan)
    skin=np.array(linear(SKIN));blush=np.array(linear(BLUSH))
    verts=[];cols=[];index={}
    for j in range(len(zs)):
        for i in range(len(xs)):
            if not valid[j,i] or ell[j,i]>=1:continue
            x,z=xs[i],zs[j];f=fade[j,i];c=SRC[j,i]*(1-f)+skin*f
            for cx,cz,r in CHEEKS:
                w=math.exp(-(((x-cx)**2+((z-cz)*1.15)**2)/(r*r))*1.3)
                c=c*(1-w)+blush*w
            index[j,i]=len(verts);verts.append((x,Yf[j,i],z));cols.append((*c,1))
    faces=[]
    for j in range(len(zs)-1):
        for i in range(len(xs)-1):
            q=[(j,i),(j,i+1),(j+1,i+1),(j+1,i)]
            if all(k in index for k in q):faces.append(tuple(index[k] for k in q))
    s=Sculpt('FaceSupport',SKIN);s.v=verts;s.f=faces;s.colors=cols
    # Eyes: flat rounded ovals lying just in front of the shell.
    def depth(x,z):
        # Bilinear, so the eye discs follow the shell without stepping.
        fi=(x-xs[0])/step;fj=(z-zs[0])/step;i=int(fi);j=int(fj);u=fi-i;w=fj-j
        return ((1-u)*(1-w)*Yf[j,i]+u*(1-w)*Yf[j,i+1]+(1-u)*w*Yf[j+1,i]+u*w*Yf[j+1,i+1])
    eye=np.array(linear(EYE))
    for cx,cz,rx,rz in EYES:
        n=64;rings=10;base=len(s.v)
        s.v.append((cx,depth(cx,cz)-.0035,cz));s.colors.append((*eye,1))
        for r in range(1,rings+1):
            for k in range(n):
                a=2*math.pi*k/n;x=cx+rx*r/rings*math.cos(a);z=cz+rz*r/rings*math.sin(a)
                s.v.append((x,depth(x,z)-.0030,z));s.colors.append((*eye,1))
        for k in range(n):s.f.append((base,base+1+k,base+1+(k+1)%n))
        for r in range(1,rings):
            a0=base+1+(r-1)*n;a1=base+1+r*n
            for k in range(n):s.f.append((a0+k,a1+k,a1+(k+1)%n,a0+(k+1)%n))
    obj=s.finish();obj['hairSupport']=True
    mat=body.data.materials[0].copy();mat.name='Face shell skin'
    sh=mat.node_tree.nodes['Principled BSDF']
    for key in ('Base Color','Metallic','Roughness','Normal'):
        for l in list(sh.inputs[key].links):mat.node_tree.links.remove(l)
    sh.inputs['Metallic'].default_value=.04;sh.inputs['Roughness'].default_value=.95
    vc=mat.node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='Clay tint'
    mat.node_tree.links.new(vc.outputs['Color'],sh.inputs['Base Color'])
    obj.data.materials.clear();obj.data.materials.append(mat)
    return obj
