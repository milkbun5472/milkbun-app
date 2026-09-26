"""Build the app's doll.glb from the v2 web pieces (already decimated by compress_asset.py).
- one skinned body (bones leftArm/rightArm/leftLeg/rightLeg; pivots in extras dollRig);
- hair hats on HeadAnchor, named hair_<id>, base colour neutralised to grey (runtime dyes it);
- outfits skinned to the same armature, extras outfit=<id>; every face carries a colour-slot
  index in COLOR_0.r (0 cloth / 1 trim / 2 bottom / 3 accent) so the runtime can recolour
  vest, shirt, shorts and tie separately while keeping the knit/folds of the texture;
- body shape sliders as shape keys (height/shoulder/waist/flare/build/head) on the body AND
  on every outfit, from ONE deform() so clothes follow the body; pivot / HeadAnchor offsets per
  slider go to extras rigMorphs (runtime moves the bones and re-binds);
- extras skinBase on DollBody: the texture's own skin colour, so a chosen skin tint = ratio.
Writes apps/fairy-garden/doll.glb, doll.json (hair names from ../hairstyles.json, dims, faces,
outfits) and outfits.mjs. Expression textures: bake_faces separately into apps/fairy-garden/faces/.
Usage: python3 assemble_v2.py"""
import bpy,sys,os,json,bmesh,numpy as np
from mathutils import Vector
HERE=os.path.dirname(os.path.abspath(__file__));V2=os.path.join(HERE,'v2');WEB=os.path.join(V2,'web')
APP=os.path.join(HERE,'..','..','..','apps','fairy-garden')
LABELS=json.load(open(os.path.join(HERE,'..','hairstyles.json')))  # the one hair list (tests pin runtime to it)
HAIRS={'korean':'hair_m03.glb','curtains':'hair_m02.glb','airbang':'hair_f01.glb','bob':'hair_f02.glb','pixie':'hair_m04.glb'}
OUTFIT_LABELS={'academy':'学院背心','garden':'背带连衣裙','ranger':'连帽卫衣工装裤'};OUTFITS={'academy':'outfit_c01.glb','garden':'outfit_c02.glb','ranger':'outfit_c03.glb'}
# per outfit: which colour slots exist (a dress has no separate 'bottom'), shoe colour
OUTFIT_OPTS={'academy':dict(bottom=True,shoe='#4a3a32'),'garden':dict(bottom=False,accent=False,shoe='#3b2b25'),'ranger':dict(bottom=True,accent=True,shoe='#5a4a3e')}
SLOTS=['cloth','trim','bottom','accent']
FACES={'default':'平常','happy':'开心','cozy':'惬意','relax':'放松','surprise':'惊讶','amazed':'哇','proud':'得意','gloomy':'低落','sad':'难过','irritated':'不耐烦'}
# Slider ranges (1 = neutral). A shape key is the offset at value 2, the runtime feeds value-1.
DIMS=[('height','腿长',.85,1.25,'短一点','长一点'),('shoulder','肩宽',.85,1.2,'窄一点','宽一点'),('waist','腰身',.85,1.15,'纤细','丰盈'),
      ('flare','衣摆',.78,1.22,'收拢','蓬松'),('build','圆润度',.85,1.15,'轻巧','圆润'),('head','头身比',.88,1.1,'小一点','大一点')]
HC=np.array([.00436,.01302,.94833])   # skull centre (HeadAnchor)
ss=lambda t:(lambda u:u*u*(3-2*u))(np.clip(t,0,1))
def deform(P,arm,key,outfit):
    """Offsets at slider value 2 for points P (Blender Z-up, doll space). arm = arm weight."""
    x,y,z=P[:,0],P[:,1],P[:,2];D=np.zeros_like(P);head=ss((z-.70)/.06);sx=np.sign(x)
    if key=='height':D[:,2]=.25*ss(z/.30)
    elif key=='shoulder':
        # the shoulder cap moves sideways as one piece with the arm (scaling it squashed the slope: 'no shoulders')
        cap=ss((z-.50)/.12)*(1-head)*ss((np.abs(x)-.04)/.08);D[:,0]=sx*.072*np.maximum(arm,cap)
    elif key=='waist':
        w=np.clip(1-np.abs(z-.50)/.15,0,1)*(1-arm);D[:,0]=x*.8*w;D[:,1]=y*.5*w
    elif key=='flare':
        if outfit:w=ss((.45-z)/.25)*(1-arm)*(z>.30);D[:,0]=x*.9*w;D[:,1]=y*.6*w
    elif key=='build':
        # rounder / lighter body, but the shoulder line keeps its width (the arms only follow the chest a little)
        b=(1-head)*(1-.7*ss((z-.55)/.10));D[:,0]=np.where(arm>.5,sx*.165*.6*.3,x*.6*b);D[:,1]=y*.55*b*(1-arm)
    elif key=='head':
        D=(P-HC)*head[:,None]*1.0
    return D
