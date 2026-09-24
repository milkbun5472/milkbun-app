"""Volumetric clay locks: closed swept lenses, laid around a complete scalp.

Coordinates are the source traveler's Z-up display space. The hair is authored
in the round; a front illustration is never used as an extruded silhouette.
"""
import math
import random
import bpy
import numpy as np
from mathutils import Vector

PI=math.pi
C=Vector((-.012,.035,1.31))
PALETTE={'curtains':'5d4840','comma':'b18b6b','wolf':'6c4b38','pixie':'483d38','mullet':'986343',
         'airbang':'895c44','bob':'614a3d','ponytail':'70503d','hush':'ac7f57','bun':'60473c','wavy':'caa583'}


def linear(hexcolor):
    c=[int(hexcolor[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4 for x in c)


class Sculpt:
    def __init__(self,name,color):
        self.name=name;self.color=np.array(linear(color));self.v=[];self.f=[];self.colors=[]
        self.random=random.Random(name)
    def add(self,verts,faces,tint=1.,color=None):
        off=len(self.v);self.v.extend(verts);self.f.extend(tuple(off+i for i in f) for f in faces)
        rgb=self.color*tint if color is None else linear(color)
        self.colors.extend([(*rgb,1)]*len(verts))
    def ellipsoid(self,center,radii,tint=1.,n=40,rings=22,color=None):
        v=[];f=[]
        for j in range(rings+1):
            ph=PI*j/rings
            for i in range(n):
                th=2*PI*i/n
                v.append((center[0]+radii[0]*math.sin(ph)*math.sin(th),center[1]-radii[1]*math.sin(ph)*math.cos(th),center[2]+radii[2]*math.cos(ph)))
        for j in range(rings):
            for i in range(n):
                a=j*n+i;b=j*n+(i+1)%n;c=b+n;d=a+n;f.append((a,b,c,d))
        self.add(v,f,tint,color)
    def cap(self,short=False):
        # The nape reaches behind both ears; the front stays under the bangs.
        n=72;rings=22;v=[];f=[]
        for j in range(rings+1):
            t=j/rings
            for i in range(n):
                th=2*PI*i/n;front=max(0,math.cos(th))
                end=2.92-1.65*front**2
                ph=.015+t*(end-.015)
                rx=.302 if not short else .288;ry=.287 if not short else .277;rz=.286 if not short else .257
                v.append(tuple(C+Vector((rx*math.sin(ph)*math.sin(th),-ry*math.sin(ph)*math.cos(th),rz*math.cos(ph)))))
        for j in range(rings):
            for i in range(n):
                a=j*n+i;b=j*n+(i+1)%n;f.append((a,b,b+n,a+n))
        # Closing the scalp makes its inside well-defined as a solid too.
        f.append(tuple(range(n-1,-1,-1)))
        outer=len(v)
        v.extend([tuple(C+(Vector(p)-C)*.965) for p in list(v)])
        f.extend([tuple(outer+i for i in reversed(face)) for face in list(f)])
        for i in range(n):
            a=rings*n+i;b=rings*n+(i+1)%n;f.append((a,a+outer,b+outer,b))
        self.add(v,f,.90)
    def lock(self,points,width=.085,depth=.038,tint=None,normal=None,rings=22,sides=12,tip=.002):
        points=np.array(points,float)
        if len(points)<4:raise ValueError('A lock needs a cubic or a sampled centreline')
        if tint is None:tint=self.random.uniform(.94,1.06)
        v=[];f=[]
        previous=None
        for j in range(rings+1):
            t=j/rings;u=1-t
            if len(points)==4:
                p=u**3*points[0]+3*u*u*t*points[1]+3*u*t*t*points[2]+t**3*points[3]
                tangent=3*u*u*(points[1]-points[0])+6*u*t*(points[2]-points[1])+3*t*t*(points[3]-points[2])
            else:
                q=t*(len(points)-1);a=min(len(points)-2,int(q));blend=q-a
                p=points[a]*(1-blend)+points[a+1]*blend
                tangent=points[min(a+2,len(points)-1)]-points[max(0,a-1)]
            tangent/=max(np.linalg.norm(tangent),1e-10)
            outward=np.array(normal if normal else p-np.array(C),float)
            outward-=tangent*np.dot(outward,tangent)
            if np.linalg.norm(outward)<1e-5:outward=np.array([0,-1,0.])
            outward/=np.linalg.norm(outward)
            across=np.cross(tangent,outward);across/=max(np.linalg.norm(across),1e-10)
            if previous is not None and np.dot(across,previous)<0:across=-across;outward=-outward
            previous=across
            # Broad rounded belly, a buried narrow root and a soft tapered tip.
            profile=max(.012,math.sin(PI*(.055+.945*t)))**.64
            w=width*profile;d=depth*profile
            if j==rings:w=d=tip
            for i in range(sides):
                a=2*PI*i/sides
                q=p+across*w*math.cos(a)+outward*d*math.sin(a)
                v.append(tuple(q))
        for j in range(rings):
            for i in range(sides):
                a=j*sides+i;b=j*sides+(i+1)%sides;f.append((a,b,b+sides,a+sides))
        f.extend([tuple(range(sides-1,-1,-1)),tuple(rings*sides+i for i in range(sides))])
        self.add(v,f,tint)
    def radial(self,theta,phi0,phi1,width=.08,depth=.037,sweep=.0,lift=.0,short=False,drop=0,flare=0):
        layer=.018*max(0,1-phi0/1.2)
        rx=.315+layer;ry=.302+layer;rz=(.305 if not short else .27)+layer
        pts=[]
        for t in np.linspace(0,1,25):
            ph=phi0+(phi1-phi0)*t;th=theta+sweep*math.sin(t*PI/2)
            r=1+lift*math.sin(t*PI/2)+flare*t**5
            pts.append(tuple(C+Vector((rx*r*math.sin(ph)*math.sin(th),-ry*r*math.sin(ph)*math.cos(th),rz*math.cos(ph)-drop*t*t))))
        self.lock(pts,width,depth)
    def finish(self):
        mesh=bpy.data.meshes.new(self.name);mesh.from_pydata(self.v,[],self.f);mesh.update()
        # Recalculate winding consistently. Retain gentle broad planar facets,
        # with smooth normals so the locks read as clay instead of paper cones.
        import bmesh
        bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free()
        for p in mesh.polygons:p.use_smooth=True
        attr=mesh.color_attributes.new(name='Clay tint',type='FLOAT_COLOR',domain='POINT')
        attr.data.foreach_set('color',np.array(self.colors).ravel())
        mat=bpy.data.materials.get('Sculpted clay hair')
        if not mat:
            mat=bpy.data.materials.new('Sculpted clay hair');mat.use_nodes=True
            shader=mat.node_tree.nodes['Principled BSDF'];shader.inputs['Roughness'].default_value=.86
            vertex=mat.node_tree.nodes.new('ShaderNodeVertexColor');vertex.layer_name='Clay tint'
            mat.node_tree.links.new(vertex.outputs['Color'],shader.inputs['Base Color'])
        mesh.materials.append(mat)
        obj=bpy.data.objects.new(self.name,mesh);bpy.context.collection.objects.link(obj)
        return obj


def rear_layers(s,style):
    short=style=='pixie'
    # Staggered layers cover a round occiput all the way to the nape.
    for row,(p0,p1,n,w) in enumerate([(1.10,2.80,13,.071),(.52,2.08,12,.089),(.08,1.51,10,.098)]):
        if short:p0*=.88;p1-=.12;w*=.84
        for i in range(n):
            start=1.25 if row==0 else .82
            theta=start+(2*PI-2*start)*(i+.18*(row%2))/(n-1)
            s.radial(theta,p0,p1,w,.034,sweep=.07*math.sin(theta*3),short=short,
                     lift=.035 if row==0 else (.135 if row==1 else .22),
                     drop=(.067 if style=='wolf' else .018) if row==0 else 0,flare=.55 if row==0 else 0)


def curtains(s,soft=False):
    # Two broad C-shaped locks, with smaller swept companions at the temples.
    for side in (-1,1):
        s.lock([(side*.025,-.045,1.600),(side*.19,-.28,1.61),(side*.21,-.34,1.34),(side*.105,-.267,1.225)],.091,.041)
        s.lock([(side*.085,-.018,1.593),(side*.30,-.17,1.56),(side*.31,-.27,1.36),(side*.245,-.205,1.21)],.09,.044)
        s.lock([(side*.14,.045,1.57),(side*.34,-.005,1.50),(side*.35,-.12,1.28),(side*.288,-.115,1.125)],.077,.037)
        s.lock([(side*.18,.13,1.51),(side*.35,.12,1.40),(side*.355,.01,1.20),(side*.26,-.01,1.085)],.07,.034)
    for side in (-1,1):
        s.lock([(side*.008,-.18,1.51),(side*.055,-.29,1.49),(side*.09,-.30,1.38),(side*.08,-.27,1.305)],.039,.026)
    if not soft:
        s.lock([(-.01,.06,1.575),(-.12,.06,1.66),(-.19,.12,1.66),(-.21,.16,1.596)],.049,.025)


def fringe(s):
    s.lock([(-.012,-.01,1.60),(-.10,-.31,1.54),(-.065,-.34,1.33),(-.008,-.26,1.205)],.080,.043)
    s.lock([(.015,-.00,1.59),(.09,-.27,1.52),(.15,-.33,1.30),(.205,-.225,1.195)],.079,.043)
    s.lock([(-.045,.03,1.59),(-.25,-.21,1.53),(-.24,-.30,1.32),(-.195,-.205,1.18)],.095,.041)


def long_back(s,kind):
    n=15
    bottom={'airbang':.72,'bob':1.045,'bun':.955}[kind]
    for i in range(n):
        theta=.92+(2*PI-1.84)*i/(n-1)
        dx=math.sin(theta);dy=-math.cos(theta)
        end=bottom+.024*math.sin(i*1.7)
        s.lock([(.055*dx,.035+.05*dy,1.604),(.39*dx,.035+.37*dy,1.62),
                (.40*dx,.035+.365*dy,end+.17),(.30*dx,.035+.29*dy,end)],
               .065 if kind=='bob' else .073,.041,normal=(dx,dy,.03),rings=32)
    for side in (-1,1):
        end=bottom+.045
        s.lock([(side*.19,-.12,1.48),(side*.31,-.16,1.24),(side*.34,-.16,end+.14),(side*.285,-.11,end)],.059,.036,normal=(side*.5,-1,0),rings=28)


def braid(s,side):
    # Three interwoven tapered strands. Their crossing stays in true 3D.
    for strand in range(3):
        steps=54;sides=10;v=[];f=[]
        for j in range(steps+1):
            t=j/steps;a=t*PI*5+strand*2*PI/3
            envelope=1-.50*t
            center=np.array([side*(.285+.015*math.sin(t*PI)),.012-.157*(t*t*(3-2*t)),1.19-.455*t])
            center+=np.array([.041*envelope*math.sin(a),.029*envelope*math.cos(a),0])*min(1,t/.12)
            radius=.030*envelope*min(1,(1-t)*16+.2)
            for k in range(sides):
                b=2*PI*k/sides;v.append(tuple(center+[radius*math.cos(b),radius*math.sin(b),0]))
        for j in range(steps):
            for k in range(sides):
                a=j*sides+k;b=j*sides+(k+1)%sides;f.append((a,b,b+sides,a+sides))
        f.extend([tuple(range(sides-1,-1,-1)),tuple(steps*sides+i for i in range(sides))]);s.add(v,f,1+.025*(strand-1))
    s.ellipsoid((side*.283,-.143,.758),(.033,.033,.017),color='785344',n=20,rings=10)
    s.lock([(side*.284,-.145,.754),(side*.30,-.162,.727),(side*.29,-.171,.704),(side*.27,-.153,.695)],.024,.022)


def build_style(style):
    s=Sculpt('hair_'+style,PALETTE[style]);s.cap(style=='pixie')
    if style in ['curtains','comma','wolf','pixie','mullet','ponytail','hush']:
        rear_layers(s,style)
    if style=='curtains':curtains(s)
    elif style=='comma':
        # An off-centre part and a long sweep crossing the forehead.
        for i in range(4):
            s.lock([(.08+i*.012,.005,1.61),(-.02+i*.06,-.25,1.62),
                    (-.31+i*.10,-.32,1.40),(-.245+i*.095,-.233,1.20+.02*math.sin(i))],.080-i*.007,.042)
        s.lock([(.09,.025,1.61),(-.13,-.11,1.69),(-.27,-.24,1.48),(-.32,-.14,1.415)],.078,.042)
        s.lock([(.12,.055,1.60),(.30,-.03,1.54),(.32,-.19,1.31),(.245,-.16,1.185)],.072,.038)
    elif style=='wolf':
        fringe(s)
        for side in (-1,1):
            for j in range(3):
                s.lock([(side*(.03+j*.035),-.005+j*.06,1.61-j*.025),(side*(.19+j*.06),-.24+j*.10,1.54),(side*(.27+j*.025),-.29+j*.12,1.34-j*.03),(side*(.15+j*.075),-.255+j*.15,1.185-j*.05)],.083,.040)
        s.lock([(.0,.055,1.58),(-.01,.015,1.69),(-.10,.05,1.70),(-.13,.05,1.69)],.035,.02)
        s.lock([(.01,.055,1.58),(.035,.02,1.65),(.075,.03,1.67),(.095,.025,1.65)],.028,.018)
    elif style=='pixie':
        for row in range(3):
            n=7+row*2
            for i in range(n):
                th=-1.26+2.52*(i+.22*(row%2))/(n-1)
                s.radial(th,.14+row*.34,1.03+row*.30+.12*math.sin(i*2.7),.059-.007*row,.032,sweep=.21*math.sin(i*1.6),short=True)
        for i in range(9):
            th=2*PI*i/9;s.radial(th,.04,.88,.043,.030,sweep=.34,lift=.28,short=True)
        s.lock([(-.06,.045,1.55),(-.10,.03,1.63),(-.125,.02,1.66),(-.16,.025,1.66)],.040,.026)
        s.lock([(.018,.04,1.55),(.02,.03,1.62),(-.015,.015,1.655),(-.045,.012,1.67)],.033,.024)
    elif style=='mullet':
        fringe(s)
        # Puffy, gently bent locks with alternating tips; no strand-sized spikes.
        for side in (-1,1):
            for j in range(4):
                y=-.02+j*.07
                s.lock([(side*.045,y,1.60),(side*(.29+.012*j),y-.19,1.60-j*.02),(side*(.12+.06*j),y-.34,1.29-j*.022),(side*(.20+.035*j),y-.245,1.21-j*.024)],.094-j*.006,.05)
        s.lock([(.0,.04,1.58),(.03,.015,1.72),(.04,.02,1.74),(.11,.045,1.73)],.039,.027)
        s.lock([(.04,-.22,1.60),(.24,-.27,1.64),(.20,-.36,1.43),(.08,-.33,1.48)],.051,.034)
        s.lock([(-.08,-.10,1.61),(-.29,-.13,1.65),(-.34,-.24,1.42),(-.27,-.20,1.41)],.054,.036)
    elif style in ['airbang','bob','bun','wavy']:
        if style!='wavy':long_back(s,style)
        else:
            for i in range(15):
                th=.88+(2*PI-1.76)*i/14;dx=math.sin(th);dy=-math.cos(th)
                pts=[]
                for t in np.linspace(0,1,41):
                    radius=.04+.285*math.sin(min(1,t/.40)*PI/2)
                    wave=.032*math.sin((t-.32)*PI*4+(.25*math.sin(i*2))) * min(1,t/.4)
                    z=1.60-.85*t
                    pts.append(((radius+wave)*dx,.035+(radius+wave)*dy,z))
                s.lock(pts,.066,.039,normal=(dx,dy,0),rings=40)
            for side in (-1,1):
                pts=[]
                for t in np.linspace(0,1,35):
                    x=side*(.225+.08*math.sin(t*PI/2)+.039*math.sin(t*PI*4))
                    pts.append((x,-.16-.025*math.sin(t*PI*3),1.41-.63*t))
                s.lock(pts,.057,.035,normal=(side*.35,-1,0),rings=34)
            # Soft solid bow wings, pinched at the knot and broad at the ends.
            # A folded ribbon has a flared outline, not the curl of a hair lock.
            for outline in [[(.326,1.45),(.337,1.487),(.398,1.56),(.428,1.482)],
                            [(.326,1.445),(.427,1.414),(.389,1.353),(.339,1.414)]]:
                outline=np.array(outline);rounded=[]
                for i,a in enumerate(outline):
                    b=outline[(i+1)%len(outline)];rounded.extend([.80*a+.20*b,.20*a+.80*b])
                outline=np.array(rounded);center=outline.mean(0);n=len(outline);v=[];f=[]
                for half in (-1,1):
                    for j in range(7):
                        r=j/6
                        for point in outline:
                            x,z=center+(point-center)*r
                            v.append((x,.105+half*.021*math.sqrt(max(0,1-r*r)),z))
                for half in range(2):
                    off=half*7*n
                    for j in range(6):
                        for k in range(n):
                            a=off+j*n+k;b=off+j*n+(k+1)%n;f.append((a,b,b+n,a+n))
                for k in range(n):
                    a=6*n+k;b=6*n+(k+1)%n;f.append((a,b,b+7*n,a+7*n))
                s.add(v,f,color='362b28')
            s.ellipsoid((.335,.084,1.448),(.025,.030,.025),n=20,rings=12,color='44332b')
        # Crown strips flow into the back length rather than ending as a helmet.
        for i in range(10):
            th=.9+(2*PI-1.8)*i/9;s.radial(th,.03,1.63,.09,.035,sweep=.035)
        fringe(s)
        if style=='bun':
            s.ellipsoid((-.02,.105,1.645),(.075,.065,.036),color='ce6148',n=32,rings=12)
            s.ellipsoid((-.02,.11,1.723),(.111,.095,.105),tint=.96,n=32,rings=20)
            for i in range(5):
                th=2*PI*i/5
                s.lock([(-.02+.045*math.sin(th),.11+.04*math.cos(th),1.64),(-.02+.13*math.sin(th),.11+.11*math.cos(th),1.70),(-.02+.11*math.sin(th+.7),.11+.10*math.cos(th+.7),1.81),(-.02,.11,1.803)],.039,.020)
    elif style=='ponytail':
        curtains(s,True)
        s.ellipsoid((.12,.32,1.16),(.067,.044,.064),color='a87750',n=28,rings=14)
        for i in range(6):
            th=2*PI*i/6;x=.12+.04*math.sin(th);y=.35+.04*math.cos(th)
            s.lock([(x,y,1.18),(x+.17,y+.085,1.16),(x+.18,y-.055,.95),(x+.09,y-.015,.835+.018*math.sin(i))],.059,.040,normal=(math.sin(th),math.cos(th),0),rings=28)
        for side in (-1,1):
            s.lock([(side*.24,-.07,1.31),(side*.26,-.16,1.19),(side*.23,-.19,1.055),(side*.26,-.17,1.015)],.028,.022)
    elif style=='hush':
        fringe(s)
        for side in (-1,1):
            s.lock([(side*.15,.005,1.55),(side*.34,-.06,1.44),(side*.31,-.13,1.22),(side*.28,.01,1.13)],.082,.041)
            braid(s,side)
    return s.finish()
