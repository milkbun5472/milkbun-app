"""Package the approved berry v8 preview without changing geometry or morph data.
Usage: python3 package_berry.py preview.glb runtime.glb [report.json]
Requires Pillow. Input SHA guards against packaging another revision.
"""
from pathlib import Path
import sys,json,struct,hashlib,io
from PIL import Image
src,out=map(Path,sys.argv[1:3]);b=src.read_bytes()
assert hashlib.sha256(b).hexdigest()=='a49b4486ea08cfa7246a02060cf77cf39564c299efcbe66121da972210622bb9'
n=struct.unpack_from('<I',b,12)[0];g=json.loads(b[20:20+n]);blob=b[28+n:];views=[blob[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']] for v in g['bufferViews']];before=list(views);images=[];image_views=set()
for i,im in enumerate(g.get('images',[])):
 if im['mimeType']!='image/png':continue
 vi=im['bufferView'];image_views.add(vi);pic=Image.open(io.BytesIO(views[vi]));buf=io.BytesIO();pic.save(buf,format='WEBP',quality=95,method=6);views[vi]=buf.getvalue();im['mimeType']='image/webp'
 for tex in g['textures']:
  if tex.get('source')==i:tex.pop('source');tex.setdefault('extensions',{})['EXT_texture_webp']={'source':i}
 images.append({'name':im.get('name'),'width':pic.width,'height':pic.height,'before':len(before[vi]),'after':len(views[vi])})
for key in ['extensionsUsed','extensionsRequired']:
 if 'EXT_texture_webp' not in g.setdefault(key,[]):g[key].append('EXT_texture_webp')
for m in g['meshes']:
 if 'weights' in m:m['weights']=[0]*len(m['weights'])
for node in g['nodes']:
 if 'weights' in node:node['weights']=[0]*len(node['weights'])
 if node.get('extras',{}).get('outfit')=='berry':node['extras'].pop('slotBase',None)
new=bytearray()
for v,data in zip(g['bufferViews'],views):
 new+=b'\0'*((-len(new))%4);v['byteOffset']=len(new);v['byteLength']=len(data);new.extend(data)
g['buffers'][0]['byteLength']=len(new);new+=b'\0'*((-len(new))%4);js=json.dumps(g,separators=(',',':'),ensure_ascii=False).encode();js+=b' '*((-len(js))%4)
result=struct.pack('<III',0x46546c67,2,28+len(js)+len(new))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(new),0x004e4942)+new;out.write_bytes(result)
assert all(a==c for i,(a,c) in enumerate(zip(before,views)) if i not in image_views)
report={'bytes':len(result),'sha256':hashlib.sha256(result).hexdigest(),'geometrySkinMorphBuffersUnchanged':True,'images':images,'restWeightsZero':True,'singleRegionDyeMetadata':True}
if len(sys.argv)>3:Path(sys.argv[3]).write_text(json.dumps(report,indent=2))
print(json.dumps(report))
