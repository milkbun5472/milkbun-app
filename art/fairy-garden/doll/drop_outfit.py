"""Remove one added outfit (every object named outfit_<id> / outfit_<id>_*) from the full master, so it can be
re-added with add_outfit.py after its recipe changed. Other outfits, body, hair and their fixes stay untouched.
Run: python3 -c "import sys,runpy;sys.argv=['x','--','<id>'];runpy.run_path('drop_outfit.py',run_name='__main__')" """
import bpy,sys,os,runpy
HERE=os.path.dirname(os.path.abspath(__file__))
def main():
    oid=sys.argv[sys.argv.index('--')+1]
    split=runpy.run_path(os.path.join(HERE,'split_outfits.py'))
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=split['MASTER'])
    gone=[o for o in bpy.data.objects if o.get('outfit')==oid or o.name=='outfit_'+oid or o.name.startswith('outfit_'+oid+'_')]
    for o in gone:bpy.data.objects.remove(o,do_unlink=True)
    print('dropped',len(gone),'objects of',oid)
    split['export'](lambda o:True,split['MASTER'])
if __name__=='__main__':main()
