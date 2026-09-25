"""Give the v2 doll a skeleton so it can move like the old traveler (arms and legs swing
about shoulder/hip pivots). The Hunyuan body is one fused mesh, so instead of cutting parts
off (which leaves a hole at the shoulder when the arm swings) it is skinned with smooth
procedural weights. Bone names match the runtime rig labels: leftArm/rightArm/leftLeg/rightLeg
(left = -X, same as apps/fairy-garden/traveler.mjs). Bones are direct children of the
armature (no root bone) so their parent space is the model space; pivots are also written to
the armature's extras as dollRig (three.js Y-up coordinates), like the old doll.glb.
Usage: python3 rig_doll.py in.glb out.glb"""
import bpy,sys,numpy as np
from mathutils import Vector
src,out=sys.argv[-2:]
for o in list(bpy.data.objects):bpy.data.objects.remove(o)
bpy.ops.import_scene.gltf(filepath=src)
M=next(o for o in bpy.data.objects if o.type=='MESH');M.name='DollBody'
M.data.transform(M.matrix_world);M.matrix_world.identity()
ss=lambda t:(lambda u:u*u*(3-2*u))(np.clip(t,0,1))
# Pivots (Blender Z-up): shoulder where the A-pose arm leaves the body, hip at the leg top.
SH=(.165,0,.655);HAND=(.275,0,.40);HIP=(.075,0,.30);FOOT=(.08,0,.03)
bpy.ops.object.armature_add(location=(0,0,0));A=bpy.context.object;A.name='DollRig'
bpy.ops.object.mode_set(mode='EDIT');eb=A.data.edit_bones;eb.remove(eb[0])
def bone(n,h,t):b=eb.new(n);b.head=Vector(h);b.tail=Vector(t);return b
for side,s in (('left',-1),('right',1)):
    bone(side+'Arm',(s*SH[0],SH[1],SH[2]),(s*HAND[0],HAND[1],HAND[2]))
    bone(side+'Leg',(s*HIP[0],HIP[1],HIP[2]),(s*FOOT[0],FOOT[1],FOOT[2]))
bone('body',(0,0,.30),(0,0,.72))
bpy.ops.object.mode_set(mode='OBJECT')
P=np.array([v.co[:] for v in M.data.vertices]);x,z=P[:,0],P[:,2];ax=np.abs(x)
# Arms: outside the torso side line, below the shoulder top; blend band ~2.5cm.
xb=.150+(z-.46)*(-.03/.2)
arm=ss((ax-xb)/.025)*ss((.72-z)/.07)*(z>.33)
# Legs: below the crotch, blended over 6cm; split by side.
leg=ss((.31-z)/.07)*(1-arm)
body=np.clip(1-arm-leg,0,1)
groups={n:M.vertex_groups.new(name=n) for n in ('body','leftArm','rightArm','leftLeg','rightLeg')}
for i in range(len(P)):
    s='left' if x[i]<0 else 'right'
    if body[i]>1e-4:groups['body'].add([i],float(body[i]),'REPLACE')
    if arm[i]>1e-4:groups[s+'Arm'].add([i],float(arm[i]),'REPLACE')
    if leg[i]>1e-4:groups[s+'Leg'].add([i],float(leg[i]),'REPLACE')
mod=M.modifiers.new('Rig','ARMATURE');mod.object=A;M.parent=A
H=bpy.data.objects.get('HeadAnchor')
if H:H.parent=A
# extras for the runtime: pivots in three.js (Y-up) model space
tj=lambda p:[round(p[0],4),round(p[2],4),round(-p[1],4)]
A['dollRig']={s+'Arm':tj((sg*SH[0],SH[1],SH[2])) for s,sg in (('left',-1),('right',1))}|{s+'Leg':tj((sg*HIP[0],HIP[1],HIP[2])) for s,sg in (('left',-1),('right',1))}
print('verts',len(P),'arm',int((arm>.5).sum()),'leg',int((leg>.5).sum()))
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',use_selection=True,export_extras=True,export_skins=True,export_animations=False)
