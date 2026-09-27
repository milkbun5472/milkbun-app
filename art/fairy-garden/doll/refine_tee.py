"""Continuous relaxed cotton tee, retaining the denim and authored sneaker detail."""
from pathlib import Path
import bpy,bmesh,numpy as np,runpy,math
from mathutils import Vector,Matrix
HERE=Path(__file__).resolve().parent
shape=runpy.run_path(str(HERE/'body_shape.py'))['deform']
KEYS=('height','shoulder','waist','flare','build','head')

def finish(o,template,arm=0,legs=False):
    o.parent=template.parent;o['outfit']='tee';o['slotBase']=template['slotBase'].to_dict()
    for f in o.data.polygons:f.use_smooth=True
    for g in list(o.vertex_groups):o.vertex_groups.remove(g)
    if legs:
        for name,sign in [('leftLeg',-1),('rightLeg',1)]:
            o.vertex_groups.new(name=name).add([v.index for v in o.data.vertices if v.co.x*sign>0],1,'REPLACE')
    else:o.vertex_groups.new(name='body').add(list(range(len(o.data.vertices))),1,'REPLACE')
    mod=o.modifiers.new('Rig','ARMATURE');mod.object=o.parent
    p=np.array([v.co[:] for v in o.data.vertices]);o.shape_key_add(name='Basis')
    for key in KEYS:
        k=o.shape_key_add(name=key);k.value=0
        k.data.foreach_set('co',(p+shape(p,np.full(len(p),arm),key,True)).ravel())

def cotton(template):
    # One continuous surface: relaxed hem, shallow vertical folds, sloping shoulders.
    profiles=[(.315,.178,.116),(.318,.180,.118),(.324,.180,.118),(.329,.178,.116)]
    profiles += [(float(z),float(np.interp(z,[.36,.48,.59,.655],[.174,.168,.161,.145])),float(np.interp(z,[.36,.48,.59,.655],[.112,.109,.108,.106]))) for z in np.linspace(.36,.655,20)]
    profiles += [(.675,.143,.101),(.694,.125,.090),(.710,.101,.076),(.720,.081,.064),(.726,.080,.061),(.731,.077,.061),(.734,.073,.057),(.734,.066,.050),(.726,.066,.050)]
    n=64;verts=[];faces=[]
    for i,(z,rx,ry) in enumerate(profiles):
        for j in range(n):
            a=j*2*math.pi/n;front=max(0,math.cos(a));fade=max(0,min(1,(.67-z)/.08))
            fold=(.003*math.sin(6*a+z*3)+.0014*math.sin(10*a+z*10))*fade
            hem=.003*math.cos(2*a)*max(0,1-(z-.315)/.10)
            neck=-.021*front*max(0,min(1,(z-.70)/.026))
            neckBlend=max(0,min(1,(z-.675)/.05))
            verts.append(((rx+fold)*math.sin(a)+.004*neckBlend,-(ry+fold)*math.cos(a)+.010*neckBlend,z+hem+neck))
    for i in range(len(profiles)-1):
        for j in range(n):a=i*n+j;b=i*n+(j+1)%n;faces.append((a,b,b+n,a+n))
    # Turn the hem inward, giving it a sewn edge rather than a zero-thickness cut.
    start=len(verts)
    for j in range(n):
        p=Vector(verts[j]);p.x*=.976;p.y*=.976;p.z+=.005;verts.append(p)
    for j in range(n):faces.append((j,start+j,start+(j+1)%n,(j+1)%n))
    mesh=bpy.data.meshes.new('Continuous cotton body');mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new('outfit_tee_cotton',mesh);bpy.context.collection.objects.link(o)
    mesh.materials.append(template.data.materials[0].copy());mesh.uv_layers.new(name='UVMap');mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
    uv=mesh.uv_layers['UVMap'];col=mesh.color_attributes['Color']
    for f in mesh.polygons:
        for li in f.loop_indices:
            vi=mesh.loops[li].vertex_index;p=mesh.vertices[vi].co
            uv.data[li].uv=(.396+.008*((vi%n)/n),.832+.008*max(0,min(1,(p.z-.338)/.36)))
            col.data[li].color=(.02,0,0,1)
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
    bpy.context.view_layer.objects.active=o
    sub=o.modifiers.new("Soft cotton transitions","SUBSURF");sub.levels=1
    bpy.ops.object.modifier_apply(modifier=sub.name)
    finish(o,template);o['continuousCottonVersion']=1
    return o

def refine_tee():
    garment=bpy.data.objects['outfit_tee']
    if garment.get('refinedTeeVersion'):return
    cotton(garment)
    # Keep the authored denim panels, seams, pockets and rolled hems.
    bm=bmesh.new();bm.from_mesh(garment.data);uv=bm.loops.layers.uv.active
    im=next(n.image for n in garment.data.materials[0].node_tree.nodes if n.type=='TEX_IMAGE' and n.image);w,h=im.size;px=np.array(im.pixels[:]).reshape(h,w,4)
    gone=[]
    for f in bm.faces:
        z=f.calc_center_median().z
        u,v=np.mean([l[uv].uv[:] for l in f.loops],0);c=px[int(np.clip(v,0,1)*(h-1)),int(np.clip(u,0,1)*(w-1)),:3]**(1/2.2)
        denim=c[2]>c[0]+.01 and c[0]<.72
        if z>.36 or z>.29 and not denim or f.material_index>0:gone.append(f)
    bmesh.ops.delete(bm,geom=gone,context='FACES');bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS')
    bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),plane_co=(0,0,.332),plane_no=(0,0,1),dist=1e-6,clear_outer=True)
    # Tuck the waistband beneath the cotton hem without flattening lower denim details.
    for v in bm.verts:
        w=max(0,min(1,(v.co.z-.285)/.03));scale=1-.05*w*w*(3-2*w)
        v.co.x*=scale;v.co.y*=scale
        for layer in bm.verts.layers.shape.values():v[layer].x*=scale;v[layer].y*=scale
    bm.to_mesh(garment.data);bm.free()
    garment['skinCoverage']['torsoBelow']=.708
    runpy.run_path(str(HERE/'restore_suit_footwear.py'))['restore_source_footwear']('tee','hunyuan-c07-shell.glb')
    garment['refinedTeeVersion']=1

if __name__=='__main__':
    split=runpy.run_path(str(HERE/'split_outfits.py'));split['load']();refine_tee()
    split['export'](lambda o:True,split['MASTER']);split['export'](lambda o:o.type=='ARMATURE' or o.get('outfit')=='tee',str(Path(split['APP'])/'outfits/tee.glb'))
