"""Author a body-material sleeve envelope from an actual runtime reference capture.

The capture must contain the unmodified linen binding/indices, dimensionRest,
rigFit and body ownership. Only cloth metadata is emitted; no body solver or
animation channels are changed. See linen.md for the source capture and QA.
"""
from pathlib import Path
import argparse, gzip, hashlib, json
import numpy as np
from scipy.spatial import Delaunay, cKDTree
from scipy.sparse import coo_matrix, diags, eye
from scipy.sparse.linalg import splu

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def prepare(source, cap_mask):
    q = json.loads(source.read_text())
    row = q['binding']
    C = np.array(row['rest']).reshape(-1, 3)
    B = np.array(q['bodyRest']).reshape(-1, 3)
    owner = np.array(q['bodyOwner'])
    si = np.array(row['skinIndex']).reshape(-1, 4)
    sw = np.array(row['skinWeight']).reshape(-1, 4)
    if len(C) != 13598 or row['dims']['shoulder'] != .92:
        raise ValueError('Expected the unchanged linen reference at shoulder 92%')
    cloth = {m['name']: m for m in q['cloth']}
    F0 = np.array(cloth[row['name']]['indices']).reshape(-1, 3)
    anchors = []
    smooth = lambda x: np.clip(x, 0, 1)**2 * (3 - 2*np.clip(x, 0, 1))
    for side in [0, 1]:
        sh = np.array(q['rigFit'][side]['shoulder'])
        axis = np.array(q['rigFit'][side]['wrist']) - sh
        axis /= np.linalg.norm(axis)
        u = np.array([0., 0., 1.]); u -= axis * (u @ axis); u /= np.linalg.norm(u)
        v = np.cross(axis, u)
        at = (B-sh) @ axis
        theta = np.arctan2((B-sh) @ v, (B-sh) @ u)
        ids = np.where((owner > .4) & ((B[:, 0] > 0) == bool(side)) & (at > -.03) & (at < .29))[0]
        pp = np.column_stack([at[ids]*25, theta[ids]])
        pp = np.concatenate([pp + [0, angle] for angle in [-2*np.pi, 0, 2*np.pi]])
        ids = np.tile(ids, 3)
        _, unique = np.unique(np.round(pp, 6), axis=0, return_index=True)
        pp, ids = pp[unique], ids[unique]
        tri, tree = Delaunay(pp), cKDTree(pp)
        def sample(t, angle, fallback=False):
            x = np.array([t*25, angle]); j = int(tri.find_simplex(x))
            if j < 0:
                if not fallback: return None
                _, nearest = tree.query(x)
                return np.repeat(ids[nearest], 3), np.array([1., 0., 0.])
            bary = tri.transform[j, :2] @ (x-tri.transform[j, 2])
            return ids[tri.simplices[j]], np.r_[bary, 1-bary.sum()]
        for i, p in enumerate(C):
            if (p[0] > 0) != bool(side): continue
            fore = 5 if side else 2
            own = sw[i][np.isin(si[i], [fore-1, fore])].sum()
            t = (p-sh) @ axis
            weight = float(smooth(own/.15)*smooth((t+.03)/.05))
            if weight < 1e-8: continue
            radial = p-sh-axis*t; direction = radial/np.linalg.norm(radial)
            angle = np.arctan2(radial @ v, radial @ u)
            fw = sw[i][si[i] == fore].sum()
            bent_t = t + (.215+.5*(t-.19)-t)*smooth(fw)
            bent = sample(bent_t, angle)
            if bent is None: continue
            bi, bary = bent; bp = bary @ B[bi]
            gap = np.linalg.norm(radial) - (bp-sh-axis*((bp-sh) @ axis)) @ direction
            offset = .004+.45*(np.logaddexp(0, gap/.006)*.006)
            base_i, base_bary = sample(t, angle, True)
            base_gap = (p-base_bary @ B[base_i]) @ direction
            base_offset = .005+np.logaddexp(0, base_gap/.006)*.006
            anchors.append([i, side, weight, bi.tolist(), bary.tolist(), float(offset), base_i.tolist(), base_bary.tolist(), float(base_offset)])

    # Relax only the anatomical shoulder. Extending this solve toward the elbow
    # short-circuits the bent arm and pulls the back of the sleeve through it.
    _, first, inv = np.unique(np.round(C, 6), axis=0, return_index=True, return_inverse=True)
    V, F = C[first], inv[F0]
    edges = np.unique(np.sort(np.concatenate([F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]]), axis=1), axis=0)
    i, j = edges[edges[:, 0] != edges[:, 1]].T
    n = len(V); w = np.ones(len(i))
    degree = np.bincount(np.r_[i, j], minlength=n)
    L = coo_matrix((np.r_[w, w, -w, -w], (np.r_[i, j, i, j], np.r_[i, j, j, i])), shape=(n, n)).tocsc()
    own = (sw[first]*np.isin(si[first], [1, 2, 4, 5])).sum(1)
    at = np.zeros(n)
    for side in [0, 1]:
        sh = np.array(q['rigFit'][side]['shoulder']); axis = np.array(q['rigFit'][side]['wrist'])-sh; axis /= np.linalg.norm(axis)
        sel = (V[:, 0] > 0) == bool(side); at[sel] = (V[sel]-sh) @ axis
    # The anatomical shoulder is a body patch, not an arm-cylinder section.
    # Bind its original points to actual body triangles and fade into the shaft.
    import igl
    shoulder_weight = smooth((own-.02)/.25)*(1-smooth((at-.015)/.06))
    root_ids = np.where(shoulder_weight > 1e-8)[0]
    BF = np.array(q['bodyIndex']).reshape(-1, 3)
    _, face_ids, closest = igl.point_mesh_squared_distance(V[root_ids], B, BF)
    root_anchors = []
    for k, j in enumerate(root_ids):
        ids = BF[face_ids[k]]; triangle = B[ids]
        edge = (triangle[1:]-triangle[0]).T
        uv = np.linalg.lstsq(edge, closest[k]-triangle[0], rcond=None)[0]
        bary = np.r_[1-uv.sum(), uv]
        normal = np.cross(edge[:, 0], edge[:, 1]); normal /= np.linalg.norm(normal)
        offset = max(.004, float((V[j]-closest[k]) @ normal))
        for i in np.where(inv == j)[0]:
            root_anchors.append([int(i), float(shoulder_weight[j]), ids.tolist(), bary.tolist(), offset])
    unknown = np.where((own > .02) & (at < .075))[0]
    lam = degree*(.001+8*np.clip((at-.025)/.05, 0, 1)**4)
    A = (L+diags(lam))[unknown][:, unknown].tocsc()
    lu = splu(A, permc_spec='MMD_AT_PLUS_A', diag_pivot_thresh=0, options={'SymmetricMode': True})
    if not np.array_equal(lu.perm_r, lu.perm_c): raise ValueError('Non-symmetric shoulder factor')
    def csr(a):
        a = a.tocsr(); return {'ptr': a.indptr.tolist(), 'col': a.indices.tolist(), 'value': a.data.tolist()}
    factor = {'rhs': csr(eye(len(unknown))), 'L': csr(lu.L), 'symmetricFactor': True,
              'diagonal': lu.U.diagonal().tolist(), 'permR': lu.perm_r.tolist(), 'permC': lu.perm_c.tolist()}
    adj = (diags(degree)-L).tocsr()
    shoulder = {'first': first.tolist(), 'inv': inv.tolist(), 'unknown': unknown.tolist(),
                'active': np.unique(np.r_[unknown, adj[unknown].indices]).tolist(),
                'ptr': adj.indptr.tolist(), 'col': adj.indices.tolist(), 'lam': lam[unknown].tolist(), 'factor': factor}

    # Cuff inserts were assigned to the belt material. Their seam vertices must
    # follow the same cloth boundary, with a harmonic interior and rigid relief.
    trim = next(r for r in row['parts'] if r['name'] == 'outfit_linen_trim' and not r.get('linear'))
    R = np.array(trim['rest']).reshape(-1, 3)
    TF = np.array(cloth[trim['name']]['indices']).reshape(-1, 3)
    patches = []
    for side in [0, 1]:
        ids = np.array([i for i in trim['ids'] if (R[i, 0] > 0) == bool(side)])
        index = {i: j for j, i in enumerate(ids)}
        distance, nearest = cKDTree(C).query(R[ids])
        boundary, interior = np.where(distance < 1e-4)[0], np.where(distance >= 1e-4)[0]
        lap = np.zeros((len(ids), len(ids)))
        for f in TF:
            if not all(i in index for i in f): continue
            for a, b in zip(f, np.roll(f, 1)):
                a, b = index[a], index[b]; lap[a, b] = lap[b, a] = -1
        lap[np.diag_indices_from(lap)] = -lap.sum(1)
        weights = np.zeros((len(ids), len(boundary))); weights[boundary, np.arange(len(boundary))] = 1
        weights[interior] = np.linalg.solve(lap[np.ix_(interior, interior)], -lap[np.ix_(interior, boundary)])
        residual = R[ids]-weights @ C[nearest[boundary]]
        patches.append({'ids': ids.tolist(), 'anchors': nearest[boundary].tolist(), 'weights': weights.tolist(), 'residual': residual.tolist()})
    mask = np.array(json.loads(cap_mask.read_text()))
    if len(mask) != len(F0) or mask.sum() != 1085: raise ValueError('Unreviewed cuff opening mask')
    trim_ids = set(trim['ids'])
    split = [j for j, f in enumerate(TF) if all(int(i) in trim_ids for i in f)]
    edits = {'removeFaces': [{'name': row['name'], 'vertices': len(C), 'triangles': len(F0), 'faces': np.where(mask)[0].tolist()}],
             'splitFaces': [{'name': trim['name'], 'vertices': len(R), 'triangles': len(TF), 'faces': split,
                             'target': 'outfit_linen_cuff_patch', 'colorSlot': 'cloth'}]}
    return {'anchors': anchors, 'rootAnchors': root_anchors, 'shoulder': shoulder, 'trimPatches': patches, 'meshEdits': edits,
            'sourceSha256': digest(source), 'modelSha256': digest(ROOT/'apps/fairy-garden/outfits/linen.glb'),
            'bodySha256': digest(ROOT/'apps/fairy-garden/avatar-motion/data/body.bin.gz')}

if __name__ == '__main__':
    ap = argparse.ArgumentParser(); ap.add_argument('source', type=Path); ap.add_argument('cap_mask', type=Path)
    ap.add_argument('--output', type=Path, default=HERE/'linen-envelope.json.gz'); args = ap.parse_args()
    data = prepare(args.source, args.cap_mask)
    args.output.write_bytes(gzip.compress(json.dumps(data, separators=(',', ':')).encode(), mtime=0))
    print(json.dumps({'anchors': len(data['anchors']), 'shoulderVertices': len(data['shoulder']['unknown']), 'bytes': args.output.stat().st_size}))
