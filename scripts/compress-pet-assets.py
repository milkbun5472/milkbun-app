"""Build the production lossless fur mask and audit existing Draco pet GLBs."""
from pathlib import Path
from PIL import Image
import json,hashlib,struct
root=Path(__file__).resolve().parent.parent
source=root/'art/pet-house/cat-mask.png';target=source.with_suffix('.webp')
im=Image.open(source).convert('RGBA');im.save(target,lossless=True,exact=True,method=6)
decoded=Image.open(target).convert('RGBA');assert decoded.tobytes()==im.tobytes(),'Fur/face protection channels must be exact'
files=['art/pet-house/cat.glb','art/pet-house/room.glb']+['art/pet-career/'+p+'.glb' for p in ['outside','bakery','florist','store','cafe','alley']]
models=[]
for file in files:
 b=(root/file).read_bytes();d=json.loads(b[20:20+struct.unpack_from('<I',b,12)[0]])
 assert all('KHR_draco_mesh_compression' in p.get('extensions',{})for m in d['meshes']for p in m['primitives']),file
 models.append({'path':file,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
report={'mask':{'sourceBytes':source.stat().st_size,'bytes':target.stat().st_size,'pixelExact':True,'size':im.size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()},'models':models}
(root/'apps/pets/compression.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report['mask']))
