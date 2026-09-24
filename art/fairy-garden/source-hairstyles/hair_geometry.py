"""Volumetric clay locks: closed swept lenses, laid around a complete scalp.

Coordinates are the source traveler's Z-up display space. The hair is authored
in the round; a front illustration is never used as an extruded silhouette.
"""
import math
import random
import os
import bpy
import numpy as np
from mathutils import Vector

PI=math.pi
C=Vector((-.012,.035,1.31))
PALETTE={'curtains':'4e3d37','comma':'b18b6b','wolf':'6c4b38','pixie':'483d38','mullet':'986343',
         'airbang':'895c44','bob':'614a3d','ponytail':'70503d','hush':'ac7f57','bun':'60473c','wavy':'caa583'}


def linear(hexcolor):
    c=[int(hexcolor[i:i+2],16)/255 for i in (0,2,4)]
    return tuple(x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4 for x in c)


class Sculpt:
    def __init__(self,name,color):
        self.name=name;self.color=np.array(linear(color));self.v=[];self.f=[];self.colors=[]
        self.random=random.Random(name);self.source_painted_vertices=set()
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
    def cap(self,short=False,parted=False,source_rear=False):
        # The nape reaches behind both ears; the front stays under the bangs.
        n=72;rings=22;v=[];f=[]
        for j in range(rings+1):
            t=j/rings
            for i in range(n):
                th=2*PI*i/n;front=max(0,math.cos(th))
                end=2.92-(1.72 if parted else 1.23)*front**2
                end+=front**4*(.055*math.sin(th*7+.3)+.028*math.cos(th*11))
                side_angle=abs((th+PI)%(2*PI)-PI)
                end-=.53*math.exp(-((side_angle-1.40)/.30)**2)
                ph=.015+t*(end-.015)
                rx=.302 if not short else .288;ry=.287 if not short else .277;rz=.286 if not short else .257
                if source_rear:rz=.286
                z=C.z+rz*math.cos(ph)
                if source_rear:
                    inset=max(0,min(1,(.45-math.cos(th))/.40))*max(0,min(1,(1.59-z)/.08))
                    rx*=1-.27*inset;ry*=1-.27*inset
                v.append((C.x+rx*math.sin(ph)*math.sin(th),C.y-ry*math.sin(ph)*math.cos(th),z))
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
    def lock(self,points,width=.085,depth=.038,tint=None,normal=None,rings=24,sides=12,tip=.002,flow=False,round_end=False,widths=None):
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
                p0=points[max(0,a-1)];p1=points[a];p2=points[a+1];p3=points[min(a+2,len(points)-1)]
                b=blend
                p=.5*((2*p1)+(-p0+p2)*b+(2*p0-5*p1+4*p2-p3)*b*b+(-p0+3*p1-3*p2+p3)*b*b*b)
                tangent=.5*((-p0+p2)+2*(2*p0-5*p1+4*p2-p3)*b+3*(-p0+3*p1-3*p2+p3)*b*b)
            tangent/=max(np.linalg.norm(tangent),1e-10)
            outward=np.array(normal if normal else p-np.array(C),float)
            outward-=tangent*np.dot(outward,tangent)
            if np.linalg.norm(outward)<1e-5:outward=np.array([0,-1,0.])
            outward/=np.linalg.norm(outward)
            across=np.cross(tangent,outward);across/=max(np.linalg.norm(across),1e-10)
            if previous is not None and np.dot(across,previous)<0:across=-across;outward=-outward
            previous=across
            # Broad rounded belly, a buried narrow root and a soft tapered tip.
            profile=(.68+.32*math.sin(PI*min(1,t/.7))) * max(.025,1-max(0,(t-.64)/.36)**2)**.6 if flow else max(.012,math.sin(PI*(.12+.88*t)))**.72
            if round_end:
                profile=(.66+.34*math.sin(PI*min(1,t/.82)))*math.sqrt(max(.001,1-max(0,(t-.89)/.11)**2))
            if widths is not None:profile=float(np.interp(t,np.linspace(0,1,len(widths)),widths))
            w=width*profile;d=depth*profile
            if j==rings:w=d=tip
            for i in range(sides):
                a=2*PI*i/sides
                q=p+across*w*math.cos(a)+outward*d*math.copysign(abs(math.sin(a))**.73,math.sin(a))
                v.append(tuple(q))
        for j in range(rings):
            for i in range(sides):
                a=j*sides+i;b=j*sides+(i+1)%sides;f.append((a,b,b+sides,a+sides))
        f.extend([tuple(range(sides-1,-1,-1)),tuple(rings*sides+i for i in range(sides))])
        self.add(v,f,tint)
    def radial(self,theta,phi0,phi1,width=.08,depth=.037,sweep=.0,lift=.0,short=False,drop=0,flare=0,wave=0):
        layer=.018*max(0,1-phi0/1.2)
        rx=.315+layer;ry=.302+layer;rz=(.305 if not short else .27)+layer
        pts=[]
        for t in np.linspace(0,1,25):
            ph=phi0+(phi1-phi0)*t;th=theta+sweep*math.sin(t*PI/2)
            r=1+lift*math.sin(t*PI/2)+flare*t**5+wave*math.sin(t*PI*2)
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
        colors=np.array(self.colors)
        if self.name!='ScalpSupport':
            # Contact shadows are baked into vertex colour because the garden's
            # mobile renderer does not provide screen-space ambient occlusion.
            # These are rays against the actual curved hair, not painted bands.
            from mathutils.bvhtree import BVHTree
            mesh.update()
            bm=bmesh.new();bm.from_mesh(mesh);bm.normal_update()
            tree=BVHTree.FromBMesh(bm);bm.free()
            for i,vert in enumerate(mesh.vertices):
                if i in self.source_painted_vertices:continue
                normal=vert.normal.normalized();origin=vert.co+normal*.0007
                tangent=normal.cross(Vector((0,0,1)))
                if tangent.length<.01:tangent=normal.cross(Vector((0,1,0)))
                tangent.normalize();bitangent=normal.cross(tangent)
                blocked=0.;samples=16
                for j in range(samples):
                    radius=math.sqrt((j+.5)/samples);angle=j*2.399963229728653
                    direction=tangent*(radius*math.cos(angle))+bitangent*(radius*math.sin(angle))+normal*math.sqrt(1-radius*radius)
                    hit,_,_,distance=tree.ray_cast(origin,direction,.10)
                    if hit is not None:blocked+=max(0,1-distance/.10)
                occlusion=1-.48*blocked/samples
                # Low-amplitude clay colour variation follows 3D position.
                x,y,z=vert.co;grain=1+.016*math.sin(73*x+19*math.sin(41*z))*math.sin(67*y+31*z)
                colors[i,:3]*=occlusion*grain
        attr.data.foreach_set('color',colors.ravel())
        # Recompute smooth normals after clipping and bending the reused rear.
        # Source custom normals belong to the intact mesh and produce torn shading here.
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
    """Unequal overlapping clumps following the round crown, not a tiled helmet."""
    short=style=='pixie'
    rows=[(1.40,2.69,15,.050),(.72,2.03,15,.063),(.12,1.31,12,.070)]
    if short: rows=[(.67,1.77,19,.038),(.20,1.19,16,.046)]
    for row,(p0,p1,n,w) in enumerate(rows):
        start=1.34 if row==0 and not short else .87
        for i in range(n):
            th=start+(2*PI-2*start)*(i+.13*(row%2))/(n-1)
            th+=s.random.uniform(-.045,.045)
            a=p0+s.random.uniform(-.13,.13);b=p1+s.random.uniform(-.16,.14)
            side_angle=abs((th+PI)%(2*PI)-PI)
            if style in ('curtains','comma','pixie'):b=min(b,2.60-.65*math.exp(-((side_angle-1.40)/.34)**2))
            wolf=style=='wolf';curly=style=='mullet'
            s.radial(th,a,b,w*s.random.uniform(.85,1.14),.024 if short else .030,
                     sweep=.10*math.sin(th*2+.4)+s.random.uniform(-.16,.16),short=short,
                     lift=(.055,.19,.23)[row]+(.07 if curly else 0),
                     drop=(.075 if wolf else .009) if row==0 and not short else 0,
                     flare=(.40 if wolf else .20) if row==0 and not short else .04,
                     wave=.10 if curly else .025)
    # Small lifted crown tips break the silhouette without a detached ornament.
    if style in ('curtains','comma','wolf','mullet'):
        for j in range(2 if style!='mullet' else 3):
            x=-.03+j*.033
            s.lock([(x,.06,1.58),(x-.015,.055,1.68),(x-.11,.04,1.69),(x-.12,.075,1.65)],.027,.019)


