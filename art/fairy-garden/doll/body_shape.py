"""Shared body and garment shape-key deformation, in Blender Z-up space."""
import numpy as np

HC=np.array([.00436,.01302,.94833])   # skull centre (HeadAnchor)
ss=lambda t:(lambda u:u*u*(3-2*u))(np.clip(t,0,1))
def deform(P,arm,key,outfit):
    """Offsets at slider value 2 for points P (Blender Z-up, doll space). arm = arm weight."""
    x,y,z=P[:,0],P[:,1],P[:,2];D=np.zeros_like(P);head=ss((z-.70)/.06);sx=np.sign(x)
    if key=='height':D[:,2]=.25*ss(z/.30)
    elif key=='shoulder':
        # the shoulder cap moves sideways as one piece with the arm (scaling it squashed the slope: 'no shoulders')
        cap=ss((z-.50)/.12)*(1-head)*ss((np.abs(x)-.04)/.08);D[:,0]=sx*.072*np.maximum(arm,cap)
    elif key=='waist':
        w=np.clip(1-np.abs(z-.50)/.15,0,1)*(1-arm);D[:,0]=x*.8*w;D[:,1]=y*.5*w
    elif key=='flare':
        if outfit:w=ss((.45-z)/.25)*(1-arm)*(z>.30);D[:,0]=x*.9*w;D[:,1]=y*.6*w
    elif key=='build':
        # rounder / lighter body, but the shoulder line keeps its width (the arms only follow the chest a little)
        b=(1-head)*(1-.7*ss((z-.55)/.10));D[:,0]=np.where(arm>.5,sx*.165*.6*.3,x*.6*b);D[:,1]=y*.55*b*(1-arm)
    elif key=='head':
        D=(P-HC)*head[:,None]*1.0
    return D
