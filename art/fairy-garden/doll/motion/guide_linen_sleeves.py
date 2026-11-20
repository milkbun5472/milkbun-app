"""Attach the shared body section guides to linen without repacking its arrays."""
import argparse
import copy
import gzip
import json
import struct
from pathlib import Path

WIDTH = {'B': 1, 'H': 2, 'h': 2, 'I': 4, 'i': 4, 'f': 4, 'd': 8}


def unpack(blob):
    raw = gzip.decompress(blob)
    if raw[:4] != b'LMOT':
        raise ValueError('Expected LMOT')
    length = struct.unpack('<I', raw[4:8])[0]
    return json.loads(raw[8:8 + length]), raw[8 + length:]


def attach(linen_blob, guide_blob):
    meta, payload = unpack(linen_blob)
    source, guide_payload = unpack(guide_blob)
    binding, reference = meta['binding'], source['binding']
    if binding['name'] != 'outfit_linen_cloth':
        raise ValueError('Expected linen binding')
    if binding['dims'] != reference['dims']:
        raise ValueError('Body guide reference dimensions differ')
    guides = reference['sleeveSectionGuides']
    if len(guides) != 2 or [g['side'] for g in guides] != [0, 1]:
        raise ValueError('Expected both arm guides')
    if 'sleeveSectionGuides' in binding:
        raise ValueError('Linen already contains section guides')
    chunks = [payload]
    offset = len(payload)

    def transfer(value):
        nonlocal offset
        if isinstance(value, dict):
            if '$array' in value:
                code, start, count = value['$array']
                size = count * WIDTH[code]
                if start < 0 or count < 0 or start + size > len(guide_payload):
                    raise ValueError('Invalid guide array')
                result = copy.deepcopy(value)
                result['$array'][1] = offset
                chunks.append(guide_payload[start:start + size])
                offset += size
                return result
            return {k: transfer(v) for k, v in value.items()}
        if isinstance(value, list):
            return [transfer(v) for v in value]
        return value

    binding['sleeveSectionGuides'] = transfer(guides)
    encoded = json.dumps(meta, separators=(',', ':'), ensure_ascii=False).encode()
    return gzip.compress(b'LMOT' + struct.pack('<I', len(encoded)) + encoded + b''.join(chunks), mtime=0)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('linen', type=Path)
    parser.add_argument('guides', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    if args.output.resolve() in (args.linen.resolve(), args.guides.resolve()):
        raise ValueError('Keep inputs intact; write a separate candidate')
    args.output.write_bytes(attach(args.linen.read_bytes(), args.guides.read_bytes()))
