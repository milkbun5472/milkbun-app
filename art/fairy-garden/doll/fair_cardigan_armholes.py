"""Fair the old cut-and-capped sleeve remnants without changing mesh topology.

Coordinates are glTF Y-up. UV duplicates share a displacement; the same linear
operator acts on all six morph deltas. Collar, hem, centre artwork and cream
accessories are anchors. This is an offline authoring operation, never per-frame.
"""
import numpy as np
from scipy.sparse import coo_matrix


def fair_armholes(position, normal, faces, texels, morphs):
    p = np.asarray(position, dtype=float)
    _, first, weld = np.unique(np.round(p / 2e-5).astype(int), axis=0,
                              return_index=True, return_inverse=True)
    P, F = p[first], weld[np.asarray(faces)]
    edges = np.vstack((F[:, [0, 1]], F[:, [1, 2]], F[:, [2, 0]]))
    edges = np.unique(np.sort(edges, axis=1), axis=0)
    a, b = edges[edges[:, 0] != edges[:, 1]].T
    weight = 1 / np.maximum(np.linalg.norm(P[a] - P[b], axis=1), .001)
    adjacency = coo_matrix((np.r_[weight, weight],
                           (np.r_[a, b], np.r_[b, a])), shape=(len(P), len(P))).tocsr()
    degree = np.maximum(np.asarray(adjacency.sum(1)).ravel(), 1e-9)
    def smooth(t):
        t = np.clip(t, 0, 1)
        return t * t * (3 - 2 * t)
    x, y, z = P.T
    mask = smooth((abs(x) - .07) / .045) * smooth((y - .46) / .04) * (1 - smooth((y - .64) / .045))
    texels = np.asarray(texels)
    cream = texels[:, 1] - texels[:, 2] > np.maximum(texels[:, 0] - texels[:, 1], .005) * .32
    protected = np.zeros(len(P), dtype=bool)
    protected[weld[cream]] = True
    mask[protected & (((x > 0) & (y < .60) & (z > .04)) | ((y > .59) & (z > -.01)))] = 0
    mask[(x > 0) & (z > .09) & (y < .60)] = 0
    mask[abs(x) > .16] = 0
    # The pouch has a cloth-coloured rear wall: its texels alone do not identify it.
    mask[(x > .135) & (y < .60) & (z > .02)] = 0
    def apply(values):
        original = np.asarray(values)[first]
        current = original.copy()
        for _ in range(180):
            current += (adjacency @ current / degree[:, None] - current) * mask[:, None] * .45
        return np.asarray(values) + .85 * (current - original)[weld]
    fitted = apply(p)
    P = fitted[first]
    cross = np.cross(P[F[:, 1]] - P[F[:, 0]], P[F[:, 2]] - P[F[:, 0]])
    joined = np.zeros_like(P)
    for k in range(3):
        np.add.at(joined, F[:, k], cross)
    joined /= np.maximum(np.linalg.norm(joined, axis=1), 1e-9)[:, None]
    normal = np.asarray(normal).copy()
    changed = mask[weld] > 0
    normal[changed] += (joined[weld][changed] - normal[changed]) * mask[weld][changed, None]
    normal[changed] /= np.maximum(np.linalg.norm(normal[changed], axis=1), 1e-9)[:, None]
    return fitted, normal, [apply(m) for m in morphs], mask[weld]
