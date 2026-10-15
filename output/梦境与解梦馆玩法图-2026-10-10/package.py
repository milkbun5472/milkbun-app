from pathlib import Path
from urllib.parse import quote
from html import escape
import json, shutil, zipfile, hashlib
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent
manifest = json.loads((ROOT / 'manifest.json').read_text())
records = manifest['records']
cover = '梦境与解梦馆-小红书封面.png'
archive = '梦境与解梦馆-18张玩法图.zip'
shutil.copy2(ROOT / '发布图' / records[0]['file'], ROOT / cover)

notes = '''秋秋机 · 梦境 × 解梦馆玩法图
18张单图，包含小红书封面；每张1200×1600。
午夜蓝、梦中拱门与纸片层次，延续时刻／星测的氛围。
原生功能界面；人物、梦境、解读与聊天回复均为虚构演示数据。

发布图／：18张完整PNG，可直接选取上传。
index.html：图册，点击图片放大，可切换原尺寸并单张下载。
梦境与解梦馆-小红书封面.png：独立封面，与第01页相同。
18页总览.jpg：排版总览，仅用于预览。

页序：
'''
notes += '\n'.join(f"{r['id']:02d}  {r['name']} — {r['features']}" for r in records)
notes += '''

制作与核查：
基于当前工作目录的原生界面与实际点击流程制作，使用隔离虚构档。
玩法说明由梦境、解梦馆、梦循环、物品和聊天代码核对。
梦核／直面／梦碎／主动醒来、回档、物品写入、解读并存及同场夜梦联动均经过原生处理器操作。
模型响应、语音转写和聊天内容为本地预置演示，未调用真实模型或读取私人存档。
内置image_gen生成无字背景；界面截图和文字用HTML/CSS排版，背景提示词见相邻文件。
raw／保留原界面区域，editable／保留可编辑排版；capture、render和manifest保留制作证据。

功能边界：
熟悉度提示按此版本从TA的夜梦进入的路径展示。
夜梦复现仅适用于TA夜梦中的梦碎结局，2—7晚后，每场只回来一次。
醒后聊天展示对应结局带来的余味，不代表独立定时发送。
语音听写需当前设备支持；没有现场测试麦克风识别。
梦中物品进入我的物品，可带在身上；14天未提起变浅、30天消散，聊天提及物品名能续留。
'''
(ROOT / '制作说明.txt').write_text(notes)

cards = []
gallery_data = []
for i, r in enumerate(records):
    src = quote('发布图/' + r['file'])
    label = f"{r['id']:02d} / {r['name']}"
    cards.append(f'''<article><button class="thumb" data-index="{i}" aria-label="放大{escape(label)}"><img src="{src}" alt="{escape(label)}" loading="eager" width="1200" height="1600"></button><h2>{escape(label)}</h2><p>{escape(r['features'])}</p><a href="{src}" download="{escape(r['file'])}">下载这一张</a></article>''')
    gallery_data.append({'src': src, 'file': r['file'], 'label': label})
