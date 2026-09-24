"""Close the actual source hairline with a smoothly shaded round scalp.

The first ring is the exact clipped source boundary, not an overlapping ball.
Consequently the forehead has no floating strip, jagged hole or second face.
"""
import collections, math
import bpy
import numpy as np
from mathutils import Vector
from hair_geometry import Sculpt,linear


def make_scalp(body):
    mesh=body.data
    p=np.array([body.matrix_world@v.co for v in mesh.vertices])
    f=np.array([poly.vertices[:] for poly in mesh.polygons])
    # UV seams duplicate positions. Weld by distance on a temporary mesh;
    # rounding coordinates can split a seam at a quantization boundary.
    import bmesh
    from mathutils.kdtree import KDTree
    bm=bmesh.new();bm.from_mesh(mesh)
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=2e-5)
    bm.verts.ensure_lookup_table();bm.verts.index_update()
    unique=np.array([body.matrix_world@v.co for v in bm.verts])
    tree=KDTree(len(p))
    for i,co in enumerate(p):tree.insert(co,i)
    tree.balance()
    first=np.array([tree.find(co)[1] for co in unique])
    edges=collections.Counter(tuple(sorted(e)) for face in bm.faces
        for e in [(edge.verts[0].index,edge.verts[1].index) for edge in face.edges])
    bm.free()
    adj=collections.defaultdict(list)
    for (a,b),count in edges.items():
        if count==1:adj[a].append(b);adj[b].append(a)
    loops=[];seen=set()
    for start in adj:
        if start in seen:continue
        loop=[];at=start;prev=None
        while at not in seen:
            seen.add(at);loop.append(at)
            opts=[b for b in adj[at] if b!=prev]
            if not opts:break
            prev,at=at,opts[0]
        loops.append(loop)
    loop=max(loops,key=len)
    pts=p[first[loop]]
    # Original per-corner normals and image values are preserved at the seam.
    normal=np.zeros_like(p);uv=np.zeros((len(p),2));count=np.zeros(len(p))
    normal_matrix=body.matrix_world.to_3x3().inverted().transposed()
    for item,n,u in zip(mesh.loops,mesh.corner_normals,mesh.uv_layers.active.data):
        index=item.vertex_index;normal[index]+=normal_matrix@Vector(n.vector);uv[index]+=u.uv[:];count[index]+=1
    normal/=np.maximum(count[:,None],1);normal/=np.maximum(np.linalg.norm(normal,axis=1,keepdims=True),1e-10)
    uv/=np.maximum(count[:,None],1)
    ns=normal[first[loop]];uv=uv[first[loop]]
    image=next(n.image for n in mesh.materials[0].node_tree.nodes if n.type=='TEX_IMAGE' and any(l.to_socket.name=='Base Color' for out in n.outputs for l in out.links))
    w,h=image.size;tex=np.array(image.pixels[:],dtype=np.float32).reshape(h,w,4)
    xy=np.floor(uv*[w,h]).astype(int);colors=tex[np.clip(xy[:,1],0,h-1),np.clip(xy[:,0],0,w-1),:3]
    colors=np.where(colors<=.04045,colors/12.92,((colors+.055)/1.055)**2.4)
    theta=np.unwrap(np.arctan2(pts[:,0]+.006,-(pts[:,1]-.018)))
    target=np.array(linear('e6c7ad'))
    verts=[];rgb=[];faces=[];n=len(pts);rings=24
    for j in range(rings+1):
        t=j/rings
        # Start exactly on the source border, relax its irregular sampling
        # into a circular forehead, then close at the crown.
        z=pts[:,2]+(1.49-pts[:,2])*t
        theta_blend=theta
        rx=.255;ry=.257;zcentre=1.19;rz=.30
        rad=np.sqrt(np.maximum(0,1-((z-zcentre)/rz)**2))
        desired=np.stack([-.006+rx*rad*np.sin(theta_blend),.018-ry*rad*np.cos(theta_blend),z],axis=1)
        extension=pts.copy();extension[:,2]=z
        blend=min(1,t/.32);blend=blend*blend*(3-2*blend)
        ring=extension*(1-blend)+desired*blend
        if j>0:
            for relax in range(min(18,j*3)):
                ring=(ring*2+np.roll(ring,1,axis=0)+np.roll(ring,-1,axis=0))/4
        if j==0:ring=pts
        if j==rings:ring=np.tile([-.006,.018,1.49],(n,1))
        verts.extend(ring)
        cb=np.clip((ring[:,2]-pts[:,2])/.018,0,1)[:,None];cb=cb*cb*(3-2*cb)
        rgb.extend([(*c,1) for c in colors*(1-cb)+target*cb])
        if j:
            for i in range(n):
                a=(j-1)*n+i;b=(j-1)*n+(i+1)%n;faces.append((a,b,b+n,a+n))
    sculpt=Sculpt('ScalpSupport','f3d0b4');sculpt.v=verts;sculpt.f=faces;sculpt.colors=rgb
    obj=sculpt.finish();obj['hairSupport']=True
    # Match the imported skin's PBR response as well as its colour. Hair and
    # skin must not share one roughness/specular material.
    material=mesh.materials[0].copy();material.name='Source skin continuation'
    shader=material.node_tree.nodes['Principled BSDF']
    for key in ('Base Color','Metallic','Roughness','Normal'):
        for link in list(shader.inputs[key].links):material.node_tree.links.remove(link)
    shader.inputs['Metallic'].default_value=.0431373
    shader.inputs['Roughness'].default_value=.9960785
    colors_node=material.node_tree.nodes.new('ShaderNodeVertexColor');colors_node.layer_name='Clay tint'
    material.node_tree.links.new(colors_node.outputs['Color'],shader.inputs['Base Color'])
    obj.data.materials.clear();obj.data.materials.append(material)
    # Preserve seam shading after consistent mesh winding has been calculated.
    normals=[]
    for corner in obj.data.loops:
        co=obj.data.vertices[corner.vertex_index].co
        v=Vector(((co.x+.006)/(.255**2),(co.y-.018)/(.257**2),(co.z-1.19)/(.30**2)))
        ring=corner.vertex_index//n;index=corner.vertex_index%n
        blend=min(1,max(0,(co.z-pts[index,2])/.025));blend=blend*blend*(3-2*blend)
        normals.append(Vector(ns[index]).lerp(v.normalized(),blend).normalized())
    obj.data.normals_split_custom_set(normals)
    obj['hairlineVertices']=n
    return obj
