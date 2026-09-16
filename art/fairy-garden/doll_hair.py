"""Editable fairy doll: one imported face/base, shared body morphs, five hair meshes.
Art only; this module does not modify or export the runtime traveler.glb.
Coordinates are Blender Z-up, facing -Y. See README for runtime integration limits.
"""
import bpy, math, os
from mathutils import Vector, Matrix
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'apps', 'fairy-garden', 'traveler.glb')
SK = Vector((0, -.067, 1.210))
SKR = Vector((.239, .190, .260))
BROW = 1.352
CODEX_HAIR = ['Swept fringe', 'Back hair', 'Side hair', 'Hair bun']
PROPS = ['Satchel strap', 'Little herb bag', 'Held herb']
DIMS = dict(flare=1., shoulder=1., height=1., head=1., waist=1., build=1.)
LIMITS = dict(flare=(.78,1.22), shoulder=(.85,1.2), height=(.85,1.25),
              head=(.88,1.10), waist=(.85,1.15), build=(.85,1.15))

def mesh(name, verts, faces, material=None):
    data=bpy.data.meshes.new(name); data.from_pydata(verts, [], faces); data.update()
    o=bpy.data.objects.new(name,data); bpy.context.collection.objects.link(o)
    for p in data.polygons: p.use_smooth=True
    if material: data.materials.append(material)
    o['part']=name
    return o

def hair_mat(hexc='#654536', slot='Doll hair'):
    key=slot+' '+hexc
    if key in bpy.data.materials: return bpy.data.materials[key]
    m=bpy.data.materials.new(key); m.use_nodes=True
    lin=lambda c:c/12.92 if c<=.04045 else ((c+.055)/1.055)**2.4
    rgb=[lin(int(hexc[i:i+2],16)/255) for i in (1,3,5)]
    m.diffuse_color=(*rgb,1)
    nd=m.node_tree.nodes; lk=m.node_tree.links; bs=nd.get('Principled BSDF')
    bs.inputs['Roughness'].default_value=.78
    noise=nd.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value=22
    ramp=nd.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color=(*[x*.86 for x in rgb],1)
    ramp.color_ramp.elements[1].color=(*[min(1,x*1.13) for x in rgb],1)
    lk.new(noise.outputs['Fac'],ramp.inputs[0]); lk.new(ramp.outputs[0],bs.inputs['Base Color'])
    return m

def loft(name, rings, material):
    verts=[]; faces=[]; n=40
    for z,rx,ry in rings:
        for j in range(n):
            a=j*2*math.pi/n
            # A few restrained fabric folds, never a scalloped bubble hem.
            fold=1+.010*math.cos(8*a)*max(0,(.78-z)/.35)
            verts.append((rx*math.cos(a)*fold,ry*math.sin(a)*fold,z))
    for i in range(len(rings)-1):
        for j in range(n):
            a=i*n+j; b=i*n+(j+1)%n
            faces.append((a,b,b+n,a+n))
    faces.extend([tuple(reversed(range(n))),tuple((len(rings)-1)*n+j for j in range(n))])
    return mesh(name,verts,faces,material)

def lock(name, points, width, depth=.020):
    """One curved, tapered ribbon-volume, rooted inside the cap; no bead segments."""
    points=[Vector(p) for p in points]; verts=[]; faces=[]; steps=18; sides=12
    for i in range(steps+1):
        t=i/steps; u=1-t
        p=u**3*points[0]+3*u*u*t*points[1]+3*u*t*t*points[2]+t**3*points[3]
        tangent=3*u*u*(points[1]-points[0])+6*u*t*(points[2]-points[1])+3*t*t*(points[3]-points[2])
        across=Vector((-tangent.z,0,tangent.x)).normalized()
        if across.length<.1: across=Vector((1,0,0))
        taper=max(.008,(1-t)**.35)*(.10+1.2*math.sin(math.pi*t)**.7)
        for j in range(sides):
            a=2*math.pi*j/sides
            q=p+across*(math.cos(a)*width*taper)+Vector((0,math.sin(a)*depth*taper,0))
            verts.append(tuple(q))
    for i in range(steps):
        for j in range(sides):
            a=i*sides+j; b=i*sides+(j+1)%sides
            faces.append((a,b,b+sides,a+sides))
    faces.extend([tuple(reversed(range(sides))),tuple(steps*sides+j for j in range(sides))])
    return mesh(name,verts,faces)

