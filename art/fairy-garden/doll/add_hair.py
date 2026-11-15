"""Hairstyles = hats on HeadAnchor. One table (HAIRS) and one way to hang a style (hang), shared by the
full assembly (assemble_v2.py) and this migration, which adds one style to the finished doll:
Run: python3 -c "import sys,runpy;sys.argv=['x','--','<id>'];runpy.run_path('add_hair.py',run_name='__main__')"
The label comes from ../hairstyles.json (the one list the runtime and tests pin); the web piece is
v2/web/<file> (fit_shell.py -> shape_hair.py -> compress_asset.py TRIS=18000). Hair is exported separately under apps/fairy-garden/hair/. Use --lazy after the ID
to add it using the deployed body, leaving every other asset untouched."""
import bpy,sys,os,json,runpy
HERE=os.path.dirname(os.path.abspath(__file__))
WEB=os.path.join(HERE,'v2','web')
LABELS_FILE=os.path.join(HERE,'..','hairstyles.json')
HAIRS={'korean':'hair_m03.glb','curtains':'hair_m02.glb','airbang':'hair_f01.glb','bob':'hair_f02.glb','pixie':'hair_m04.glb',
       'fluffy':'hair_h07.glb','longpart':'hair_h08.glb','wolfcut':'hair_wolfcut.glb','sweptback':'hair_sweptback.glb','braids':'hair_braids.glb'}
_slots=runpy.run_path(os.path.join(HERE,'outfit_slots.py'))
_grey=_slots['grey'];_base_image=_slots['base_image']

def hang(hid,anchor):
    before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=os.path.join(WEB,HAIRS[hid]))
    objs=[o for o in bpy.data.objects if o not in before]
    m=next(o for o in objs if o.type=='MESH');mw=m.matrix_world.copy()
    m.parent=anchor;m.matrix_parent_inverse.identity();m.matrix_basis=mw;m.name='hair_'+hid;m['hair']=hid
    grey_images=set()
    for s in m.material_slots:
        s.material=s.material.copy();s.material.name='hair_'+hid
        im=_base_image(s.material)
        if im and im.as_pointer() not in grey_images:
            grey_images.add(im.as_pointer());_grey(s.material)
    for o in objs:
        if o!=m:bpy.data.objects.remove(o)
    return m

def strip_maps(m):
    """Only the base colour carries the clay look (see assemble_v2: phones ran out of texture memory)."""
    for sl in m.material_slots:
        bs=next((n for n in sl.material.node_tree.nodes if n.type=='BSDF_PRINCIPLED'),None)
        if not bs:continue
        for inp in ('Normal','Metallic','Roughness'):
            for l in list(bs.inputs[inp].links):sl.material.node_tree.links.remove(l)
        bs.inputs['Metallic'].default_value=0;bs.inputs['Roughness'].default_value=.85

def main():
    hid=sys.argv[sys.argv.index('--')+1]
    labels=json.load(open(LABELS_FILE))
    if hid not in labels:raise SystemExit('add a label for '+hid+' to hairstyles.json first')
    split=runpy.run_path(os.path.join(HERE,'split_outfits.py'))
    lazy='--lazy' in sys.argv
    if lazy:
        # Add a supplied style to an already deployed doll without rebuilding other assets.
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=os.path.join(HERE,'..','..','..','apps','fairy-garden','doll.glb'))
    else:split['load']()
    if bpy.data.objects.get('hair_'+hid):raise RuntimeError('hair already present: '+hid)
    strip_maps(hang(hid,bpy.data.objects['HeadAnchor']))
    if lazy:
        split['export'](lambda o:o.type=='ARMATURE' or o.name=='HeadAnchor' or o.get('hair')==hid,os.path.join(split['APP'],'hair',hid+'.glb'))
    else:
        bpy.ops.object.select_all(action='SELECT')
        bpy.ops.export_scene.gltf(filepath=split['MASTER'],**{**split['EXPORT'],'use_selection':False})
    app=os.path.join(HERE,'..','..','..','apps','fairy-garden','doll.json');d=json.load(open(app));d['hair']=labels
    with open(app,'w') as f:json.dump(d,f,ensure_ascii=False,indent=1);f.write('\n')
    print('hair added',hid,labels[hid])
    if not lazy:split['split']()

if __name__=='__main__':
    main()
