"""Run with Blender --background --python art/fairy-garden/check_model.py."""
import sys, os, math
sys.path.insert(0,os.path.dirname(__file__))
import doll_hair as b
from mathutils import Vector
bpy=b.bpy
base=b.load(); original={o.name:[tuple(v.co) for v in o.data.vertices] for o in base}
a=b.make('korean',base=base); c=b.make('korean',base=base)
root=a[0].parent
parts={o['part']:o for o in a}
for name in ['Linen leggings','Linen leggings.001','Rounded boots','Rounded boots.001','Dark embroidered eye','Dark embroidered eye.001']:
    assert name in parts,name
assert len({o['part'] for o in a})==len(a)
assert not ({m for o in a for m in o.data.materials}&{m for o in c for m in o.data.materials}), 'Materials leak across dolls'
assert all(x.data is not y.data for x,y in zip(a,c))

def coords(o):
    deps=bpy.context.evaluated_depsgraph_get(); ev=o.evaluated_get(deps)
    return [v.co.copy() for v in ev.data.vertices]

def flat(): return [tuple(v) for o in a for v in coords(o)]
def sole(): return min(p.z for n in ['Rounded boots','Rounded boots.001'] for p in coords(parts[n]))
b.apply_dims(a,{},root); neutral=flat(); sole0=sole()
for key,(lo,hi) in b.LIMITS.items():
    for value in [lo,hi]:
        b.apply_dims(a,{key:value},root)
        changed=flat(); assert changed!=neutral,(key,'did not move')
        assert abs(sole()-sole0)<1e-6,(key,'sole moved')
        assert all(math.isfinite(x) for p in changed for x in p)
        b.apply_dims(a,{key:value},root); assert flat()==changed,'Accumulating deformation'
        b.apply_dims(a,{},root); assert flat()==neutral,'Cannot restore neutral'
for extreme in [0,1]:
    b.apply_dims(a,{k:v[extreme] for k,v in b.LIMITS.items()},root)
    assert abs(sole()-sole0)<1e-6
b.apply_dims(a,{},root)
# Direct Blender custom property edits must also drive the geometry.
root['height']=1.2; root.update_tag(); bpy.context.view_layer.update()
assert flat()!=neutral,'Editable root slider did not evaluate'
for o in base: assert [tuple(v.co) for v in o.data.vertices]==original[o.name],'Source modified'
for style in b.HAIR:
    objects=b.make(style,base=base)
    assert all(len(o.data.vertices)>0 for o in objects)
    assert [len(o.data.vertices) for o in objects[:len(base)]]==[len(o.data.vertices) for o in base]
try: b.apply_dims(a,{'height':4},root)
except ValueError: pass
else: raise AssertionError('Unsafe range accepted')
print('PASS: six morphs at both ends, combined extremes, grounded soles, idempotency, live drivers, exact side identities, isolated meshes/materials, five hairstyles, shared body topology.')