def cap_shell(name='hair.cap'):
    verts=[]; faces=[]; columns=64; rows=20
    for i in range(rows+1):
        t=(i+.002)/(rows+.002)
        for j in range(columns):
            a=2*math.pi*j/columns; front=max(0,math.cos(a))
            end=1.98-1.12*front**3
            p=t*end
            verts.append((.250*math.sin(p)*math.sin(a),-.055-.202*math.sin(p)*math.cos(a),1.215+.275*math.cos(p)))
    for i in range(rows):
        for j in range(columns):
            a=i*columns+j; b=i*columns+(j+1)%columns
            faces.append((a,b,b+columns,a+columns))
    return mesh(name,verts,faces)

def fringe(prefix, airy=False, short=False):
    out=[]
    # Side part: broad flowing locks overlap at the roots, unequal tapered ends.
    specs=[(-.13,-.205,1.31,.040),(-.085,-.130,1.325,.054),
           (-.025,-.050,1.305,.057),(.040,.040,1.333,.048),(.105,.143,1.345,.044)]
    for i,(start,end,z,w) in enumerate(specs):
        if airy: w*=.54; z+=.018
        if short: z+=.027
        out.append(lock(prefix+f'.fringe{i}',[(start*.55,-.055,1.460),(start+.035,-.235,1.425),
                        (end-.025,-.275,z+.055),(end,-.250,z)],w,.023 if not airy else .014))
    return out

def side_locks(prefix, long=False, shag=False):
    out=[]
    for s in (-1,1):
        out.append(lock(prefix+f'.temple{s}',[(s*.158,-.065,1.40),(s*.266,-.154,1.31),
                    (s*.251,-.105,1.16),(s*.221,-.082,1.115)],.046,.033))
        if long or shag:
            for j in range(3):
                end=(.76+j*.045) if long else (1.015+j*.065)
                out.append(lock(prefix+f'.fall{s}.{j}',[(s*(.10+j*.025),.04,1.40),
                    (s*(.27+j*.006),.10,1.18),(s*(.235+j*.015),.08,end+.08),
                    (s*(.18+j*.038),.035,end)],.061 if long else .049,.055))
    return out

def back_locks(prefix, long=False):
    return [lock(prefix+f'.back{i}',[(x,.12,1.39),(x*1.55,.205,1.21),
                (x*1.7,.18,.91 if long else 1.08),(x*1.6,.12,.76 if long else .99)],.074,.044)
            for i,x in enumerate([-.12,-.06,0,.06,.12])]

def hair_korean():
    return [cap_shell()]+fringe('hair.korean')+side_locks('hair.korean')
def hair_wolf():
    out=[cap_shell()]+fringe('hair.wolf',short=True)+side_locks('hair.wolf',shag=True)+back_locks('hair.wolf')
    for s in (-1,1):
        out.append(lock(f'hair.wolf.flick{s}',[(s*.08,.025,1.44),(s*.205,.02,1.38),
                        (s*.24,.0,1.29),(s*.27,.0,1.24)],.032,.023))
    return out
def hair_mullet():
    return [cap_shell()]+fringe('hair.mullet',short=True)+side_locks('hair.mullet')+back_locks('hair.mullet',long=True)
def hair_airbang():
    return [cap_shell()]+fringe('hair.air',airy=True)+side_locks('hair.air',long=True)+back_locks('hair.air',long=True)
def hair_bun():
    out=[cap_shell()]+fringe('hair.bun',airy=True)+side_locks('hair.bun')
    # One compact bun with sculpted winding grooves, attached to the crown.
    verts=[]; faces=[]; n=40; rings=24
    for i in range(rings+1):
        p=math.pi*(i+.001)/(rings+.002)
        for j in range(n):
            t=j*2*math.pi/n; ripple=1+.035*math.cos(7*t+2*p)
            verts.append((.093*math.sin(p)*math.cos(t)*ripple,
                          .075+.081*math.sin(p)*math.sin(t)*ripple,
                          1.505+.087*math.cos(p)))
    for i in range(rings):
        for j in range(n):
            a=i*n+j; c=i*n+(j+1)%n; faces.append((a,c,c+n,a+n))
    out.append(mesh('hair.bun.knot',verts,faces))
    return out
