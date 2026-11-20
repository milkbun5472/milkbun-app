"""Build the sewn tee and matching motion asset; preserve denim, footwear and skeleton.
Run sew_tee_armholes.py first. Source: tee.glb, meshes.json, motion.json.
"""
import json,runpy,hashlib,copy
from pathlib import Path
import numpy as np
from scipy import sparse
from scipy.spatial import cKDTree
import sys
source,out=map(Path,sys.argv[1:]);out.mkdir(parents=True,exist_ok=True)
assert hashlib.sha256((source/'tee.glb').read_bytes()).hexdigest()=='608bc37c0bc7d9961af89e94c35e8319bca5fbe7bf65e81785f79d30a57167b3', 'Unreviewed or already repaired source'
src=json.loads((source/'meshes.json').read_text());rows={r['id']:r for r in src['meshes']};d=json.loads((out/'surface.json').read_text());P=np.array(d['p']);F=np.array(d['faces']);V=len(P);srcids=[1,3,4];offset={};total=0
for i in srcids:offset[i]=total;total+=rows[i]['vertices']
r=[];c=[];w=[]
for i,t in enumerate(d['transfer']):
 for mid,j,v in t:r.append(i);c.append(offset[mid]+j);w.append(v)
A=sparse.csr_matrix((w,(r,c)),shape=(V,total))
# Smooth only influences near the actual intersection, keeping cuffs/neck/hem fixed.
new=np.array([len(t)>1 and .57<P[i,1]<.715 for i,t in enumerate(d['transfer'])]);dist=cKDTree(P[new]).query(P)[0];mask=np.clip(1-dist/.055,0,1);mask=mask*mask*(3-2*mask);mask*=np.clip((.715-P[:,1])/.025,0,1)*np.clip((np.abs(P[:,0])-.07)/.04,0,1)
edges=np.r_[F[:,[0,1]],F[:,[1,2]],F[:,[2,0]]];adj=sparse.csr_matrix((np.ones(len(edges)*2),(np.r_[edges[:,0],edges[:,1]],np.r_[edges[:,1],edges[:,0]])),shape=(V,V));adj.data[:]=1;L=sparse.diags(1/np.asarray(adj.sum(1)).ravel())@adj

def smooth(a):
 for _ in range(500):a+=.42*mask[:,None]*(L@a-a)
 return a

def normals(p):
 n=np.zeros_like(p);f=np.cross(p[F[:,1]]-p[F[:,0]],p[F[:,2]]-p[F[:,0]])
 for k in range(3):np.add.at(n,F[:,k],f)
 return n/np.maximum(np.linalg.norm(n,axis=1)[:,None],1e-12)
originalP=P.copy()
for _ in range(80):P+=.42*mask[:,None]*(L@P-P)
N=normals(P);P+=N*(.008*mask[:,None]);N=normals(P)
def fit_root(b):
 p=np.array(b['rest']).reshape(-1,3);old=np.array(b['skinWeight']).reshape(-1,4);si=np.array(b['skinIndex']).reshape(-1,4)
 for key in ['skinWeight','bentSkinWeight']:
  w=np.array(b[key]).reshape(-1,4)
  for row in b['parts']:
   if 'sleeve' not in row['name']:continue
   sign=-1 if 'left' in row['name'] else 1;bone=1 if sign<0 else 4
   rp=np.array(row['rest']).reshape(-1,3);rw=np.array(row[key]).reshape(-1,4);ri=np.array(row['skinIndex']).reshape(-1,4)
   ds,idx=cKDTree(rp).query(p,k=8);mix=1/np.maximum(ds,.0001)**4;mix/=mix.sum(1)[:,None]
   near=np.zeros_like(w)
   for k in range(4):
    same=(ri[idx]==si[:,k,None,None]);near[:,k]=(mix*(rw[idx]*same).sum(2)).sum(1)
   # Seam influence decays into fixed central chest, neck and lower torso.
   smooth=lambda t:np.clip(t,0,1)**2*(3-2*np.clip(t,0,1))
   f=np.exp(-(ds[:,0]/.028)**2)*smooth((p[:,0]*sign-.065)/.045)*smooth((p[:,1]-.59)/.045)
   f[f<.001]=0
   w+=(near-w)*f[:,None]
   b[key]=w.ravel().tolist()
 b['ids']=sorted(set(b['ids'])|set(np.flatnonzero(np.any(abs(w-old)>1e-8,axis=1)).tolist()))

