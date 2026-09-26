"""Blender QA: -- before.glb after.glb report.json; inspect collar fit separately in browser."""
import bpy,json,sys,struct,hashlib
from pathlib import Path
from mathutils.kdtree import KDTree

def read(path):
 bpy.ops.wm.read_factory_settings(use_empty=True)
 bpy.ops.import_scene.gltf(filepath=path)
 return {o.name:{'p':[v.co.copy() for v in o.data.vertices],'k':{k.name:[v.co.copy() for v in k.data] for k in o.data.shape_keys.key_blocks} if o.data.shape_keys else {}} for o in bpy.data.objects if o.type=='MESH'}
def hashes(path):
 raw=Path(path).read_bytes();n=struct.unpack_from('<I',raw,12)[0];g=json.loads(raw[20:20+n]);out=[]
 for im in g['images']:
  v=g['bufferViews'][im['bufferView']];s=28+n+v.get('byteOffset',0);out.append(hashlib.sha256(raw[s:s+v['byteLength']]).hexdigest())
 return sorted(out)
before,after,report_path=sys.argv[sys.argv.index('--')+1:]
a=read(before);b=read(after);assert a.keys()==b.keys();result={}
for name,old in a.items():
 new=b[name];assert old['k'].keys()==new['k'].keys()
 # Index pairing through unchanged XY plus the displaced Z is ambiguous along
 # dense collar triangles. Use the authoring map solely for correspondence;
 # enforce independent bounds, direction, and unchanged morph offsets below.
 def smooth(x):
  x=max(0,min(1,x));return x*x*(3-2*x)
 tree=KDTree(len(old['p']))
 for i,p in enumerate(old['p']):
  q=p.copy()
  if name=='outfit_cardigan':q.z-=.028*smooth((p.z-.685)/.085)*smooth((.135-abs(p.x))/.04)
  tree.insert(q,i)
 tree.balance();outside=0;dx=0;dzmin=0;dzmax=0;shape=0;err=0
 for i,p in enumerate(new['p']):
  _,j,d=tree.find(p);err=max(err,d);q=old['p'][j];delta=p-q
  if name!='outfit_cardigan' or q.z<=.685 or abs(q.x)>=.135:outside=max(outside,delta.length)
  dx=max(dx,abs(delta.x),abs(delta.y));dzmin=min(dzmin,delta.z);dzmax=max(dzmax,delta.z)
  candidates=tree.find_range(p,max(d+1e-6,.0001))
  if old['k'] and (name!='outfit_cardigan' or q.z<=.685 or abs(q.x)>=.135):shape=max(shape,min(max(((new['k'][k][i]-p)-(old['k'][k][idx]-old['p'][idx])).length for k in old['k']) for _,idx,_ in candidates))
 assert err<.0002 and outside<.0002 and dx<.0002 and shape<.0002,(name,err,outside,dx,shape)
 assert dzmin>-.0282 and dzmax<.0002,(name,dzmin,dzmax)
 if name=='outfit_cardigan':assert -.029<dzmin<-.027
 result[name]={'outsideError':outside,'xyError':dx,'zRange':[dzmin,dzmax],'morphDeltaError':shape}
assert hashes(before)==hashes(after);assert len(hashes(after))==12
Path(report_path).write_text(json.dumps(result,indent=2))
print('PASS: only collar moves down <= .028; non-collar morph offsets and 12 embedded textures preserved')