HAIR=dict(korean=hair_korean,wolf=hair_wolf,mullet=hair_mullet,airbang=hair_airbang,bun=hair_bun)

def put_hair(style, hexc='#654536'):
    m=hair_mat(hexc); out=HAIR[style]()
    for o in out: o.data.materials.append(m)
    return out

def load(strip_hair=True, strip_props=True):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=SRC)
    kill=(CODEX_HAIR if strip_hair else [])+(PROPS if strip_props else [])
    for o in list(bpy.data.objects):
        if o.type=='MESH' and any(o.name.startswith(n) for n in kill): bpy.data.objects.remove(o,do_unlink=True)
    # Imported meshes use local doll coordinates under a placement root. Bake local
    # transforms, not the garden placement: every morph shares the same origin.
    for o in list(bpy.data.objects):
        if o.type!='MESH': continue
        o['part']=o.name
        mat=o.matrix_basis.copy(); o.parent=None
        o.data.transform(mat); o.matrix_world=Matrix.Identity(4)
    cloth=bpy.data.materials.get('Character dusty rose wool')
    for name in ['Tunic skirt','Tunic upper body']:
        bpy.data.objects.remove(bpy.data.objects[name],do_unlink=True)
    loft('Tunic body',[(.435,.199,.122),(.448,.202,.124),(.50,.198,.124),(.61,.183,.12),
         (.72,.164,.117),(.82,.179,.125),(.88,.195,.128),(.92,.180,.116),(.965,.10,.085)],cloth)
    for o in bpy.data.objects:
        if o.type!='MESH': continue
        n=o['part']
        for v in o.data.vertices:
            p=v.co
            if 'sleeve' in n:
                # Relaxed arms, smaller cuffs; retain side-specific part names.
                sign=-1 if n.startswith('Left') else 1
                p.x=sign*.19+(p.x-sign*.19)*.78; p.y*=.85
            elif 'hand' in n:
                center=Vector((-.325,-.02,.54) if n.startswith('Left') else (.32,-.13,.64))
                p[:]=center+(p-center)*.86; p.x*=.88
            elif n.startswith('Rounded boots'):
                center=Vector((-.115 if not n.endswith('.001') else .115,-.055,.095))
                p[:]=center+(p-center)*.86
            elif n.startswith('Wood button'): p.y-=.004
            # Longer visible legs in the shared neutral base; soles stay anchored.
            p.z += .075*max(0,min(1,(p.z-.18)/.30))
    return [o for o in bpy.data.objects if o.type=='MESH']

def deform(p, name, key, value):
    p=Vector(p); delta=value-1
    is_head=name.startswith('hair.') or name in ['Face','Small nose','Small mouth'] or name.startswith(('Dark embroidered eye','Eye catchlight','Soft cheek'))
    if key=='height': p.z+=.30*delta*max(0,min(1,(p.z-.18)/.30))
    elif key=='head' and is_head:
        pivot=Vector((0,-.067,1.025)); p=pivot+(p-pivot)*value
    elif key=='shoulder' and not is_head:
        if 'sleeve' in name or 'hand' in name: p.x+=math.copysign(.19*delta,p.x)
        elif name=='Tunic body': p.x*=1+delta*max(0,min(1,(p.z-.76)/.16))
    elif key=='flare' and name=='Tunic body':
        weight=max(0,min(1,(.82-p.z)/.29)); p.x*=1+delta*weight; p.y*=1+delta*weight*.45
    elif key=='waist' and name=='Tunic body':
        weight=max(0,1-abs(p.z-.80)/.18); p.x*=1+delta*weight; p.y*=1+delta*weight
    elif key=='build' and not is_head:
        if name=='Tunic body' or 'sleeve' in name or 'hand' in name or name.startswith('Linen leggings'):
            p.x*=value; p.y*=1+delta*.65
        elif name.startswith(('Wood button','Cream collar')): p.y*=1+delta*.65
    return p

