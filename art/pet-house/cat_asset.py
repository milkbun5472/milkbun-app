"""Smooth control rig and fur-only dye mask for Lisa's Hunyuan kitten.

Weights are computed in the actual mesh rest coordinates; coincident UV seam
vertices receive identical weights. All deformation controls are siblings so the
runtime can place IK joints in model space without duplicating a hierarchy solver.
"""
import bpy, numpy as np, json, math
from pathlib import Path
from mathutils import Vector

def smooth(t):
    t=np.clip(t,0,1);return t*t*(3-2*t)

def web(p):return [round(float(p[0]),6),round(float(p[2]),6),round(float(-p[1]),6)]

def rig_cat(objects,out):
    return rig_pet(objects,out,"cat")

def rig_pet(objects,out,species):
    out=Path(out)
    mesh=next(o for o in objects if o.type=='MESH');mesh.name='Kitten' if species=='cat' else 'Puppy'
    mesh.data.transform(mesh.matrix_world);mesh.matrix_world.identity()
    points=np.array([v.co[:] for v in mesh.data.vertices]);x,y,z=points.T
    bones={
      'chest':[(0,-.05,.29),(0,-.15,.35)],
      'pelvis':[(0,.24,.28),(0,.32,.35)],
      'head':[(0,-.18,.37),(0,-.29,.55)],
      'tail0':[(0,.355,.355),(0,.47,.50)],
      'tail1':[(0,.47,.50),(0,.505,.65)],
      'tail2':[(0,.505,.65),(0,.475,.81)]
    }
    if species=='dog':
        bones={
          'chest':[(0,-.10,.30),(0,-.20,.36)],'pelvis':[(0,.22,.31),(0,.30,.37)],
          'head':[(0,-.19,.38),(0,-.30,.55)],
          'tail0':[(0,.35,.405),(0,.46,.51)],
          'tail1':[(0,.46,.51),(0,.47,.65)],
          'tail2':[(0,.47,.65),(0,.32,.69)]}
    legs={}
    for side,sgn in [('L',-1),('R',1)]:
        for kind,root,knee,ankle,toe in [
          ('front',(.125,-.12,.315),(.12,-.10,.175),(.11,-.215,.072),(.11,-.27,.04)),
          ('back',(.155,.285,.29),(.155,.17,.18),(.125,.35,.072),(.12,.28,.03))]:
            if species=='dog':
                root,knee,ankle,toe=([(.135,-.18,.32),(.13,-.16,.18),(.125,-.275,.065),(.125,-.335,.03)] if kind=='front' else [(.155,.255,.32),(.16,.135,.20),(.135,.30,.065),(.13,.24,.025)])
            pts=[(sgn*p[0],p[1],p[2]) for p in [root,knee,ankle,toe]]
            key=kind+side;legs[key]={'root':web(pts[0]),'knee':web(pts[1]),'ankle':web(pts[2]),'toe':web(pts[3]),'bend':-1 if kind=='front' else 1}
            for i,suffix in enumerate(['Upper','Lower','Paw']):bones[key+suffix]=[pts[i],pts[i+1]]
    bpy.ops.object.select_all(action='DESELECT')
    bpy.ops.object.armature_add(location=(0,0,0));rig=bpy.context.object;rig.name='KittenRig' if species=='cat' else 'PuppyRig'
    bpy.ops.object.mode_set(mode='EDIT');eb=rig.data.edit_bones;eb.remove(eb[0])
    for name,(a,b) in bones.items():
        bone=eb.new(name);bone.head=a;bone.tail=b
    bpy.ops.object.mode_set(mode='OBJECT')
    groups={name:mesh.vertex_groups.new(name=name) for name in bones}
    weights=np.zeros((len(points),len(bones)),dtype=float);names=list(bones)
    def setcol(name,v):weights[:,names.index(name)]=v
    ax=np.abs(x)
    # Head and tail masks are disjoint; fur clumps blend through the neck/root.
    # The whole skull (including the rear dome and ears) is one rigid
    # region. Only the lower neck blends with the chest; a front/back Y
    # threshold alone would assign the back of the skull to the torso.
    face=smooth((-.13-y)/.10)*smooth((z-.275)/.08)
    skull=smooth((z-.34)/.07)*(1-smooth((y-.18)/.08))
    head=np.maximum(face,skull)
    tail=smooth((y-(.335 if species=='cat' else .32))/.095)*smooth((z-(.335 if species=='cat' else .415))/.075)
    limb=smooth((.335-z)/.105)*(1-head)*(1-tail)
    # Belly belongs to the torso above the crotch; paw soles are entirely rigid.
    limb*=np.where(z<.115,1,smooth((ax-.065)/.055))
    front=1-smooth((y+.06)/.14)
    back=smooth((y-.08)/.12)
    paw=1-smooth((z-.072)/.064)
    upper=smooth((z-.155)/.10)*(1-paw)
    lower=np.clip(1-paw-upper,0,1)
    for side,sign in [('L',-1),('R',1)]:
        side_mask=(x<0) if sign<0 else (x>=0)
        for kind,k in [('front',front),('back',back)]:
            a=limb*k*side_mask
            for suffix,w in [('Upper',upper),('Lower',lower),('Paw',paw)]:setcol(kind+side+suffix,a*w)
    setcol('head',head)
    t=(z-.355)/(.81-.355)
    tw=np.stack([np.exp(-((t-c)/.27)**2) for c in [.12,.48,.87]],axis=1);tw/=tw.sum(1)[:,None]
    for i in range(3):setcol('tail'+str(i),tail*tw[:,i])
    torso=np.clip(1-weights.sum(1),0,1);pelvis=smooth((y+.08)/.37)
    setcol('pelvis',torso*pelvis);setcol('chest',torso*(1-pelvis))
    # GLTF supports four weights. Drop only negligible blends and renormalize.
    for i,row in enumerate(weights):
        active=np.argsort(row)[-4:];total=row[active].sum()
        for j in active:
            if row[j]>1e-6:groups[names[j]].add([i],float(row[j]/total),'REPLACE')
    arm=mesh.modifiers.new('KittenSkin','ARMATURE');arm.object=rig;mesh.parent=rig
    bounds=[web(points.min(0)),web(points.max(0))]
    meta={'version':2,'height':float(points[:,2].max()-points[:,2].min()),
          'bones':{n:{'head':web(a),'tail':web(b)} for n,(a,b) in bones.items()},'legs':legs,
          'species':species,'duty':.68,'stride':.13,'cycle':1.00 if species=='cat' else .95,'lift':.025 if species=='cat' else .027,
          'bounds':bounds,'headRigid':{'minHeight':.41,'maxForwardY':.18}}
    rig['catRig']=meta
    mask_report=make_dye_mask(mesh,out,species)
    meta['dye']=mask_report
    (out/(species+'-rig.json')).write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
    rig['catRig']=meta
    return objects+[rig]

