"""Remove the retained shell's ragged cuff underside and overlapping hoodie scraps.

The retained trouser object includes the original ribbed hoodie hem. Keep that
hem and its UVs; trim only the duplicated surface above the new hoodie's edge.
BMesh interpolates every shape-key layer at both cuts, so fitted body shapes
keep the same source deformation instead of acquiring a second arm/leg rig.
"""
import bpy, bmesh, runpy
from pathlib import Path

HERE = Path(__file__).resolve().parent

def clean_ranger_edges():
    o = bpy.data.objects['outfit_ranger_trousers']
    if o.get('cleanEdgesVersion'): return
    bm = bmesh.new(); bm.from_mesh(o.data)
    for z, below in ((.092, True), (.390, False)):
        bmesh.ops.bisect_plane(bm, geom=list(bm.verts)+list(bm.edges)+list(bm.faces),
                              plane_co=(0,0,z), plane_no=(0,0,1), dist=1e-7,
                              clear_inner=below, clear_outer=not below)
    # Disconnected old sleeve-end scraps sit beyond the ribbed hem at the hip.
    scraps = [f for f in bm.faces if f.calc_center_median().z > .367
              and abs(f.calc_center_median().x) > .173]
    bmesh.ops.delete(bm, geom=scraps, context='FACES')
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
    bm.to_mesh(o.data); bm.free()
    o['cleanEdgesVersion'] = 1

if __name__ == '__main__':
    split = runpy.run_path(str(HERE/'split_outfits.py'))
    split['load'](); clean_ranger_edges()
    split['export'](lambda o: True, split['MASTER'])
    split['export'](lambda o: o.type=='ARMATURE' or o.get('outfit')=='ranger',
                    str(Path(split['APP'])/'outfits/ranger.glb'))
