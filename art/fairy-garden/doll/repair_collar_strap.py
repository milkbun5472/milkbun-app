"""Repair reviewed GLBs without reordering vertices or re-exporting other parts.
Input folder: original garden/ranger.glb, decoded strap geometry, decoded motion.
The decoder must read the original GLB with GLTFLoader, before traveler changes it.
"""
from pathlib import Path
import argparse,hashlib,json,runpy,struct
import numpy as np
HERE=Path(__file__).resolve().parent
SHA={'garden':'1d8a17f4c7358d86fcca304b916e7e317e97b59103338742d2ad3ba11463141c','ranger':'5ff1d76858e7717136cba6b3c3c93b921352d3c3c121981d0b02f3cfa28d4953'}
def read_glb(path):
    raw=path.read_bytes();n=struct.unpack_from('<I',raw,12)[0]
    return json.loads(raw[20:20+n]),bytearray(raw[28+n:])
def write_glb(path,doc,blob):
    doc['buffers'][0]['byteLength']=len(blob)
    text=json.dumps(doc,separators=(',',':'),ensure_ascii=False).encode();text+=b' '*((-len(text))%4);blob+=b'\0'*((-len(blob))%4)
    path.write_bytes(struct.pack('<III',0x46546c67,2,28+len(text)+len(blob))+struct.pack('<II',len(text),0x4e4f534a)+text+struct.pack('<II',len(blob),0x004e4942)+blob)