def front_lock(s,theta,endphi,width=.06,startphi=.08,bend=0,layer=0,tip=.002):
    pts=[]
    for t in np.linspace(0,1,32):
        ph=startphi+(endphi-startphi)*t
        th=theta+bend*math.sin(t*PI)
        r=.329+layer+.012*math.sin(PI*t)
        pts.append((-.012+r*math.sin(ph)*math.sin(th),.024-r*math.sin(ph)*math.cos(th),1.31+(.321+layer)*math.cos(ph)))
    s.lock(pts,width,.043 if width>.04 else .026,rings=28,tip=tip)


def curtains(s,soft=False):
    # M02: the front curls begin BELOW the crown. Their roots turn upward,
    # swell sideways, then return toward the centre at the ends, as in the
    # supplied close-up. Crown layers are separately sculpted above them.
    for side in (-1,1):
        s.lock([(side*.012,-.228,1.495),(side*.038,-.239,1.526),
                (side*.090,-.248,1.515),(side*.136,-.285,1.451),
                (side*.148,-.303,1.370),(side*.134,-.297,1.300),
                (side*.105,-.280,1.244),(side*.073,-.258,1.222)],
               .052,.035,normal=(side*.15,-1,.08),rings=40,tip=.004,
               widths=[.36,.73,1,1,.93,.74,.43,.04])
        # Companion layers follow the temples and finish at staggered heights.
        s.lock([(side*.035,-.06,1.595),(side*.21,-.245,1.60),
                (side*.288,-.277,1.385),(side*.207,-.216,1.21)],
               .071,.041,rings=30,tip=.004)
        s.lock([(side*.07,.015,1.621),(side*.29,-.075,1.60),
                (side*.355,-.20,1.39),(side*.316,-.098,1.30)],
               .067,.039,rings=30,tip=.004)
        s.lock([(side*.12,.055,1.60),(side*.325,.035,1.51),
                (side*.365,-.065,1.36),(side*.32,-.06,1.23)],
               .052,.035,tip=.004)
        # A lifted swept crown wedge is independent of the cheek curl.
        s.lock([(side*.005,.045,1.615),(side*.16,-.05,1.70),
                (side*.315,-.14,1.54),(side*.377,-.071,1.43)],
               .070,.038,rings=30,tip=.005)
    if soft:
        for side in (-1,1):
            s.lock([(side*.25,-.07,1.34),(side*.272,-.135,1.22),(side*.24,-.183,1.05),(side*.266,-.17,1.027)],.022,.017,flow=True)


