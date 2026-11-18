"""Quantize only pose displacement/normal channels in an existing LMOT asset.

Each pose/channel has its own symmetric Int16 scale. All other shuffled array
payloads (including every solve factor) are copied byte-for-byte. No NumPy needed.
"""
import argparse
import array
import gzip
import hashlib
import json
import math
import struct
import sys
from pathlib import Path

WIDTH = {'B': 1, 'H': 2, 'h': 2, 'I': 4, 'i': 4, 'f': 4, 'd': 8}


def quantize(blob):
    source = gzip.decompress(blob)
    if source[:4] != b'LMOT':
        raise ValueError('Not an LMOT asset')
    size = struct.unpack_from('<I', source, 4)[0]
    meta = json.loads(source[8:8 + size])
    payload = source[8 + size:]
    chunks, records = [], []
    offset = 0

    def visit(value, path=()):
        nonlocal offset
        if isinstance(value, list):
            return [visit(v, path + (i,)) for i, v in enumerate(value)]
        if not isinstance(value, dict):
            return value
        if '$array' not in value:
            return {k: visit(v, path + (k,)) for k, v in value.items()}
        code, start, count = value['$array']
        width = WIDTH[code]
        raw = payload[start:start + count * width]
        if len(raw) != count * width:
            raise ValueError('Truncated motion array')
        result = dict(value)
        target = (len(path) == 4 and path[:2] == ('poseCurveData', 'rows')
                  and path[-1] in ('positionDelta', 'normalDelta'))
        if target and code == 'B' and not any(raw):
            target = False  # Neutral zero channels already cost one byte/value.
        if target:
            if code != 'f' or '$scale' in value:
                raise ValueError('Quantize the original Float32 pose data only')
            unpacked = bytearray(len(raw))
            for j in range(width):
                unpacked[j::width] = raw[j * count:(j + 1) * count]
            values = array.array(code)
            values.frombytes(unpacked)
            if sys.byteorder != 'little':
                values.byteswap()
            if not all(math.isfinite(v) for v in values):
                raise ValueError('Nonfinite pose delta')
            maximum = max(map(abs, values), default=0)
            scale = maximum / 32767 if maximum else 1.
            quantized = array.array('h', (round(v / scale) for v in values))
            restored = array.array('f', (v * scale for v in quantized))
            error = max((abs(a - b) for a, b in zip(values, restored)), default=0)
            limit = 1e-5 if path[-1] == 'positionDelta' else 4e-5
            if error > limit:
                raise ValueError(f'{path}: error {error} exceeds {limit}')
            records.append({'pose': meta['poseCurveData']['rows'][path[2]]['sourcePose'],
                            'channel': path[-1], 'count': count, 'scale': scale,
                            'maximum': maximum, 'maxError': error})
            if sys.byteorder != 'little':
                quantized.byteswap()
            packed = quantized.tobytes()
            raw = packed[0::2] + packed[1::2]
            code = 'h'
            result['$scale'] = scale
        result['$array'] = [code, offset, count]
        chunks.append(raw)
        offset += len(raw)
        return result

    encoded = json.dumps(visit(meta), separators=(',', ':'), ensure_ascii=False).encode()
    output = gzip.compress(b'LMOT' + struct.pack('<I', len(encoded)) + encoded + b''.join(chunks), mtime=0)
    return output, {'sourceBytes': len(blob), 'bytes': len(output),
                    'sourceSHA256': hashlib.sha256(blob).hexdigest(),
                    'sha256': hashlib.sha256(output).hexdigest(), 'channels': records}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    parser.add_argument('--report', required=True, type=Path)
    args = parser.parse_args()
    if args.source.resolve() == args.output.resolve():
        parser.error('Keep the original asset as the reference input')
    output, report = quantize(args.source.read_bytes())
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(output)
    args.report.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({k: v for k, v in report.items() if k != 'channels'}))


if __name__ == '__main__':
    main()