def apply_dims(objs, d, root=None):
    """Idempotent mesh morphs; each slider always evaluates from the immutable Basis."""
    unknown=set(d)-set(DIMS)
    if unknown: raise ValueError('Unknown dimensions: '+str(unknown))
    values={**DIMS,**d}
    for key,value in values.items():
        lo,hi=LIMITS[key]
        if not lo<=value<=hi: raise ValueError(f'{key} outside {lo}..{hi}')
    for o in objs:
        if o.type!='MESH': continue
        if not o.data.shape_keys:
            basis=o.shape_key_add(name='Basis')
            for key in DIMS:
                target=o.shape_key_add(name=key); target.slider_min=-1; target.slider_max=1
                for src,dst in zip(basis.data,target.data): dst.co=deform(src.co,o['part'],key,2.)
                if root:
                    driver=target.driver_add('value').driver; driver.expression='dimension - 1'
                    var=driver.variables.new(); var.name='dimension'; var.targets[0].id=root
                    var.targets[0].data_path='["'+key+'"]'
        for key,value in values.items(): o.data.shape_keys.key_blocks[key].value=value-1
    if root:
        for key,value in values.items():
            root[key]=value; lo,hi=LIMITS[key]
            root.id_properties_ui(key).update(min=lo,max=hi,soft_min=lo,soft_max=hi)
        root.update_tag()
    bpy.context.view_layer.update()

def make(style, hexc='#654536', dims=None, offset=(0,0,0), base=None):
    root=bpy.data.objects.new('Doll '+style,None); bpy.context.collection.objects.link(root)
    root.empty_display_type='CIRCLE'; root.empty_display_size=.3
    objs=[]; materials={}
    for source in base:
        o=source.copy(); o.data=source.data.copy(); bpy.context.collection.objects.link(o)
        o.hide_render=False; o.hide_viewport=False
        # Preserve exact identities, including .001 (the other leg/eye/collar).
        o['part']=source.get('part',source.name)
        for slot in o.material_slots:
            if slot.material:
                key=slot.material.name
                if key not in materials: materials[key]=slot.material.copy()
                slot.material=materials[key]
        objs.append(o)
    hair=put_hair(style,hexc)
    own_hair=hair[0].data.materials[0].copy()
    for o in hair: o.data.materials[0]=own_hair
    # The imported body was raised .075 above its old legs; hair follows the face.
    for o in hair:
        for v in o.data.vertices: v.co.z+=.075
    objs+=hair
    for o in objs: o.parent=root
    apply_dims(objs,dims or {},root)
    root.location=offset
    return objs

def scene(iso=True):
    s=bpy.context.scene; w=bpy.data.worlds.new('Warm studio'); s.world=w; w.use_nodes=True
    w.node_tree.nodes['Background'].inputs[0].default_value=(.72,.77,.82,1)
    w.node_tree.nodes['Background'].inputs[1].default_value=.45
    for name,loc,energy,size in [('Softbox',(-3,-4,6),450,5),('Fill',(4,-1,3),160,4),('Rim',(1,3,4),260,3)]:
        data=bpy.data.lights.new(name,'AREA'); data.energy=energy; data.shape='DISK'; data.size=size
        o=bpy.data.objects.new(name,data); bpy.context.collection.objects.link(o); o.location=loc
        o.rotation_euler=(Vector((0,0,.8))-o.location).to_track_quat('-Z','Y').to_euler()
    cam=bpy.data.cameras.new('Camera'); cam.type='ORTHO'; co=bpy.data.objects.new('Camera',cam)
    bpy.context.collection.objects.link(co); s.camera=co
    s.view_settings.view_transform='AgX'
    return co

def render(path,res=(1200,850),samples=32):
    s=bpy.context.scene; s.render.engine='CYCLES'; s.cycles.samples=samples; s.cycles.use_denoising=True
    s.render.resolution_x,s.render.resolution_y=res; s.render.resolution_percentage=100
    s.render.filepath=path; bpy.ops.render.render(write_still=True)