def fringe(s,kind='soft'):
    # Broad connected forehead locks sit on the same round surface as the
    # crown. Each end has its own length; there are no floating filler fingers.
    specs=[(-.06,1.88,.058,.12,-.10),(.29,1.84,.050,.15,.12),
           (-.44,1.86,.063,.10,-.14),(.69,1.78,.067,.08,.15),
           (-.93,1.73,.065,.18,-.08),(1.13,1.70,.051,.31,.12)]
    for th,end,w,p0,bend in specs:
        if kind=='wolf':end+=.06;w*=.95
        if kind=='curl':bend*=1.8
        front_lock(s,th,end,w,p0,bend,layer=.005)
    # One swept upper section, ending to the side rather than in a rigid row.
    front_lock(s,-.70,1.16,.064,.035,-.28,layer=.032)


def flowing_back(s,kind):
    """Long lengths leave a spherical crown and turn softly at their ends."""
    bottom={'airbang':.545,'bob':1.072,'bun':.76,'wavy':.59}[kind]
    n=23 if kind in ('airbang','wavy') else 19
    for i in range(n):
        th=1.0+(2*PI-2.0)*i/(n-1)
        dx,dy=math.sin(th),-math.cos(th)
        end=bottom+.022*math.sin(i*2.27)+.010*math.cos(i*.8)
        pts=[]
        for t in np.linspace(0,1,49):
            z=1.627-(1.627-end)*t
            ph=math.acos(max(-1,min(1,(z-C.z)/.320)))
            # Crown becomes the rounded side curtain at its equator.
            radius=.322*math.sin(ph) if z>1.31 else .322
            lower=max(0,(1.31-z)/(1.31-end))
            if kind=='bob':
                radius+=.014*math.sin(lower*PI)-.065*lower**4
            elif kind=='airbang':
                radius+=.016*math.sin(lower*PI*1.3+i*.29)-.041*lower**6
            else:
                radius+=(.038 if kind=='wavy' else .023)*math.sin(lower*PI*4+i*.83)*math.sin(min(1,lower*2)*PI/2)
                radius-=.025*lower**6
            # Alternating tangential waves make true curled clumps, not just a
            # corrugated silhouette sharing the same phase down every strip.
            turn=th+(.13 if kind=='wavy' else .025)*math.sin(lower*PI*3+i*.73)
            pts.append((radius*math.sin(turn),.045-radius*math.cos(turn),z))
        s.lock(pts,.053 if kind!='wavy' else .045,.025 if kind!='wavy' else .030,
               normal=(dx,dy,0),rings=44,flow=True,round_end=True,tip=.002)
    # Soft face-framing pieces stop above the loose back length.
    for side in (-1,1):
        length={'airbang':.73,'bob':1.075,'bun':.94,'wavy':.73}[kind]
        pts=[]
        for t in np.linspace(0,1,39):
            wave=(.043 if kind=='wavy' else .022)*math.sin(t*PI*(3.8 if kind=='wavy' else 1.3))
            pts.append((side*(.244+.043*math.sin(t*PI/2)+wave),-.155-.025*math.sin(t*PI),1.39-(1.39-length)*t))
        s.lock(pts,.027 if kind!='wavy' else .037,.023,normal=(side*.45,-1,0),rings=36,flow=True,round_end=True,tip=.002)