html = '''<!doctype html><html lang="zh-CN"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>秋秋机 · 梦境与解梦馆玩法图</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#0e1727;color:#ebe5d9;font-family:"PingFang SC",sans-serif}header,main{max-width:1350px;margin:auto;padding:32px}header{padding-bottom:8px}h1{font-family:"Songti SC",serif;font-size:clamp(27px,4vw,46px);margin:10px 0 15px}header p{color:#bdc4d0;line-height:1.8}nav{display:flex;flex-wrap:wrap;gap:12px;margin:24px 0}a,button{color:inherit}nav a,dialog button,dialog a{border:1px solid #5b6373;border-radius:20px;background:#202a3d;padding:9px 16px;text-decoration:none;font-size:14px}main{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:36px 24px}article{min-width:0}h2{font-size:18px;font-weight:500;margin:16px 0 8px}article p{font-size:14px;color:#bdc4d0;line-height:1.6;min-height:44px;margin:0 0 12px}article>a{font-size:13px;color:#d8c9ae;text-underline-offset:4px}.thumb{border:0;background:transparent;padding:0;width:100%;cursor:zoom-in;display:block}.thumb img{display:block;width:100%;height:auto;box-shadow:0 12px 26px #0005}button:focus-visible,a:focus-visible{outline:3px solid #d7c18f;outline-offset:4px}
dialog{padding:0;border:1px solid #566077;background:#0e1727;color:inherit;width:calc(100vw - 32px);height:calc(100dvh - 32px);max-width:1500px;max-height:none;border-radius:10px}dialog::backdrop{background:#030813dd}.toolbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:12px;border-bottom:1px solid #3a465c}.toolbar span{flex:1 0 190px;font-size:14px}.viewer{height:calc(100% - 66px);overflow:auto;display:flex;align-items:flex-start;justify-content:center;padding:16px}.viewer img{max-width:100%;max-height:100%;object-fit:contain;width:auto;height:auto}.viewer.actual{display:block}.viewer.actual img{width:1200px;max-width:none;max-height:none;height:1600px}.toolbar button{cursor:pointer}footer{padding:30px;text-align:center;color:#929cac;font-size:13px;line-height:1.8}@media(max-width:850px){main{grid-template-columns:repeat(2,minmax(0,1fr))}header,main{padding:22px}.toolbar{min-height:105px}.viewer{height:calc(100% - 105px)}}@media(max-width:520px){main{grid-template-columns:1fr;gap:32px}header,main{padding:18px}article p{min-height:0}dialog{width:calc(100vw - 12px);height:calc(100dvh - 12px)}.toolbar{padding:8px;gap:6px;min-height:113px}.toolbar span{flex-basis:100%}.toolbar button,.toolbar a{padding:7px 10px;font-size:12px}.viewer{height:calc(100% - 113px);padding:8px}}
</style><header><p>秋秋机 · 梦境 × 解梦馆</p><h1>我的梦，给TA解。<br>TA的梦，换我闯。</h1><p>18张单图 · 含小红书封面 · 1200×1600<br>点击图片放大，用左右键翻页，也可查看原尺寸。</p><nav>__NAV__</nav></header><main>__CARDS__</main><footer>真实功能界面 · 人物、梦境、解读与聊天回复为虚构演示数据<br>无字背景使用内置image_gen生成，截图与文案单独排版。</footer><dialog aria-label="原图查看"><div class="toolbar"><span id="page-label"></span><button id="prev" aria-label="上一张">上一张</button><button id="next" aria-label="下一张">下一张</button><button id="zoom">原尺寸</button><a id="download" download>下载</a><button id="close">关闭</button></div><div class="viewer"><img id="full" alt=""></div></dialog>
<script>
const pages=__DATA__,dialog=document.querySelector('dialog'),viewer=document.querySelector('.viewer'),full=document.querySelector('#full'),label=document.querySelector('#page-label'),download=document.querySelector('#download'),zoom=document.querySelector('#zoom');let index=0;
function show(i){index=(i+pages.length)%pages.length;const p=pages[index];full.src=p.src;full.alt=p.label;label.textContent=p.label;download.href=p.src;download.download=p.file;viewer.classList.remove('actual');zoom.textContent='原尺寸';viewer.scrollTop=viewer.scrollLeft=0}
document.querySelectorAll('.thumb').forEach(b=>b.addEventListener('click',()=>{show(Number(b.dataset.index));dialog.showModal()}));document.querySelector('#prev').onclick=()=>show(index-1);document.querySelector('#next').onclick=()=>show(index+1);document.querySelector('#close').onclick=()=>dialog.close();zoom.onclick=()=>{const actual=viewer.classList.toggle('actual');zoom.textContent=actual?'适合窗口':'原尺寸'};dialog.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();show(index-1)}if(e.key==='ArrowRight'){e.preventDefault();show(index+1)}});
</script></html>'''
nav = ''.join(f'<a href="{quote(name)}" download>{label}</a>' for name, label in [(archive,'下载18张原图ZIP'),(cover,'下载独立封面'),('18页总览.jpg','查看总览'),('制作说明.txt','制作说明'),('背景提示词.txt','背景提示词')])
html = html.replace('__NAV__',nav).replace('__CARDS__','\n'.join(cards)).replace('__DATA__',json.dumps(gallery_data,ensure_ascii=False))
(ROOT / 'index.html').write_text(html)

font = ImageFont.truetype('/System/Library/Fonts/STHeiti Light.ttc',20)
title_font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Songti.ttc',36)
cols, tw, th, gap, pad, top = 3, 360, 480, 26, 32, 128
cell = th+45
overview = Image.new('RGB',(2*pad+cols*tw+(cols-1)*gap,top+6*cell+5*gap+pad),'#0e1727')
draw=ImageDraw.Draw(overview);draw.text((pad,30),'秋秋机 · 梦境 × 解梦馆',font=title_font,fill='#ebe5d9');draw.text((pad,83),'18张单图 · 含封面 · 完整图片见发布图文件夹',font=font,fill='#adb7c6')
for i,r in enumerate(records):
    im=Image.open(ROOT/'发布图'/r['file']).convert('RGB').resize((tw,th),Image.Resampling.LANCZOS)
    x=pad+(i%cols)*(tw+gap);y=top+(i//cols)*(cell+gap);overview.paste(im,(x,y));draw.text((x,y+th+10),f"{r['id']:02d}  {r['name']}",font=font,fill='#d8c9ae')
overview.save(ROOT/'18页总览.jpg',quality=92)

with zipfile.ZipFile(ROOT/archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for r in records:z.write(ROOT/'发布图'/r['file'],r['file'])
    for f in ['制作说明.txt','背景提示词.txt']:z.write(ROOT/f,f)

hashes={}
for r in records:
    p=ROOT/'发布图'/r['file']
    with Image.open(p) as im:assert im.size==(1200,1600)
    for src in r['native']:assert (ROOT/'raw'/f'{src}.png').exists()
    hashes[r['file']]=hashlib.sha256(p.read_bytes()).hexdigest()
with zipfile.ZipFile(ROOT/archive) as z:
    assert z.testzip() is None
    assert len([n for n in z.namelist() if n.endswith('.png')])==18
    for name,digest in hashes.items():assert hashlib.sha256(z.read(name)).hexdigest()==digest
source=json.loads((ROOT/'source-snapshot.json').read_text())
for f in source['files']:
    assert hashlib.sha256((ROOT/'product-source'/f['path']).read_bytes()).hexdigest()==f['sha256'],f['path']
layout=json.loads((ROOT/'render-checks.json').read_text());assert layout['violations']==layout['errors']==[]
checks={'pages':18,'dimensions':[1200,1600],'pngHashes':hashes,'zipCRC':'pass','zipHashes':'pass','sourceSnapshotHashes':len(source['files']),'renderErrors':0,'zipBytes':(ROOT/archive).stat().st_size}
(ROOT/'final-checks.json').write_text(json.dumps(checks,ensure_ascii=False,indent=2)+'\n')
print(json.dumps({k:v for k,v in checks.items() if k!='pngHashes'},ensure_ascii=False))
