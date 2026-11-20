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
    outward = json.loads(gzip.decompress((HERE/'linen-outward.json.gz').read_bytes()))
    if outward.pop('referenceSha256') != source['sourceSha256']:
        raise ValueError('Outward lift was fitted on a different body or shirt binding')
    envelope['outwardSleeve'] = outward
    rows = source['anchors']
    # UV splits duplicate the same material point. Preserve every source double
    # once and store the original cloth-vertex to material-row mapping.
    unique, indices, lookup = [], [], {}
    for row in rows:
        key = tuple(tuple(v) if isinstance(v, list) else v for v in row[1:])
        if key not in lookup:
            lookup[key] = len(unique)
            unique.append(row)
        indices.append(lookup[key])
    anchors = {'ids': [r[0] for r in rows], 'materialRow': indices}
    for name, k in [('side', 1), ('weight', 2), ('body', 3), ('bary', 4),
                    ('offset', 5), ('baseBody', 6), ('baseBary', 7), ('baseOffset', 8)]:
        if k in (4, 7):
            if any(r[k][2] != 1 - (r[k][0] + r[k][1]) for r in unique):
                raise ValueError('Cannot losslessly reconstruct linen barycentric weights')
            anchors[name] = [v for r in unique for v in r[k][:2]]
        elif k in (3, 6):
            anchors[name] = [v for r in unique for v in r[k]]
        else:
            anchors[name] = [r[k] for r in unique]
    envelope['anchors'] = anchors
    roots = envelope.pop('rootAnchors')
    envelope['rootColumns'] = {
        'ids': [r[0] for r in roots], 'weight': [r[1] for r in roots],
        'body': [v for r in roots for v in r[2]], 'bary': [v for r in roots for v in r[3]],
        'offset': [r[4] for r in roots]}
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
