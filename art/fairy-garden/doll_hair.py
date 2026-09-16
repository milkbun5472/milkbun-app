"""Editable fairy doll: one imported face/base, shared body morphs, twelve hairstyles.
Art only; this module does not modify or export the runtime traveler.glb.
Coordinates are Blender Z-up, facing -Y. See README for runtime integration limits.
"""
import bpy, math, os, json
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
    bs.inputs['Roughness'].default_value=.58 if slot=='Doll hair' else .78
    bs.inputs['Specular IOR Level'].default_value=.22 if slot=='Doll hair' else .5
    noise=nd.new('ShaderNodeTexNoise'); noise.inputs['Scale'].default_value=22
    if slot=='Doll hair':
        tex=nd.new('ShaderNodeTexCoord'); mapping=nd.new('ShaderNodeVectorMath'); mapping.operation='MULTIPLY'
        mapping.inputs[1].default_value=(18,.24,1)
        lk.new(tex.outputs['UV'],mapping.inputs[0]); lk.new(mapping.outputs[0],noise.inputs['Vector'])
    ramp=nd.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color=(*[x*.65 for x in rgb],1)
    ramp.color_ramp.elements[1].color=(*[min(1,x*1.28) for x in rgb],1)
    lk.new(noise.outputs['Fac'],ramp.inputs[0]); lk.new(ramp.outputs[0],bs.inputs['Base Color'])
    if slot=='Doll hair':
        bump=nd.new('ShaderNodeBump'); bump.inputs['Strength'].default_value=.27; bump.inputs['Distance'].default_value=.0016
        lk.new(noise.outputs['Fac'],bump.inputs['Height']); lk.new(bump.outputs[0],bs.inputs['Normal'])

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

