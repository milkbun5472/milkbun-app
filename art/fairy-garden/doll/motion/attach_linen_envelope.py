"""Attach reviewed linen-only envelope metadata; preserve body and other outfits."""
from pathlib import Path
import gzip, hashlib, json, struct
from guide_linen_sleeves import unpack
from pack_motion import pack

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]

def attach(blob, authored=HERE/'linen-envelope.json.gz'):
    source = json.loads(gzip.decompress(authored.read_bytes()))
    for key, path in [('modelSha256', ROOT/'apps/fairy-garden/outfits/linen.glb'),
                      ('bodySha256', ROOT/'apps/fairy-garden/avatar-motion/data/body.bin.gz')]:
        if hashlib.sha256(path.read_bytes()).hexdigest() != source[key]:
            raise ValueError('Linen envelope source changed: '+key)
    data, payload = unpack(blob)
    if 'envelopePayloadOffset' in data:
        payload = payload[:data['envelopePayloadOffset']]
    binding = data['binding']
    trim = next((r for r in binding['parts'] if r['name'] == 'outfit_linen_trim' and not r.get('linear')), None)
    if trim:
        trim.update(name='outfit_linen_cuff_patch', meshId=6, followArms=True)
    elif not any(r['name'] == 'outfit_linen_cuff_patch' and r['meshId'] == 6 for r in binding['parts']):
        raise ValueError('Missing linen cuff patch binding')
    envelope = {k: source[k] for k in ['shoulder', 'trimPatches', 'rootAnchors']}
    rows = source['anchors']
    columns = [('ids', 0), ('side', 1), ('weight', 2), ('body', 3), ('bary', 4),
               ('offset', 5), ('baseBody', 6), ('baseBary', 7), ('baseOffset', 8)]
    envelope['anchors'] = {name: ([v for r in rows for v in r[k]] if k in (3,4,6,7) else [r[k] for r in rows]) for name, k in columns}
    addition, extra = unpack(pack({'meshEdits': source['meshEdits'], 'sleeveEnvelope': envelope}))
    # Preserve existing packed arrays byte-for-byte. Their descriptors refer to
    # the original payload, not to decoded ordinary Python lists.
    def shift(value):
        if isinstance(value, list): return [shift(v) for v in value]
        if isinstance(value, dict):
            if '$array' in value:
                value['$array'][1] += len(payload)
                return value
            return {k: shift(v) for k, v in value.items()}
        return value
    data.update(shift(addition)); data['envelopePayloadOffset'] = len(payload)
    meta = json.dumps(data, separators=(',', ':'), ensure_ascii=False).encode()
    return gzip.compress(b'LMOT'+struct.pack('<I', len(meta))+meta+payload+extra, mtime=0)

if __name__ == '__main__':
    target = ROOT/'apps/fairy-garden/avatar-motion/data/linen.bin.gz'
    target.write_bytes(attach(target.read_bytes()))
    manifest = target.parent/'manifest.json'; report = json.loads(manifest.read_text())
    report['linen'].update(bytes=target.stat().st_size, sha256=hashlib.sha256(target.read_bytes()).hexdigest(),
                          sleeveEnvelope=hashlib.sha256((HERE/'linen-envelope.json.gz').read_bytes()).hexdigest())
    manifest.write_text(json.dumps(report, indent=2)+'\n')
    print('linen envelope bytes', target.stat().st_size)