# Source skin is also continuous across the sewn ring; the runtime retains anatomical transport.
motion=json.loads((source/'motion.json').read_text());binding=motion['binding'];fit_root(binding);br={r['meshId']:r for r in [binding]+binding['parts']}
weights=[]
for key in ['skinWeight','bentSkinWeight']:
 all=[]
 for i in srcids:
  b=br[i];si=np.array(b['skinIndex']).reshape(-1,4);sw=np.array(b[key]).reshape(-1,4);v=np.zeros((len(si),9))
  for k in range(4):v[np.arange(len(si)),si[:,k]]+=sw[:,k]
  all.append(v)
 weights.append(smooth(A@np.concatenate(all)))
# The lower torso must remain native body-only so its seated drape survives.
# Tiny inherited arm weights used to be excluded by the old row's ids.
protected=np.array([P[i,1]<.52 and {mid for mid,_,_ in t}=={1} for i,t in enumerate(d['transfer'])])
for weight in weights:
 weight[protected]=0;weight[protected,0]=1
# Each side contains only body/upper/fore; select shared slots for both bind states.
score=np.maximum(*weights);SI=np.argsort(-score,axis=1)[:,:4];W=[]
for weight in weights:
 s=np.take_along_axis(weight,SI,axis=1);s/=s.sum(1)[:,None];W.append(s)
# Recompute six continuous shape fields on the sewn surface. A thresholded
# body/arm morph inherited from separate shells folds the new underarm seam.
deform=runpy.run_path(str(Path(__file__).parent/'body_shape.py'))['deform'];arm=weights[0][:,[1,2,4,5]].sum(1)
ss=lambda x:np.clip(x,0,1)**2*(3-2*np.clip(x,0,1))
armTarget=ss((np.abs(P[:,0])-.09)/.13)
armBlend=ss((P[:,1]-.53)/.05)
arm=arm*(1-armBlend)+armTarget*armBlend
blender=np.c_[P[:,0],-P[:,2],P[:,1]];M=[]
for key in ['height','shoulder','waist','flare','build','head']:
 delta=deform(blender,arm,key,True)
 if key=='build':
  ss=lambda x:np.clip(x,0,1)**2*(3-2*np.clip(x,0,1))
  x,y,z=blender.T;factor=(1-ss((z-.70)/.06))*(1-.7*ss((z-.55)/.10))
  delta[:,0]=x*.6*factor*(1-arm)+np.sign(x)*.165*.6*.3*arm
 M.append(np.c_[delta[:,0],delta[:,2],-delta[:,1]])
helpers=runpy.run_path(str(Path(__file__).parent/'repair_collar_strap.py'));doc,blob=helpers['read_glb'](source/'tee.glb');node=next(n for n in doc['nodes'] if n.get('name')=='outfit_tee_cotton');prim=doc['meshes'][node['mesh']]['primitives'][0];old=copy.deepcopy(prim)
def attr(values,width,kind=5126):
 a=np.asarray(values,dtype={5126:'<f4',5123:'<u2',5125:'<u4'}[kind]).reshape(-1,width);blob.extend(b'\0'*(-len(blob)%4));offset=len(blob);raw=a.tobytes();blob.extend(raw);view=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(raw)});idx=len(doc['accessors']);rec={'bufferView':view,'componentType':kind,'count':len(a),'type':{1:'SCALAR',2:'VEC2',3:'VEC3',4:'VEC4'}[width]}
 if width==3:rec.update(min=a.min(0).tolist(),max=a.max(0).tolist())
 doc['accessors'].append(rec);return idx
