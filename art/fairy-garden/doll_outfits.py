"""Six interchangeable outfits; baked meshes share doll_hair's body morphs and arm rig.
Blender Z-up, front -Y. Catalog exported alongside doll.json and outfits.mjs.
"""
import bpy, math, json, os
from mathutils import Matrix
import doll_hair as D
CATALOG=json.load(open(os.path.join(os.path.dirname(__file__),'outfits.json')))
def tag(o,style,slot='cloth',part='Tunic body',rig=None):
    o['outfit']=style;o['colorSlot']=slot;o['deformPart']=part
    if rig:o['rigPart']=rig
    o['part']='outfit_'+style+'_'+o.name.replace(' ','_').replace('.','_')
    o.name=o['part'];return o

def material(style,slot):
    m=bpy.data.materials.new(style+'_'+slot);m.diffuse_color=tuple(int(CATALOG[style]['colors'][slot][i:i+2],16)/255 for i in (1,3,5))+(1,);m.use_nodes=True
    m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=m.diffuse_color
    m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.92
    return m

def build(base):
    # Keep the original silhouette and props only with the original outfit.
    for o in base:
        n=o.get('part',o.name)
        if n.startswith(('Tunic','Cream collar','Wood button','Satchel','Little herb','Held herb')) or 'sleeve' in n:
            o['outfit']='traveler'
            if n.startswith('Tunic') or 'sleeve' in n:o['colorSlot']='cloth'
            elif n.startswith('Cream collar'):o['colorSlot']='trim'
        elif n.startswith('Linen leggings'):o['colorSlot']='bottom'
        elif n.startswith('Rounded boots'):o['colorSlot']='boots'
    out=[]
    for style in list(CATALOG)[1:]:
        mats={k:material(style,k) for k in CATALOG[style]['colors']}
        def loft(name,rings,slot='cloth'):
            o=D.loft(name,rings,mats[slot]);out.append(tag(o,style,slot));return o
        def panel(name,points,slot='trim'):
            o=D.mesh(name,points,[tuple(range(len(points)))],mats[slot]);mod=o.modifiers.new('Cloth thickness','SOLIDIFY');mod.thickness=.008
            bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
            out.append(tag(o,style,slot));return o
        def bead(name,x,y,z,r=.012,slot='trim'):
            bpy.ops.mesh.primitive_uv_sphere_add(segments=12,ring_count=8,radius=r,location=(x,y,z));o=bpy.context.object;o.name=name;o.data.transform(o.matrix_basis);o.matrix_world=Matrix.Identity(4);o.data.materials.append(mats[slot]);out.append(tag(o,style,slot));return o
        # Each sleeve remains attached to its own original arm pivot.
        for src in base:
            n=src.get('part',src.name)
            if 'sleeve' not in n:continue
            o=src.copy();o.data=src.data.copy();bpy.context.collection.objects.link(o);o.data.materials.clear();o.data.materials.append(mats['trim' if style=='garden' else 'cloth'])
            out.append(tag(o,style,'trim' if style=='garden' else 'cloth',n,'leftArm' if n.startswith('Left') else 'rightArm'))
        lower=.52 if style in ('academy','cardigan') else .30 if style=='alchemist' else .37 if style=='garden' else .51
        width=.255 if style in ('garden','alchemist') else .193
        loft('Tailored_body',[(lower,width,.135),(lower+.025,width,.136),(.64,.187,.127),(.77,.17,.125),(.89,.197,.137),(.985,.178,.118),(1.04,.102,.086)])
        # Collar pieces hug the front rather than floating across the face.
        for side in [-1,1]:
            panel('Folded_collar',[(side*.015,-.092,1.045),(side*.108,-.088,1.03),(side*.147,-.12,.945),(side*.052,-.148,.92)])
        if style=='academy':
            for x in [-.046,.046]:
                for z in [.67,.77,.87]:bead('Brass_button',x,-.14,z)
            for x in [-.105,.105]:panel('Welt_pocket',[(x-.037,-.14,.64),(x+.037,-.14,.64),(x+.034,-.144,.617),(x-.034,-.144,.617)])
        elif style=='garden':
            panel('Apron_bib',[(-.085,-.14,.945),(.085,-.14,.945),(.075,-.145,.72),(-.075,-.145,.72)])
            panel('Linen_apron',[(-.075,-.145,.73),(.075,-.145,.73),(.173,-.151,.43),(-.173,-.151,.43)])
            # stitched pocket, distinct from the apron cloth
            panel('Apron_pocket',[(-.048,-.161,.63),(.048,-.161,.63),(.046,-.163,.54),(-.046,-.163,.54)],'cloth')
            for side in [-1,1]:bead('Strap_button',side*.065,-.152,.9,.015,'cloth')
        elif style=='alchemist':
            panel('Robe_front',[(-.028,-.15,.91),(.028,-.15,.91),(.042,-.145,.34),(-.042,-.145,.34)])
            for side in [-1,1]:
                for z in [.49,.65]:
                    x=side*.13
                    panel('Embroidered_star',[(x,-.151,z+.025),(x+.01,-.153,z+.008),(x+.025,-.151,z),(x+.008,-.153,z-.008),(x,-.151,z-.025),(x-.008,-.153,z-.008),(x-.025,-.151,z),(x-.01,-.153,z+.008)])
        elif style=='ranger':
            # Short open-front cape; open arms and hands remain visible while walking.
            verts=[];faces=[];n=40
            for z,rx,ry in [(1.055,.105,.09),(1.01,.215,.145),(.88,.29,.184),(.73,.3,.19)]:
                for j in range(n+1):
                    a=-.95+j*(math.pi+1.9)/n;verts.append((rx*math.cos(a),ry*math.sin(a),z))
            for k in range(3):
                for j in range(n):a=k*(n+1)+j;faces.append((a,a+1,a+n+2,a+n+1))
            o=D.mesh('Open_shoulder_cape',verts,faces,mats['cloth']);out.append(tag(o,style));o.data.materials[0].use_backface_culling=False
            bead('Cloak_clasp',0,-.105,1.015,.022)
            panel('Leather_belt',[(-.17,-.141,.74),(.17,-.141,.74),(.17,-.141,.7),(-.17,-.141,.7)])
        else:
            panel('Cream_knit_insert',[(-.075,-.142,.99),(.075,-.142,.99),(.055,-.151,.65),(-.055,-.151,.65)])
            for side in [-1,1]:
                panel('Cardigan_edge',[(side*.07,-.151,.98),(side*.1,-.146,.97),(side*.043,-.155,.6),(side*.014,-.155,.6)])
                panel('Patch_pocket',[(side*.09-.034,-.145,.67),(side*.09+.034,-.145,.67),(side*.09+.034,-.146,.59),(side*.09-.034,-.146,.59)],'cloth')
            for z in [.55,.61,.67]:bead('Knit_button',0,-.158,z,.013)
    return out
