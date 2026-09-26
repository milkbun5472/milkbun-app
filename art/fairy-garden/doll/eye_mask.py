"""把「眼珠在哪」写进每张脸贴图的透明通道（她 2026-09-26：眼睛也要能自定义颜色）。
十张脸里眼睛是唯一的深棕色块（嘴是偏红的，见 art/fairy-garden/faces/faces.json）。
只在「十张脸彼此不同」的那几块（膨胀一圈）里找，贴图边上那些深色接缝不会被算进去。
alpha = 255 - 眼睛程度*127：皮肤处 255，眼珠中心 128——不用 0，免得浏览器预乘把颜色吃掉。
运行时（traveler.mjs eyeShader）按 m=(1-a)*2 把这一块换成选的眼睛颜色。
用法：python3 eye_mask.py apps/fairy-garden/faces apps/companion/faces"""
import sys,numpy as np
from PIL import Image,ImageFilter
IDS=['default','happy','cozy','relax','surprise','amazed','proud','gloomy','sad','irritated']
SKIN=np.array([236,208,186.]);BROWN=np.array([100,74,61.])
for d in sys.argv[1:]:
    A={i:np.asarray(Image.open(f'{d}/{i}.webp').convert('RGB')).astype(float) for i in IDS}
    diff=np.zeros(A['default'].shape[:2],bool)
    for i in IDS[1:]:diff|=np.abs(A[i]-A['default']).sum(-1)>90
    W=A['default'].shape[1];r=max(3,W//80)
    zone=np.asarray(Image.fromarray((diff*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(2*r+1)))>0
    v=BROWN-SKIN
    for i in IDS:
        c=A[i];t=np.clip(((c-SKIN)@v)/(v@v),0,1)
        resid=np.linalg.norm(c-(SKIN+t[...,None]*v),axis=-1)
        red=(c[...,0]-c[...,1])>42   # 嘴和腮红：红减绿明显大；眼珠和皮肤都在 30 上下
        # 嘴上沿那道深色描边挨着红嘴：深红（嘴，不是浅粉的腮红）周围一小圈都不算眼睛
        mouth=red&(c.sum(-1)<560)
        mouth=np.asarray(Image.fromarray((mouth*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(2*r+1)))>0
        m=np.where(zone&~red&~mouth&(resid<34+20*(1-t)),t,0)
        m=np.clip((m-.12)/.7,0,1)
        a=(255-np.round(m*127)).astype(np.uint8)
        Image.fromarray(np.dstack([c.astype(np.uint8),a]),'RGBA').save(f'{d}/{i}.webp','WEBP',quality=90,method=6,exact=True)
        print(d,i,'eye texels',int((m>.5).sum()))
