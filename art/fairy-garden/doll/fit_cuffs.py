"""Match sleeve openings to the shared arm instead of exposing a clipped wrist."""
import bpy,runpy,numpy as np
from pathlib import Path
from mathutils import Vector
HERE=Path(__file__).parent

def fit_cuffs():
 shape=runpy.run_path(str(HERE/'body_shape.py'))['deform']
 body=bpy.data.objects['DollBody']
 if not body.get('fittedWristVersion'):
  original=np.array([p.co[:] for p in body.data.vertices]);oldkeys={k.name:np.array([p.co[:] for p in k.data]) for k in body.data.shape_keys.key_blocks}
  arm=np.array([sum(g.weight for g in p.groups if body.vertex_groups[g.group].name.endswith(('Arm','Forearm'))) for p in body.data.vertices])
  for p in body.data.vertices:
   if arm[p.index]<.5 or abs(p.co.x)<.12:continue
   sign=1 if p.co.x>0 else -1;a=Vector((sign*.095,0,-.19)).normalized();v=a.cross(Vector((0,1,0)));start=Vector((sign*.153,0,.655));d=p.co-start;t=d.dot(a)
   if not .035<t<.285:continue
   fade=min(1,max(0,(t-.035)/.045),max(0,(.285-t)/.075));fade=fade*fade*(3-2*fade)
   radial=d-a*t;center=Vector((0,.01,0))+v*(-.03 if sign>0 else .03);centered=radial-center;target=centered*min(.56,.031/max(centered.length,1e-6))
   p.co+=(target-radial)*fade
  P=np.array([p.co[:] for p in body.data.vertices]);body.data.shape_keys.key_blocks['Basis'].data.foreach_set('co',P.ravel())
  for key in ('height','shoulder','waist','flare','build','head'):body.data.shape_keys.key_blocks[key].data.foreach_set('co',(oldkeys[key]+P-original+shape(P,arm,key,False)-shape(original,arm,key,False)).ravel())
  body['fittedWristVersion']=1
 for name in ('academy','garden','ranger','cardigan'):
  o=bpy.data.objects['outfit_'+name]
  if o.get('fittedCuffVersion'):continue
  short=name=='garden';end=.156 if short else .214
  for side,sign in [('left',-1),('right',1)]:
   sleeve=bpy.data.objects['outfit_'+name+'_'+side+'_sleeve'];a=Vector((sign*.095,0,-.19)).normalized();u=Vector((0,1,0));v=a.cross(u).normalized();start=Vector((sign*.153,0,.655))
   for p in sleeve.data.vertices:
    delta=p.co-start;t=delta.dot(a);blend=max(0,min(1,(t-(end-.075))/.055));blend=blend*blend*(3-2*blend)
    radial=delta-a*t;r=radial.length
    if r>1e-6:p.co+=radial.normalized()*.004*blend
   P=np.array([p.co[:] for p in sleeve.data.vertices]);sleeve.data.shape_keys.key_blocks['Basis'].data.foreach_set('co',P.ravel())
   for key in ('height','shoulder','waist','flare','build','head'):
    sleeve.data.shape_keys.key_blocks[key].data.foreach_set('co',(P+shape(P,np.ones(len(P)),key,True)).ravel())
   sleeve['fittedCuffVersion']=1
  c=o['skinCoverage'];c['sleeve']=[round(end-.016,3),0,.76,.10];c['armAxis']=[.153,.655,.095,-.19];o['fittedCuffVersion']=1
