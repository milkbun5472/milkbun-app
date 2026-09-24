"""Original Blender geometry, authored from Lisa's image references. No mesh imports."""
import bpy, math
from mathutils import Vector

def body(D):
 bpy.ops.wm.read_factory_settings(use_empty=True)
 skin=D.mat('Warm porcelain clay','#f3ceb0');eye=D.mat('Cocoa eyes','#493326');blush=D.mat('Peach cheeks','#edac91')
 out=[]
 def ball(name,p,r,m,**kw):
  o=D.ellipsoid(name,p,r,m,**kw);out.append(o);return o
 # Continuous head with softly squared cheeks and a rounded chin; no scanned seam.
 v=[];f=[];n=64;rows=40
 for i in range(rows+1):
  t=.001+(math.pi-.002)*i/rows;z=1.265+.285*math.cos(t)
  for j in range(n):
   a=j*math.tau/n;s=math.sin(t)**.72
   v.append((.278*s*math.cos(a),.015+.222*s*math.sin(a),z))
 for i in range(rows):
  for j in range(n):a=i*n+j;b=i*n+(j+1)%n;f.append((a,a+n,b+n,b))
 out.append(D.mesh('Face',v,f,skin,skin=True))
 for side in [-1,1]:
  ball('Ear '+str(side),(side*.271,.013,1.154),(.051,.046,.064),skin,skin=True,deformPart='Face')
  ball('Eye '+str(side),(side*.104,-.202,1.168),(.020,.012,.043),eye,deformPart='Face')
  ball('Cheek '+str(side),(side*.154,-.182,1.110),(.034,.010,.022),blush,deformPart='Face')
  ball(('Left' if side<0 else 'Right')+' hand',(side*.308,-.018,.531),(.043,.045,.061),skin,skin=True,rigPart='leftArm' if side<0 else 'rightArm')
 ball('Neck',(0,0,.957),(.055,.052,.068),skin,skin=True)
 pants=D.mat('Cream linen','#e8dfcd');boots=D.mat('Brown shoes','#655448')
 for side in [-1,1]:
  name='Left' if side<0 else 'Right';rig='leftLeg' if side<0 else 'rightLeg'
  o=D.loft('Linen leggings '+name,[(.125,.080,.078),(.145,.091,.086),(.19,.087,.082),(.33,.071,.075),(.49,.080,.085),(.52,.088,.085)],pants,colorSlot='bottom',rigPart=rig)
  for p in o.data.vertices:p.co.x+=side*.105
  out.append(o)
  ball('Rounded boots '+name,(side*.105,-.031,.076),(.093,.127,.070),boots,colorSlot='boots',rigPart=rig)
  ball('Rounded boots sole '+name,(side*.105,-.035,.027),(.094,.126,.021),boots,colorSlot='boots',rigPart=rig)
 return out

def hairs(D):
 out=[];m=D.mat('Sculpted chestnut','#926448')
 styles=['korean','curtains','comma','wolf','pixie','mullet','airbang','bob','ponytail','hush','bun','wavy']
 for style in styles:
  parts=[];n=48;rows=18;verts=[];faces=[]
  for i in range(rows+1):
   for j in range(n):
    a=j*math.tau/n;front=max(0,-math.sin(a));end=1.96-.76*front
    t=.001+(end-.001)*i/rows
    verts.append((.292*math.sin(t)*math.cos(a),.024+.239*math.sin(t)*math.sin(a),1.28+.302*math.cos(t)))
  for i in range(rows):
   for j in range(n):a=i*n+j;b=i*n+(j+1)%n;faces.append((a,a+n,b+n,b))
  parts.append(D.mesh('cap',verts,faces,m))
  def strand(points,w=.055,d=.022):parts.append(D.lock('sculpted lock',points,w,d,m))
  # Broad, rounded clay locks. Tips end above the eyes; each sits on the scalp.
  if style in ('curtains','comma'):
   for side in [-1,1]:
    for j in range(4):
     x=side*(.075+j*.052);z=1.24+.025*j
     if style=='comma':x+=.037;z-=.025 if side<0 else 0
     strand([(side*.015,.002,1.574),(side*.12,-.22,1.55),(x+side*.035,-.25,1.36),(x,-.201,z)],.070,.033)
  else:
   count=7 if style!='pixie' else 11
   for j in range(count):
    x=(j-(count-1)/2)*(.076 if count==7 else .048)
    tip=1.215+.04*abs(x)/.25+.018*math.sin(j*2)
    if style=='pixie':tip+=.07
    strand([(x*.30,.002,1.574),(x*.85-.024,-.18,1.54),(x-.023,-.255,1.36),(x,-.205,tip)],.075 if count==7 else .039,.034)
   if style in ('korean','wolf','mullet'):
    for side in [-1,1]:
     for j in range(3):
      strand([(side*.035,.015,1.59),(side*.17,-.155,1.57),(side*(.26-j*.035),-.23,1.44),(side*(.285-j*.053),-.20,1.37-j*.025)],.069,.037)
  for side in [-1,1]:
   for k in range(4):
    y=-.09+k*.078
    strand([(side*.14,y,1.535),(side*.30,y-.02,1.46),(side*.31,y,1.29),(side*.27,y+.012,1.16+.025*k)],.06,.027)
   if style in ('airbang','bob','wavy','bun','wolf','mullet'):
    length=.41 if style in ('airbang','wavy') else .29 if style=='bun' else .19 if style=='bob' else .13
    for k in range(5):
     y=-.035+k*.055;x=side*(.267-.018*k)
     strand([(x,y,1.36),(x+side*.02,y+.02,1.20),(x+side*(.045 if style=='wavy' else .006),y+.015,1.12-length*.55),(x+side*.003,y,1.13-length)],.05,.032)
   if style=='hush':
    for k in range(6):
     z=1.17-k*.049
     parts.append(D.ellipsoid('braid',(side*(.273-.004*k),.035,z),(.045,.043,.039),m))
  for j in range(9):
   x=(j-4)*.058
   bottom=1.075 if style not in ('airbang','wavy','bun','bob') else .82 if style in ('airbang','wavy') else 1.00
   strand([(x*.3,.07,1.563),(x*.88,.282,1.49),(x,.286,1.26),(x*.96,.205,bottom+.03*abs(x)/.24)],.061,.033)
  if style in ('bun','ponytail'):
   parts.append(D.ellipsoid('tie',(0,.17,1.54 if style=='bun' else 1.20),(.10,.09,.095),m))
   if style=='ponytail':
    for k in range(4):strand([(.02*k,.19,1.23),(.09,.28,1.1),(.12,.27,.97),(.06,.23,.89)],.048,.038)
  if style in ('korean','wolf','mullet'):
   strand([(0,.02,1.55),(-.035,.02,1.66),(-.085,.01,1.68),(-.095,.01,1.65)],.035,.025)
  for piece in parts:
   for vertex in piece.data.vertices:
    vertex.co.x*=1.10
    if style=='wavy' and vertex.co.z<1.3:
     vertex.co.x+=.025*math.sin((vertex.co.z-1.3)*27)
    if style=='mullet':
     vertex.co.x+=.009*math.sin(vertex.co.z*40+vertex.co.y*12)
     vertex.co.z+=.012*math.sin(vertex.co.x*30)
  bpy.ops.object.select_all(action='DESELECT')
  for o in parts:o.select_set(True)
  bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();o=parts[0];o['part']='hair.'+style;out.append(o)
 return out
