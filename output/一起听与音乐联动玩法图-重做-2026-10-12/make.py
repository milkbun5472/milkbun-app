from pathlib import Path
from PIL import Image
import html,json
P=Path(__file__).parent
esc=lambda s:html.escape(s).replace('\n','<br>')
records=[]
def fig(name,caption,x,y,w,kind='full-page',maxh=None):
    image=P/'raw'/f'{name}.png'
    assert image.exists(),image
    iw,ih=Image.open(image).size
    if maxh:w=min(w,20+(maxh-58)*iw/ih)
    refs.append({'file':name+'.png','kind':kind,'originalSize':[iw,ih],'displayWidth':w-20})
    return f'<figure class="native checked {"panel" if kind!="full-page" else ""}" style="left:{x}px;top:{y}px;width:{w}px"><img class="checked" src="../raw/{name}.png" alt="{html.escape(caption)}"><figcaption class="checked">{esc(caption)}</figcaption></figure>'
def note(text,x,y,w):
    return f'<p class="note checked" style="left:{x}px;top:{y}px;width:{w}px">{esc(text)}</p>'
def add(name,title,sub,features,body,css=''):
    i=len(records)+1
    cls=('cover' if i==1 else '')+(' p5' if i==5 else '')
    out=f'''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>{esc(name)}</title><link rel="stylesheet" href="../poster.css"><body class="{cls}"><div class="wash"></div><div class="rim"></div><div class="brand checked">秋秋机 · 一起听与音乐联动</div><div class="page-no checked">{i:02d} / 06</div><div class="bar"></div><h1 class="checked">{esc(title)}</h1>'''
    if i!=1:out+=f'<p class="sub checked">{esc(sub)}</p>'
    out+=body+f'<footer class="footer checked"><span class="features checked">{esc(features)}</span><span class="demo checked">真实功能界面 · 人物／曲目／对话为演示数据</span></footer></body></html>'
    (P/'editable'/f'{i:02d}.html').write_text(out)
    records.append({'id':i,'name':name,'file':f'{i:02d}-{name}.png','title':title,'sub':sub,'features':features,'native':refs.copy()})
refs=[]
add('小红书封面','一起听','', '一起听 × 主聊天 × 查手机音乐 × 情侣唱片',
    '<p class="tagline checked">同一首歌，<br>两个人的声音。</p><p class="lead checked">他能邀请你来听。<br>你也能让他选歌。<br>聊过的话，接回主聊天。</p><div class="chips checked"><span>边听边聊</span><span>他的歌单</span><span>你们的唱片</span></div><p class="slogan checked">耳机戴上，<br>也听听他的偏爱。</p>'+fig('listen-bubbles','播放器里，你们也在说话。',669,321,452))
refs=[]
add('完整播放器与边听边聊','同一首歌，边听边聊。','播放、进度、歌词、选对象，都在播放器里。\n输入一句，TA逐句接话；也能开关TA自己开口。','选对象 · 播放与歌词 · 逐句接话 · 主动开口可开关',
    fig('listen-partner','完整播放页 · 对象和操作都在。',80,340,480)+fig('lyrics-player-full','看歌词、说一句，TA也接得上。',679,334,414))
refs=[]
add('邀请点歌与主聊天同步','他能邀你，聊过的话也留着。','TA可发一起听邀请，也能按聊天里的消息选歌、切歌。\n一起听里你们说过的原话，回到主聊天还能接着聊。','聊天邀请 → 一起听 → 原话回主聊天 · 也能聊天点歌',
    fig('chat-linked-full','邀请、听歌原话、点歌，在主聊。',113,332,414,maxh=1160)+fig('chat-picked-player-full','TA选过以后，播放器也切好了。',640,340,480))
refs=[]
add('TA歌单与查手机音乐','他的歌单，两处都找得到。','按TA的人设生成歌单，继续生成会追加新歌、跳过重复。\n查手机里是同一张；也能看TA选歌，把备注提回聊天。','生成TA歌单 · 追加与去重 · 查手机同一张 · 看TA点歌',
    fig('my-char-compact-full','一起听 · 生成TA的私人歌单。',80,340,480)+fig('watch-six-full','查手机 · 同一份歌单，TA点歌。',640,340,480))
refs=[]
add('情侣唱片与B面刻字','喜欢的歌，刻进你们的唱片。','聊天里让TA刻歌，也能请他多选几首。\n自己刻歌、改B面刻字，都在唱片页。','聊天刻歌 → 情侣唱片 · TA选歌 · 自己刻歌 · B面可改',
    fig('chat-carve-before-full','主聊天 · 请TA刻一首歌。',80,334,480)+fig('disc-linked-complete','刻好的歌，已经在你们的唱片里。',685,264,425))
refs=[]
add('搜歌歌单与播放小功能','搜到就放，喜欢就收进歌单。','想找歌、建歌单、收藏或换个播放模式，都能自己来。\n切回聊天还能悬浮播；进出查手机和情侣唱片，也会接回原曲。','搜歌 · 歌单 · 收藏 · 队列 · 模式 · 悬浮 · 续播',
    fig('search-results','完整搜歌页 · 找到就能播放。',75,340,480)+fig('personal-playlist-card','收进自己建的歌单。',640,342,490,'complete-widget')+fig('player-queue','播放队列 · 挑一首接着放。',640,550,490,'complete-widget')+fig('mini-player','回到聊天 · 还有悬浮播放器。',640,1125,490,'complete-widget')+note('三种播放模式可以切换。\n离开查手机或情侣唱片，\n原曲、队列和进度会接回来。',650,1323,465))
if (P/'raw/char-generate-notes-full.png').exists():
    refs=[]
    add('生成TA歌单','按TA的人设，生成他的歌单。','选一个角色，按他的性格、经历和音乐口味找歌。\n每首附一句他的备注；再生成会追加新歌，跳过重复。','按人设选歌 · 每首备注 · 再生成追加 · 重复跳过',
        fig('char-generate-select-full','选一个角色，生成TA的歌单。',80,340,480)+fig('char-generate-notes-full','生成的歌与备注，查手机也能读。',640,340,480))
for r in records:
    file=P/'editable'/f'{r["id"]:02d}.html'
    file.write_text(file.read_text().replace(' / 06</div>',f' / {len(records):02d}</div>'))
(P/'manifest.json').write_text(json.dumps({'title':'一起听 · 银紫唱片内页版','size':[1200,1600],'count':len(records),'records':records},ensure_ascii=False,indent=2))
print(f'{len(records)} poster sources ready')
