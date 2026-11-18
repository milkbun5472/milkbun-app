"""Pack validated motion arrays losslessly; source folder is supplied explicitly.
No float quantization: choose Float32 only when every value round-trips exactly.
Byte shuffle makes IEEE floating point arrays compress without changing values.
"""
from pathlib import Path
import argparse,array,gzip,json,struct,sys,hashlib

def pack(document):
    chunks=[];offset=0
    def visit(x):
        nonlocal offset
        if isinstance(x,list):
            if len(x)>=16 and all(type(v) in (int,float) for v in x):
                integer=all(v==int(v) and -2147483648<=v<=4294967295 for v in x)
                code='I' if integer and min(x)>=0 else 'i' if integer else 'd'
                if integer and min(x)>=0 and max(x)<=65535:code='H'
                if integer and min(x)>=0 and max(x)<=255:code='B'
                data=array.array(code,(int(v) for v in x) if integer else x)
                if not integer:
                    narrow=array.array('f',x)
                    if all(a==b for a,b in zip(x,narrow)):code='f';data=narrow
                if sys.byteorder!='little':data.byteswap()
                raw=data.tobytes();size=data.itemsize
                shuffled=b''.join(raw[j::size] for j in range(size))
                result={'$array':[code,offset,len(x)]};chunks.append(shuffled);offset+=len(raw);return result
            return [visit(v) for v in x]
        if isinstance(x,dict):return {k:visit(v) for k,v in x.items() if k not in ('scope',)}
        return x
    meta=json.dumps(visit(document),separators=(',',':'),ensure_ascii=False).encode()
    return gzip.compress(b'LMOT'+struct.pack('<I',len(meta))+meta+b''.join(chunks),mtime=0)

def load(p):return json.loads(gzip.decompress(p.read_bytes()) if p.suffix=='.gz' else p.read_bytes())
def main():
    ap=argparse.ArgumentParser();ap.add_argument('source',type=Path);ap.add_argument('--symmetric',action='store_true');ap.add_argument('--quantize-pose-deltas',action='store_true');ap.add_argument('--output',type=Path,default=Path('apps/fairy-garden/avatar-motion/data'));args=ap.parse_args();args.output.mkdir(parents=True,exist_ok=True)
    files={'mesh':'hybrid-body-wrist-proxy.json','poseCurveData':'body-pose-field-v3.json','dimensionData':'body-dim-transfer-v3.json.gz','liveFairData':'body-live-fair-v4-data.json','shoulderRootData':'shoulder-root-fair-v1-data.json','neckAreaData':'neck-area-v1-data.json','jointFlowData':'joint-flow-v1-data.json.gz','elbowMetricData':'elbow-metric-v1-data.json.gz','contactMetricData':'contact-metric-v1-data.json.gz'}
    if args.symmetric:
        for key in ['liveFairData','shoulderRootData','elbowMetricData','contactMetricData']:files[key]=files[key].replace('.json','-symmetric.json')
    report={}
    def save(name,data,inputs):
        blob=pack(data)
        if name=='body' and args.quantize_pose_deltas:
            from quantize_pose_deltas import quantize
            blob,quality=quantize(blob)
            (args.output/'pose-quantization.json').write_text(json.dumps(quality,indent=2)+'\n')
        (args.output/(name+'.bin.gz')).write_bytes(blob);report[name]={'bytes':len(blob),'sha256':hashlib.sha256(blob).hexdigest(),'sources':{f:hashlib.sha256((args.source/f).read_bytes()).hexdigest() for f in inputs}}
    body={k:load(args.source/f) for k,f in files.items()}
    # These channels are converted to Float32BufferAttribute before any runtime
    # computation. Store that exact representation, preserving rendered values.
    f32=lambda values:list(array.array('f',values))
    for key in ['position','normal','uv','repairSkin']:body['mesh'][key]=f32(body['mesh'][key])
    for row in body['poseCurveData']['rows']:
        for key in ['positionDelta','normalDelta']:row[key]=f32(row[key])
    for key in ['position','normal']:body['dimensionData'][key]=[f32(row) for row in body['dimensionData'][key]]
    save('body',body,files.values())
    for outfit in ['linen','heritage','bamboo','argyle','cardigan','ranger','garden','jacket','suit','tee','academy','berry']:
        f=('wardrobe-section-guide-bind-'if outfit in ('heritage','bamboo','argyle')else'wardrobe-fair-bind-')+outfit+'.json.gz';binding=load(args.source/f)
        # Capture geometry is not needed: runtime clones each actual garment.
        save(outfit,{'binding':binding,'materialCuff':outfit in ('heritage','bamboo','argyle')},[f])
    # Linen uses the same body sections as the existing guided garments.
    # Preserve all original binding arrays when upgrading an older source pack.
    from guide_linen_sleeves import attach,unpack
    linen=args.output/'linen.bin.gz'
    if 'sleeveSectionGuides' not in unpack(linen.read_bytes())[0]['binding']:
        linen.write_bytes(attach(linen.read_bytes(),(args.output/'bamboo.bin.gz').read_bytes()))
    report['linen'].update(bytes=linen.stat().st_size,sha256=hashlib.sha256(linen.read_bytes()).hexdigest(),sectionGuides=True)
    (args.output/'manifest.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v['bytes'] for k,v in report.items()}))
if __name__=='__main__':main()
