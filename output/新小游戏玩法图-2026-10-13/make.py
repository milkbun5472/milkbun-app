from pathlib import Path
from PIL import Image
import json,html
P=Path(__file__).parent
records=[]
def esc(s):return html.escape(s).replace('\n','<br>')
def fig(name,caption,col,maxh=1131,maxw=474):
    iw,ih=Image.open(P/'raw'/f'{name}.png').size;w=min(maxw,20+(maxh-59)*iw/ih);x=(75 if col==0 else 649)+(474-w)/2
    native.append({'file':name+'.png','originalSize':[iw,ih],'displayWidth':w-20,'scope':'complete native viewport'})
    return f'<figure class="native checked" style="left:{x}px;top:335px;width:{w}px"><img class="checked" src="../raw/{name}.png"><figcaption class="checked">{esc(caption)}</figcaption></figure>'
def add(name,cls,title,sub,features,body):
    i=len(records)+1;game='骗子骰' if cls=='liar' else '故事接龙' if cls=='story' else '各怀心思的约会'
    doc=f'''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>{esc(name)}</title><link rel="stylesheet" href="../poster.css"><body class="{cls}"><div class="wash"></div><div class="rim"></div><div class="brand checked">秋秋机 · {game}</div><div class="number checked">{i:02d} / 04</div><div class="rule"></div><h1 class="checked">{esc(title)}</h1><p class="sub checked">{esc(sub)}</p>{body}<footer class="footer checked"><span class="features checked">{esc(features)}</span><span class="demo checked">真实游戏界面 · 人物、对话与局内数据为演示数据 · 入口：一起玩 → 小游戏</span></footer></body></html>'''
    (P/'editable'/f'{i:02d}.html').write_text(doc);records.append({'id':i,'name':name,'file':f'{i:02d}-{name}.png','title':title,'sub':sub,'style':cls,'native':native.copy()})
native=[]
add('骗子骰','liar','骰子藏着，嘴上可不认输。','TA按自己的人设出手，会诈唬、嘴硬，也能让着你。\n你也能边叫边回一句；开了杯，再看谁刚才在嘴硬。','正常／放水／观战 · 人设与水平分别发挥 · 叫价、开杯和扣命都按实际判',fig('liar-playing-full','骰子扣着，桌上的话可没停。',0)+fig('liar-reveal-full','一开杯，骰子和这一手的结果都亮了。',1))
native=[]
add('故事接龙','story','你接一句，TA把故事拐个弯。','和几个角色轮流接，接法跟着各自的人设走。\n抽到的词会标出来，写完能起名字、复制整篇带走。','2–8人一起写 · 每人一词 · 三圈收尾 · 谁接了哪句看得到',fig('story-writing-full','轮到你接，抽到的词就在输入栏。',0)+fig('story-finished-full','你们接的句子，拼成了同一篇。',1))
native=[]
add('秘密约会商量与抓玩偶','date','约你出门，TA也藏着算盘。','各抽一张秘密任务，轮流商量这一站去哪。\n地图从地点池里抽，路上可能撞小意外；到站TA也会接话。','各自秘密任务 · 轮流做主 · 抓玩偶TA管前后、你管左右 · 预算在本局',fig('date-plan-chat-full','商量下一站，也藏着各自的心思。',0)+fig('date-claw-full','TA停前后排，你拖滑杆管左右。',1))
native=[]
add('秘密约会配动作与翻牌','date','你猜他的心思，他也在猜你。','合照拖滑杆选动作，听TA的提示找默契；失手能再配合一次。\n收工各猜一次对方任务，翻牌看谁做成了、谁猜中了。','合照配动作 · TA先封猜测 · 完成+2／猜中+1 · 独立存档，不进回忆',fig('date-photo-full','听TA的提示，拖滑杆配一个动作。',0)+fig('date-result-full','到最后翻牌，才知道他藏着什么。',1))
(P/'manifest.json').write_text(json.dumps({'title':'三个新小游戏 · 4张玩法图','size':[1200,1600],'count':len(records),'records':records},ensure_ascii=False,indent=2));print('Ready',len(records),'poster sources')
