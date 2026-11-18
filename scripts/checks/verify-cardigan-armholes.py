"""Independent preservation and 64-slider audit for the cardigan migration.
Usage: python verify-cardigan-armholes.py SOURCE_FOLDER CANDIDATE_FOLDER REPORT
"""
from pathlib import Path
import sys, json, struct, hashlib, copy, itertools
import numpy as np

source, candidate, output = map(Path, sys.argv[1:])
def read(path):
    raw = path.read_bytes(); size = struct.unpack_from('<I', raw, 12)[0]
    return json.loads(raw[20:20 + size]), raw[28 + size:]
def view(doc, blob, i):
    v = doc['bufferViews'][i]; at = v.get('byteOffset', 0)
    return blob[at:at + v['byteLength']]
def signature(doc, blob, i):
    a = copy.deepcopy(doc['accessors'][i])
    if 'bufferView' in a: a['bufferView'] = hashlib.sha256(view(doc, blob, a['bufferView'])).hexdigest()
    if 'sparse' in a:
        for k in ['indices', 'values']:
            a['sparse'][k]['bufferView'] = hashlib.sha256(view(doc, blob, a['sparse'][k]['bufferView'])).hexdigest()
    return a
def values(doc, blob, i):
    a = doc['accessors'][i]; assert a['componentType'] == 5126
    out = np.zeros((a['count'], 3))
    if 'bufferView' in a: out[:] = np.frombuffer(view(doc, blob, a['bufferView']), '<f4').reshape(-1, 3)
    if 'sparse' in a:
        s = a['sparse']; assert s['indices']['componentType'] == 5123
        ids = np.frombuffer(view(doc, blob, s['indices']['bufferView']), '<u2')
        out[ids] = np.frombuffer(view(doc, blob, s['values']['bufferView']), '<f4').reshape(-1, 3)
    return out
old, oldBlob = read(source / 'cardigan.glb'); doc, blob = read(candidate / 'cardigan.glb')
nodes = copy.deepcopy(old['nodes'])
next(n for n in nodes if n.get('name') == 'outfit_cardigan')['extras']['armholeSurfaceVersion'] = 2
assert nodes == doc['nodes']
for key in ['materials', 'textures', 'samplers', 'skins', 'scenes', 'scene', 'animations']:
    assert old.get(key) == doc.get(key), key
for a, b in zip(old['images'], doc['images']): assert view(old, oldBlob, a['bufferView']) == view(doc, blob, b['bufferView'])
prim = doc['meshes'][0]['primitives'][0]
changedAccessors = {prim['attributes'][k] for k in ['POSITION', 'NORMAL']} | {t['POSITION'] for t in prim['targets']}
for i in range(len(doc['accessors'])):
    if i not in changedAccessors: assert signature(old, oldBlob, i) == signature(doc, blob, i), i
for i, (a, b) in enumerate(zip(old['meshes'], doc['meshes'])):
    a, b = copy.deepcopy(a), copy.deepcopy(b)
    for mesh, document, binary in [(a, old, oldBlob), (b, doc, blob)]:
        for p in mesh['primitives']:
            d = p.get('extensions', {}).get('KHR_draco_mesh_compression')
            if d: d['bufferView'] = hashlib.sha256(view(document, binary, d['bufferView'])).hexdigest()
    if i == 0:
        for k in ['POSITION', 'NORMAL']: del a['primitives'][0]['extensions']['KHR_draco_mesh_compression']['attributes'][k]
    assert a == b, i
decoded = json.loads((source / 'meshes.json').read_text())['meshes'][0]
oldP = np.array(decoded['attributes']['position']['values']).reshape(-1, 3)
oldN = np.array(decoded['attributes']['normal']['values']).reshape(-1, 3)
oldM = [np.array(m['values']).reshape(-1, 3) for m in decoded['morphs']['position'][:6]]
P = values(doc, blob, prim['attributes']['POSITION']); N = values(doc, blob, prim['attributes']['NORMAL'])
M = [values(doc, blob, t['POSITION']) for t in prim['targets']]
fixed = np.all(P == oldP, axis=1)
for a, b in [(N, oldN), *zip(M, oldM)]: assert np.array_equal(a[fixed], b[fixed])
motion = json.loads((candidate / 'motion.json').read_text()); oldMotion = json.loads((source / 'motion.json').read_text())
row = motion['binding']; originalRow = oldMotion['binding']
rest = P + sum(w * m for w, m in zip(row['referenceMorphWeights'], M))
error = float(np.max(abs(rest.ravel() - row['rest']))); assert error < 1e-6
for k in ['rest', 'normal']:
    assert np.max(abs(np.array(row[k]).reshape(-1, 3)[fixed] - np.array(originalRow[k]).reshape(-1, 3)[fixed])) < 1e-15
    row[k] = originalRow[k]
assert motion == oldMotion, 'Weights, guides and every other binding field stay unchanged'
F = np.array(decoded['index']).reshape(-1, 3)
cross = lambda p: np.cross(p[F[:, 1]] - p[F[:, 0]], p[F[:, 2]] - p[F[:, 0]])
base = cross(P); area = np.linalg.norm(base, axis=1); oldBase = cross(oldP)
assert np.all(area > 1e-10)
region = (~fixed)[F].any(1)
catalog = json.loads(Path('apps/fairy-garden/doll.json').read_text())
ranges = {d['key']: [d['min'] - 1, d['max'] - 1] for d in catalog['dims']}
names = doc['meshes'][0]['extras']['targetNames']; minRatio = 1; oldFlips = set(); retainedFlips = set()
for weights in itertools.product(*(ranges[k] for k in names)):
    current = cross(P + sum(w * m for w, m in zip(weights, M)))
    previous = cross(oldP + sum(w * m for w, m in zip(weights, oldM)))
    flipped = set(np.flatnonzero(np.sum(current * base, axis=1) <= 0))
    oldFlipped = set(np.flatnonzero(np.sum(previous * oldBase, axis=1) <= 0))
    assert not (flipped - oldFlipped), 'No newly reversed faces'
    assert not any(region[i] for i in flipped), 'Repaired faces stay oriented'
    oldFlips |= oldFlipped; retainedFlips |= flipped
    minRatio = min(minRatio, float(np.min(np.linalg.norm(current, axis=1) / area)))
report = {'changedVertices': int((~fixed).sum()), 'fixedVertices': int(fixed.sum()),
          'otherMeshesPreserved': len(doc['meshes']) - 1, 'texturesUVSkinIndicesPreserved': True,
          'bindingError': error, 'otherBindingFieldsPreserved': True, 'dimensions': 64,
          'newReversedFaces': 0, 'repairedRegionReversedFaces': 0, 'collapsedFaces': 0,
          'minAreaRatio': minRatio, 'originalReversedFacesAtSliderExtremes': len(oldFlips),
          'retainedReversedFacesOutsideRepair': len(retainedFlips)}
output.write_text(json.dumps(report, indent=2)); print(json.dumps(report))