RIG={'leftArm':np.array([-.165,0,.655]),'rightArm':np.array([.165,0,.655]),'leftLeg':np.array([-.075,0,.30]),'rightLeg':np.array([.075,0,.30]),'HeadAnchor':HC}
def rig_morphs():
    out={}
    for lab,p in RIG.items():
        arm=np.array([1. if 'Arm' in lab else 0.])
        out[lab]={}
        for key,*_ in DIMS:
            d=deform(p[None],arm,key,False)[0]
            if lab=='HeadAnchor' and key=='head':d=np.zeros(3)   # the head grows around the anchor: scale, not move
            if lab=='HeadAnchor':d=d+deform(p[None]+[0,0,-.2],arm,key,False)[0]*(key=='height')*0   # (height already in d)
            if np.abs(d).max()>1e-6:out[lab][key]=[round(d[0],5),round(d[2],5),round(-d[1],5)]   # three.js Y-up
    out['HeadAnchor']['scale']={'head':1.0}
    return out

for o in list(bpy.data.objects):bpy.data.objects.remove(o)
def imp(p):
    before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=p);return [o for o in bpy.data.objects if o not in before]
new=imp(os.path.join(WEB,'doll-rigged.glb'))
A=next(o for o in new if o.type=='ARMATURE');HA=bpy.data.objects['HeadAnchor'];B=bpy.data.objects['DollBody']
for o in new:
    if o.type=='MESH' and o.name.startswith('Icosphere'):bpy.data.objects.remove(o)
def base_image(mat):
    for n in mat.node_tree.nodes:
        if n.type=='BSDF_PRINCIPLED':
            l=n.inputs['Base Color'].links
            return l[0].from_node.image if l else None
def grey(mat):
    im=base_image(mat)
    if not im:return
    px=np.array(im.pixels[:]).reshape(-1,4);y=px[:,:3]@[.2126,.7152,.0722]
    y=np.clip(y/np.percentile(y,92),0,1);px[:,:3]=y[:,None];im.pixels[:]=px.ravel();im.pack()
for hid,f in HAIRS.items():
    objs=imp(os.path.join(WEB,f));m=next(o for o in objs if o.type=='MESH');mw=m.matrix_world.copy()
    m.parent=HA;m.matrix_parent_inverse.identity();m.matrix_basis=mw;m.name='hair_'+hid;m['hair']=hid
    for s in m.material_slots:
        s.material=s.material.copy();s.material.name='hair_'+hid;grey(s.material)
    for o in objs:
        if o!=m:bpy.data.objects.remove(o)
def arm_weights(o):
    gi={g.name:g.index for g in o.vertex_groups};w=np.zeros(len(o.data.vertices))
    for v in o.data.vertices:
        for g in v.groups:
            if g.group in (gi.get('leftArm'),gi.get('rightArm')):w[v.index]+=g.weight
    return np.clip(w,0,1)
def colour_slots(o,bottom=True,accent=True):
    """Per-face slot from the face's own texels, then 2 rounds of neighbour majority."""
    im=base_image(o.material_slots[0].material);W,H=im.size;tex=np.array(im.pixels[:]).reshape(H,W,4)[:,:,:3]**(1/2.2)
    bm=bmesh.new();bm.from_mesh(o.data);bm.faces.ensure_lookup_table();uv=bm.loops.layers.uv.active
    slot={}
    for f in bm.faces:
        U=np.array([l[uv].uv[:] for l in f.loops]+[np.mean([l[uv].uv[:] for l in f.loops],0)])
        c=np.median(tex[np.clip((U[:,1]*H).astype(int),0,H-1),np.clip((U[:,0]*W).astype(int),0,W-1)],0)
        z=f.calc_center_median().z;lum=c@[.2126,.7152,.0722]
        s=2 if bottom and z<.34 and abs(f.calc_center_median().x)<.2 else 3 if accent and c[0]-c[2]>.12 else 1 if lum>.92 else 0
        if f.material_index==1:s=1   # the under-layer is shirt coloured
        slot[f.index]=s
    for _ in range(2):
        new={}
        for f in bm.faces:
            nb=[slot[k.index] for e in f.edges for k in e.link_faces if k!=f]
            new[f.index]=max(set(nb),key=nb.count) if nb and nb.count(slot[f.index])==0 and slot[f.index]!=3 else slot[f.index]
        slot=new
    for a in list(o.data.color_attributes):o.data.color_attributes.remove(a)
    ca=o.data.color_attributes.new('slot','BYTE_COLOR','CORNER');o.data.color_attributes.active_color=ca;o.data.color_attributes.render_color_index=0
    for pl in o.data.polygons:
        for li in pl.loop_indices:ca.data[li].color=(slot[pl.index]/4+.02,0,0,1)
    base={}
    for k in range(4):
        fs=[f for f in bm.faces if slot[f.index]==k]
        if not fs:continue
        U=np.array([np.mean([l[uv].uv[:] for l in f.loops],0) for f in fs])
        c=np.median(tex[np.clip((U[:,1]*H).astype(int),0,H-1),np.clip((U[:,0]*W).astype(int),0,W-1)],0)
        base[SLOTS[k]]='#%02x%02x%02x'%tuple(int(round(v*255)) for v in np.clip(c,0,1))
    bm.free();return base