def repair(source,output,motion_output):
    output.mkdir(parents=True,exist_ok=True)
    for name,sha in SHA.items():
        if hashlib.sha256((source/(name+'.glb')).read_bytes()).hexdigest()!=sha:raise ValueError('Unreviewed input: '+name)
    garden,bin_g=read_glb(source/'garden.glb');nodes=[n for n in garden['nodes'] if n.get('name')=='outfit_garden'];assert len(nodes)==1
    nodes[0]['extras']['skinCoverage']['torsoBelow']=.715
    write_glb(output/'garden.glb',garden,bin_g)
    doc,blob=read_glb(source/'ranger.glb');decoded=json.loads((source/'strap-decoded.json').read_text())
    assert decoded['matrix']==[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]
    node=next(n for n in doc['nodes'] if n.get('name')=='outfit_ranger_back_strap');mesh=doc['meshes'][node['mesh']];assert len(mesh['primitives'])==1
    prim=mesh['primitives'][0];attrs=decoded['attributes'];P=np.array(attrs['position']['values']).reshape(-1,3);N=np.array(attrs['normal']['values']).reshape(-1,3);oldP=P.copy();oldN=N.copy()
    t=np.clip((P[:,1]-.590)/.075,0,1);blend=t*t*(3-2*t);slope=6*t*(1-t)/.075
    to_blender=lambda p:np.c_[p[:,0],-p[:,2],p[:,1]];to_gltf=lambda p:np.c_[p[:,0],p[:,2],-p[:,1]]
    fitted,fitted_normal=runpy.run_path(str(HERE/'fit_ranger_strap.py'))['fit_shoulder_arc'](to_blender(P),to_blender(N))
    P,N=to_gltf(fitted),to_gltf(fitted_normal)
    P=P.astype('float32').astype('float64');N=N.astype('float32').astype('float64')
    N[blend==0]=oldN[blend==0]
    # Apply the shared six-shape deformation to the changed arc only. Preserve
    # quantized source deltas exactly elsewhere, including both bag endpoints.
    deform=runpy.run_path(str(HERE/'body_shape.py'))['deform']
    oldM=[np.array(a['values']).reshape(-1,3) for a in decoded['morphs']];newM=[]
    for key,M in zip(mesh['extras']['targetNames'],oldM):
        delta=to_gltf(deform(to_blender(P),np.zeros(len(P)),key,True)-deform(to_blender(oldP),np.zeros(len(P)),key,True))
        newM.append((M+delta).astype('float32').astype('float64'))
    def store_accessor(index,values,width,dtype,component):
        array=np.asarray(values,dtype=dtype).reshape(-1,width);blob.extend(b'\0'*((-len(blob))%4));offset=len(blob);raw=array.tobytes();blob.extend(raw)
        view=len(doc['bufferViews']);doc['bufferViews'].append({'buffer':0,'byteOffset':offset,'byteLength':len(raw)})
        doc['accessors'][index]={'bufferView':view,'componentType':component,'count':len(array),'type':{1:'SCALAR',3:'VEC3',4:'VEC4'}[width]}
        if width==3:doc['accessors'][index].update(min=array.min(0).tolist(),max=array.max(0).tolist())
    names={'position':'POSITION','normal':'NORMAL','color':'COLOR_0','skinIndex':'JOINTS_0','skinWeight':'WEIGHTS_0'}
    for key,semantic in names.items():
        a=attrs[key];values=P if key=='position' else N if key=='normal' else a['values'];integer=key=='skinIndex'
        store_accessor(prim['attributes'][semantic],values,a['size'],'<u2' if integer else '<f4',5123 if integer else 5126)
    store_accessor(prim['indices'],decoded['index']['values'],1,'<u2',5123)
    for target,M in zip(prim['targets'],newM):store_accessor(target['POSITION'],M,3,'<f4',5126)
    prim['extensions'].pop('KHR_draco_mesh_compression');node['extras']['shoulderStrapFitVersion']=2
    # Reclaim only unreachable buffer views; all retained payload bytes survive.
    used=set()
    for a in doc['accessors']:
        if 'bufferView' in a:used.add(a['bufferView'])
        if 'sparse' in a:
            for k in ['indices','values']:used.add(a['sparse'][k]['bufferView'])
    for image in doc.get('images',[]):
        if 'bufferView' in image:used.add(image['bufferView'])
    for m in doc['meshes']:
        for p in m['primitives']:
            d=p.get('extensions',{}).get('KHR_draco_mesh_compression')
            if d:used.add(d['bufferView'])
    mapping={};views=[];compact=bytearray()
    for i,v in enumerate(doc['bufferViews']):
        if i not in used:continue
        mapping[i]=len(views);compact.extend(b'\0'*((-len(compact))%4));start=v.get('byteOffset',0);copy_view=dict(v);copy_view['byteOffset']=len(compact);compact.extend(blob[start:start+v['byteLength']]);views.append(copy_view)
    for a in doc['accessors']:
        if 'bufferView' in a:a['bufferView']=mapping[a['bufferView']]
        if 'sparse' in a:
            for k in ['indices','values']:a['sparse'][k]['bufferView']=mapping[a['sparse'][k]['bufferView']]
    for image in doc.get('images',[]):
        if 'bufferView' in image:image['bufferView']=mapping[image['bufferView']]
    for m in doc['meshes']:
        for p in m['primitives']:
            d=p.get('extensions',{}).get('KHR_draco_mesh_compression')
            if d:d['bufferView']=mapping[d['bufferView']]
    doc['bufferViews']=views;write_glb(output/'ranger.glb',doc,compact)
    motion=json.loads((source/'ranger-motion.json').read_text());binding=motion['binding'];row=next(r for r in [binding,*binding['parts']] if r['name']=='outfit_ranger_back_strap');weights=row['referenceMorphWeights']
    oldRest=oldP+sum(w*m for w,m in zip(weights,oldM));newRest=P+sum(w*m for w,m in zip(weights,newM));error=float(np.max(np.abs(oldRest-np.array(row['rest']).reshape(-1,3))))
    if error>1e-6:raise ValueError('Binding/asset vertex order mismatch: '+str(error))
    selected=blend>0;rest=np.array(row['rest']).reshape(-1,3);rest[selected]+=(newRest-oldRest)[selected]
    normal=np.array(row['normal']).reshape(-1,3);normal[selected]+=(N-oldN)[selected];normal[selected]/=np.linalg.norm(normal[selected],axis=1)[:,None]
    row['rest']=rest.ravel().tolist();row['normal']=normal.ravel().tolist()
    (output/'ranger-motion.json').write_text(json.dumps(motion,separators=(',',':')))
    pack=runpy.run_path(str(HERE/'motion/pack_motion.py'))['pack'];motion_output.write_bytes(pack(motion))
    report={'bindingInputError':error,'changedVertices':int(np.count_nonzero(blend)),'fixedVertices':int(np.count_nonzero(blend==0)),'minJacobian':float(np.min(1+.018*slope)),'bytes':{k:(output/(k+'.glb')).stat().st_size for k in SHA}}
    (output/'repair.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))
if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('source',type=Path);ap.add_argument('output',type=Path);ap.add_argument('motion_output',type=Path);a=ap.parse_args();repair(a.source,a.output,a.motion_output)