def make_dye_mask(mesh,out,species="cat"):
    mat=mesh.data.materials[0];bsdf=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    image=next(n.image for n in mat.node_tree.nodes if n.type=='TEX_IMAGE' and n.image and n.outputs['Color'].is_linked and any(l.to_node==bsdf and l.to_socket.name=='Base Color' for l in n.outputs['Color'].links))
    w,h=image.size;pixels=np.empty(w*h*4,dtype=np.float32);image.pixels.foreach_get(pixels);a=pixels.reshape(h,w,4)[:,:,:3]
    lum=a@np.array([.2126,.7152,.0722]);chroma=a.max(2)-a.min(2)
    protected=(chroma>.105)|(lum<.36)
    patch=1-smooth((lum-.75)/.14);base=1-patch
    # Keep coloured facial details and eye outlines completely unchanged.
    fur=1-smooth((chroma-(.065 if species=="cat" else .24))/(.04 if species=="cat" else .12));fur*=smooth((lum-.36)/.12)
    uv=mesh.data.uv_layers.active.data
    points=np.array([v.co[:] for v in mesh.data.vertices]);x,y,z=points.T
    feature=np.zeros(len(points))
    for cx in ([-.115,.115] if species=='cat' else [-.075,.075]):
        ell=((x-cx)/(.070 if species=='cat' else .09))**2+((y+(.416 if species=='cat' else .382))/(.06 if species=='cat' else .085))**2+((z-(.51 if species=='cat' else .617))/(.082 if species=='cat' else .085))**2
        feature=np.maximum(feature,1-smooth((ell-.70)/.35))
    ell=(x/.04)**2+((y+.448)/.032)**2+((z-.425)/.032)**2
    feature=np.maximum(feature,1-smooth((ell-.7)/.35))
    if species=='dog':
        # Puppy feature centres were measured from the original dark/pink UV pixels.
        for cy,cz,rx,ry,rz in [(-.489,.555,.075,.075,.065),(-.445,.49,.065,.065,.065)]:
            ell=(x/rx)**2+((y-cy)/ry)**2+((z-cz)/rz)**2
            feature=np.maximum(feature,1-smooth((ell-.7)/.35))
    mesh.data.calc_loop_triangles()
    # Raster a protective UV mask from semantic face locations, avoiding fur dye
    # on even nearly grey reflections inside the eyeballs.
    for tri in mesh.data.loop_triangles:
        values=feature[list(tri.vertices)]
        if values.max()<.01:continue
        q=np.array([uv[i].uv[:] for i in tri.loops])*[w-1,h-1]
        xmin=max(0,int(np.floor(q[:,0].min())));xmax=min(w-1,int(np.ceil(q[:,0].max())))
        ymin=max(0,int(np.floor(q[:,1].min())));ymax=min(h-1,int(np.ceil(q[:,1].max())))
        if xmax<xmin or ymax<ymin:continue
        yy,xx=np.mgrid[ymin:ymax+1,xmin:xmax+1];a0,b,c=q
        den=(b[1]-c[1])*(a0[0]-c[0])+(c[0]-b[0])*(a0[1]-c[1])
        if abs(den)<1e-5:continue
        u=((b[1]-c[1])*(xx-c[0])+(c[0]-b[0])*(yy-c[1]))/den
        v=((c[1]-a0[1])*(xx-c[0])+(a0[0]-c[0])*(yy-c[1]))/den
        inside=(u>=-.02)&(v>=-.02)&(u+v<=1.02)
        val=np.clip(u*values[0]+v*values[1]+(1-u-v)*values[2],0,1)
        region=fur[ymin:ymax+1,xmin:xmax+1];region[:]=np.minimum(region,1-val*inside)
    if species=='dog':
        # Protect UV seams too: linear sampling and quantized glTF UVs can
        # otherwise mix an eye-island edge with unused atlas pixels.
        for _ in range(3):
            padded=np.pad(fur,1,mode='edge')
            fur=np.minimum.reduce([padded[dy:dy+h,dx:dx+w] for dy in range(3) for dx in range(3)])
    r=np.clip(patch*fur,0,1);g=np.clip(base*fur,0,1)
    mask=bpy.data.images.new('KittenFurMask',width=w,height=h,alpha=True)
    mask.colorspace_settings.name='Non-Color';rgba=np.stack([r,g,np.zeros_like(r),np.ones_like(r)],axis=2)
    mask.pixels.foreach_set(rgba.astype(np.float32).reshape(-1));mask.file_format='PNG';mask.filepath_raw=str(out/(species+'-mask.png'));mask.save()
    gray=a[(r>.7)&(lum>.5)];white=a[g>.8]
    def hexcolor(arr):return '#'+''.join(f'{round(float(np.median(arr,axis=0)[i])*255):02x}' for i in range(3))
    report={'patchReference':hexcolor(gray),'baseReference':hexcolor(white),
            'maskSize':[w,h],'patchPixels':int((r>.5).sum()),'basePixels':int((g>.5).sum()),
            'protectedPixels':int(((r+g)<.01).sum())}
    print('FUR MASK',json.dumps(report));return report
