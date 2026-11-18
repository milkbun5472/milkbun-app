"""Lift the existing satchel band over the shoulder, preserving its cross-section."""
from pathlib import Path
import numpy as np, runpy
HERE=Path(__file__).resolve().parent

def fit_shoulder_arc(points,normals=None):
    """Version 1 to 2, in Blender Z-up space; fixed bag endpoints."""
    p=np.array(points,copy=True)
    t=np.clip((p[:,2]-.590)/.075,0,1);blend=t*t*(3-2*t)
    p[:,2]+=.018*blend;p[:,0]-=.018*blend
    n=None
    if normals is not None:
        n=np.array(normals,copy=True);slope=6*t*(1-t)/.075
        n[:,2]=(n[:,2]+.018*slope*n[:,0])/(1+.018*slope)
        n/=np.linalg.norm(n,axis=1)[:,None]
    return p,n

def fit_ranger_strap():
    import bpy
    strap=bpy.data.objects['outfit_ranger_back_strap']
    version=int(strap.get('shoulderStrapFitVersion',0))
    if version>=2:return
    p=np.array([v.co[:] for v in strap.data.vertices])
    # Move the shoulder arc outward and upward; the hood naturally covers its centre.
    if version<1:
        t=np.clip((p[:,2]-.588)/.060,0,1)
        blend=t*t*(3-2*t)
        p[:,2]+=.028*blend
        p[:,0]-=.025*blend
    # The fitted sleeve crown sits above the original arc. Keep the endpoints
    # fixed and carry the band over its outer shoulder, below the hood edge.
    p,_=fit_shoulder_arc(p)
    strap.data.vertices.foreach_set('co',p.ravel())
    shape=runpy.run_path(str(HERE/'body_shape.py'))['deform']
    for key in strap.data.shape_keys.key_blocks:
        coords=p if key.name=='Basis' else p+shape(p,np.zeros(len(p)),key.name,True)
        key.data.foreach_set('co',coords.ravel())
    strap.data.normals_split_custom_set([(0,0,0)]*len(strap.data.loops))
    strap['shoulderStrapFitVersion']=2

if __name__=='__main__':
    split=runpy.run_path(str(HERE/'split_outfits.py'))
    split['load']();fit_ranger_strap()
    split['export'](lambda o:True,split['MASTER'])
    split['export'](lambda o:o.type=='ARMATURE' or o.get('outfit')=='ranger',str(Path(split['APP'])/'outfits/ranger.glb'))
