"""Migrate the reviewed cardigan GLB and its matching motion binding together.

Input: cardigan.glb, meshes.json (decoded before animation), texels.json (sRGB
atlas samples at each main-mesh UV), motion.json (decoded motion asset).
Other Draco attributes and primitives retain their original encoded payloads.
"""
from pathlib import Path
import argparse, hashlib, json, runpy
import numpy as np

HERE = Path(__file__).resolve().parent
helpers = runpy.run_path(str(HERE / 'repair_collar_strap.py'))
fair_armholes = runpy.run_path(str(HERE / 'fair_cardigan_armholes.py'))['fair_armholes']


def repair(source, output):
    output.mkdir(parents=True, exist_ok=True)
    doc, blob = helpers['read_glb'](source / 'cardigan.glb')
    node = next(n for n in doc['nodes'] if n.get('name') == 'outfit_cardigan')
    assert node['extras']['armholeSurfaceVersion'] == 1, 'Already repaired or unreviewed source'
    decoded = json.loads((source / 'meshes.json').read_text())['meshes'][0]
    assert decoded['name'] == node['name']
    prim = doc['meshes'][node['mesh']]['primitives'][0]
    attrs = decoded['attributes']
    oldP = np.array(attrs['position']['values']).reshape(-1, 3)
    oldN = np.array(attrs['normal']['values']).reshape(-1, 3)
    oldM = [np.array(m['values']).reshape(-1, 3) for m in decoded['morphs']['position'][:len(prim['targets'])]]
    P, N, morphs, mask = fair_armholes(oldP, oldN, np.array(decoded['index']).reshape(-1, 3),
                                      json.loads((source / 'texels.json').read_text()), oldM)
    P = P.astype('float32').astype(float)
    N = N.astype('float32').astype(float)
    prim = doc['meshes'][node['mesh']]['primitives'][0]
    assert doc['accessors'][prim['attributes']['POSITION']]['count'] == len(P)
    def store(values):
        blob.extend(b'\0' * (-len(blob) % 4))
        offset = len(blob)
        data = values.tobytes()
        blob.extend(data)
        view = len(doc['bufferViews'])
        doc['bufferViews'].append({'buffer': 0, 'byteOffset': offset, 'byteLength': len(data)})
        return view
    for name, values in [('POSITION', P), ('NORMAL', N)]:
        doc['accessors'][prim['attributes'][name]] = {
            'bufferView': store(values.astype('<f4')), 'componentType': 5126,
            'count': len(values), 'type': 'VEC3',
            'min': values.min(0).tolist(), 'max': values.max(0).tolist()}
        # Draco may encode only a subset of primitive attributes. Keep its
        # original index/UV/colour/skin order; load the two repaired channels.
        del prim['extensions']['KHR_draco_mesh_compression']['attributes'][name]
    newM = []
    for target, values, original in zip(prim['targets'], morphs, oldM):
        # Float32 source morphs retain their exact precision and fixed entries.
        restored = values.astype('<f4').astype(float)
        assert np.array_equal(restored[mask == 0], original[mask == 0])
        newM.append(restored)
        ids = np.flatnonzero(np.any(restored, axis=1)).astype('<u2')
        if len(ids):
            doc['accessors'][target['POSITION']] = {
                'componentType': 5126, 'type': 'VEC3', 'count': len(values),
                'sparse': {'count': len(ids), 'indices': {'bufferView': store(ids), 'componentType': 5123},
                           'values': {'bufferView': store(restored[ids].astype('<f4'))}}}
        else:
            doc['accessors'][target['POSITION']] = {
                'componentType': 5126, 'type': 'VEC3', 'count': len(values)}
        doc['accessors'][target['POSITION']].update(min=restored.min(0).tolist(), max=restored.max(0).tolist())
    node['extras']['armholeSurfaceVersion'] = 2
    # Reclaim unreachable old morph payloads while retaining every other byte.
    used = set()
    for a in doc['accessors']:
        if 'bufferView' in a: used.add(a['bufferView'])
        if 'sparse' in a:
            for k in ['indices', 'values']: used.add(a['sparse'][k]['bufferView'])
    for image in doc.get('images', []):
        if 'bufferView' in image: used.add(image['bufferView'])
    for mesh in doc['meshes']:
        for p in mesh['primitives']:
            draco = p.get('extensions', {}).get('KHR_draco_mesh_compression')
            if draco: used.add(draco['bufferView'])
    mapping, views, compact = {}, [], bytearray()
    for i, view in enumerate(doc['bufferViews']):
        if i not in used: continue
        mapping[i] = len(views)
        compact.extend(b'\0' * (-len(compact) % 4))
        copy = dict(view)
        copy['byteOffset'] = len(compact)
        start = view.get('byteOffset', 0)
        compact.extend(blob[start:start + view['byteLength']])
        views.append(copy)
    for a in doc['accessors']:
        if 'bufferView' in a: a['bufferView'] = mapping[a['bufferView']]
        if 'sparse' in a:
            for k in ['indices', 'values']: a['sparse'][k]['bufferView'] = mapping[a['sparse'][k]['bufferView']]
    for image in doc.get('images', []):
        if 'bufferView' in image: image['bufferView'] = mapping[image['bufferView']]
    for mesh in doc['meshes']:
        for p in mesh['primitives']:
            draco = p.get('extensions', {}).get('KHR_draco_mesh_compression')
            if draco: draco['bufferView'] = mapping[draco['bufferView']]
    doc['bufferViews'] = views
    helpers['write_glb'](output / 'cardigan.glb', doc, compact)
    motion = json.loads((source / 'motion.json').read_text())
    row = motion['binding']
    assert row['name'] == node['name'] and row['meshId'] == 0
    oldRest = oldP + sum(w * m for w, m in zip(row['referenceMorphWeights'], oldM))
    assert np.max(abs(oldRest.ravel() - row['rest'])) < 1e-6, 'Source/binding vertex order mismatch'
    newRest = P + sum(w * m for w, m in zip(row['referenceMorphWeights'], newM))
    row['rest'] = (np.array(row['rest']).reshape(-1, 3) + newRest - oldRest).ravel().tolist()
    normal = np.array(row['normal']).reshape(-1, 3)
    changed = mask > 0
    normal[changed] += (N - oldN)[changed]
    normal[changed] /= np.linalg.norm(normal[changed], axis=1)[:, None]
    row['normal'] = normal.ravel().tolist()
    (output / 'motion.json').write_text(json.dumps(motion, separators=(',', ':')))
    pack = runpy.run_path(str(HERE / 'motion/pack_motion.py'))['pack']
    (output / 'cardigan.bin.gz').write_bytes(pack(motion))
    report = {'sourceSHA256': hashlib.sha256((source / 'cardigan.glb').read_bytes()).hexdigest(),
              'changedVertices': int(np.count_nonzero(changed)), 'fixedVertices': int(np.count_nonzero(~changed)),
              'maxDisplacement': float(np.max(np.linalg.norm(P - oldP, axis=1))),
              'bytes': {name: (output / name).stat().st_size for name in ['cardigan.glb', 'cardigan.bin.gz']}}
    (output / 'repair.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(report))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    repair(args.source, args.output)
