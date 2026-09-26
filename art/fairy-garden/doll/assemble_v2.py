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
HERE=os.path.dirname(os.path.abspath(__file__));V2=os.path.join(HERE,'v2');WEB=os.path.join(V2,os.environ.get('PIECES','web'))   # PIECES=hd: the 陪伴 pet build
APP=os.path.join(HERE,'..','..','..','apps','fairy-garden')
LABELS=json.load(open(os.path.join(HERE,'..','hairstyles.json')))  # the one hair list (tests pin runtime to it)
HAIRS={'korean':'hair_m03.glb','curtains':'hair_m02.glb','airbang':'hair_f01.glb','bob':'hair_f02.glb','pixie':'hair_m04.glb'}
OUTFIT_LABELS={'academy':'学院背心','garden':'背带连衣裙','ranger':'连帽卫衣工装裤','cardigan':'小兔毛衣'};OUTFITS={'academy':'outfit_c01.glb','garden':'outfit_c02.glb','ranger':'outfit_c03.glb','cardigan':'outfit_c04.glb'}
# per outfit: which colour slots exist (a dress has no separate 'bottom'), shoe colour
OUTFIT_OPTS={'academy':dict(bottom=True,shoe='#4a3a32'),'garden':dict(bottom=False,accent=False,shoe='#3b2b25'),'ranger':dict(bottom=True,accent=True,shoe='#5a4a3e'),'cardigan':dict(bottom=True,accent=False,shoe=None,bottom_z=.33,bottom_pale_z=.42,under='cloth',sole_z=.085,no_trim=True)}
SLOTS=['cloth','trim','bottom','accent']
FACES={'default':'平常','happy':'开心','cozy':'惬意','relax':'放松','surprise':'惊讶','amazed':'哇','proud':'得意','gloomy':'低落','sad':'难过','irritated':'不耐烦'}
# Slider ranges (1 = neutral). A shape key is the offset at value 2, the runtime feeds value-1.
DIMS=[('height','腿长',.85,1.25,'短一点','长一点'),('shoulder','肩宽',.85,1.2,'窄一点','宽一点'),('waist','腰身',.85,1.15,'纤细','丰盈'),
      ('flare','衣摆',.78,1.22,'收拢','蓬松'),('build','圆润度',.85,1.15,'轻巧','圆润'),('head','头身比',.88,1.1,'小一点','大一点')]
import runpy
_shape = runpy.run_path(os.path.join(HERE, 'body_shape.py'))
HC, ss, deform = (_shape[k] for k in ('HC', 'ss', 'deform'))
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
base_image=runpy.run_path(os.path.join(HERE,'outfit_slots.py'))['base_image']
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
_slots=runpy.run_path(os.path.join(HERE,'outfit_slots.py'))
arm_weights,colour_slots=_slots['arm_weights'],_slots['colour_slots']
catalog={}
for oid,f in OUTFITS.items():
    objs=imp(os.path.join(WEB,f));m=next(o for o in objs if o.type=='MESH' and o.name.startswith('Outfit'))
    m.parent=A;m.matrix_parent_inverse.identity()
    for md in m.modifiers:
        if md.type=='ARMATURE':md.object=A
    m.name='outfit_'+oid;m['outfit']=oid
    catalog[oid]={'label':OUTFIT_LABELS[oid],'colors':colour_slots(m,OUTFIT_OPTS[oid]['bottom'],OUTFIT_OPTS[oid].get('accent',True),OUTFIT_OPTS[oid])}
    m['slotBase']=catalog[oid]['colors']
    for o in objs:
        if o!=m:bpy.data.objects.remove(o)
# The same authored footwear builder is used by full assembly and asset migration.
import runpy
build_shoes=runpy.run_path(os.path.join(HERE,'shoes.py'))['build_shoes']
shoes=[]
for oid in OUTFITS:
    colour=OUTFIT_OPTS[oid]['shoe']
    if colour:
        shoes.extend(build_shoes(oid,A,colour))
        catalog[oid]['colors']['boots']=colour
# shape keys
for o in [B]+[bpy.data.objects['outfit_'+k] for k in OUTFITS]:
    P=np.array([v.co[:] for v in o.data.vertices]);arm=arm_weights(o);o.shape_key_add(name='Basis')
    for key,*_ in DIMS:
        k=o.shape_key_add(name=key);k.value=0;D=deform(P,arm,key,o!=B)
        for i,v in enumerate(k.data):v.co=Vector(P[i]+D[i])
A['rigMorphs']=rig_morphs()
# skin base: median of the body texture's skin-toned texels
im=base_image(B.material_slots[0].material);px=np.array(im.pixels[:]).reshape(-1,4)[::5,:3]**(1/2.2)
sk=px[(px[:,0]>.6)&(px[:,0]>px[:,2]+.05)];B['skinBase']='#%02x%02x%02x'%tuple(int(v*255) for v in np.median(sk,0))
# Only the base colour carries the clay look on hair and clothes; their normal and metal-roughness
# maps cost two more decoded textures each (the 陪伴 page ran phones out of memory: 30 textures).
for o in bpy.data.objects:
    if o.type!='MESH' or o is B:continue
    for sl in o.material_slots:
        m=sl.material
        if not m or not m.use_nodes:continue
        bs=next((n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
        if not bs:continue
        for inp in ('Normal','Metallic','Roughness'):
            for l in list(bs.inputs[inp].links):m.node_tree.links.remove(l)
        bs.inputs['Metallic'].default_value=0;bs.inputs['Roughness'].default_value=.85
# Share the articulated arm rig with the post-assembly migration.
import runpy
runpy.run_path(os.path.join(HERE, 'restore_cardigan_shoes.py'))['restore_cardigan_shoes']()
runpy.run_path(os.path.join(HERE, 'add_elbows.py'))['add_elbows']()
# Outfits added after the elbow rig (C05 on): the same add_outfit() the single-outfit migration runs.
_extra=runpy.run_path(os.path.join(HERE,'add_outfit.py'))
for oid in _extra['EXTRA']:catalog[oid]=_extra['add_outfit'](oid)
bpy.ops.object.select_all(action='SELECT')
out=os.environ.get('OUT') or os.path.join(APP,'doll.glb')
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',use_selection=True,export_extras=True,export_skins=True,export_animations=False,
    export_morph=True,export_morph_normal=False,export_image_format='WEBP',export_draco_mesh_compression_enable=True,export_draco_mesh_compression_level=10,
    export_draco_position_quantization=12,export_draco_normal_quantization=8,export_draco_texcoord_quantization=11,export_draco_color_quantization=6,
    export_try_sparse_sk=True,export_try_omit_sparse_sk=True)
print('wrote',out,os.path.getsize(out)//1024,'KB skinBase',B['skinBase'],catalog)
if os.environ.get('OUT'):sys.exit(0)   # the pet build only writes its glb; catalogues stay the garden's
dj=os.path.join(APP,'doll.json');d=json.load(open(dj))
d['hair']=LABELS;d['outfits']=catalog;d['faces']=FACES;d['style']='hunyuan-v2-2026-09'
d['dims']=[dict(key=k,label=l,min=a,max=b,low=lo,high=hi) for k,l,a,b,lo,hi in DIMS]
with open(dj,'w') as f:json.dump(d,f,ensure_ascii=False,indent=1);f.write('\n')
with open(os.path.join(APP,'outfits.mjs'),'w') as f:f.write('// Generated by art/fairy-garden/doll/assemble_v2.py.\nexport const OUTFITS = '+json.dumps(catalog,ensure_ascii=False)+';\n')
