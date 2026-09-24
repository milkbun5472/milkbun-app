"""Keep near-collinear body triangles from folding under curved morph fields.

Fit a local affine displacement along each sliver's long edge. This adjusts only
shape-key deltas, never the neutral mesh. Head and sole vertices are excluded.
"""
import numpy as np
from body_shapes import displacement


def stabilize(points, triangles, fields):
    p = np.asarray(points, dtype=np.float64)
    tri = np.asarray(triangles, dtype=np.int32)
    corners = p[tri]
    edges = np.stack([corners[:, (i + 1) % 3] - corners[:, i] for i in range(3)], axis=1)
    lengths = np.sum(edges * edges, axis=2)
    area = np.linalg.norm(np.cross(edges[:, 0], -edges[:, 2]), axis=1)
    active = (corners[:, :, 2].min(axis=1) > .145) & (corners[:, :, 2].max(axis=1) < .98)
    strength = np.clip(.04 * lengths[active].max(axis=1) / np.maximum(area[active], 1e-14), .08, 100)
    tri = tri[active]
    longest = lengths[active].argmax(axis=1)
    rows = np.arange(len(tri))
    a = tri[rows, longest]
    b = tri[rows, (longest + 1) % 3]
    c = tri[rows, (longest + 2) % 3]
    edge = p[b] - p[a]
    t = np.sum((p[c] - p[a]) * edge, axis=1) / np.sum(edge * edge, axis=1)
    residual = p[c] - ((1 - t[:, None]) * p[a] + t[:, None] * p[b])
    centres = (p[a] + p[b] + p[c]) / 3
    denominator = 1 + (1 - t) ** 2 + t ** 2
    counts = np.zeros(len(p))
    for index in [a, b, c]:
        np.add.at(counts, index, strength)
    counts = np.maximum(1, counts)
    # Colour the very thin constraints so each batch touches disjoint vertices.
    # This final projection avoids averaging away a sliver's orientation constraint.
    batches = []
    occupied = []
    for row in np.flatnonzero(strength > 2):
        vertices = {int(a[row]), int(b[row]), int(c[row])}
        for index, used in enumerate(occupied):
            if used.isdisjoint(vertices):
                batches[index].append(row)
                used.update(vertices)
                break
        else:
            batches.append([row])
            occupied.append(vertices)
    batches = [np.array(batch) for batch in batches]
    result = {}
    maximum = 0.0
    for key, raw in fields.items():
        raw = np.asarray(raw, dtype=np.float64)
        values = raw.copy()
        target = np.array([np.array(displacement(q + r * .5, key)) -
                           np.array(displacement(q - r * .5, key))
                           for q, r in zip(centres, residual)])
        for _ in range(240):
            error = values[c] - (1 - t[:, None]) * values[a] - t[:, None] * values[b] - target
            error /= denominator[:, None]
            error *= strength[:, None]
            updates = np.zeros_like(values)
            np.add.at(updates, c, -error)
            np.add.at(updates, a, error * (1 - t[:, None]))
            np.add.at(updates, b, error * t[:, None])
            values += .8 * updates / counts[:, None]
        for _ in range(200):
            for rows in batches:
                aa, bb, cc, tt = a[rows], b[rows], c[rows], t[rows, None]
                error = (values[cc] - (1 - tt) * values[aa] - tt * values[bb] - target[rows]) / denominator[rows, None]
                values[cc] -= error
                values[aa] += (1 - tt) * error
                values[bb] += tt * error
        maximum = max(maximum, float(np.linalg.norm(values - raw, axis=1).max()))
        result[key] = values
    return result, {'constrained_triangles': len(tri), 'maximum_unit_delta_correction': maximum}
