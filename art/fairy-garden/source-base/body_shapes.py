"""Continuous deformations for the intact original GLB, in display Z-up units.

Each field is the displacement for a slider offset of +1. The game evaluates
all six exported shape keys additively with weight (slider_value - 1).
No faces are classified, split, removed or recreated.
"""
import math


def smooth(lo, hi, value):
    t = max(0.0, min(1.0, (value - lo) / (hi - lo)))
    return t * t * (3.0 - 2.0 * t)


def eased_ramp(lo, hi, value):
    """Linear through the long shirt triangles, with rounded end transitions."""
    t = max(0.0, min(1.0, (value - lo) / (hi - lo)))
    edge = .12
    if t < edge:
        return t * t / (2 * edge * (1 - edge))
    if t > 1 - edge:
        return 1 - (1 - t) ** 2 / (2 * edge * (1 - edge))
    return (t - edge / 2) / (1 - edge)


def _body_displacement(point, key):
    x, y, z = point
    if key == 'height':
        # Shoes stay fixed; the legs lengthen and everything above moves together.
        return (0, 0, .36 * smooth(.145, .505, z))
    if key == 'head':
        # Full head, ears, eyes and hair share one isotropic scale about the neck.
        weight = smooth(.94, .98, z)
        return (x * weight, (y - .018) * weight, (z - .962) * weight)
    if key == 'waist':
        weight = smooth(.46, .65, z) * (1 - smooth(.78, .94, z))
        return (x * weight, (y - .012) * .65 * weight, 0)
    if key == 'flare':
        # Local hem only: trousers and shoes are not stretched with the shirt.
        weight = smooth(.42, .55, z) * (1 - eased_ramp(.55, .86, z))
        return (x * weight, (y - .012) * .45 * weight, 0)
    if key == 'build':
        weight = smooth(.155, .24, z) * (1 - smooth(.90, .97, z))
        # Each trouser leg grows around its own centre; keep the stance and soles.
        leg_centre = .11 * math.tanh(x / .07) * (1 - smooth(.42, .54, z))
        return ((x - leg_centre) * .65 * weight, (y - .012) * .55 * weight, 0)
    raise ValueError('Unknown body dimension: ' + key)


def displacement(point, key):
    x, y, z = point
    arm = smooth(.045, .30, abs(x))
    if key == 'shoulder':
        # Forearms and hands translate sideways as units; the upper torso blends
        # into that displacement through a broad, monotonic shoulder region.
        weight = smooth(.38, .51, z) * (1 - smooth(.90, .97, z))
        across = x * eased_ramp(.48, .86, z) * (1 - arm) + math.copysign(.19, x) * arm
        return (across * weight, 0, 0)
    delta = _body_displacement(point, key)
    if key in ('head', 'height'):
        return delta
    # Waist/hem/fullness belong to the torso. Fade across the sleeve root instead
    # of shearing the palm through the different vertical garment weights.
    weight = 1 - arm * smooth(.42, .51, z)
    return tuple(value * weight for value in delta)
