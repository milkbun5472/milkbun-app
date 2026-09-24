"""Losslessly share identical GLB buffers (mostly zero morph displacements).

No mesh simplification, quantization or image recompression is performed.
Every original bufferView is checked byte-for-byte after packing.
"""
import hashlib,json,struct
from pathlib import Path


def pack(path):
    path=Path(path);original=path.read_bytes()
    size=struct.unpack_from('<I',original,12)[0]
    doc=json.loads(original[20:20+size]);binary=original[28+size:]
    chunks=[];new=bytearray();lookup={}
    for view in doc['bufferViews']:
        start=view.get('byteOffset',0);data=binary[start:start+view['byteLength']]
        digest=hashlib.sha256(data).digest()
        if digest not in lookup:
            while len(new)%4:new.append(0)
            lookup[digest]=len(new);new.extend(data)
        view['byteOffset']=lookup[digest]
        chunks.append(data)
    doc['buffers'][0]['byteLength']=len(new)
    while len(new)%4:new.append(0)
    text=json.dumps(doc,ensure_ascii=False,separators=(',',':')).encode()
    text+=b' '*((-len(text))%4)
    result=struct.pack('<III',0x46546c67,2,28+len(text)+len(new))+struct.pack('<II',len(text),0x4e4f534a)+text+struct.pack('<II',len(new),0x004e4942)+new
    for before,view in zip(chunks,doc['bufferViews']):
        assert before==new[view['byteOffset']:view['byteOffset']+view['byteLength']]
    path.write_bytes(result)
    return {'before_bytes':len(original),'after_bytes':len(result),'all_buffer_views_byte_identical':True}

if __name__=='__main__':
    import sys
    print(json.dumps(pack(sys.argv[1])))
