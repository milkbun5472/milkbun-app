"""M02 hand-shaped clay patches, wrapped onto the round source head.

Outlines are authored against the supplied close-up. Both surfaces and the
rim are real geometry; depth follows an ellipsoid, never a flat extrusion.
"""
import math
import collections
import numpy as np
from mathutils import Vector
from mathutils.geometry import delaunay_2d_cdt


def rounded_outline(points,steps=4):
    p=np.array(points,float);out=[]
    for i in range(len(p)):
        p0,p1,p2,p3=p[(i-1)%len(p)],p[i],p[(i+1)%len(p)],p[(i+2)%len(p)]
        for t in np.linspace(0,1,steps,endpoint=False):
            out.append(.5*(2*p1+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t))
    return np.array(out)


def patch(s,pixels,side=1,lift=.006,depth=.032,tint=1,angle=0):
    outline=rounded_outline(pixels)
    outline[:,0]=(outline[:,0]-310)*.00137*side
    outline[:,1]=1.166+(575-outline[:,1])*.00137
    # Orient the constrained polygon counterclockwise.
    area=np.sum(outline[:,0]*np.roll(outline[:,1],-1)-outline[:,1]*np.roll(outline[:,0],-1))
    if area<0:outline=outline[::-1]
    lo=outline.min(0);hi=outline.max(0)
    points=list(outline)
    for z in np.arange(lo[1]+.006,hi[1],.010):
        for x in np.arange(lo[0]+.005,hi[0],.010):
            inside=False
            for a,b in zip(outline,np.roll(outline,-1,axis=0)):
                if (a[1]>z)!=(b[1]>z) and x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0]:inside=not inside
            if inside:points.append((x,z))
    vertices,edges,faces,*_=delaunay_2d_cdt([Vector(p) for p in points],[],[list(range(len(outline)))],1,1e-7,False)
    used=sorted(set(i for f in faces for i in f));mapping={i:j for j,i in enumerate(used)}
    coords=np.array([vertices[i][:] for i in used]);faces=[tuple(mapping[i] for i in f) for f in faces]
    a=outline;b=np.roll(outline,-1,axis=0);d=b-a
    r=coords[:,None,:]-a[None,:,:];t=np.clip(np.sum(r*d[None,:,:],axis=2)/np.maximum(np.sum(d*d,axis=1),1e-14),0,1)
    distance=np.sqrt(np.min(np.sum((r-t[:,:,None]*d[None,:,:])**2,axis=2),axis=1))
    # Solve a smooth bulge over the constrained outline. Nearest-edge distance
    # alone leaves ridges where the closest edge changes on a concave curl.
    counts=collections.Counter(tuple(sorted((face[i],face[(i+1)%3]))) for face in faces for i in range(3))
    boundary=sorted({i for edge,count in counts.items() if count==1 for i in edge})
    src=[];dst=[];weight=[];area=np.zeros(len(coords))
    for face in faces:
        for j in range(3):
            a,b,c=(face[j],face[(j+1)%3],face[(j+2)%3])
            e1=coords[b]-coords[a];e2=coords[c]-coords[a]
            cross=abs(e1[0]*e2[1]-e1[1]*e2[0]);cot=float(np.dot(e1,e2))/max(cross,1e-12)
            w=max(.00001,cot*.5);src.extend([b,c]);dst.extend([c,b]);weight.extend([w,w]);area[a]+=cross/6
    src=np.array(src);dst=np.array(dst);weight=np.array(weight)
    diag=np.bincount(src,weights=weight,minlength=len(coords));u=np.zeros(len(coords))
    for _ in range(700):
        averaged=(np.bincount(src,weights=weight*u[dst],minlength=len(coords))+area)/np.maximum(diag,1e-10)
        u=.7*averaged+.3*u;u[boundary]=0
    thickness=depth*.88*np.sqrt(np.maximum(0,u)/max(1e-12,float(u.max())))
    v=[]
    for face in (-1,1):
        for (x,z),thick in zip(coords,thickness):
            q=max(.001,1-(x/.405)**2-((z-1.31)/.355)**2)
            y=.035-.307*math.sqrt(q)-lift+face*(.003+thick*(1 if face<0 else .25))
            # Rotate entire closed patches around the head when authoring sides.
            v.append((x*math.cos(angle)-(y-.035)*math.sin(angle),x*math.sin(angle)+(y-.035)*math.cos(angle)+.035,z))
    n=len(coords);f=list(faces)+[tuple(n+i for i in reversed(face)) for face in faces]
    counts=collections.Counter(tuple(sorted((face[i],face[(i+1)%len(face)]))) for face in faces for i in range(len(face)))
    for (i,j),count in counts.items():
        if count==1:f.append((i,j,j+n,i+n))
    s.add(v,f,tint)


