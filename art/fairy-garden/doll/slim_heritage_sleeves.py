"""Taper the excessive middle-sleeve ease; preserve shoulder and cuff ends.

Coordinates are glTF model coordinates. A smooth spatial field is shared by
UV-split vertices, avoiding cracks at coincident seams. No topology or UV edits.
"""
import numpy as np


def smooth(x):
    t = np.clip(x, 0, 1)
    return t * t * (3 - 2 * t)


def fit(points):
    p = np.asarray(points, dtype=float)
    side = np.where(p[:, 0] < 0, -1., 1.)
    q = p.copy()
    q[:, 0] *= side
    shoulder = np.array([.125, .675, -.012])
    cuff = np.array([.226, .455, -.012])
    axis = cuff - shoulder
    length = np.linalg.norm(axis)
    axis /= length
    t = (q - shoulder) @ axis
    center = shoulder + t[:, None] * axis
    radial = q - center
    # Zero at the chest/shoulder root and at the existing cuff opening.
    blend = (smooth((q[:, 0] - .115) / .055)
             * smooth((t - .012) / .065)
             * (1 - smooth((t - .17) / .055)))
    q -= .28 * blend[:, None] * radial
    q[:, 0] *= side
    return q, blend


def slim_sleeves(position, normal, morphs):
    p, blend = fit(position)
    # Inverse-transpose of the actual spatial deformation, including taper.
    columns = []
    for axis in range(3):
        delta = np.eye(3)[axis] * 1e-5
        columns.append((fit(position + delta)[0] - fit(position - delta)[0]) / 2e-5)
    jacobian = np.stack(columns, axis=2)
    assert np.min(np.linalg.det(jacobian)) > .45
    n = np.linalg.solve(jacobian.transpose(0, 2, 1), normal[..., None])[..., 0]
    n /= np.linalg.norm(n, axis=1)[:, None]
    n[blend == 0] = normal[blend == 0]
    # Shape keys describe displacement, not absolute coordinates. Transport
    # cross-section motion with its center instead of shrinking translations
    # around a fixed world-space shoulder (which folded extreme body shapes).
    targets = np.array(morphs, dtype=float).copy()
    for side in [-1, 1]:
        axis = np.array([side * .101, -.22, 0])
        axis /= np.linalg.norm(axis)
        t = (position - np.array([side * .125, .675, -.012])) @ axis
        selection = (position[:, 0] * side > .15) & (t > 0) & (t < .27)
        centers = np.linspace(0, .27, 55)
        for k, original in enumerate(morphs):
            samples = []
            for at in centers:
                weights = np.exp(-((t[selection] - at) / .035) ** 2)
                samples.append(np.average(original[selection], axis=0, weights=weights))
            samples = np.array(samples)
            average = np.column_stack([np.interp(t, centers, samples[:, j]) for j in range(3)])
            radial = original - average
            radial -= np.outer(radial @ axis, axis)
            ids = position[:, 0] * side > 0
            targets[k, ids] -= .28 * blend[ids, None] * radial[ids]
    return p, n, list(targets), blend
