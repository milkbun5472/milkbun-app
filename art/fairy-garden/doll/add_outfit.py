"""Add one more skinned outfit to the finished doll without re-running the full assembly.
The full doll already carries hand repairs (elbows, cuffs, shoes, straps); rebuilding it from the web
pieces would drop them, so a new outfit is attached to the existing rig instead:
colour slots (outfit_slots.py), the six body-shape keys (body_shape.py), sleeve weights and forearm
split (add_elbows.py), covered skin under the garment. assemble_v2.py calls the same add_outfit().
Run: python3 -c "import sys,runpy;sys.argv=['x','--','<id>'];runpy.run_path('add_outfit.py',run_name='__main__')"
(or Blender -b --python add_outfit.py -- <id>): adds it to the full doll (split_outfits.MASTER), writes
doll.json / outfits.mjs, then splits the app files (doll.glb + outfits/<id>.glb, loaded on demand)."""
import bpy,sys,os,json,runpy,numpy as np
from mathutils import Vector
HERE=os.path.dirname(os.path.abspath(__file__))
APP=os.path.join(HERE,'..','..','..','apps','fairy-garden')
WEB=os.path.join(HERE,'v2','web')
# id -> web piece, label, colour-slot options (see outfit_slots.colour_slots), skin hidden under it.
# skinCoverage is in three.js rest space (Y up): torso skin between torsoAbove and torsoBelow is
# discarded, arm skin closer to the shoulder than sleeve[0] along armAxis is discarded.
EXTRA={
 'jacket':dict(file='outfit_c05.glb',label='短夹克工装裤',bottom=True,accent=False,
    opts=dict(sole_z=.075,trim_lum=.78),
    coverage={'torsoAbove':0.0,'torsoBelow':0.705,'sleeve':[0.2,0.0,0.76,0.1],'armAxis':[0.153,0.655,0.095,-0.19]},feet=.12,
    # the shell's own sleeves tear when the whole arm lifts: cut them and author round ones
    # (round_sleeves.py, as C01-C04) from one clean jacket texel patch
    sleeves=dict(atlas=(.156,.953,.008,.008),slot=.02)),
 'suit':dict(file='outfit_c06.glb',label='小西装短裤',bottom=True,accent=False,
    opts=dict(trim_lum=.6),   # shaded white shirt and socks share the trim slot; the black shoes follow the shorts
    coverage={'torsoAbove':0.0,'torsoBelow':0.705,'sleeve':[0.2,0.0,0.76,0.1],'armAxis':[0.153,0.655,0.095,-0.19]},feet=.14,
    sleeves=dict(atlas=(.031,.859,.008,.008),slot=.02,scrap_z=.25)),   # longer sleeves: cuff scraps hang lower
}
_slots=runpy.run_path(os.path.join(HERE,'outfit_slots.py'))
_deform=runpy.run_path(os.path.join(HERE,'body_shape.py'))['deform']
_elbows=runpy.run_path(os.path.join(HERE,'add_elbows.py'))
DIM_KEYS=['height','shoulder','waist','flare','build','head']

def cut_sleeves(m,scrap_z=.33):
    """Remove the shell's own sleeves and pin everything
    above the hips to the torso; trousers keep leg weights. The round sleeve root covers the armhole."""
    import bmesh
    bm=bmesh.new();bm.from_mesh(m.data)
    # glTF splits vertices at UV seams: weld first so a cut never leaves a loose half-face
    bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00002)
    # everything outside the torso side is sleeve, sleeve root or a cuff scrap bridged onto the hem;
    # side_lining() closes the flank this opens under a lifted arm
    def sleeve(f):
        c=f.calc_center_median()
        return abs(c.x)>.2 and c.z>scrap_z or abs(c.x)>.17 and c.z>.40
    gone={f for f in bm.faces if sleeve(f)}
    bmesh.ops.delete(bm,geom=list(gone),context='FACES')
    # small loose bits left beside the hands (cuff lining, shirt-cuff edges) once the sleeve is gone
    seen=set();scraps=[]
    for v0 in bm.verts:
        if v0 in seen:continue
        part=[];st=[v0];seen.add(v0)
        while st:
            v=st.pop();part.append(v)
            for e in v.link_edges:
                w=e.other_vert(v)
                if w not in seen:seen.add(w);st.append(w)
        c=sum((v.co for v in part),Vector())/len(part)
        if len(part)<200 and abs(c.x)>.14 and c.z>.3:scraps+=part
    bmesh.ops.delete(bm,geom=scraps,context='VERTS')
    bm.to_mesh(m.data);bm.free()
    for v in m.data.vertices:
        if v.co.z>.40 or any(m.vertex_groups[g.group].name.endswith('Arm') and g.weight>.01 for g in v.groups):
            for g in m.vertex_groups:g.remove([v.index])
            m.vertex_groups['body'].add([v.index],1,'REPLACE')
    print('sleeves cut',len(gone),'scrap verts',len(scraps))