def gathered(s,kind):
    """Combed crown masses converge to nape ties; no shaggy rear layers."""
    n=14
    for i in range(n):
        th=.98+(2*PI-1.96)*i/(n-1);dx,dy=math.sin(th),-math.cos(th)
        side=1 if dx>0 else -1
        target=(0,.32,1.135) if kind=='ponytail' else (side*.258,.076,1.145)
        pts=[]
        for t in np.linspace(0,1,35):
            if t<.66:
                ph=.05+2.10*t/.66
                p=np.array([.317*math.sin(ph)*dx,.035+.304*math.sin(ph)*dy,1.31+.304*math.cos(ph)])
            else:
                q=(t-.66)/.34;q=q*q*(3-2*q)
                start=np.array([.317*math.sin(2.15)*dx,.035+.304*math.sin(2.15)*dy,1.31+.304*math.cos(2.15)])
                p=start*(1-q)+np.array(target)*q
                p[1]+=.025*math.sin(q*PI)
            pts.append(p)
        s.lock(pts,.066,.026,normal=(dx,dy,.08),rings=32,flow=True,tip=.006)


def braid(s,side):
    # Broad alternating crossing sections create a plait, not three thin ropes.
    for j in range(6):
        z=1.165-j*.068;w=.057*(1-j*.085)
        y=.045-.20*(j/6)
        for strand in (-1,1):
            x=side*.28+strand*w*.47
            s.lock([(x+strand*w*.38,y+.005,z+.035),(x+strand*w*.78,y-.01,z+.006),
                    (x-strand*w*.20,y-.035,z-.035),(side*.28-strand*w*.40,y-.018,z-.052)],
                   w*.62,w*.55,normal=(0,-1,0),rings=16,tip=.008)
    s.ellipsoid((side*.28,-.149,.757),(.028,.028,.015),color='785344',n=20,rings=10)
    s.lock([(side*.28,-.148,.75),(side*.293,-.16,.727),(side*.282,-.175,.704),(side*.265,-.16,.692)],.024,.022)


def back_bow(s):
    # Symmetric folded wings sit on the upper BACK, as the new rear view shows.
    color='3b302c';y=.412;z=1.40
    for side in (-1,1):
        v=[];f=[];n=16
        for j in range(9):
            t=j/8;x=side*(.014+.14*t);half=.021+.052*math.sin(t*PI/2)*(1-.16*t**6)
            for i in range(n):
                a=2*PI*i/n
                v.append((x,y+.025*math.sin(a)*(.45+.55*math.sin(PI*t)),z+half*math.cos(a)+.014*t))
        for j in range(8):
            for i in range(n):
                a=j*n+i;b=j*n+(i+1)%n;f.append((a,b,b+n,a+n))
        f.extend([tuple(range(n-1,-1,-1)),tuple(8*n+i for i in range(n))]);s.add(v,f,color=color)
        # Two softly flared ribbon tails, each with a folded shallow centre.
        v=[];f=[]
        for j in range(9):
            t=j/8
            for k in range(6):
                a=2*PI*k/6;v.append((side*(.015+.068*t)+(.018+.014*t)*math.cos(a),y+.010+.040*math.sin(PI*t)+.009*math.sin(a),z-.015-.17*t))
        for j in range(8):
            for k in range(6):
                a=j*6+k;b=j*6+(k+1)%6;f.append((a,b,b+6,a+6))
        f.extend([tuple(range(5,-1,-1)),tuple(48+i for i in range(6))]);s.add(v,f,color=color)
    s.ellipsoid((0,y+.013,z),(.032,.030,.029),n=24,rings=14,color='443630')


