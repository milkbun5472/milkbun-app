"""Reversible source-head partition and smooth reference-style facial paint.

The original head remains in the asset for M01 comparison. Replacement hair
uses a new rounded head; the eyes and blush are colours on that same surface,
not raised stickers or separate ellipsoids.
"""
import math
import bpy
import numpy as np
from mathutils import Vector
from hair_geometry import Sculpt,linear


def split_original_head(body):
    mesh=body.data
    original_name=body.name
    world=[body.matrix_world@v.co for v in mesh.vertices]
    groups=[[],[]]
    image=next(n.image for n in mesh.materials[0].node_tree.nodes if n.type=='TEX_IMAGE' and any(l.to_socket.name=='Base Color' for socket in n.outputs for l in socket.links))
    w,h=image.size;pixels=np.array(image.pixels[:]).reshape(h,w,4)
    for p in mesh.polygons:
        z=sum(world[i].z for i in p.vertices)/len(p.vertices)
        uv=np.array([mesh.uv_layers.active.data[i].uv[:] for i in p.loop_indices]);q=np.floor(uv*[w,h]).astype(int)
        color=pixels[np.clip(q[:,1],0,h-1),np.clip(q[:,0],0,w-1),:3].mean(0)
        # Preserve the ivory collar even where its tips rise above the neck
        # cut. Skin and chin are removed without sawing through the clothing.
        head=z>.989 or (z>.952 and color[0]-color[2]>.12)
        groups[int(head)].append(p)
    objects=[]
    for name,polys in zip(('SourceBody','SourceHeadOriginal'),groups):
        used=sorted({i for p in polys for i in p.vertices});index={old:new for new,old in enumerate(used)}
        out=bpy.data.meshes.new(name);out.from_pydata([mesh.vertices[i].co[:] for i in used],[],[tuple(index[i] for i in p.vertices) for p in polys]);out.update()
        for material in mesh.materials:out.materials.append(material)
        uv=out.uv_layers.new(name=mesh.uv_layers.active.name)
        normals=[];at=0
        for new,old in zip(out.polygons,polys):
            new.material_index=old.material_index;new.use_smooth=old.use_smooth
            for loop in old.loop_indices:
                uv.data[at].uv=mesh.uv_layers.active.data[loop].uv
                normals.append(mesh.corner_normals[loop].vector[:]);at+=1
        out.normals_split_custom_set(normals)
        obj=bpy.data.objects.new(name,out);bpy.context.collection.objects.link(obj);obj.matrix_world=body.matrix_world.copy()
        for source in mesh.shape_keys.key_blocks:
            key=obj.shape_key_add(name=source.name)
            key.slider_min=source.slider_min;key.slider_max=source.slider_max;key.value=source.value
            for target,i in zip(key.data,used):target.co=source.data[i].co
        for key,value in body.items():obj[key]=value
        if name=='SourceHeadOriginal':
            if 'sourceBodySliders' in obj:del obj['sourceBodySliders']
            obj['sourceFaceOriginal']=True
        objects.append(obj)
    bpy.data.objects.remove(body,do_unlink=True)
    for obj,name in zip(objects,('SourceBody','SourceHeadOriginal')):obj.name=name
    return objects


def smooth(t):
    t=np.clip(t,0,1);return t*t*(3-2*t)


# Rounded chin and full cheeks in profile, with a continuous convex forehead.
PROFILE=np.array([[.965,0,0],[.981,.082,.105],[1.005,.152,.181],[1.035,.199,.223],
 [1.07,.223,.247],[1.11,.234,.257],[1.16,.241,.263],[1.23,.247,.263],
 [1.30,.243,.252],[1.37,.202,.214],[1.43,.137,.151],[1.475,.050,.057],[1.485,0,0]])


def profile(z):
    # Catmull-Rom slopes are evaluated with a cubic Hermite interpolation.
    xs=PROFILE[:,0];result=[]
    k=min(len(xs)-2,max(0,int(np.searchsorted(xs,z)-1)))
    t=(z-xs[k])/(xs[k+1]-xs[k]);h=xs[k+1]-xs[k]
    for column in (1,2):
        ys=PROFILE[:,column];slopes=np.gradient(ys,xs)
        value=(2*t**3-3*t*t+1)*ys[k]+(t**3-2*t*t+t)*h*slopes[k]+(-2*t**3+3*t*t)*ys[k+1]+(t**3-t*t)*h*slopes[k+1]
        result.append(max(0,float(value)))
    return result


