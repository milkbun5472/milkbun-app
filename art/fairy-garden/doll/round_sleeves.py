"""Shared full-volume sleeve surface, binding and six body morphs."""
from pathlib import Path
import math,runpy,bpy,numpy as np
from mathutils import Vector
HERE=Path(__file__).resolve().parent

def round_sleeves(o, profile=None, atlas=(.285,.615,.085,.105), slot=0, inset=0):
    rig=o.parent;mat=o.data.materials[0]
    shape=runpy.run_path(str(HERE / 'body_shape.py'))['deform']
    for sign,side in [(-1,'left'),(1,'right')]:
        axis=Vector((sign*.095,0,-.19)).normalized();u=Vector((0,1,0));v=axis.cross(u).normalized();start=Vector((sign*.153,0,.655));verts=[];faces=[]
        rings=profile or [(-.055,.003),(-.047,.030),(-.030,.051),(-.01,.063),(0.015,.067),(.04,.068),(.065,.068),(.09,.067),(.115,.065),(.14,.061),(.162,.056),(.178,.050),(.182,.048),(.188,.050),(.208,.048),(.214,.045),(.214,.038),(.196,.038)]
        N=40
        for t,r in rings:
            for j in range(N):
                a=j*2*math.pi/N;fold=.0012*math.cos(a*7+t*30)*math.sin(max(0,min(1,t/.18))*math.pi);rib=.00065*math.cos(a*20) if .182<t<.214 else 0;verts.append(start+axis*t+(u*math.cos(a)+v*math.sin(a))*(r*.87+fold+rib))
        if inset:
            for i,p in enumerate(verts):
                fade=1-max(0,min(1,rings[i//N][0]/.16));p.x-=sign*inset*fade;p.z-=inset*.35*fade
        for i in range(len(rings)-1):
            for j in range(N):a=i*N+j;b=i*N+(j+1)%N;faces.append((a,b,b+N,a+N))
        faces.append(tuple(reversed(range(N))))
        mesh=bpy.data.meshes.new('SleeveSurface');mesh.from_pydata(verts,[],faces);mesh.update();s=bpy.data.objects.new('outfit_'+o['outfit']+'_'+side+'_sleeve',mesh);bpy.context.collection.objects.link(s);s.parent=rig;s['outfit']=o['outfit'];s['roundSleeveVersion']=1;s['sleeveSide']=side;s['slotBase']=o['slotBase'].to_dict();mesh.materials.append(mat.copy())
        mesh.uv_layers.new(name='UVMap');mesh.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='CORNER')
        # Look both up after both exist: adding an attribute can invalidate an earlier layer handle (Blender 5).
        uv_layer=mesh.uv_layers['UVMap'];color=mesh.color_attributes['Color']
        for f in mesh.polygons:
            f.use_smooth=True
            for li in f.loop_indices:
                vi=mesh.loops[li].vertex_index;ri,j=divmod(vi,N)
                # One clean, continuous knit patch: do not interpolate between atlas islands.
                phase=(j+(N if j==0 and any(mesh.loops[k].vertex_index%N==N-1 for k in f.loop_indices) else 0))/N
                uv_layer.data[li].uv=(atlas[0]+atlas[2]*phase,atlas[1]+atlas[3]*max(0,min(1,(rings[ri][0]+.055)/(rings[-2][0]+.055))))
                color.data[li].color=(slot,0,0,1)
        group=s.vertex_groups.new(name=side+'Arm');group.add(list(range(len(verts))),1,'REPLACE');arm=np.ones(len(verts))
        mod=s.modifiers.new('Rig','ARMATURE');mod.object=rig
        s.shape_key_add(name='Basis');P=np.array([p[:] for p in verts])
        for key in ['height','shoulder','waist','flare','build','head']:
            k=s.shape_key_add(name=key);k.value=0;delta=shape(P,arm,key,True)
            for i,p in enumerate(k.data):p.co=Vector(P[i]+delta[i])
