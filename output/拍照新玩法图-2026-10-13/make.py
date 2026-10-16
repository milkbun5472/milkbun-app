from pathlib import Path
from PIL import Image
import json,html
P=Path(__file__).parent
records=[]
def esc(s):return html.escape(s).replace('\n','<br>')
def fig(name,caption,col,y=335,maxh=1131,maxw=474):
    path=P/'raw'/f'{name}.png';iw,ih=Image.open(path).size
    w=min(maxw,20+(maxh-59)*iw/ih)
    x=(75 if col==0 else 649)+(474-w)/2
    native.append({'file':name+'.png','originalSize':[iw,ih],'displayWidth':w-20,'scope':'complete native viewport'})
    return f'<figure class="native checked" style="left:{x}px;top:{y}px;width:{w}px"><img class="checked" src="../raw/{name}.png"><figcaption class="checked">{esc(caption)}</figcaption></figure>'
def add(name,cls,title,sub,features,body):
    i=len(records)+1
    decor='<div class="film-edge"></div><div class="film-edge right"></div>' if cls=='diary' else '<svg class="scribble" viewBox="0 0 240 150"><path d="M28 98 Q70 20 96 83 T162 63 Q200 114 223 28 M22 123 Q85 106 191 134" fill="none" stroke="#6688b7" stroke-width="6" stroke-linecap="round"/></svg>' if cls=='doodle' else ''
    hint='出图先配图像API及双方参考照' if cls=='studio' else '出图先配图像API、给TA传参考照' if cls=='diary' else '涂画、打分和抠图在本机完成'
    doc=f'''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>{esc(name)}</title><link rel="stylesheet" href="../poster.css"><body class="{cls}"><div class="wash"></div><div class="rim"></div>{decor}<div class="brand checked">秋秋机 · {"照片日记" if cls=="diary" else "照片上互动" if cls=="doodle" else "照相馆"}</div><div class="number checked">{i:02d} / 06</div><div class="rule"></div><h1 class="checked">{esc(title)}</h1><p class="sub checked">{esc(sub)}</p>{body}<footer class="footer checked"><span class="features checked">{esc(features)}</span><span class="demo checked">真实功能截图 · 人物、图像、对话为演示数据 · {hint}</span></footer></body></html>'''
    (P/'editable'/f'{i:02d}.html').write_text(doc)
    records.append({'id':i,'name':name,'file':f'{i:02d}-{name}.png','title':title,'sub':sub,'style':cls,'native':native.copy()})
native=[]
add('照相馆单张与题材','studio','挑好衣服，换个世界合照。','平行世界、杂志封面、电影海报，题材还能自己写。\n拍之前挑画风，拍完也能重画；原图会留着。','情侣空间 → 墙上 → 照相馆 · 两边衣柜可多选 · 拍好可发回聊天',fig('studio-single-entry-full','题材、两边衣服和画风，在这儿挑。',0)+fig('studio-single-result-full','拍好能换画风，也能发回聊天。',1))
native=[]
add('照相馆四宫格','studio','一张四宫格，四个小表情。','拍成大头贴，也能先挑你喜欢的画风。\n每一格都能单独放大；想更清楚，就把那格再拍成单张。','四宫格 · 选画风 · 单格放大 · 单格重拍需再用一次生图',fig('studio-grid-result-full','四宫格拍好，底下能逐格看。',0)+fig('studio-grid-cell-full','点开一格，能放大，也能再拍。',1))
native=[]
add('照相馆拍立得','studio','咔嚓一下，等照片慢慢显影。','白边相纸，底下还有TA写的一行字。\n两小时后才显出来；等不及就长按甩一甩。','拍立得 · 延迟显影 · 长按甩一甩 · 偶尔会漏光、糊或偏色',fig('polaroid-wait-full','拍完先是一张还在显影的相纸。',0)+fig('polaroid-developed-full','显影后，照片和他的字都在。',1))
native=[]
add('照片日记','diary','把他这一天，冲成三格胶片。','照着那天的日记和日程，从早到晚选三个时刻。\n那天记下的换装也会带进去；三格都能点开看。','他的日记页最底下 · 手动点一次才拍 · 每格能单独放大',fig('photo-diary-before-full','日记最底下，点一下才拍。',0)+fig('photo-diary-after-full','三格照片，连着他这一天。',1))
native=[]
add('照片涂画与TA接笔','doodle','在他的照片上，回他一笔。','画画、圈出来问他，画完连照片一起发回聊天。\n他也能在你画过的那张上接几笔，再发回来。','点开TA的照片 → 在上面画，发回去 · 换颜色／笔粗细 · 撤销',fig('doodle-circle-full','圈住想问的地方，连图一起问。',0)+fig('doodle-return-chat-full','你画过的那张，TA接了一笔。',1))
native=[]
result='<div class="sticker-result checked"><img class="checked" src="../raw/native-cut-sticker.png"><p class="checked"><b>抠好了 →「沈屿的表情」</b><br>起的名字，你们聊天都能用。</p></div>'
add('照片打分与抠成表情','doodle','贴个分数，抠成他的表情。','表情、文字、分数都能自己贴。描一圈就能抠成透明贴纸，\n起个名字、印一句字，放进他的表情包，你们都能发。','贴 · 自己写 · 打分 · 抠透明底 · 起名字 · 图上印字 · 角色也能发',fig('doodle-stamp-full','自己写个分数，点一下贴上去。',0,maxh=995)+fig('doodle-cut-full','描一圈、起名字，也能印一句字。',1,maxh=995)+result)
(P/'manifest.json').write_text(json.dumps({'title':'拍照新玩法 · 6张首批','size':[1200,1600],'count':len(records),'records':records},ensure_ascii=False,indent=2))
print('Ready',len(records),'poster sources')
