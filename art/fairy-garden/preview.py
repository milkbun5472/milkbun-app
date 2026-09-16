"""Blender --background --python art/fairy-garden/preview.py -- dims hair face
Or python3 art/fairy-garden/preview.py (requires bpy). Outputs stay outside git.
"""
import importlib.util, sys, os
from mathutils import Vector
HERE=os.path.dirname(os.path.abspath(__file__))
OUT=os.environ.get('DOLL_OUT','/tmp/fairy-doll')
os.makedirs(OUT,exist_ok=True)
spec=importlib.util.spec_from_file_location('doll',os.path.join(HERE,'doll_hair.py'))
b=importlib.util.module_from_spec(spec); spec.loader.exec_module(b)
bpy=b.bpy

def stage():
    base=b.load(); co=b.scene()
    for o in base: o.hide_render=True; o.hide_viewport=True
    bpy.ops.mesh.primitive_plane_add(size=200)
    floor=bpy.context.object; floor.name='Studio floor'; floor.location.z=.0085
    floor.data.materials.append(b.hair_mat('#e3dace','Studio floor'))
    return base,co

def camera(co, center, scale, front=False):
    target=Vector(center); co.location=target+Vector((0,-8,1.5) if front else (2,-8,3.1))
    co.rotation_euler=(target-co.location).to_track_quat('-Z','Y').to_euler(); co.data.ortho_scale=scale

def save(name,res):
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,name+'.blend'))
    b.render(os.path.join(OUT,name+'.png'),res=res)

def sheet_dims():
    base,co=stage()
    sets=[('korean',dict(shoulder=1.13,flare=.82,height=1.14,head=.94,waist=1.03)),
          ('korean',dict(shoulder=.94,flare=1.05,height=1.06,head=.96,waist=.89)),
          ('airbang',dict(shoulder=1.13,flare=.82,height=1.14,head=.94,waist=1.03)),
          ('airbang',dict(shoulder=.94,flare=1.05,height=1.06,head=.96,waist=.89))]
    for i,(style,dims) in enumerate(sets): b.make(style,'#694735',dims,((i-1.5)*.88,0,0),base)
    camera(co,(0,0,.87),4.10)
    save('dims-refined',(1500,850))

def sheet_hair():
    sheet_trends()

def sheet_face():
    base,co=stage(); b.make('korean','#694735',{},(0,0,0),base)
    camera(co,(0,-.04,1.29),.86,front=True)
    save('face-refined',(850,950))

def hair_row(styles, name, profile=False):
    base,co=stage()
    for i,style in enumerate(styles):
        objs=b.make(style,'#40362f',dict(head=.96),((i-(len(styles)-1)/2)*.76,0,0),base)
        objs[0].parent.rotation_euler.z=-1.12 if profile else -.10
    target=Vector((0,0,1.25)); co.location=target+Vector((0,-8,1.15))
    co.rotation_euler=(target-co.location).to_track_quat('-Z','Y').to_euler()
    co.data.ortho_scale=2.30
    save(name,(1800,870))

def sheet_focus():
    hair_row(['korean','wolf','mullet'],'focus-front')
    hair_row(['korean','wolf','mullet'],'focus-profile',profile=True)

def sheet_trends():
    keys=list(b.HAIR)
    for i in range(0,len(keys),3): hair_row(keys[i:i+3],f'catalog-{i//3+1}')

def sheet_long():
    keys=list(b.HAIR)
    for i in [6,9]: hair_row(keys[i:i+3],f'catalog-{i//3+1}')

def sheet_tied():
    hair_row(['wavy','bun','ponytail'],'tied-profile',profile=True)

JOBS=dict(tied=sheet_tied,long=sheet_long,dims=sheet_dims,hair=sheet_hair,face=sheet_face,focus=sheet_focus,trends=sheet_trends)
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else (sys.argv[1:] if sys.argv[0].endswith('.py') else [])
for name in args or ['focus','trends']: JOBS[name]()
