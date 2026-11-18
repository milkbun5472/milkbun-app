"""Bind fitted outward-lift samples to the original posed arm.

Input NPZ arrays come from the actual pose capture and the fitted shirt:
body, original, fitted, feature, torso. One file per increasing lift angle.
"""
import argparse
import gzip
import hashlib
import json
from pathlib import Path

import igl
import numpy as np

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
UNIT = .0003


def body_anchors(rest_points, fitted, body, faces):
    triangles = np.empty((len(fitted), 3), dtype=int)
    weights = np.empty((len(fitted), 2), dtype=int)
    first, second, third = body[faces].transpose(1, 0, 2)
    area = np.linalg.norm(np.cross(second - first, third - first), axis=1)
    centers = body[faces].mean(axis=1)
    for sign in (-1, 1):
        side = sign * rest_points[:, 0] > 0
        usable = (sign * centers[:, 0] > .055) & (centers[:, 1] < .86) & (area > 1e-7)
        candidates = faces[usable]
        _, nearest, surface = igl.point_mesh_squared_distance(fitted[side], body, candidates)
        triangles[side] = candidates[nearest]
        a, b, c = body[triangles[side]].transpose(1, 0, 2)
        bary = igl.barycentric_coordinates(surface, a, b, c)
        weights[side] = np.rint(bary[:, 1:] * 65535).clip(0, 65535).astype(int)
    return triangles, weights


def arm_guides(source):
    rest = np.array(source['bodyRest']).reshape(-1, 3)
    guides = []
    for row in source['binding']['sleeveSectionGuides']:
        sections = row['sections']
        middle, distal = [np.array(sections[i]['ids']) for i in (3, 6)]
        center = rest[middle].mean(axis=0)
        axis = rest[distal].mean(axis=0) - center
        axis /= np.linalg.norm(axis)
        front = np.array([0., 0., 1.])
        front -= axis * (axis @ front)
        front /= np.linalg.norm(front)
        across = np.cross(axis, front)
        points = rest[middle] - center
        groups = [middle, distal]
        for direction in (front, across):
            projection = points @ direction
            groups.append(middle[projection > np.quantile(projection, .75)])
        guides.append([group.tolist() for group in groups])
    return guides


def bind(source, samples):
    rest = np.array(source['binding']['rest']).reshape(-1, 3)
    faces = np.array(source['bodyIndex']).reshape(-1, 3)
    _, first, welded = np.unique(np.round(rest, 6), axis=0, return_index=True, return_inverse=True)
    moved = np.any([np.linalg.norm(s['fitted'] - s['original'], axis=1) > .00015 for s in samples], axis=0)
    groups = np.unique(welded[moved])
    ids = first[groups]
    peak = samples[-1]
    triangles, weights = body_anchors(rest[ids], peak['fitted'][ids], peak['body'], faces)
    uv = weights / 65535
    bary = np.column_stack([1 - uv.sum(axis=1), uv])
    result = {'groups': groups.tolist(), 'body': triangles.ravel().tolist(),
              'bary': weights.ravel().tolist(), 'samples': [], 'unit': UNIT}
    result['guides'] = arm_guides(source)
    previous = np.zeros((len(ids), 3), dtype=int)
    for sample in samples:
        anchor = np.einsum('ni,nij->nj', bary, sample['body'][triangles])
        offset = (sample['fitted'][ids] - anchor) @ sample['torso'][:3, :3]
        current = np.rint(offset / UNIT).astype(int)
        delta = current - previous
        encoded = np.where(delta < 0, -2 * delta - 1, 2 * delta)
        feature = sample['feature']
        bases = []
        for groups in result['guides']:
            centers = np.array([sample['body'][g].mean(axis=0) for g in groups])
            bases.append((centers[1:] - centers[0]).ravel().tolist())
        result['samples'].append({'bases': bases, 'pitch': -feature[0], 'lateral': feature[1:3].tolist(),
                                  'delta': encoded.ravel().tolist()})
        previous = current
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('reference', type=Path)
    parser.add_argument('frames', type=Path)
    parser.add_argument('--output', type=Path, default=HERE/'linen-outward.json.gz')
    args = parser.parse_args()
    samples = sorted((dict(np.load(p)) for p in args.frames.glob('*.npz')), key=lambda s: -s['feature'][0])
    if len(samples) < 2 or -samples[-1]['feature'][0] < 2.4:
        raise ValueError('Expected the complete outward lift including its peak')
    chart = bind(json.loads(args.reference.read_text()), samples)
    chart['referenceSha256'] = hashlib.sha256(args.reference.read_bytes()).hexdigest()
    args.output.write_bytes(gzip.compress(json.dumps(chart, separators=(',', ':')).encode(), mtime=0))