catalog={}
for oid,f in OUTFITS.items():
    objs=imp(os.path.join(WEB,f));m=next(o for o in objs if o.type=='MESH' and o.name.startswith('Outfit'))
    m.parent=A;m.matrix_parent_inverse.identity()
    for md in m.modifiers:
        if md.type=='ARMATURE':md.object=A
    m.name='outfit_'+oid;m['outfit']=oid
    catalog[oid]={'label':OUTFIT_LABELS[oid],'colors':colour_slots(m,OUTFIT_OPTS[oid]['bottom'],OUTFIT_OPTS[oid].get('accent',True))}
    m['slotBase']=catalog[oid]['colors']
    for o in objs:
        if o!=m:bpy.data.objects.remove(o)
# Shoes (the Hunyuan outfit came without any): a copy of the doll's own feet below SHOE_Z, pushed out
# along the normals, soles flattened; same bone weights, so they walk with the feet. Plain colour, slot 'boots'.
SHOE_Z=.085
def make_shoes(oid,colour='#4a3a32'):
    S=B.copy();S.data=B.data.copy();bpy.context.collection.objects.link(S);S.name='outfit_'+oid+'_shoes'
    bm=bmesh.new();bm.from_mesh(S.data);bm.normal_update()
    bmesh.ops.delete(bm,geom=[f for f in bm.faces if any(v.co.z>SHOE_Z for v in f.verts)],context='FACES')
    for v in bm.verts:
        n=v.normal.copy();v.co+=n*(.012 if v.co.z>.012 else .006)
        if v.co.z<.004:v.co.z=-.003          # a flat sole
    bm.to_mesh(S.data);bm.free()
    mat=bpy.data.materials.new('shoes_'+oid);mat.use_nodes=True;bsdf=mat.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value=(*[int(colour[i:i+2],16)/255 for i in (1,3,5)],1);bsdf.inputs['Roughness'].default_value=.7
    S.data.materials.clear();S.data.materials.append(mat);S['outfit']=oid;S['colorSlot']='boots';catalog[oid]['colors']['boots']=colour
    for c in list(S.data.color_attributes):S.data.color_attributes.remove(c)
    return S
shoes=[make_shoes(k,OUTFIT_OPTS[k]['shoe']) for k in OUTFITS]
# shape keys
for o in [B]+[bpy.data.objects['outfit_'+k] for k in OUTFITS]+shoes:
    P=np.array([v.co[:] for v in o.data.vertices]);arm=arm_weights(o);o.shape_key_add(name='Basis')
    for key,*_ in DIMS:
        k=o.shape_key_add(name=key);k.value=0;D=deform(P,arm,key,o!=B)
        for i,v in enumerate(k.data):v.co=Vector(P[i]+D[i])
A['rigMorphs']=rig_morphs()
# skin base: median of the body texture's skin-toned texels
im=base_image(B.material_slots[0].material);px=np.array(im.pixels[:]).reshape(-1,4)[::5,:3]**(1/2.2)
sk=px[(px[:,0]>.6)&(px[:,0]>px[:,2]+.05)];B['skinBase']='#%02x%02x%02x'%tuple(int(v*255) for v in np.median(sk,0))
bpy.ops.object.select_all(action='SELECT')
out=os.path.join(APP,'doll.glb')
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',use_selection=True,export_extras=True,export_skins=True,export_animations=False,
    export_morph=True,export_morph_normal=False,export_image_format='WEBP',export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=7)
print('wrote',out,os.path.getsize(out)//1024,'KB skinBase',B['skinBase'],catalog)
dj=os.path.join(APP,'doll.json');d=json.load(open(dj))
d['hair']=LABELS;d['outfits']=catalog;d['faces']=FACES;d['style']='hunyuan-v2-2026-09'
d['dims']=[dict(key=k,label=l,min=a,max=b,low=lo,high=hi) for k,l,a,b,lo,hi in DIMS]
with open(dj,'w') as f:json.dump(d,f,ensure_ascii=False,indent=1);f.write('\n')
with open(os.path.join(APP,'outfits.mjs'),'w') as f:f.write('// Generated by art/fairy-garden/doll/assemble_v2.py.\nexport const OUTFITS = '+json.dumps(catalog,ensure_ascii=False)+';\n')
