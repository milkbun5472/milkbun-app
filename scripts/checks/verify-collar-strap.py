"""Independent preservation and 64-dimension checks for collar/strap migration."""
from pathlib import Path
import sys,json,hashlib,struct,copy,itertools
import numpy as np
source,candidate,out=map(Path,sys.argv[1:])
def read(p):
    raw=p.read_bytes();n=struct.unpack_from('<I',raw,12)[0];return json.loads(raw[20:20+n]),raw[28+n:]
def view(d,b,i):
    v=d['bufferViews'][i];s=v.get('byteOffset',0);return b[s:s+v['byteLength']]
def accessor(d,b,i):
    a=copy.deepcopy(d['accessors'][i])
    if 'bufferView' in a:a['bufferView']=hashlib.sha256(view(d,b,a['bufferView'])).hexdigest()
    if 'sparse' in a:
        for k in ['indices','values']:a['sparse'][k]['bufferView']=hashlib.sha256(view(d,b,a['sparse'][k]['bufferView'])).hexdigest()
    return a
def signature(d,b,m):
    m=copy.deepcopy(m)
    for p in m['primitives']:
        p['attributes']={k:accessor(d,b,i) for k,i in p['attributes'].items()}
        if 'indices' in p:p['indices']=accessor(d,b,p['indices'])
        p['targets']=[{k:accessor(d,b,i) for k,i in t.items()} for t in p.get('targets',[])]
        draco=p.get('extensions',{}).get('KHR_draco_mesh_compression')
        if draco:draco['bufferView']=hashlib.sha256(view(d,b,draco['bufferView'])).hexdigest()
    return m
def values(d,b,i):
    a=d['accessors'][i];assert not a.get('sparse');v=d['bufferViews'][a['bufferView']];typ={5121:'u1',5123:'<u2',5125:'<u4',5126:'<f4'}[a['componentType']];width={'SCALAR':1,'VEC3':3,'VEC4':4}[a['type']];return np.frombuffer(b,dtype=typ,count=a['count']*width,offset=v.get('byteOffset',0)+a.get('byteOffset',0)).reshape(-1,width)
report={}
for outfit in ['garden','ranger']:
    a,ab=read(source/(outfit+'.glb'));d,db=read(candidate/(outfit+'.glb'))
    for key in ['materials','textures','samplers','skins','scenes','scene','animations']:assert a.get(key)==d.get(key),key
    assert len(a['nodes'])==len(d['nodes']);expected=copy.deepcopy(a['nodes'])
    for n in expected:
        if n.get('name')=='outfit_garden':n['extras']['skinCoverage']['torsoBelow']=.715
        if n.get('name')=='outfit_ranger_back_strap':n['extras']['shoulderStrapFitVersion']=2
    assert expected==d['nodes']
    for old,new in zip(a.get('images',[]),d.get('images',[])):
        assert view(a,ab,old['bufferView'])==view(d,db,new['bufferView'])
    preserved=0
    for old,new in zip(a['meshes'],d['meshes']):
        if old['name']=='Continuous satchel strap':continue
        assert signature(a,ab,old)==signature(d,db,new),old['name'];preserved+=1
    report[outfit]={'otherMeshesPreserved':preserved,'texturesAndSkeletonPreserved':True}
    if outfit=='garden':assert ab==db;continue
    p=next(m for m in d['meshes'] if m['name']=='Continuous satchel strap')['primitives'][0]
    decoded=json.loads((source/'strap-decoded.json').read_text());oldP=np.array(decoded['attributes']['position']['values']).reshape(-1,3);fixed=oldP[:,1]<=.590
    P=values(d,db,p['attributes']['POSITION']).astype('float64');N=values(d,db,p['attributes']['NORMAL']);I=values(d,db,p['indices']).ravel();M=[values(d,db,t['POSITION']).astype('float64') for t in p['targets']]
    assert np.array_equal(I,np.array(decoded['index']['values']))
    for key,attr in [('skinIndex','JOINTS_0'),('skinWeight','WEIGHTS_0'),('color','COLOR_0')]:assert np.array_equal(values(d,db,p['attributes'][attr]).ravel(),decoded['attributes'][key]['values']),key
    assert np.array_equal(P[fixed],oldP[fixed]);assert np.array_equal(N[fixed],np.array(decoded['attributes']['normal']['values']).reshape(-1,3)[fixed])
    oldM=[np.array(m['values']).reshape(-1,3) for m in decoded['morphs']]
    for m,old in zip(M,oldM):assert np.array_equal(m[fixed],old[fixed])
    triangles=I.reshape(-1,3);cross=lambda points:np.cross(points[triangles[:,1]]-points[triangles[:,0]],points[triangles[:,2]]-points[triangles[:,0]])
    base=cross(P);areas=np.linalg.norm(base,axis=1);assert np.all(areas>1e-10)
    catalog=json.loads(Path('apps/fairy-garden/doll.json').read_text());dims={r['key']:[r['min']-1,r['max']-1] for r in catalog['dims']};names=next(m for m in d['meshes'] if m['name']=='Continuous satchel strap')['extras']['targetNames'];min_area=1;min_dot=1
    for weights in itertools.product(*(dims[k] for k in names)):
        points=P+sum(w*m for w,m in zip(weights,M));norm=cross(points);ratios=np.linalg.norm(norm,axis=1)/areas;dots=np.sum(norm*base,axis=1)/areas**2;min_area=min(min_area,float(ratios.min()));min_dot=min(min_dot,float(dots.min()));assert np.all(ratios>1e-4) and np.all(dots>0)
        assert np.array_equal(points[fixed],(oldP+sum(w*m for w,m in zip(weights,oldM)))[fixed])
    motion=json.loads((candidate/'ranger-motion.json').read_text());old_motion=json.loads((source/'ranger-motion.json').read_text());binding=motion['binding'];row=next(r for r in [binding,*binding['parts']] if r['name']=='outfit_ranger_back_strap');oldrow=next(r for r in [old_motion['binding'],*old_motion['binding']['parts']] if r['name']=='outfit_ranger_back_strap');rest=P+sum(w*m for w,m in zip(row['referenceMorphWeights'],M));error=float(np.max(np.abs(rest-np.array(row['rest']).reshape(-1,3))));assert error<1e-6
    for key in ['rest','normal']:assert np.array_equal(np.array(row[key]).reshape(-1,3)[fixed],np.array(oldrow[key]).reshape(-1,3)[fixed]);row[key]=oldrow[key]
    assert motion==old_motion
    report[outfit].update(fixedVertices=int(fixed.sum()),changedVertices=int((~fixed).sum()),dimensions=64,minAreaRatio=min_area,minNormalDot=min_dot,bindingError=error,otherBindingDataPreserved=True)
out.write_text(json.dumps(report,indent=2));print(json.dumps(report))