def build_style(style):
    s=Sculpt('hair_'+style,PALETTE[style]);s.cap(style=='pixie',style in ('curtains','ponytail'),style=='curtains')
    if style in ['comma','wolf','pixie','mullet']:rear_layers(s,style)
    if style=='curtains':
        from curtains_study import sculpt_front,source_back
        source_back(s);sculpt_front(s)
    elif style=='comma':
        for j,(theta,end,width) in enumerate([(-.86,1.80,.058),(-.50,1.88,.063),(-.14,1.90,.054),(.22,1.81,.052)]):
            front_lock(s,theta,end,width,.10+j*.035,bend=.55,layer=.017)
        for j in range(3):
            front_lock(s,.69+j*.26,1.78-j*.04,.051,.25+j*.10,bend=.19)
        front_lock(s,-.90,1.16,.072,.05,bend=.44,layer=.044)
    elif style=='wolf':
        fringe(s,'wolf')
        for side in (-1,1):
            for j in range(3):
                s.radial(side*(.92+j*.26),.40+j*.25,1.78+j*.27,.048,.029,
                         sweep=side*.15,lift=.12,drop=.023*j,flare=.12)
    elif style=='pixie':
        for row in range(3):
            n=8+row*2
            for i in range(n):
                th=-1.30+2.60*(i+.17*(row%2))/(n-1)
                s.radial(th,.12+row*.35,1.00+row*.37+s.random.uniform(-.17,.16),.036,.026,
                         sweep=s.random.uniform(-.20,.20),short=True,lift=.12 if row<2 else .02)
        for i in range(10):
            th=2*PI*i/10;s.radial(th,.02,.72,.035,.025,sweep=.30,lift=.46,short=True)
        for j in range(3):
            x=-.05+j*.045
            s.lock([(x,.045,1.55),(x-.02,.03,1.63),(x-.06,.02,1.67),(x-.09,.03,1.665)],.029,.022)
    elif style=='mullet':
        fringe(s,'curl')
        for side in (-1,1):
            for j in range(4):
                s.radial(side*(.45+j*.32),.15+j*.10,1.72+j*.20,.052,.037,
                         sweep=side*(-.10 if j%2 else .21),lift=.17,wave=.15,drop=.009*j)
        s.lock([(.02,.06,1.61),(.035,.03,1.71),(.06,.04,1.76),(.12,.07,1.745)],.033,.023)
    elif style in ['airbang','bob','bun','wavy']:
        flowing_back(s,style);fringe(s)
        if style=='bun':
            # Upper back sections sweep into the tied crown above loose waves.
            for side in (-1,1):
                for j in range(4):
                    s.lock([(side*(.22-j*.024),.19,1.40+j*.04),(side*.27,.28,1.48),
                            (side*.15,.22,1.64),(side*.025,.12,1.66)],.044,.024,normal=(0,1,.2),flow=True)
            s.ellipsoid((-.012,.10,1.712),(.095,.083,.088),tint=.94,n=32,rings=20)
            for i in range(5):
                th=2*PI*i/5
                s.lock([(-.012+.055*math.sin(th),.10+.045*math.cos(th),1.642),
                        (-.012+.113*math.sin(th),.10+.10*math.cos(th),1.715),
                        (-.012+.07*math.sin(th+.9),.10+.07*math.cos(th+.9),1.815),
                        (-.012,.10,1.781)],.034,.024)
            for j in range(5):
                s.ellipsoid((-.065+j*.027,.025,1.652),(.017,.02,.018),color='ca644d',n=16,rings=10)
        if style=='wavy':back_bow(s)
    elif style=='ponytail':
        gathered(s,style);curtains(s,True)
        s.ellipsoid((0,.335,1.142),(.061,.041,.046),color='916449',n=28,rings=14)
        for i in range(10):
            th=2*PI*i/10;dx,dy=math.sin(th),math.cos(th)
            s.lock([(.018*dx,.345+.02*dy,1.15),(.10*dx,.44+.07*dy,1.10),
                    (.13*dx,.45+.075*dy,.925),(.065*dx,.36+.045*dy,.87+.018*math.sin(i*1.6))],
                   .034,.028,normal=(dx,dy,0),rings=28,flow=True)
    elif style=='hush':
        gathered(s,style);fringe(s)
        for side in (-1,1):
            s.lock([(side*.16,.005,1.55),(side*.31,-.03,1.45),(side*.33,-.09,1.29),(side*.272,.042,1.15)],.058,.032)
            braid(s,side)
    return s.finish()