def side_lining(o,atlas,slot):
    """A thin jacket-coloured copy of the body's flanks under the armpits, pinned to the torso:
    with the sleeves cut away and torso skin hidden, a lifted arm would otherwise show a hole there."""
    import bmesh
    body=bpy.data.objects['DollBody'];rig=o.parent
    arm_groups={g.index for g in body.vertex_groups if g.name.endswith(('Arm','Forearm'))}
    bm=bmesh.new();bm.from_mesh(body.data);bm.normal_update();dl=bm.verts.layers.deform.active
    arm=lambda v:sum(w for g,w in v[dl].items() if g in arm_groups)
    keep=lambda f:.38<f.calc_center_median().z<.69 and abs(f.normal.x)>.45 and max(arm(v) for v in f.verts)<.5
    bmesh.ops.delete(bm,geom=[f for f in bm.faces if not keep(f)],context='FACES')
    for v in bm.verts:v.co+=v.normal*.004
    mesh=bpy.data.meshes.new('SideLining');bm.to_mesh(mesh);bm.free()
    s=bpy.data.objects.new('outfit_'+o['outfit']+'_side_lining',mesh);bpy.context.collection.objects.link(s);s.parent=rig
    s['outfit']=o['outfit'];s['slotBase']=o['slotBase'].to_dict() if hasattr(o['slotBase'],'to_dict') else dict(o['slotBase'])
    mesh.materials.clear();mesh.materials.append(o.data.materials[0].copy())
    for l in list(mesh.uv_layers):mesh.uv_layers.remove(l)
    for a in list(mesh.color_attributes):mesh.color_attributes.remove(a)
    mesh.uv_layers.new(name='UVMap');mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
    uv=mesh.uv_layers['UVMap'];color=mesh.color_attributes['Color']
    for f in mesh.polygons:
        f.use_smooth=True
        for li in f.loop_indices:uv.data[li].uv=(atlas[0]+atlas[2]/2,atlas[1]+atlas[3]/2);color.data[li].color=(slot,0,0,1)
    g=s.vertex_groups.new(name='body');g.add(list(range(len(mesh.vertices))),1,'REPLACE')
    mod=s.modifiers.new('Rig','ARMATURE');mod.object=rig
    if mesh.shape_keys:
        for k in list(mesh.shape_keys.key_blocks)[::-1]:s.shape_key_remove(k)
    P=np.array([v.co[:] for v in mesh.vertices]);s.shape_key_add(name='Basis')
    for key in DIM_KEYS:
        k=s.shape_key_add(name=key);k.value=0;D=_deform(P,np.zeros(len(P)),key,True)
        for i,v in enumerate(k.data):v.co=Vector(P[i]+D[i])
    print('side lining faces',len(mesh.polygons))

def add_outfit(oid):
    cfg=EXTRA[oid]
    if bpy.data.objects.get('outfit_'+oid):raise RuntimeError('outfit already present: '+oid)
    rig=next(o for o in bpy.data.objects if o.type=='ARMATURE' and o.get('elbowRig'))
    body=bpy.data.objects['DollBody']
    before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=os.path.join(WEB,cfg['file']))
    new=[o for o in bpy.data.objects if o not in before]
    m=next(o for o in new if o.type=='MESH' and o.name.startswith('Outfit'))
    for o in new:
        if o is not m:bpy.data.objects.remove(o)
    mw=m.matrix_world.copy();m.parent=rig;m.matrix_parent_inverse.identity();m.matrix_world=mw
    for md in m.modifiers:
        if md.type=='ARMATURE':md.object=rig
    m.name='outfit_'+oid;m['outfit']=oid
    colors=_slots['colour_slots'](m,cfg['bottom'],cfg['accent'],cfg['opts'])
    m['slotBase']=colors
    if cfg.get('sleeves'):cut_sleeves(m,cfg['sleeves'].get('scrap_z',.33))
    P=np.array([v.co[:] for v in m.data.vertices]);arm=_slots['arm_weights'](m);m.shape_key_add(name='Basis')
    for key in DIM_KEYS:
        k=m.shape_key_add(name=key);k.value=0;D=_deform(P,arm,key,True)
        for i,v in enumerate(k.data):v.co=Vector(P[i]+D[i])
    # only the base colour carries the clay look (see assemble_v2: phones ran out of texture memory)
    for sl in m.material_slots:
        bs=next((n for n in sl.material.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
        if not bs:continue
        for inp in ('Normal','Metallic','Roughness'):
            for l in list(bs.inputs[inp].links):sl.material.node_tree.links.remove(l)
        bs.inputs['Metallic'].default_value=0;bs.inputs['Roughness'].default_value=.85
    m['skinCoverage']=cfg['coverage'];m['coversFeetBelow']=cfg['feet']
    if cfg.get('sleeves'):
        runpy.run_path(os.path.join(HERE,'round_sleeves.py'))['round_sleeves'](m,None,cfg['sleeves']['atlas'],cfg['sleeves']['slot'],inset=.012)
        m['roundSleeveVersion']=1
        side_lining(m,cfg['sleeves']['atlas'],cfg['sleeves']['slot'])
        runpy.run_path(os.path.join(HERE,'fit_cuffs.py'))['fit_cuffs']()
        runpy.run_path(os.path.join(HERE,'repair_added_outfits.py'))['repair_outfit'](oid,cfg)
    else:
        _elbows['resample_sleeves'](m,body)
        _elbows['split_forearms'](m,rig,_elbows['arm_ends'](rig))
    if oid == 'suit':
        runpy.run_path(os.path.join(HERE,'restore_suit_footwear.py'))['restore_suit_footwear']()
    return {'label':cfg['label'],'colors':colors}

def write_catalog(oid,entry):
    dj=os.path.join(APP,'doll.json');d=json.load(open(dj))
    d['outfits'][oid]=entry
    with open(dj,'w') as f:json.dump(d,f,ensure_ascii=False,indent=1);f.write('\n')
    with open(os.path.join(APP,'outfits.mjs'),'w') as f:f.write('// Generated by art/fairy-garden/doll/assemble_v2.py.\nexport const OUTFITS = '+json.dumps(d['outfits'],ensure_ascii=False)+';\n')

def main():
    oid=sys.argv[sys.argv.index('--')+1]
    split=runpy.run_path(os.path.join(HERE,'split_outfits.py'))
    split['load']()
    entry=add_outfit(oid)
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=split['MASTER'],**{**split['EXPORT'],'use_selection':False})
    print('outfit added',oid,entry)
    write_catalog(oid,entry)
    split['split']()

if __name__=='__main__':
    main()
