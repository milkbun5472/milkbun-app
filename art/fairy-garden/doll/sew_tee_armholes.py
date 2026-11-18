"""Blender: open the actual armholes and stitch cuffs to torso by boundary order.
Input source contains meshes.json captured before animation; output is a shared
surface plus barycentric transfers from the original meshes. No wardrobe export.
"""
import bpy,bmesh,json,sys,math
from pathlib import Path
from mathutils import Vector
source,output=map(Path,sys.argv[sys.argv.index('--')+1:]);output.mkdir(parents=True,exist_ok=True);src=json.loads((source/'meshes.json').read_text());P=[];F=[];loops={}
for row in src['meshes']:
 if row['id'] not in [1,3,4]:continue
 bm=bmesh.new();verts=[bm.verts.new(row['attributes']['position']['values'][i:i+3]) for i in range(0,row['vertices']*3,3)]
 for i in range(0,len(row['index']),3):bm.faces.new([verts[j] for j in row['index'][i:i+3]])
 bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=1e-6)
 if row['id']==1:
  gone=[]
  for f in bm.faces:
   p=f.calc_center_median()
   if abs(p.x)>.075 and ((p.y-.642)/.060)**2+(p.z/.066)**2<1:gone.append(f)
  bmesh.ops.delete(bm,geom=gone,context='FACES')
 else:
  sign=-1 if row['id']==3 else 1;axis=Vector((sign*.4472136,-.8944272,0));center=Vector((sign*.153,.655,0))+axis*.012
  bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=1e-7,plane_co=center,plane_no=axis,clear_inner=True)
  bmesh.ops.delete(bm,geom=[v for v in bm.verts if not v.link_faces],context='VERTS')
 bm.verts.ensure_lookup_table();index={v:len(P)+i for i,v in enumerate(bm.verts)};P.extend(list(v.co) for v in bm.verts)
 for f in bm.faces:F.append([index[v] for v in f.verts])
 edges={e for e in bm.edges if e.is_boundary}
 while edges:
  seed=edges.pop();chain=[seed.verts[0],seed.verts[1]]
  while True:
   edge=next((e for e in chain[-1].link_edges if e in edges),None)
   if edge is None:break
   edges.remove(edge);v=edge.other_vert(chain[-1])
   if v==chain[0]:break
   chain.append(v)
  mean=sum((v.co for v in chain),Vector())/len(chain)
  if row['id']==1 and .56<mean.y<.71 and abs(mean.x)>.08:loops['body'+str(1 if mean.x>0 else -1)]=[index[v] for v in chain]
  if row['id']!=1 and mean.y>.60:loops['arm'+str(-1 if row['id']==3 else 1)]=[index[v] for v in chain]
 bm.free()
# Match orientation around the vertical/depth circle and bridge with intermediate rings.
for sign in [-1,1]:
 a,b=loops['body'+str(sign)],loops['arm'+str(sign)];centerA=sum((Vector(P[i]) for i in a),Vector())/len(a);centerB=sum((Vector(P[i]) for i in b),Vector())/len(b)
 def ordered(loop,center):
  angle=[math.atan2(P[i][2]-center.z,P[i][1]-center.y) for i in loop]
  winding=sum((angle[(i+1)%len(angle)]-v+math.pi)%(2*math.pi)-math.pi for i,v in enumerate(angle))
  if winding<0:loop=list(reversed(loop))
  start=min(range(len(loop)),key=lambda k:abs(math.atan2(P[loop[k]][2]-center.z,P[loop[k]][1]-center.y)))
  return loop[start:]+loop[:start]
 a,b=ordered(a,centerA),ordered(b,centerB)
 def parameters(loop):
  lengths=[(Vector(P[loop[(i+1)%len(loop)]])-Vector(P[v])).length for i,v in enumerate(loop)];total=sum(lengths);values=[0]
  for value in lengths:values.append(values[-1]+value/total)
  values[-1]=1;return values
 def samples(loop,center):
  angles=parameters(loop);values=[]
  for j in range(64):
   t=j/64;k=next(k for k in range(len(loop)) if angles[k+1]>=t);f=(t-angles[k])/(angles[k+1]-angles[k]);values.append(Vector(P[loop[k]]).lerp(Vector(P[loop[(k+1)%len(loop)]]),f))
  return values
 A,B=samples(a,centerA),samples(b,centerB)
 def zipper(a,b,ca,cb):
  aa=parameters(a);bb=parameters(b);i=j=0
  while i<len(a) or j<len(b):
   if j==len(b) or i<len(a) and aa[i+1]<=bb[j+1]:F.append([a[i%len(a)],a[(i+1)%len(a)],b[j%len(b)]]);i+=1
   else:F.append([a[i%len(a)],b[(j+1)%len(b)],b[j%len(b)]]);j+=1
 previous=a;previouscenter=centerA
 for t in [.25,.5,.75]:
  loop=[]
  for av,bv in zip(A,B):loop.append(len(P));P.append(list(av.lerp(bv,t)))
  center=centerA.lerp(centerB,t);zipper(previous,loop,previouscenter,center);previous=loop;previouscenter=center
 zipper(previous,b,previouscenter,centerB)
# Recalculate connected normals and triangulate; original hem/cuffs remain open.
bm=bmesh.new();v=[bm.verts.new(p) for p in P]
for f in F:bm.faces.new([v[i] for i in f])
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bmesh.ops.triangulate(bm,faces=list(bm.faces));bm.verts.ensure_lookup_table();idx={v:i for i,v in enumerate(bm.verts)};result={'p':[list(v.co) for v in bm.verts],'faces':[[idx[v] for v in f.verts] for f in bm.faces]};(output/'surface.json').write_text(json.dumps(result));print(len(result['p']),len(result['faces']),{k:len(v) for k,v in loops.items()})

import bpy,json,sys
from pathlib import Path
from mathutils import Vector,geometry
from mathutils.bvhtree import BVHTree
from mathutils.kdtree import KDTree
src=json.loads((source/'meshes.json').read_text());rows=[r for r in src['meshes'] if r['id'] in [1,3,4]];p=[];faces=[];map=[]
for row in rows:
 P=row['attributes']['position']['values'];base=len(p);p.extend(Vector(P[i:i+3]) for i in range(0,len(P),3));map.extend((row['id'],i) for i in range(len(P)//3));faces.extend([base+v for v in row['index'][i:i+3]] for i in range(0,len(row['index']),3))
bvh=BVHTree.FromPolygons(p,faces,all_triangles=True);tree=KDTree(len(p))
for i,v in enumerate(p):tree.insert(v,i)
tree.balance();result=json.loads((output/'surface.json').read_text());transfer=[]
for v in result['p']:
 v=Vector(v);near,i,dist=tree.find(v)
 if dist<1e-6:transfer.append([list(map[i])+[1]]);continue
 point,n,i,dist=bvh.find_nearest(v);a,b,c=faces[i];weights=geometry.barycentric_transform(point,p[a],p[b],p[c],Vector((1,0,0)),Vector((0,1,0)),Vector((0,0,1)))
 transfer.append([list(map[j])+[float(w)] for j,w in zip((a,b,c),weights)])
result['transfer']=transfer;(output/'surface.json').write_text(json.dumps(result));print(len(transfer),sum(len(t)>1 for t in transfer))
