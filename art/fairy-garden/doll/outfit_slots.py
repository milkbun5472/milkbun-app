"""Garment helpers shared by the full assembly and single-outfit migrations.
Every face gets a dye slot (0 cloth / 1 trim / 2 bottom / 3 accent) in COLOR_0.r from its own texels;
arm weights feed body_shape.deform so clothes follow the body sliders."""
import bmesh,os,numpy as np
SLOTS=['cloth','trim','bottom','accent']
def base_image(mat):
    for n in mat.node_tree.nodes:
        if n.type=='BSDF_PRINCIPLED':
            l=n.inputs['Base Color'].links
            return l[0].from_node.image if l else None
def grey(mat):
    """Hair base colour to neutral grey (brightness only): the runtime dyes it."""
    im=base_image(mat)
    if not im:return
    px=np.array(im.pixels[:]).reshape(-1,4);y=px[:,:3]@[.2126,.7152,.0722]
    y=np.clip(y/np.percentile(y,92),0,1);px[:,:3]=y[:,None];im.pixels[:]=px.ravel()
    # Save as WEBP, then pack those bytes: a modified image packs (and exports, format AUTO) as PNG,
    # ~4x the bytes in the always-downloaded doll.glb.
    import tempfile;tmp=os.path.join(tempfile.mkdtemp(),'hair.webp')
    im.filepath_raw=tmp;im.file_format='WEBP';im.save();im.unpack(method='REMOVE') if im.packed_file else None;im.filepath=tmp;im.reload();im.pack()
def arm_weights(o):
    gi={g.name:g.index for g in o.vertex_groups};w=np.zeros(len(o.data.vertices))
    for v in o.data.vertices:
        for g in v.groups:
            if g.group in (gi.get('leftArm'),gi.get('rightArm')):w[v.index]+=g.weight
    return np.clip(w,0,1)
def colour_slots(o,bottom=True,accent=True,opts={}):
    """Per-face slot from the face's own texels, then 2 rounds of neighbour majority."""
    im=base_image(o.material_slots[0].material);W,H=im.size;tex=np.array(im.pixels[:]).reshape(H,W,4)[:,:,:3]**(1/2.2)
    bm=bmesh.new();bm.from_mesh(o.data);bm.faces.ensure_lookup_table();uv=bm.loops.layers.uv.active
    slot={}
    for f in bm.faces:
        U=np.array([l[uv].uv[:] for l in f.loops]+[np.mean([l[uv].uv[:] for l in f.loops],0)])
        c=np.median(tex[np.clip((U[:,1]*H).astype(int),0,H-1),np.clip((U[:,0]*W).astype(int),0,W-1)],0)
        z=f.calc_center_median().z;lum=c@[.2126,.7152,.0722]
        pale=(c[0]-c[2])<.07   # trousers vs a pink sweater hem at the same height
        low=z<opts.get('bottom_z',.34) or (z<opts.get('bottom_pale_z',-1) and pale)   # a band above the cut counts only if trouser-coloured
        s=2 if bottom and low and abs(f.calc_center_median().x)<.2 else 3 if accent and c[0]-c[2]>.12 else 1 if lum>opts.get('trim_lum',.92) else 0
        if opts.get('no_trim') and s==1:s=0
        if z<opts.get('sole_z',-1):s=1   # the shell's own shoes follow the trim colour
        if f.material_index==1:s=SLOTS.index(opts.get('under','trim'))   # the under-layer follows the shirt (or sweater) colour
        slot[f.index]=s
    for _ in range(2):
        new={}
        for f in bm.faces:
            nb=[slot[k.index] for e in f.edges for k in e.link_faces if k!=f]
            new[f.index]=max(set(nb),key=nb.count) if nb and nb.count(slot[f.index])==0 and slot[f.index]!=3 else slot[f.index]
        slot=new
    for a in list(o.data.color_attributes):o.data.color_attributes.remove(a)
    ca=o.data.color_attributes.new('slot','BYTE_COLOR','CORNER');o.data.color_attributes.active_color=ca;o.data.color_attributes.render_color_index=0
    for pl in o.data.polygons:
        for li in pl.loop_indices:ca.data[li].color=(slot[pl.index]/4+.02,0,0,1)
    base={}
    for k in range(4):
        fs=[f for f in bm.faces if slot[f.index]==k]
        if not fs:continue
        U=np.array([np.mean([l[uv].uv[:] for l in f.loops],0) for f in fs])
        c=np.median(tex[np.clip((U[:,1]*H).astype(int),0,H-1),np.clip((U[:,0]*W).astype(int),0,W-1)],0)
        base[SLOTS[k]]='#%02x%02x%02x'%tuple(int(round(v*255)) for v in np.clip(c,0,1))
    bm.free();return base