def sculpt_front(s):
    # Left contours; the right side changes width and height slightly, rather
    # than mechanically repeating perfectly mirrored locks.
    outlines=[
        # Topmost swept crown mass.
        ([(340,275),(300,231),(260,226),(216,239),(187,254),(201,270),(246,283),(289,308),(326,316)],.0,.035,.98),
        # Upper outer sweep, with a lifted tip at the temple.
        ([(323,285),(280,260),(239,264),(196,284),(152,314),(108,348),(72,378),(40,410),(48,420),(81,409),(128,386),(168,356),(212,331),(256,320),(294,340)],.008,.033,1.02),
        # Outer side clump below the upper sweep.
        ([(247,316),(203,320),(161,348),(117,391),(82,438),(45,483),(39,515),(64,506),(98,472),(127,436),(161,405),(198,390),(230,356)],.006,.032,.98),
        # Sideburn behind the visible ear.
        ([(180,452),(135,461),(102,495),(110,537),(131,576),(157,608),(170,618),(171,594),(158,561),(163,523),(185,491)],.012,.032,.94),
        # Outer companion to the principal C curl.
        ([(287,298),(249,298),(208,329),(174,375),(143,426),(126,475),(130,523),(154,553),(186,574),(210,576),(217,568),(192,539),(181,505),(189,461),(216,413),(258,378),(279,340)],.012,.040,1.01),
        # Short root bridge; its bottom follows the curved forehead opening.
        ([(311,390),(291,398),(276,418),(272,445),(289,439),(311,439),(320,427)],.008,.020,.86),
        # Principal C-shaped fringe, broad middle and an inward turning end.
        ([(309,391),(296,363),(270,349),(240,358),(217,384),(197,422),(184,465),(183,499),(194,532),(216,552),(243,568),(273,574),(279,568),(264,549),(255,526),(252,497),(258,467),(270,440),(287,416),(301,413),(310,429)],.030,.033,1.025),
    ]
    # Rounded crown support closes the part in every viewing direction.
    s.ellipsoid((0,-.03,1.55),(.25,.14,.078),tint=.93)
    s.lock([(-.08,-.10,1.600),(-.11,.02,1.642),(.025,.12,1.635),(.14,.14,1.579)],width=.069,depth=.026,normal=(0,0,1),tint=1.02,rings=32,sides=16)
    # Curved temple bridges overlap the original rear at the cut boundary.
    # Their centreline travels around the skull, not along the front plane.
    for sign in (-1,1):
        s.lock([(sign*.12,-.005,1.617),(sign*.27,-.080,1.56),(sign*.355,-.065,1.43),(sign*.29,-.055,1.24)],width=.060,depth=.034,normal=(sign,-.10,0),tint=.98,rings=32,sides=16)
    for side in (1,-1):
        for i,(outline,lift,depth,tint) in enumerate(outlines):
            if i==0:outline=[(x,y+(-7 if side>0 else 14)) for x,y in outline]
            if i==6:outline=[(236+(x-230)*(.90 if side>0 else .94),y) for x,y in outline]
            if side<0:
                outline=[(310+(x-310)*(1.00 if i==6 else .96),y+(3 if i==6 else -2)) for x,y in outline]
            patch(s,outline,side,lift,depth,tint)


