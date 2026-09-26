"""Rebuild the rabbit outfit from its continuous source surface.

Weld UV seams before reduction: decimating disconnected UV islands opened holes
at the shoulders, cuffs and hem. The existing shoes and other outfits stay intact.
Source UVs/textures are reused; body sliders share body_shape.deform().
"""
from pathlib import Path
import bpy, bmesh, numpy as np, runpy
from mathutils import Vector
from mathutils.kdtree import KDTree

HERE = Path(__file__).resolve().parent


def restore_cardigan_surface():
    old=bpy.data.objects['outfit_cardigan']
    if old.get('continuousSurfaceVersion'):
        return runpy.run_path(str(HERE / 'rebuild_cardigan_sleeves.py'))['rebuild_cardigan_sleeves'](old)
    assert old.parent and all(name in old.parent.data.bones for name in ('leftForearm', 'rightForearm')), 'Restore the elbow rig first'
    assert bpy.data.objects.get('outfit_cardigan_footwear'), 'Restore separate source footwear before cutting the ankle join'
    rig=old.parent;mat=old.data.materials[0];props={k:(old[k].to_dict() if hasattr(old[k],'to_dict') else old[k].to_list() if hasattr(old[k],'to_list') else old[k]) for k in old.keys() if k!='loweredCollarVersion'}
    # Source surface, before per-UV-island reduction broke its seams.
    before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(HERE / 'v2/outfits/outfit_c04.glb'));imported=set(bpy.data.objects)-before
    raw=max((o for o in imported if o.type=='MESH'),key=lambda o:len(o.data.vertices));raw.data.transform(raw.matrix_world);raw.parent=None;raw.matrix_world.identity()
    bm=bmesh.new();bm.from_mesh(raw.data);uv=bm.loops.layers.uv.active
    bmesh.ops.delete(bm,geom=[f for f in bm.faces if max((l[uv].uv-f.loops[0][uv].uv).length for l in f.loops)<1e-5],context='FACES')
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00002)
    assert not any(e.is_boundary for e in bm.edges), 'Source garment must be closed after seam welding'
    bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),plane_co=(0,0,.14),plane_no=(0,0,1),dist=1e-6,clear_inner=True)
    bm.to_mesh(raw.data);bm.free();bpy.context.view_layer.objects.active=raw
    for modifier in list(raw.modifiers):raw.modifiers.remove(modifier)
    mod=raw.modifiers.new('Continuous source reduction','DECIMATE');mod.ratio=min(1,15000/max(1,len(raw.data.polygons)));bpy.ops.object.modifier_apply(modifier=mod.name)
    check=bmesh.new();check.from_mesh(raw.data)
    assert all(max(v.co.z for v in e.verts)<.141 for e in check.edges if e.is_boundary), 'Reduction opened a clothing seam'
    check.free()
    # Retain the authored colour-slot choices and all source texture coordinates.
    k=KDTree(len(old.data.polygons));old.data.update()
    slots=[];attr=next(a for a in old.data.color_attributes if len({round(d.color[0]*8) for d in a.data})>1)
    for f in old.data.polygons:k.insert(f.center,f.index);slots.append(attr.data[f.loop_indices[0]].color[0])
    k.balance()
    for a in list(raw.data.color_attributes):raw.data.color_attributes.remove(a)
    color=raw.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
    for f in raw.data.polygons:
     f.material_index=0;f.use_smooth=True;_,j,_=k.find(f.center)
     for li in f.loop_indices:color.data[li].color=(slots[j],0,0,1)
    raw.data.materials.clear();raw.data.materials.append(mat)
    for obj in imported-{raw}:bpy.data.objects.remove(obj,do_unlink=True)
    bpy.data.objects.remove(old,do_unlink=True);raw.name='outfit_cardigan';raw.parent=rig
    for key,value in props.items():raw[key]=value
    # Diffuse arm ownership along the welded surface, not across spatially close
    # sleeve/bag layers. Cream pouch texels are torso anchors. The smooth final
    # remap makes cuffs follow the arm while keeping weak torso influence zero.
    o=raw;uv=o.data.uv_layers.active.data;im=next(n.image for n in mat.node_tree.nodes if n.type=='TEX_IMAGE' and n.image);W,H=im.size;tx=np.array(im.pixels[:]).reshape(H,W,4)[:,:,:3]**(1/2.2)
    cols={}
    for f in o.data.polygons:
     for vi,li in zip(f.vertices,f.loop_indices):
      u=uv[li].uv;c=tx[min(H-1,max(0,int(u.y*H))),min(W-1,max(0,int(u.x*W)))];cols.setdefault(vi,[]).append(c)
    def ss(t):t=min(1,max(0,t));return t*t*(3-2*t)
    vs=o.data.vertices;n=len(vs);P=np.array([v.co[:] for v in vs]);C=np.array([np.median(cols[i],0) for i in range(n)]);x,y,z=P.T
    pinned=(np.abs(x)<.10)|(z<.40)|(z>.71)
    accessory=(x>0)&(x<.19)&(y<-.055)&(z<.56)&((C[:,1]-C[:,2])>np.maximum(C[:,0]-C[:,1],.005)*.32)
    pinned|=accessory;armseed=(np.abs(x)>.215)&(z>.43)&(z<.64)&~accessory;pinned|=armseed
    values=np.array([ss((abs(v.co.x)-.105)/.055) for v in vs]);values[pinned]=armseed[pinned]
    E=np.array([tuple(e.vertices) for e in o.data.edges]);a,b=E.T;w=1/np.maximum(np.linalg.norm(P[a]-P[b],axis=1),.001);den=np.bincount(a,weights=w,minlength=n)+np.bincount(b,weights=w,minlength=n)
    for _ in range(450):
     total=np.bincount(a,weights=w*values[b],minlength=n)+np.bincount(b,weights=w*values[a],minlength=n);values[~pinned]=(total/np.maximum(den,1e-9))[~pinned]
    for name in ['leftForearm','rightForearm']:
     if not o.vertex_groups.get(name):o.vertex_groups.new(name=name)
    arms=np.zeros(n)
    for v in vs:
     if v.co.z<.40:continue
     arm=ss((float(values[v.index])-.08)/.47);arms[v.index]=arm;side='left' if v.co.x<0 else 'right';sh=Vector((-.165 if v.co.x<0 else .165,0,.655));axis=Vector((-.11 if v.co.x<0 else .11,0,-.255));along=(v.co-sh).dot(axis)/axis.length_squared;lower=ss((along-.4)/.24)
     for g in o.vertex_groups:g.remove([v.index])
     o.vertex_groups['body'].add([v.index],1-arm,'REPLACE');o.vertex_groups[side+'Arm'].add([v.index],arm*(1-lower),'REPLACE');o.vertex_groups[side+'Forearm'].add([v.index],arm*lower,'REPLACE')
    # Shared shape formula keeps the new continuous seams together at slider extremes.
    o.shape_key_add(name='Basis');deform=runpy.run_path(str(HERE / 'body_shape.py'))['deform']
    for name in ['height','shoulder','waist','flare','build','head']:
     key=o.shape_key_add(name=name);key.value=0;D=deform(P,arms,name,True)
     for i,v in enumerate(key.data):v.co=Vector(P[i]+D[i])
    for key in ['loweredCollar','collarLowered','collarRepair']:
     if key in o:del o[key]
    o['continuousSurfaceVersion'] = 1
    runpy.run_path(str(HERE / 'lower_cardigan_collar.py'))['lower_cardigan_collar'](o)
    for mod in list(o.modifiers):o.modifiers.remove(mod)
    mod=o.modifiers.new('Rig','ARMATURE');mod.object=rig
    return runpy.run_path(str(HERE / 'rebuild_cardigan_sleeves.py'))['rebuild_cardigan_sleeves'](o)


def main():
    import sys
    source, destination = sys.argv[sys.argv.index('--') + 1:]
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=source)
    restore_cardigan_surface()
    bpy.ops.export_scene.gltf(filepath=destination, export_format='GLB',
        export_extras=True, export_skins=True, export_animations=False,
        export_morph=True, export_morph_normal=False, export_image_format='AUTO',
        export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=10,
        export_draco_position_quantization=14, export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12, export_draco_color_quantization=8,
        export_try_sparse_sk=True, export_try_omit_sparse_sk=True)


if __name__ == '__main__':
    main()
