"""Lift the existing satchel band over the shoulder, preserving its cross-section."""
from pathlib import Path
import bpy, numpy as np, runpy
HERE=Path(__file__).resolve().parent

def fit_ranger_strap():
    strap=bpy.data.objects['outfit_ranger_back_strap']
    if strap.get('shoulderStrapFitVersion'):return
    p=np.array([v.co[:] for v in strap.data.vertices])
    # Move the shoulder arc outward and upward; the hood naturally covers its centre.
    t=np.clip((p[:,2]-.588)/.060,0,1)
    blend=t*t*(3-2*t)
    p[:,2]+=.028*blend
    p[:,0]-=.025*blend
    strap.data.vertices.foreach_set('co',p.ravel())
    shape=runpy.run_path(str(HERE/'body_shape.py'))['deform']
    for key in strap.data.shape_keys.key_blocks:
        coords=p if key.name=='Basis' else p+shape(p,np.zeros(len(p)),key.name,True)
        key.data.foreach_set('co',coords.ravel())
    strap.data.normals_split_custom_set([(0,0,0)]*len(strap.data.loops))
    strap['shoulderStrapFitVersion']=1

if __name__=='__main__':
    split=runpy.run_path(str(HERE/'split_outfits.py'))
    split['load']();fit_ranger_strap()
    split['export'](lambda o:True,split['MASTER'])
    split['export'](lambda o:o.type=='ARMATURE' or o.get('outfit')=='ranger',str(Path(split['APP'])/'outfits/ranger.glb'))