def source_back(s):
    """Reuse the supplied GLB's actual rear clumps and baked clay colour.

Only the rear half is sampled. UV colour is retained as vertex data;
normals are recalculated after reshaping the join and crown.
"""
    import bpy
    source=bpy.data.objects['hair_korean'];mesh=source.data
    world=np.array([source.matrix_world@v.co for v in mesh.vertices])
    selected=[p for p in mesh.polygons if np.mean(world[list(p.vertices),1])>-.085]
    used=sorted({i for p in selected for i in p.vertices});mapping={old:new for new,old in enumerate(used)}
    uv=np.zeros((len(mesh.vertices),2));normal=np.zeros((len(mesh.vertices),3));count=np.zeros(len(mesh.vertices))
    transform=source.matrix_world.to_3x3().inverted().transposed()
    for loop,n,u in zip(mesh.loops,mesh.corner_normals,mesh.uv_layers.active.data):
        i=loop.vertex_index;uv[i]+=u.uv[:];normal[i]+=transform@Vector(n.vector);count[i]+=1
    uv/=np.maximum(1,count[:,None]);normal/=np.maximum(1e-12,np.linalg.norm(normal,axis=1)[:,None])
    image=next(n.image for n in mesh.materials[0].node_tree.nodes if n.type=='TEX_IMAGE' and any(l.to_socket.name=='Base Color' for out in n.outputs for l in out.links))
    w,h=image.size;tex=np.array(image.pixels[:],np.float32).reshape(h,w,4)
    q=np.floor(uv[used]*[w,h]).astype(int);rgb=tex[np.clip(q[:,1],0,h-1),np.clip(q[:,0],0,w-1),:3]
    rgb=np.where(rgb<=.04045,rgb/12.92,((rgb+.055)/1.055)**2.4)
    lum=rgb@np.array([.2126,.7152,.0722]);median=max(.001,float(np.median(lum)))
    # Bury the clipped front edge underneath the new temple locks. Preserve
    # the visible posterior volume; a raw clipping edge makes sawtooth seams.
    join=np.clip((.055-world[:,1])/.14,0,1);join=join*join*(3-2*join)
    world[:,0]*=1-.16*join
    world[:,1]+=.020*join
    world[:,2]=np.where(world[:,2]>1.645,1.645+(world[:,2]-1.645)*.06,world[:,2])
    off=len(s.v);s.add(world[used],[tuple(mapping[i] for i in p.vertices) for p in selected])
    for j,i in enumerate(used):
        s.colors[off+j]=(*(s.color*np.clip(lum[j]/median,.45,1.5)**.85),1)
        s.source_painted_vertices.add(off+j)


# --- v2: broad rounded clay clumps, placed on a shell around the skull ------
# Authored from the supplied M02 front/side/back sheet. Points are given as
# front-view (x,z) plus a shell lift; y is solved on the head ellipsoid so every
# clump wraps the round skull. Widths follow a buried root, a fat belly and a
# soft point, which reads as pressed clay rather than a thin noodle.
SHELL=(.012,.030,1.300,.300,.292,.315)   # centre x,y,z and radii


def on_shell(x,z,lift=0.,back=False):
    cx,cy,cz,rx,ry,rz=SHELL
    rx+=lift;ry+=lift;rz+=lift
    q=1-((x-cx)/rx)**2-((z-cz)/rz)**2
    # Soft floor: tips that leave the silhouette keep a forward depth instead
    # of folding back to the side plane (which pinched them into knobs).
    q=.5*(q+math.sqrt(q*q+.03))
    y=ry*math.sqrt(q)
    return (x,cy+y if back else cy-y,z)


BELLY=[.18,.42,.75,.95,1.0,.88,.62,.30,.05]


def clump(s,pts,width,depth,lifts=None,tint=None,widths=BELLY,rings=30,sides=14):
    lifts=lifts or [.02]*len(pts)
    p=[on_shell(q[0],q[1],l) if len(q)==2 else tuple(q) for q,l in zip(pts,lifts)]
    s.lock(p,width,depth,tint=tint,rings=rings,sides=sides,widths=widths)


