"""Hairstyles = hats on HeadAnchor. One table (HAIRS) and one way to hang a style (hang), shared by the
full assembly (assemble_v2.py) and this migration, which adds one style to the finished doll:
Run: python3 -c "import sys,runpy;sys.argv=['x','--','<id>'];runpy.run_path('add_hair.py',run_name='__main__')"
The label comes from ../hairstyles.json (the one list the runtime and tests pin); the web piece is
v2/web/<file> (fit_shell.py -> shape_hair.py -> compress_asset.py TRIS=18000). Hair stays in the base
doll.glb (always downloaded); split_outfits.py refreshes the app files afterwards."""
import bpy,sys,os,json,runpy
HERE=os.path.dirname(os.path.abspath(__file__))
WEB=os.path.join(HERE,'v2','web')
LABELS_FILE=os.path.join(HERE,'..','hairstyles.json')
HAIRS={'korean':'hair_m03.glb','curtains':'hair_m02.glb','airbang':'hair_f01.glb','bob':'hair_f02.glb','pixie':'hair_m04.glb',
       'fluffy':'hair_h07.glb','longpart':'hair_h08.glb'}
_grey=runpy.run_path(os.path.join(HERE,'outfit_slots.py'))['grey']

def hang(hid,anchor):
    before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=os.path.join(WEB,HAIRS[hid]))
    objs=[o for o in bpy.data.objects if o not in before]
    m=next(o for o in objs if o.type=='MESH');mw=m.matrix_world.copy()
    m.parent=anchor;m.matrix_parent_inverse.identity();m.matrix_basis=mw;m.name='hair_'+hid;m['hair']=hid
    for s in m.material_slots:
        s.material=s.material.copy();s.material.name='hair_'+hid;_grey(s.material)
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
    split['load']()
    if bpy.data.objects.get('hair_'+hid):raise RuntimeError('hair already present: '+hid)
    strip_maps(hang(hid,bpy.data.objects['HeadAnchor']))
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.export_scene.gltf(filepath=split['MASTER'],**{**split['EXPORT'],'use_selection':False})
    app=os.path.join(HERE,'..','..','..','apps','fairy-garden','doll.json');d=json.load(open(app));d['hair']=labels
    with open(app,'w') as f:json.dump(d,f,ensure_ascii=False,indent=1);f.write('\n')
    print('hair added',hid,labels[hid])
    split['split']()

if __name__=='__main__':
    main()