prim.clear();prim.update(material=old['material'],mode=4,attributes={'POSITION':attr(P,3),'NORMAL':attr(N,3),'TEXCOORD_0':attr(np.tile([.4,.836],(V,1)),2),'COLOR_0':attr(np.tile([.02,0,0,1],(V,1)),4),'JOINTS_0':attr(SI,4,5123),'WEIGHTS_0':attr(W[0],4)},indices=attr(F,1,5123),targets=[{'POSITION':attr(m,3)} for m in M])
for n in doc['nodes']:
 if n.get('name') in ['outfit_tee_left_sleeve','outfit_tee_right_sleeve']:n.pop('mesh',None);n.pop('weights',None)
assert not node['extras'].get('sewnArmholeVersion'), 'Already sewn source'
node['extras']['sewnArmholeVersion']=1

usedMeshes=sorted({n['mesh'] for n in doc['nodes'] if 'mesh' in n});mapping={old:new for new,old in enumerate(usedMeshes)}
doc['meshes']=[doc['meshes'][i] for i in usedMeshes]
for n in doc['nodes']:
 if 'mesh' in n:n['mesh']=mapping[n['mesh']]
refs=[]
for m in doc['meshes']:
 for p in m['primitives']:
  refs.extend((p['attributes'],k) for k in p['attributes'])
  if 'indices' in p:refs.append((p,'indices'))
  for target in p.get('targets',[]):refs.extend((target,k) for k in target)
for skin in doc.get('skins',[]):
 if 'inverseBindMatrices' in skin:refs.append((skin,'inverseBindMatrices'))
for anim in doc.get('animations',[]):
 for sampler in anim['samplers']:refs.extend((sampler,k) for k in ['input','output'])
used=sorted({o[k] for o,k in refs});mapping={old:new for new,old in enumerate(used)}
doc['accessors']=[doc['accessors'][i] for i in used]
for o,k in refs:o[k]=mapping[o[k]]
refs=[]
for a in doc['accessors']:
 if 'bufferView' in a:refs.append((a,'bufferView'))
 if 'sparse' in a:refs.extend((a['sparse'][k],'bufferView') for k in ['indices','values'])
for image in doc.get('images',[]):
 if 'bufferView' in image:refs.append((image,'bufferView'))
for m in doc['meshes']:
 for p in m['primitives']:
  draco=p.get('extensions',{}).get('KHR_draco_mesh_compression')
  if draco:refs.append((draco,'bufferView'))
used=sorted({o[k] for o,k in refs});mapping={old:new for new,old in enumerate(used)};compact=bytearray();views=[]
for i in used:
 view=dict(doc['bufferViews'][i]);start=view.get('byteOffset',0);compact.extend(b'\0'*(-len(compact)%4));view['byteOffset']=len(compact);compact.extend(blob[start:start+view['byteLength']]);views.append(view)
for o,k in refs:o[k]=mapping[o[k]]
doc['bufferViews']=views;blob=compact

helpers['write_glb'](out/'tee.glb',doc,blob)
# Actual model precision is the binding baseline.
P=P.astype('float32').astype(float);M=[m.astype('float32').astype(float) for m in M];N=N.astype('float32').astype(float)
binding['rest']=(P+sum(w*m for w,m in zip(binding['referenceMorphWeights'],M))).ravel().tolist();binding['normal']=N.ravel().tolist();binding['skinIndex']=SI.ravel().tolist();binding['skinWeight']=W[0].ravel().tolist();binding['bentSkinWeight']=W[1].ravel().tolist();binding['ids']=list(range(V));binding['parts']=[r for r in binding['parts'] if r['meshId'] not in [3,4]]
(out/'motion.json').write_text(json.dumps(motion));(out/'tee.bin.gz').write_bytes(runpy.run_path(str(Path(__file__).parent/'motion/pack_motion.py'))['pack'](motion));print('vertices',V,'faces',len(F),'seam',sum(mask>0),'files',[(p.name,p.stat().st_size) for p in out.iterdir()])
