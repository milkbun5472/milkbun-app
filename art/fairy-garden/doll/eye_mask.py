"""把「眼珠在哪」写进每张脸贴图的透明通道（她 2026-09-26：眼睛也要能自定义颜色）。
运行时（traveler.mjs coveredSkinShader）按 m=(1-a)*2 把这一块换成选的眼睛颜色。
alpha = 255 - 眼珠程度*127：皮肤处 255，眼珠中心 128——不用 0，免得浏览器预乘把颜色吃掉。

哪些算「眼珠」（她 2026-09-26 定）：
  · 开心（弯眼）、惬意（横眼）是眯起来的缝——整张不染；
  · 放松一睁一眯——只染睁着的那只（画面右侧），「>」不染；
  · 自豪、低落、难过、烦躁上面连着一撇眉毛/眼皮——那一撇保持深棕，只染下面的眼珠；
  · 默认、震惊、惊讶（星星眼算眼珠）整只染。
做法：在画脸的原图坐标里挑（eye-dark/<id>.png，由 eye_dark.mjs 画），细的那一撇用开运算去掉，
再按 bake_face.py 同一套正面投影（FACE_S/FACE_CZ 与 v2/README 一致）搬到贴图上，
和贴图上「接近眼睛那个棕」的程度相乘（边缘抗锯齿跟着走，贴图接缝处的深色不会被算进来）。
用法：python3 art/fairy-garden/doll/eye_mask.py -- apps/fairy-garden/faces apps/companion/faces
      ⚠️对着 bake_face.py 刚烤出来的 webp 跑一次就够；跑第二次也无妨（只重写透明通道）。"""
import sys,os,numpy as np,bpy
from PIL import Image,ImageFilter
HERE=os.path.dirname(os.path.abspath(__file__))
SRC=os.path.join(HERE,'v2','doll-blank-face.glb');S=.00152;CZ=.915;CX=0.
IDS=['default','happy','cozy','relax','surprise','amazed','proud','gloomy','sad','irritated']
CLOSED={'happy','cozy'};BROWS={'proud','gloomy','sad','irritated'}
SKIN=np.array([236,208,186.]);BROWN=np.array([100,74,61.])
def filt(a,f):return np.asarray(Image.fromarray((a*255).astype(np.uint8)).filter(f))>127
def keep(id):
    a=np.asarray(Image.open(os.path.join(HERE,'eye-dark',id+'.png')).convert('L'))<128
    if id in CLOSED:return np.zeros_like(a)
    if id in BROWS:a=filt(filt(a,ImageFilter.MinFilter(37)),ImageFilter.MaxFilter(37))   # 眉毛那一撇比眼珠细，开运算去掉
    a=a.copy();a[710 if id=='surprise' else 722:]=False                                 # 嘴上沿那道深色描边
    if id=='relax':a[:,:512]=False                                                      # 画面左边是眯着的「>」
    return filt(a,ImageFilter.MaxFilter(9))                                             # 外扩一点，接住贴图上的抗锯齿边
# 贴图像素 → 脸上世界坐标（与 bake_face.py 同一段光栅化）
for o in list(bpy.data.objects):bpy.data.objects.remove(o)
bpy.ops.import_scene.gltf(filepath=SRC)
obj=next(o for o in bpy.data.objects if o.type=='MESH');me=obj.data;mat=me.materials[0]
img=next(n.image for n in mat.node_tree.nodes if n.type=='TEX_IMAGE' and any(l.to_socket.name=='Base Color' for o_ in n.outputs for l in o_.links))
W,H=img.size;co=np.array([obj.matrix_world@v.co for v in me.vertices]);me.calc_loop_triangles();uvl=me.uv_layers.active.data
Xw=np.full((H,W),np.nan);Zw=np.full((H,W),np.nan)
for t in me.loop_triangles:
    vs=[me.loops[k].vertex_index for k in t.loops];P=co[vs]
    if P[:,1].mean()>-.02 or P[:,2].mean()<.62:continue
    uv=np.array([uvl[k].uv[:] for k in t.loops])*[W,H]
    x0,y0=np.floor(uv.min(0)).astype(int)-1;x1,y1=np.ceil(uv.max(0)).astype(int)+1
    xs,ys=np.meshgrid(np.arange(max(0,x0),min(W,x1)),np.arange(max(0,y0),min(H,y1)))
    px=np.stack([xs+.5,ys+.5],-1).reshape(-1,2);a,b,c=uv;m=np.array([b-a,c-a]).T
    if abs(np.linalg.det(m))<1e-9:continue
    l=np.linalg.solve(m,(px-a).T).T;w0=1-l[:,0]-l[:,1];inside=(l[:,0]>=-.02)&(l[:,1]>=-.02)&(w0>=-.02)
    if not inside.any():continue
    pos=w0[inside,None]*P[0]+l[inside,0,None]*P[1]+l[inside,1,None]*P[2]
    Xw[ys.reshape(-1)[inside],xs.reshape(-1)[inside]]=pos[:,0];Zw[ys.reshape(-1)[inside],xs.reshape(-1)[inside]]=pos[:,2]
for _ in range(10):
    miss=np.isnan(Xw)
    for dy,dx in ((1,0),(-1,0),(0,1),(0,-1)):
        sx=np.roll(np.roll(Xw,dy,0),dx,1);sz=np.roll(np.roll(Zw,dy,0),dx,1);take=miss&~np.isnan(sx);Xw[take]=sx[take];Zw[take]=sz[take];miss=np.isnan(Xw)
# Blender 的像素行从下往上；导出的贴图（webp）行从上往下
Xw=Xw[::-1];Zw=Zw[::-1]
cover=~np.isnan(Xw);u=np.nan_to_num((Xw-CX)/S+160)/320*1024;v=np.nan_to_num((CZ-Zw)/S+160)/320*1024
ok=cover&(u>=0)&(u<1023)&(v>=0)&(v<1023);ui=u.astype(int).clip(0,1023);vi=v.astype(int).clip(0,1023)
v_=BROWN-SKIN
for id in IDS:
    K=keep(id);kt=np.where(ok,K[vi,ui],False)
    for d in sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []:
        f=os.path.join(d,id+'.webp');c=np.asarray(Image.open(f).convert('RGB')).astype(float);h,w=c.shape[:2]
        k=np.asarray(Image.fromarray((kt*255).astype(np.uint8)).resize((w,h),Image.BILINEAR))/255.
        t=np.clip(((c-SKIN)@v_)/(v_@v_),0,1);m=np.clip((t-.12)/.7,0,1)*k
        a=(255-np.round(m*127)).astype(np.uint8)
        Image.fromarray(np.dstack([c.astype(np.uint8),a]),'RGBA').save(f,'WEBP',quality=90,method=6,exact=True)
        print(d,id,'eye texels',int((m>.5).sum()))
