"""Continue the rabbit bag's shoulder tab over the repaired rounded back.

The original C04 has a shoulder tab but no continuous rear band. Keep every
existing garment vertex/UV/morph and fit a torso-bound, bag-dyed ribbon over it.
"""
import bpy, runpy, numpy as np
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree
HERE=Path(__file__).resolve().parent
NAME='outfit_cardigan_back_strap'


def restore_cardigan_strap(cloth):
    if bpy.data.objects.get(NAME):return
    cloth.data.calc_loop_triangles()
    tree=BVHTree.FromPolygons([v.co for v in cloth.data.vertices],[tuple(t.vertices) for t in cloth.data.loop_triangles],all_triangles=True)
    # Overlap the original shoulder tab, then cross to the pouch's opposite hip.
    points=[];normals=[]
    for i in range(25):
        t=i/24;x=-.047+.175*t;z=.673-.218*t
        hit,n,_,_=tree.ray_cast(Vector((x,1,z)),Vector((0,-1,0)),2)
        assert hit is not None,('Missing cardigan back',x,z)
        points.append((x,hit.y+.0095,z));normals.append((0,1,0))
    points.extend([(.142,.055,.449),(.153,.015,.448),(.150,-.035,.450),(.145,-.070,.457),(.138,-.111,.475)])
    normals.extend([(.6,.8,0),(1,0,0),(.95,-.3,0),(.7,-.7,0),(0,-1,0)])
    ribbon=runpy.run_path(str(HERE/'strap_ribbon.py'))['strap_ribbon']
    section=[(-.009,-.0005),(-.011,0),(-.011,.002),(-.009,.003),(.009,.003),(.011,.002),(.011,0),(.009,-.0005)]
    o=ribbon(NAME,points,normals,section,cloth.parent,taper=4)
    # Reuse the tab's original cream lighting. Its bag colour remains controlled
    # by the common outfit region shader, separately from the sweater knit.
    im=next(n.image for n in cloth.data.materials[0].node_tree.nodes if n.type=='TEX_IMAGE' and n.image)
    W,H=im.size;pixels=np.array(im.pixels[:]).reshape(H,W,4);uv=cloth.data.uv_layers.active.data;colors=[]
    for f in cloth.data.polygons:
        p=f.center
        if not(-.09<p.x<-.02 and p.y>.12 and .65<p.z<.71):continue
        for li in f.loop_indices:
            u=uv[li].uv;c=pixels[min(H-1,max(0,int(u.y*H))),min(W-1,max(0,int(u.x*W))),:3];r,g,b=c**(1/2.2)
            if g-b>max(r-g,.005)*.32:colors.append(c)
    assert colors,'Find the original cream shoulder tab'
    mat=bpy.data.materials.new('Rabbit bag strap cloth');mat.use_nodes=True
    bs=mat.node_tree.nodes['Principled BSDF'];bs.inputs['Base Color'].default_value=(*np.median(colors,axis=0),1);bs.inputs['Roughness'].default_value=.9
    o.data.materials.append(mat)
    attr=o.data.color_attributes.new('slot','FLOAT_COLOR','CORNER')
    for loop in attr.data:loop.color=(.02,0,0,1)
    o['outfit']='cardigan';o['slotBase']=cloth['slotBase'].to_dict();o['backStrapVersion']=1
    o.vertex_groups.new(name='body').add(list(range(len(o.data.vertices))),1,'REPLACE')
    m=o.modifiers.new('Rig','ARMATURE');m.object=cloth.parent
    P=np.array([v.co[:] for v in o.data.vertices]);deform=runpy.run_path(str(HERE/'body_shape.py'))['deform']
    # Fit the full width over the curved knit, keeping the bevel's thickness.
    # All slider offsets still use the same shared torso deformation.
    for i,p in enumerate(P):
        if not(p[1]>.06 and .47<p[2]<.667):continue
        hit=tree.ray_cast(Vector((float(p[0]),1,float(p[2]))),Vector((0,-1,0)),2)[0]
        assert hit is not None,('Missing ribbon edge support',i)
        P[i,1]=hit.y+.0065+section[i%len(section)][1]
    for i,v in enumerate(o.data.vertices):v.co=Vector(P[i])
    o.data.update()
    o.shape_key_add(name='Basis')
    for key in ('height','shoulder','waist','flare','build','head'):
        k=o.shape_key_add(name=key);k.value=0;D=deform(P,np.zeros(len(P)),key,True)
        for i,v in enumerate(k.data):v.co=Vector(P[i]+D[i])
    return o