def make_face():
    s=Sculpt('ScalpSupport','f4d4bb');skin=np.array(linear('f4d4bb'));eye=np.array(linear('4c342a'));blush=np.array(linear('efb094'))
    # Dense paint sampling keeps the small capsule eye boundary antialiased in
    # a vertex-colour GLB, without changing the three original packed textures.
    n=192;rings=128;verts=[];faces=[];colors=[]
    for j in range(rings+1):
        z=.965+(.520*j/rings);rx,ry=profile(z)
        for i in range(n):
            theta=2*math.pi*i/n;si=math.sin(theta);co=math.cos(theta)
            x=-.004+rx*math.copysign(abs(si)**(2/2.25),si)
            y=.014-ry*math.copysign(abs(co)**(2/2.25),co)
            rear=float(smooth((-co-.05)/.6))
            zz=z+.072*rear*float(smooth((1.40-z)/.20))
            color=skin.copy()
            if co>0:
                for cx in (-.105,.105):
                    # Reference eye: 29 x 62 relative to a 400 px visible face.
                    dx=x-cx;dz=max(0,abs(z-1.115)-.021)
                    distance=math.hypot(dx,dz)-.0188
                    opacity=1-float(smooth((distance+.0007)/.0014))
                    color=color*(1-opacity)+eye*opacity
                for cx in (-.138,.138):
                    r=math.sqrt(((x-cx)/.0305)**2+((z-1.060)/.0220)**2)
                    opacity=.78*(1-float(smooth((r-.78)/.30)))
                    color=color*(1-opacity)+blush*opacity
            verts.append((x,y,zz));colors.append((*color,1))
    for j in range(rings):
        for i in range(n):
            a=j*n+i;b=j*n+(i+1)%n;faces.append((a,b,b+n,a+n))
    s.v=verts;s.f=faces;s.colors=colors
    obj=s.finish();obj['hairSupport']=True;obj['referenceFace']=True;obj['hairlineVertices']=0
    material=bpy.data.materials.new('Smooth skin with painted eyes and blush');material.use_nodes=True
    shader=material.node_tree.nodes['Principled BSDF'];shader.inputs['Roughness'].default_value=.92
    color=material.node_tree.nodes.new('ShaderNodeVertexColor');color.layer_name='Clay tint';material.node_tree.links.new(color.outputs['Color'],shader.inputs['Base Color'])
    obj.data.materials.clear();obj.data.materials.append(material)
    # Ears are round volumes, sharing the skin and head's six morph keys.
    ear=Sculpt('ears','f4d4bb')
    ear.ellipsoid((0,.014,.954),(.059,.055,.067),n=48,rings=32)
    for sign in (-1,1):ear.ellipsoid((sign*.244,.002,1.104),(.052,.038,.067),n=48,rings=32)
    start=len(verts);verts.extend(ear.v);faces.extend(tuple(start+i for i in f) for f in ear.f);colors.extend(ear.colors)
    # Rebuild once with the ears, avoiding object joins that can lose keys.
    mesh=obj.data;mesh.clear_geometry();mesh.from_pydata(verts,[],faces);mesh.update()
    for p in mesh.polygons:p.use_smooth=True
    attr=mesh.color_attributes.get('Clay tint') or mesh.color_attributes.new(name='Clay tint',type='FLOAT_COLOR',domain='POINT');attr.data.foreach_set('color',np.array(colors).ravel())
    import bmesh
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
    # Analytic facial paint on a high-resolution UV atlas. Geometry sampling
    # must not determine the boundary of a tiny eye or blush mark.
    size=2048
    x=np.linspace(-.31,.31,size)[None,:];z=np.linspace(.94,1.50,size)[:,None]
    rgb=np.broadcast_to(np.array([244,212,187])/255,(size,size,3)).copy()
    for cx in (-.097,.097):
        distance=np.hypot(x-cx,np.maximum(0,np.abs(z-1.115)-.019))-.018
        opacity=1-smooth((distance+.00022)/.00044)
        rgb=rgb*(1-opacity[:,:,None])+np.array([76,52,42])/255*opacity[:,:,None]
    for cx in (-.131,.131):
        radius=np.sqrt(((x-cx)/.0295)**2+((z-1.060)/.0215)**2)
        opacity=.78*(1-smooth((radius-.82)/.25))
        rgb=rgb*(1-opacity[:,:,None])+np.array([239,176,148])/255*opacity[:,:,None]
    paint=bpy.data.images.new('Reference face paint',width=size,height=size,alpha=True)
    paint.pixels.foreach_set(np.concatenate((rgb,np.ones((size,size,1))),axis=2).astype(np.float32).ravel())
    paint.pack()
    uv=mesh.uv_layers.new(name='Face paint')
    for loop in mesh.loops:
        i=loop.vertex_index;co=mesh.vertices[i].co
        uv.data[loop.index].uv=((co.x+.31)/.62,(co.z-.94)/.56) if i<start and co.y<.014 else (.01,.01)
    texture=material.node_tree.nodes.new('ShaderNodeTexImage');texture.image=paint
    material.node_tree.links.new(texture.outputs['Color'],shader.inputs['Base Color'])
    material.node_tree.links.new(texture.outputs['Color'],shader.inputs['Emission Color'])
    shader.inputs['Emission Strength'].default_value=.16
    obj['faceDesign']='Painted capsules: 0.036 x 0.074, centres ±0.097 / 1.115. Flat blush: 0.059 x 0.043, centres ±0.131 / 1.060. 2048px antialiased atlas.'
    return obj