def hair_surface(name, point, width, steps=30, sections=10, depth=.006, normal=None):
    """A thin sculpted hair sheet. Stable frames follow the actual 3D path.

    The old XZ-only tubes turned into fat leaves and twisted around bends. These
    ribbons have a broad root, a late taper, and shallow longitudinal grooves.
    """
    verts=[]; faces=[]; prev=None
    for i in range(steps+1):
        t=i/steps; p=Vector(point(t)); eps=.0002
        tangent=(Vector(point(min(1,t+eps)))-Vector(point(max(0,t-eps)))).normalized()
        n=Vector(normal) if normal else Vector((p.x/.255**2,(p.y+.05)/.209**2,(p.z-1.215)/.285**2))
        n=n-tangent*n.dot(tangent)
        if n.length<.01: n=Vector((0,-1,0))-tangent*tangent.dot(Vector((0,-1,0)))
        n.normalize(); across=tangent.cross(n).normalized()
        if prev is not None and across.dot(prev)<0: across=-across
        prev=across
        taper=(.86+.14*math.sin(math.pi*t))*(max(.018,(1-t)/.30)**.72 if t>.70 else 1)
        for j in range(sections+1):
            u=-1+2*j/sections
            bulge=depth*(1-u*u)+.0007*math.cos(u*math.pi*3)*math.sin(math.pi*t)
            q=p+across*(u*width*taper)+n*bulge
            verts.append(tuple(q))
    for i in range(steps):
        for j in range(sections):
            a=i*(sections+1)+j; faces.append((a,a+1,a+sections+2,a+sections+1))
    o=mesh(name,verts,faces)
    uv=o.data.uv_layers.new(name='Hair flow')
    for poly in o.data.polygons:
        for li in poly.loop_indices:
            vi=o.data.loops[li].vertex_index
            uv.data[li].uv=(vi%(sections+1)/sections,vi//(sections+1)/steps)
    # Thickness stays tiny, including at silhouettes. Bake it so shape keys see it.
    bpy.context.view_layer.objects.active=o; o.select_set(True)
    mod=o.modifiers.new('Hair sheet thickness','SOLIDIFY'); mod.thickness=.0035; mod.offset=-1
    bpy.ops.object.modifier_apply(modifier=mod.name); o.select_set(False)
    return o

def bezier(points):
    p=[Vector(x) for x in points]
    return lambda t: (1-t)**3*p[0]+3*(1-t)**2*t*p[1]+3*(1-t)*t*t*p[2]+t**3*p[3]

def lock(name,points,width,depth=.006,normal=None):
    return hair_surface(name,bezier(points),width,depth=depth,normal=normal)

def scalp(a,p,lift=0):
    return Vector(((.253+lift)*math.sin(p)*math.sin(a),
                   -.05-(.207+lift)*math.sin(p)*math.cos(a),
                   1.215+(.281+lift)*math.cos(p)))

def cap_shell(name='hair.cap',front=1.10,side=1.59,back=1.93,lift=.005,part=False):
    verts=[]; faces=[]; rows=26; cols=96
    for i in range(rows+1):
        t=(i+.003)/(rows+.003)
        for j in range(cols):
            a=j*2*math.pi/cols; c=math.cos(a)
            end=side+(front-side)*max(0,c)**3+(back-side)*max(0,-c)**2
            if part: end-=.33*math.exp(-(min(a,2*math.pi-a)/.19)**2)
            end+=.015*math.sin(11*a)+.009*math.sin(23*a)
            p=t*end
            q=scalp(a,p,lift+.016+.0015*math.sin(29*a+2*p)*math.sin(p))
            verts.append(tuple(q))
    for i in range(rows):
        for j in range(cols):
            a=i*cols+j; c=i*cols+(j+1)%cols; faces.append((a,c,c+cols,a+cols))
    o=mesh(name,verts,[tuple(reversed(f)) for f in faces])
    uv=o.data.uv_layers.new(name='Hair flow')
    for poly in o.data.polygons:
        for li in poly.loop_indices:
            vi=o.data.loops[li].vertex_index; uv.data[li].uv=(vi%cols/cols*9,vi//cols/rows)
    bpy.context.view_layer.objects.active=o
    mod=o.modifiers.new('Root volume','SOLIDIFY'); mod.thickness=.035; mod.offset=-1
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return o

def scalp_lock(name,a,end,width=.038,start=.24,twist=.12,lift=.020):
    def point(t):
        p=start+(end-start)*t
        return scalp(a+twist*(1-t)**1.3,p,lift*(.25+.75*math.sin(math.pi*t)))
    return hair_surface(name,point,width,depth=.0028)

def crown(prefix,front=1.27,side=1.62,back=1.90,volume=.028,shag=False):
    out=[]
    for i in range(52):
        a=2*math.pi*i/52; c=math.cos(a)
        if front<.95 and c>.85: continue
        end=side+(front-side)*max(0,c)**3+(back-side)*max(0,-c)**2
        end+=.065*math.sin(i*2.4)+(.035 if shag else .018)*math.cos(i*4.2)
        out.append(scalp_lock(prefix+f'.crown{i}',a,end,.020 if shag else .021,
                   start=.20+.12*(i%3),twist=.19*math.sin(a)+.25,
                   lift=volume*(1+.17*math.sin(i*1.4))))
    return out

def nape(prefix,length=.93,spread=.20,shag=False):
    out=[]
    # Only the rear semicircle: no curtain hanging over the ear.
    for i in range(13):
        a=math.pi*.52+math.pi*.96*i/12; side=abs(math.sin(a))
        end=length+.11*side+.022*math.sin(i*2.7)
        start=scalp(a,1.05,.009); mid=scalp(a,1.63,.018)
        x=math.sin(a)*spread
        out.append(lock(prefix+f'.nape{i}',[start,mid,(x,.12-.085*side,end+.10),
                        (x*(1.16 if shag else .96),.105-.11*side,end)],.029,.005,
                        normal=(math.sin(a),-math.cos(a),0)))
    return out

def face_frame(prefix,length=1.10,spread=.24,layered=False):
    out=[]
    for s in (-1,1):
        for j in range(3 if layered else 2):
            a=s*(.85+j*.15); start=scalp(a,.60,.018)
            z=length+j*.055
            out.append(lock(prefix+f'.frame{s}.{j}',[start,(s*.28,-.16,1.39),
                        (s*(spread-.025),-.16,z+.10),(s*spread,-.125,z)],.025,.005,normal=(s*.3,-1,0)))
    return out

def curtains(prefix,split=.025,long=False):
    out=[]
    # Parted hair follows the scalp in spherical coordinates. A free Bezier arch
    # floated above the skull and looked like dog ears in profile.
    for side in (-1,1):
        for j in range(8):
            endp=(1.65 if long else 1.36)+j*.023
            enda=side*(.67+j*.095)
            def path(t,side=side,j=j,endp=endp,enda=enda):
                a=side*(.06+j*.035)*(1-t)+enda*t+split
                return scalp(a,.21+(endp-.21)*t,.010+.027*math.sin(math.pi*t))
            out.append(hair_surface(prefix+f'.curtain{side}.{j}',path,.023,depth=.004))
    return out

def hair_korean():
    out=[cap_shell(front=1.09,side=1.51,back=1.77,lift=.003)]
    out+=crown('hair.korean',front=1.35,side=1.57,back=1.82,volume=.033)

    return out

def hair_wolf():
    out=[cap_shell(front=.87,side=1.58,back=1.98,lift=.007,part=True)]
    out+=crown('hair.wolf',front=.84,side=1.82,back=2.00,volume=.043,shag=True)
    out+=curtains('hair.wolf',split=-.025,long=True)
    out+=nape('hair.wolf',length=.91,spread=.24,shag=True)
    # Layered outward tips around the jaw, joined to the crown rather than ears.
    for s in (-1,1):
        for j in range(3):
            out.append(lock(f'hair.wolf.layer{s}.{j}',[scalp(s*(1.2+j*.20),.9,.016),
                (s*.28,-.01+j*.038,1.31),(s*.23,-.08+j*.03,1.05+j*.045),
                (s*(.29-j*.009),-.10+j*.04,1.08+j*.06)],.027,.004,normal=(s,-.3,0)))
    return out

def hair_mullet():
    out=[cap_shell(front=1.04,side=1.40,back=1.90,lift=.001)]
    out+=crown('hair.mullet',front=1.21,side=1.47,back=1.91,volume=.021)
    out+=nape('hair.mullet',length=.87,spread=.18)
    return out

def hair_curtains():
    return [cap_shell(front=.84,side=1.60,back=1.93,part=True)]+crown('hair.curtains',front=.80,side=1.60,back=1.93,volume=.014)+curtains('hair.curtains')

def hair_comma():
    out=[cap_shell(front=.88,side=1.5,back=1.86,lift=.002)]
    out+=crown('hair.comma',front=.82,side=1.55,back=1.91,volume=.014)
    for j in range(8):
        def path(t,j=j):
            u=1-t
            a=.65*u**3+3*.10*u*u*t+3*(-1.20)*u*t*t-.18*t**3+j*.045
            return scalp(a,.20+(1.17+j*.014)*t,.012+.037*math.sin(math.pi*t))
        out.append(hair_surface(f'hair.comma.sweep{j}',path,.022,depth=.004))
    return out

def hair_pixie():
    out=[cap_shell(front=.95,side=1.36,back=1.78,lift=.001)]
    out+=crown('hair.pixie',front=1.13,side=1.43,back=1.81,volume=.011)
    for i in range(5):
        out.append(scalp_lock(f'hair.pixie.swept{i}',-.7+i*.28,1.19,.028,start=.46,twist=.60,lift=.024))
    return out

def long_back(prefix,length=.72,wave=0,bob=False):
    # A continuous rear curtain carries the main volume. Fine carved grooves
    # follow its fall; separate hanging ribbons otherwise expose root cracks.
    verts=[]; faces=[]; rows=44; cols=96
    for i in range(rows+1):
        t=i/rows
        for j in range(cols+1):
            a=.91+(2*math.pi-1.82)*j/cols; x=math.sin(a); y=-math.cos(a)
            end=length+.010*math.cos(25*a)+(0 if bob else .055*abs(x))
            if t<=.5:
                p=.30+(math.pi/2-.30)*t/.5
                q=scalp(a,p,.017+.0017*math.cos(36*a+2*p))
            else:
                u=(t-.5)/.5; ease=u*u*(3-2*u)
                ripple=.0025*math.cos(36*a+u)
                radius=.270+wave*math.sin(u*math.pi*2)*math.sin(u*math.pi/2)+ripple-(.050 if bob else .025)*ease
                q=Vector((x*radius,-.05+y*(.224+ripple-.022*ease),1.215+(end-1.215)*u))
            verts.append(tuple(q))
    for i in range(rows):
        for j in range(cols):
            a=i*(cols+1)+j; faces.append((a,a+cols+1,a+cols+2,a+1))
    o=mesh(prefix+'.volume',verts,faces)
    uv=o.data.uv_layers.new(name='Hair flow')
    for poly in o.data.polygons:
        for li in poly.loop_indices:
            vi=o.data.loops[li].vertex_index; uv.data[li].uv=(vi%(cols+1)/cols*7,vi//(cols+1)/rows)
    bpy.context.view_layer.objects.active=o
    mod=o.modifiers.new('Continuous hair volume','SOLIDIFY'); mod.thickness=.014; mod.offset=-1
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return [o]

def air_fringe(prefix):
    out=[]
    for i in range(10):
        a=-.60+i*.132
        out.append(scalp_lock(prefix+f'.airy{i}',a,1.28+.055*math.sin(i*1.9),.019,
                              start=.46,twist=.08,lift=.017))
    return out

def hair_bob():
    out=[cap_shell(front=.90,side=1.65,back=1.96)]
    out+=long_back('hair.bob',length=1.035,bob=True)
    out+=curtains('hair.bob',long=True)
    return out

def hair_hush():
    out=[cap_shell(front=.89,side=1.72,back=1.96)]
    out+=long_back('hair.hush',length=.73,wave=.012)
    out+=curtains('hair.hush',long=True)+face_frame('hair.hush',length=.91,spread=.28,layered=True)
    return out

def hair_airbang():
    return [cap_shell(front=.89,side=1.68,back=1.96)]+long_back('hair.airbang',length=.65)+air_fringe('hair.airbang')+face_frame('hair.airbang',length=1.05,spread=.231)

def hair_wavy():
    return [cap_shell(front=.88,side=1.70,back=1.96)]+long_back('hair.wavy',length=.69,wave=.048)+curtains('hair.wavy',long=True)+face_frame('hair.wavy',length=.93,spread=.29,layered=True)

def tied_crown(prefix):
    out=[cap_shell(front=.85,side=1.58,back=1.94,lift=.002)]
    out+=crown(prefix,front=.89,side=1.60,back=1.96,volume=.010)
    out+=air_fringe(prefix)
    for s in (-1,1):
        out.append(lock(prefix+f'.wisp{s}',[scalp(s*.80,.9,.01),(s*.24,-.17,1.34),
                       (s*.22,-.16,1.16),(s*.235,-.14,1.12)],.012,.003,normal=(s*.3,-1,0)))
    return out

def hair_bun():
    out=tied_crown('hair.bun')
    # Compact wrapped bun seated in the back of the crown, rather than a top ball.
    verts=[]; faces=[]; n=48; rows=24
    for i in range(rows+1):
        p=math.pi*(i+.002)/(rows+.004)
        for j in range(n):
            a=j*2*math.pi/n; r=1+.020*math.cos(12*a+3*p)
            verts.append((.102*math.sin(p)*math.cos(a)*r,.12+.089*math.sin(p)*math.sin(a)*r,1.46+.091*math.cos(p)))
    for i in range(rows):
        for j in range(n):
            a=i*n+j; c=i*n+(j+1)%n; faces.append((a,c,c+n,a+n))
    out.append(mesh('hair.bun.knot',verts,faces))
    return out

def hair_ponytail():
    out=tied_crown('hair.ponytail')
    for i in range(12):
        a=2*math.pi*i/12
        out.append(lock(f'hair.ponytail.tail{i}',[(.024*math.cos(a),.142,1.43),
                    (.08*math.cos(a),.37,1.43),(.06+.065*math.cos(a),.33,1.09),
                    (.10+.027*math.cos(a),.28+.016*math.sin(a),.92)],.025,.006,
                    normal=(math.cos(a),math.sin(a),0)))
    return out

HAIR=dict(korean=hair_korean,wolf=hair_wolf,mullet=hair_mullet,curtains=hair_curtains,
          comma=hair_comma,pixie=hair_pixie,bob=hair_bob,hush=hair_hush,
          airbang=hair_airbang,wavy=hair_wavy,bun=hair_bun,ponytail=hair_ponytail)
with open(os.path.join(os.path.dirname(__file__),'hairstyles.json'),encoding='utf-8') as _catalog:
    HAIR_LABELS=json.load(_catalog)

def put_hair(style, hexc='#654536'):
    m=hair_mat(hexc); parts=HAIR[style]()
    # One draw mesh. The volume cap hides roots; keep precise, tapering ends.
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts: o.select_set(True)
    bpy.context.view_layer.objects.active=parts[0]
    bpy.ops.object.join(); o=bpy.context.object; o.name='hair.'+style; o['part']=o.name
    o.data.materials.clear(); o.data.materials.append(m)
    return [o]

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
    skin=bpy.data.materials.get('Character warm peach')
    for side in (-1,1):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,location=(side*.235,-.015,1.195))
        o=bpy.context.object; o.name='Ear.'+('L' if side<0 else 'R'); o['part']=o.name
        o.scale=(.038,.029,.052); o.data.materials.append(skin)
        o.data.transform(o.matrix_basis.copy()); o.matrix_world=Matrix.Identity(4)
        for poly in o.data.polygons: poly.use_smooth=True
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
    is_head=name.startswith(('hair.','Ear.')) or name in ['Face','Small nose','Small mouth'] or name.startswith(('Dark embroidered eye','Eye catchlight','Soft cheek'))
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