def sculpt_front_v2(s):
    s.ellipsoid((0,-.01,1.52),(.22,.14,.085),tint=.92)
    # Crown bridge over the whorl, closing the clipped top of the retained rear.
    s.lock([(-.09,-.06,1.615),(-.10,.03,1.650),(.02,.11,1.645),(.13,.13,1.590)],width=.075,depth=.028,normal=(0,0,1),tint=1.0,rings=32,sides=16)
    for side in (1,-1):
        m=lambda pts:[(side*x,z) if len(q)==2 else (side*q[0],q[1],q[2]) for q in pts for x,z in [q[:2]]]
        # 1. Principal C fringe: rises from the part, bellies over the temple
        #    and turns its point back inward just above the eye.
        clump(s,m([(.015,1.50),(.085,1.44),(.165,1.345),(.197,1.265),(.183,1.215),(.148,1.193)]),
              .096,.042,[.035,.042,.040,.036,.034,.032],tint=1.03,
              widths=[.16,.40,.72,.94,1,.90,.62,.30,.05])
        # 2. Short inner root under the C, fills the part opening.
        clump(s,m([(.010,1.48),(.040,1.42),(.070,1.36),(.075,1.33)]),.040,.022,[.03,.035,.035,.03],tint=.93,
              widths=[.2,.6,.9,.5,.1])
        # 3. Outer companion, parallel behind the C, ending lower at the cheek.
        clump(s,m([(.06,1.53),(.17,1.45),(.245,1.33),(.255,1.20),(.225,1.105)]),
              .080,.040,[.045,.052,.050,.046,.044],tint=.99)
        # 4. Upper sweep flaring outward into a lifted point at the temple.
        clump(s,m([(.05,1.58),(.17,1.54),(.28,1.47),(.36,1.42),(.43,1.40)]),
              .078,.036,[.055,.058,.064,.080,.105],tint=1.02)
        # 5. Mid outer flare below it.
        clump(s,m([(.14,1.50),(.25,1.42),(.33,1.33),(.38,1.27),(.43,1.25)]),
              .075,.036,[.060,.066,.074,.088,.110],tint=.97)
        # 6. Lower side lock over the ear top, tip flicking out.
        clump(s,m([(.24,1.42),(.30,1.32),(.325,1.22),(.345,1.16),(.390,1.12)]),
              .070,.034,[.062,.068,.074,.088,.108],tint=.95)
        # 7. Sideburn in front of the ear, pointing down to the cheek.
        clump(s,m([(.20,1.36),(.255,1.26),(.265,1.15),(.250,1.07),(.235,1.03)]),
              .058,.030,[.050,.052,.050,.048,.046],tint=.94)
        # 8. Crown-front lock that fills between part and upper sweep.
        clump(s,m([(.01,1.60),(.09,1.575),(.17,1.53),(.22,1.49)]),.080,.032,[.05,.055,.055,.05],tint=1.0)
    # Side sweeps: cover the join between the fringe and the retained rear,
    # falling back and down over the upper ear like the reference profile.
    for side in (1,-1):
        for i,(y0,y1,z1,w) in enumerate([(-.10,.00,1.16,.080),(-.02,.10,1.12,.085),(.06,.20,1.10,.080)]):
            th=math.atan2(y0-.03,.30)
            pts=[(side*.10,y0,1.60),(side*.26,y0+.01,1.50),(side*.345,(y0+y1)/2,1.36),
                 (side*.355,y1,1.23),(side*.34,y1+.02,z1)]
            s.lock(pts,w,.036,tint=(.97,1.0,.95)[i],rings=30,sides=14,
                   normal=None,widths=BELLY)
    # Crown cowlick: short lifted tips rising from the whorl, bent backward.
    for dx,lean,h in ((-.035,-.05,.065),(.03,.055,.055),(.0,-.01,.08)):
        s.lock([(dx,.05,1.585),(dx+lean*.3,.045,1.625),(dx+lean*.7,.06,1.585+h),(dx+lean,.09,1.60+h*.8)],
               .030,.022,tint=1.0,rings=18,normal=(0,.3,1))
