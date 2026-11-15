"""Bring supplied braids forward over the shoulders; isolate the blue tie faces
as a separately dyeable material without changing topology or UVs.
Usage: Blender -b --python prepare_braids.py -- fitted.glb head-anchor.json out.glb
"""
import bpy,sys,numpy as np,json,runpy
from pathlib import Path
src,anchor,out=sys.argv[-3:]
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=src)
h=next(o for o in bpy.data.objects if o.type=='MESH');m=h.data;mat=m.materials[0]
bs=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED');im=bs.inputs['Base Color'].links[0].from_node.image
w,t=im.size;px=np.array(im.pixels[:]).reshape(t,w,4);uv=m.uv_layers.active
aj=json.loads(Path(anchor).read_text());radius=aj['radius'];center=aj['center'][2]
# Measure each braid's own curved centre line below the cap. Fitting a smooth
# curve avoids flattening individual woven lobes or moving the whole braid.
original=np.array([v.co[:] for v in m.vertices]);world=original*radius+np.array(aj['center'])
axes={}
for side in [-1,1]:
 samples=[]
 for z in np.linspace(.47,.71,13):
  row=world[(np.abs(world[:,2]-z)<.012)&(world[:,0]*side>.05)]
  if len(row)>10:samples.append([z,*((row.min(0)+row.max(0))[:2]/2)])
 samples=np.array(samples)
 axes[side]=[np.polyfit(samples[:,0],samples[:,axis],2) for axis in [1,2]]
def smooth(value):
 value=np.clip(value,0,1)
 return value*value*(3-2*value)
def forward(points):
 world=points*radius+np.array(aj['center']);q=world.copy();z=world[:,2]
 slim=smooth((.80-z)/.10)*smooth((np.abs(world[:,0])-.05)/.05)
 for side in [-1,1]:
  mask=world[:,0]*side>0
  # End the centre-line fit at the last measured section to keep tips stable.
  sample_z=np.clip(z,.47,.71)
  cx,cy=[np.polyval(coef,sample_z) for coef in axes[side]]
  q[mask,0]-=.32*slim[mask]*(world[mask,0]-cx[mask])
  q[mask,1]-=.28*slim[mask]*(world[mask,1]-cy[mask])
 # Carry the root forward with the braid instead of shearing only its tail.
 # Use a broad depth blend so the cheek wisps move less than the roots.
 # Each braid cross-section moves together, including the band.
 lower=smooth((.78-z)/.06)
 rear=smooth((world[:,1]+.25)/.50)
 w=smooth((.94-z)/.24)*(lower+(1-lower)*rear)
 q[:,1]-=.18*w
 q[:,0]+=.055*np.tanh(points[:,0]/.5)*w
 # Soften the oversized rear overhang while retaining the crown height.
 back=np.maximum(0,world[:,1]-.10)
 q[:,1]-=.20*back*smooth(back/.15)*smooth((z-.73)/.15)
 # Balance the posterior silhouette into one broad arc. Lift its low
 # corner slightly and fill the upper-back curve without bulging the nape.
 rear_round=smooth((world[:,1]-.035)/.16)*smooth((z-.74)/.10)
 q[:,1]+=.035*np.exp(-((z-1.12)/.17)**2)*rear_round
 q[:,2]+=.025*np.exp(-((z-1.00)/.18)**2)*rear_round
 # Lower only the tall cap, blending above the forehead. The cheek
 # wisps, braid roots, lengths and independently dyed bands stay in place.
 crown=np.maximum(0,q[:,2]-.95)
 q[:,2]-=.30*crown*smooth(crown/.10)
 # Follow Lisa's marked side contour: remove the excess posterior depth,
 # leaving the forehead and hanging braids fixed. A smooth rear half-space
 # compression retains continuous rounded strands instead of a cut plane.
 posterior=np.maximum(0,q[:,1])
 cap=smooth((q[:,2]-.72)/.14)
 q[:,1]-=.24*posterior*smooth(posterior/.12)*cap
 # Lisa also requested a fuller lower edge. Fill the lower occipital arc
 # smoothly above the braid roots, keeping room for the doll's real skull.
 fullness=.035*np.exp(-((q[:,2]-.84)/.10)**2)*smooth(posterior/.16)*smooth((q[:,2]-.72)/.08)
 q[:,1]+=fullness
 return (q-np.array(aj['center']))/radius
report=runpy.run_path(str(Path(__file__).with_name('hair_deform.py')))['deform_mesh'](m,forward)
band=mat.copy();band.name='hair_accessory';band['hairAccessory']=True;m.materials.append(band);chosen=[]
for f in m.polygons:
 u=np.array([uv.data[i].uv[:] for i in f.loop_indices]);u=np.vstack([u,u.mean(0)]);c=np.median(px[np.clip((u[:,1]*t).astype(int),0,t-1),np.clip((u[:,0]*w).astype(int),0,w-1),:3],axis=0)
 if c[2]>c[0]*1.12 and c[1]>c[0]*1.08:
  f.material_index=1;chosen.append(f.index)
assert len(chosen)>50,len(chosen)
bpy.ops.object.select_all(action='DESELECT');h.select_set(True)
bpy.ops.export_scene.gltf(filepath=out,export_format='GLB',use_selection=True,export_extras=True)
Path(out).with_suffix('.json').write_text(json.dumps({**report,'accessoryFaces':len(chosen),'totalFaces':len(m.polygons)},indent=2));print('BLUE BAND FACES',len(chosen))
