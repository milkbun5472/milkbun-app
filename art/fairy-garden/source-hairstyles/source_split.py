"""Separate the source shell without moving retained vertices or repainting it.

The source is one continuous scanned surface, not a collection of hair pieces.
A continuous texture mask is used only to locate its existing material seam.
Every intersected triangle is clipped on both sides, interpolating all original
attributes. The union of the two outputs is the original surface, including
all six already validated body morphs. No triangle-centre deletion is used.
"""
import hashlib
import json
import bpy
import numpy as np
from mathutils import Vector


def split_source(source):
    mesh = source.data
    positions = np.array([v.co[:] for v in mesh.vertices])
    world = np.array([source.matrix_world @ v.co for v in mesh.vertices])
    uv = np.array([v.uv[:] for v in mesh.uv_layers.active.data])
    normals = np.array([v.vector[:] for v in mesh.corner_normals])
    faces = np.array([p.vertices[:] for p in mesh.polygons])
    image = next(n.image for n in mesh.materials[0].node_tree.nodes
                 if n.type == 'TEX_IMAGE' and any(l.to_socket.name == 'Base Color'
                 for socket in n.outputs for l in socket.links))
    w,h = image.size
    pixels = np.array(image.pixels[:], dtype=np.float32).reshape(h,w,4)
    xy = np.floor(uv * [w,h]).astype(int)
    corner_colors = pixels[np.clip(xy[:,1],0,h-1),np.clip(xy[:,0],0,w-1),:3]
    green=corner_colors[:,1]
    indices = np.array([l.vertex_index for l in mesh.loops])
    values = np.zeros(len(positions)); counts = np.zeros(len(positions))
    np.add.at(values, indices, green - .60); np.add.at(counts, indices, 1)
    values /= np.maximum(counts, 1)
    x,y,z = world.T
    # Locate the two actual dark eye components, including UV seam duplicates.
    # Rectangular protection also keeps fragments of old bangs, so use their
    # connected surface regions and a one-edge antialiasing margin instead.
    from mathutils.kdtree import KDTree
    rgb=np.zeros((len(positions),3));np.add.at(rgb,indices,corner_colors)
    rgb/=np.maximum(counts[:,None],1)
    x,y,z=world.T
    dark=(z>1.05)&(z<1.205)&(y<-.175)&(y>-.25)&(abs(x)<.155)&(rgb[:,0]<.46)&(rgb[:,1]<.33)
    neighbours=[set() for _ in positions]
    for edge in mesh.edges:
        a,b=edge.vertices;neighbours[a].add(b);neighbours[b].add(a)
    tree=KDTree(len(positions))
    for i,co in enumerate(world):tree.insert(co,i)
    tree.balance()
    for i in np.flatnonzero(dark):
        for _,other,_ in tree.find_range(world[i],2e-5):neighbours[i].add(other);neighbours[other].add(i)
    eyes=np.zeros(len(positions),bool)
    candidates=np.flatnonzero(dark)
    for sign in (-1,1):
        target=np.array([sign*.10,-.23,1.115])
        seed=int(candidates[np.argmin(np.linalg.norm(world[candidates]-target,axis=1))])
        queue=[seed];eyes[seed]=True
        for at in queue:
            for other in neighbours[at]:
                if dark[other] and not eyes[other]:eyes[other]=True;queue.append(other)
    for at in list(np.flatnonzero(eyes)):
        for other in neighbours[at]:
            if z[other]<1.198 and y[other]>-.25:eyes[other]=True
    # Remove the baked bang-contact border only above the eyes; cheeks and jaw
    # retain their complete original texture and surface.
    forehead_band=(z>1.15)&(y<-.10)&(abs(x)<.24)
    values[forehead_band]=rgb[forehead_band,1]-.80
    values[(z<1.035)|eyes] = np.maximum(values[(z<1.035)|eyes], .1)
    # A clean arc above both eyes removes the old bang-contact shading from
    # the exposed forehead. The eyes, cheeks and jaw remain source geometry.
    forehead=(y<-.10)&(z>1.035)&(abs(x)<.24)
    cut=1.149+.049*(np.exp(-((x-.102)/.042)**4)+np.exp(-((x+.099)/.042)**4))
    values[forehead]=np.minimum(values[forehead],(cut[forehead]-z[forehead])*12)
    # Average across UV seams so the two cuts meet exactly in geometry.
    _, weld = np.unique(np.round(world,6),axis=0,return_inverse=True)
    sums = np.bincount(weld, weights=values); nums = np.bincount(weld)
    values = sums[weld] / nums[weld]
    keys = list(mesh.shape_keys.key_blocks)
    shapes = np.array([[v.co[:] for v in key.data] for key in keys])
    outputs = []
    restored=set()
    output_area=0.0
    for keep_skin,name in [(True,'SourceBody'),(False,'hair_korean')]:
        verts=[]; polys=[]; tex=[]; ns=[]; origins=[]; vertex_map={}
        for fi,face in enumerate(faces):
            corners=[(int(index),int(index),0.,uv[fi*3+j],normals[fi*3+j]) for j,index in enumerate(face)]
            polygon=[]
            for j,a in enumerate(corners):
                b=corners[(j+1)%3]; va=values[a[0]];vb=values[b[0]]
                ina=(va>=0)==keep_skin; inb=(vb>=0)==keep_skin
                if ina: polygon.append(a)
                if ina!=inb:
                    t=va/(va-vb)
                    normal=a[4]*(1-t)+b[4]*t; normal/=max(np.linalg.norm(normal),1e-12)
                    polygon.append((a[0],b[0],t,a[3]*(1-t)+b[3]*t,normal))
            for j in range(1,len(polygon)-1):
                tri=[polygon[0],polygon[j],polygon[j+1]]; ids=[]
                for a,b,t,u,n in tri:
                    token=(a,) if a==b else (min(a,b),max(a,b),round(t if a<b else 1-t,11))
                    if token not in vertex_map:
                        vertex_map[token]=len(verts)
                        verts.append(positions[a]*(1-t)+positions[b]*t)
                        origins.append((a,b,t))
                    ids.append(vertex_map[token]);tex.append(u);ns.append(n)
                    if a==b:restored.add(a)
                polys.append(ids)
        data=bpy.data.meshes.new(name);data.from_pydata(verts,[],polys);data.update()
        data.materials.append(mesh.materials[0] if keep_skin else mesh.materials[0].copy())
        layer=data.uv_layers.new(name=mesh.uv_layers.active.name)
        layer.data.foreach_set('uv',np.asarray(tex).ravel())
        for p in data.polygons:p.use_smooth=True
        data.normals_split_custom_set(ns)
        obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj)
        obj.matrix_world=source.matrix_world
        a=np.array([x[0] for x in origins]);b=np.array([x[1] for x in origins]);t=np.array([x[2] for x in origins])[:,None]
        for ki,key in enumerate(keys):
            block=obj.shape_key_add(name=key.name)
            block.data.foreach_set('co',(shapes[ki,a]*(1-t)+shapes[ki,b]*t).ravel())
            if ki: block.slider_min=key.slider_min;block.slider_max=key.slider_max;block.value=0
        obj['sourceSurfacePartition']=name
        if keep_skin:obj['sourceBodySliders']=True
        outp=np.array([obj.matrix_world@v.co for v in data.vertices])
        tris=outp[np.array(polys)]
        output_area+=float(np.linalg.norm(np.cross(tris[:,1]-tris[:,0],tris[:,2]-tris[:,0]),axis=1).sum()/2)
        outputs.append(obj)
    source_tri=world[faces]
    source_area=float(np.linalg.norm(np.cross(source_tri[:,1]-source_tri[:,0],source_tri[:,2]-source_tri[:,0]),axis=1).sum()/2)
    assert len(restored)==len(positions), 'A source vertex was lost from both partitions'
    area_error=abs(output_area-source_area)/source_area
    assert area_error<1e-5, area_error
    report={'source_vertices_retained_across_partitions':len(restored),
            'source_surface_area':source_area,'partition_surface_area':output_area,
            'relative_area_error':area_error,'source_keys':[key.name for key in keys],
            'source_texture_hashes':{image.name:hashlib.sha256(image.packed_file.data).hexdigest() for image in bpy.data.images if image.packed_file},
            'forehead_policy':'New closed scalp joins a clean arc above the original eyes; original eyes, cheeks, chin and ears remain.'}
    outputs[0]['sourcePartitionAudit']=json.dumps(report)
    source.hide_render=True;source.hide_set(True)
    return outputs
