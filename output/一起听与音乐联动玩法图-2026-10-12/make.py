from pathlib import Path
from PIL import Image
import html,json
p=Path(__file__).parent
E=lambda s:html.escape(s).replace('\n','<br>')
used=[]
def fig(src,caption,x,y,w,angle=0,maxh=None,dark=False):
    iw,ih=Image.open(p/'raw'/f'{src}.png').size
    if maxh and (w-28)*ih/iw+63>maxh:w=28+(maxh-63)*iw/ih
    used.append(src);units=sum(1 if ord(c)>127 else .55 for c in caption);cap=min(22,max(16,(w-36)/max(1,units)))
    return f'<figure class="native checked {"" if dark else "light"}" style="left:{x}px;top:{y}px;width:{w}px;--cap:{cap}px;transform:rotate({angle}deg)"><img src="../raw/{src}.png"><figcaption class="checked">{E(caption)}</figcaption></figure>'
def note(text,x,y,w=400,size=30,height=160,small=False):
    return f'<p class="note checked {"small" if small else ""}" style="left:{x}px;top:{y}px;width:{w}px;height:{height}px;font-size:{size}px">{E(text)}</p>'
items=[]
def add(name,title,sub,features,build):items.append(dict(name=name,title=title,sub=sub,features=features,build=build))

add('小红书封面','这一首，\n想和 TA 一起听。','歌在放，你们也在说。\n从他的歌单，到你们的唱片，再回到聊天里。','一起听 × 查手机音乐 × 情侣唱片 × 主聊天',lambda:fig('bubble-stage','同一首歌，同一刻。',120,575,930,-.8)+fig('talk-input','想说的话，直接说给 TA。',170,1135,650,.8)+note('一起戴上耳机，\n也听听 TA 的偏爱。',840,1160,270,29,180))
add('挑个人一起听','这首歌，\n找一个人一起听。','打开播放页的封套，选“自己听”，或者挑一位 char。\n两只头像挂在封面上，唱的是同一首，话也在这一页说。','选听歌对象 · 双人头像 · 播放页输入',lambda:fig('partner-picker-detail','01 / 打开封套，挑和谁听。',120,555,925,-.7)+fig('partner-selected','02 / 选过以后：和沈屿一起听。',160,1130,860,.7)+note('换个对象，也能开始新一段一起听。',145,1410,940,27,65,True))
add('聊天里的邀请','TA 发来邀请，\n这一首，想给你听。','TA 能在聊天里发“一起听邀请”，带上歌名和邀请语。\n点“和 TA 一起听”，会选好对象、找这首歌，再打开播放器。','主聊天邀请 → 接受 → 一起听',lambda:fig('chat-invite','01 / 歌名、邀请语和接受按钮，在聊天里。',125,545,890,-.6,maxh=685)+fig('invite-selected','02 / 点过以后，听歌对象已经选好了。',165,1250,860,.6,maxh=210))
add('边听边说','歌不用停，\n想说的就说一句。','播放页直接输入，TA 会在头像旁接话。\n几句回复会一个接一个冒出来；你的气泡等 TA 接上才开始淡。','输入一句 · 头像冒泡 · 逐句接话',lambda:fig('bubble-stage','01 / 你在右边，TA 在左边接上。',120,555,930,-.7)+fig('talk-input','02 / 不用离开播放器，也能继续说。',155,1150,940,.7)+note('听歌时说过的话，会原样留到主聊天。',145,1390,950,28,80,True))
add('聊到正在唱的那一句','聊这首歌，\n也知道唱到哪儿了。','有可用歌词时，TA 会拿到当前进度和刚唱过的几句。\n点“词”能看滚动歌词，当前那一句会亮起来。','播放进度 · 歌词窗口 · 当前句高亮',lambda:fig('lyric-window','原歌词界面：此刻唱到的那句。',150,545,820,.7,maxh=720)+note('按正在听的这一段接话，\n也可以安静一起听。\n本地或外链歌可能没有歌词。',145,1320,950,30,150))
add('让TA自己开口','听到这里，\nTA 也想说一句。','把“TA 不开口”切成“TA 会开口”，让 TA 有反应时自己说。\n也可能安静听；开关和设置里的自动生成共用。','主动开口可开关 · 一首最多触发一次 · 有间隔',lambda:fig('auto-bubble','01 / 不用先问，TA 也能冒出一句。',120,555,935,-.7,maxh=460)+fig('auto-toggle','02 / 自己开口，随时可以开或关。',155,1040,940,.7)+note('一首歌最多触发一次，两次至少隔 90 秒。\n开启后会按次调用模型，安静时可以关回去。',145,1320,955,26,150,True))
add('原话回到主聊天','耳机里说过的，\n聊天里也留着。','你和 TA 在一起听里说的每一句，都会直接落进该 char 的主聊天。\n回去能看到双方原话，接着刚才那几句聊。','一起听 → 主聊天 · 双方原话同步',lambda:fig('chat-synced','同样的原话，回到主聊天也看得见。',125,550,950,-.7,maxh=800)+note('不用再转述“我们刚才聊了什么”。\n话已经在你们的聊天里。',145,1280,950,34,150))
add('聊天里点歌切歌','你说想换歌，\nTA 真给你换一首。','一起听时，可以让 TA 点歌、切上一首或下一首。\n歌库没有的歌，也能经可用音乐源搜索后播放。','主聊天点歌 → 搜到曲目 → 全局播放器换歌',lambda:fig('chat-switch','01 / 在聊天里，把选歌交给 TA。',120,550,910,-.7,maxh=560)+fig('switched-progress','02 / 播放器里，已经换成这一首。',165,1160,875,.7,maxh=300))
add('生成TA自己的歌单','他私下循环的，\n也想翻来听听。','在“我的”里选一个角色，让 TA 按人设和自己的口味推歌。\n搜到的曲目会组成归 TA 名下的歌单，每首留着他的听歌备注。','按人设推歌 · 搜到可播放曲目 · TA 的私人偏爱',lambda:fig('playlist-char-picker-detail','01 / 挑谁来生成，自己选。',120,550,925,-.7)+fig('playlist-top','02 / 找到曲目后，收进 TA 自己的歌单。',160,1040,890,.7,maxh=420))
add('查手机是同一张歌单','在一起听生成，\n去 TA 手机里也能翻。','查手机里的“音乐”，读的就是一起听中归 TA 名下的歌单。\n继续生成会追加新歌、跳过重复；两处看到的是同一张。','一起听 × 查手机音乐 · 同一张歌单 · 继续添歌',lambda:fig('playlist-created-card','01 / 一起听里生成的歌单。',110,550,460,-.5)+fig('playlist-appended-card','02 / 再生成，继续添歌。',650,560,460,.5)+fig('phone-music-top','03 / 到 TA 手机里，曲目和听歌备注也在。',135,820,950,-.4,maxh=615,dark=True))
add('把他的偏爱拿回去聊','为什么听这首，\n可以直接问 TA。','点开手机里的曲目，能“放这首”，也能“跟 TA 提这首”。\n歌名、歌手和他的听歌备注会带到主聊天，等你们接着聊。','查手机展开 → 放这首 / 提这首 → 主聊天',lambda:fig('phone-song-detail','01 / 点开这首，备注和两个动作一起展开。',120,555,940,-.7,dark=True)+fig('phone-peek-card','02 / 把这首歌和他的那句话，带回聊天。',160,1110,900,.7)+note('歌单走公开内容的提起方式，TA 会按随口聊这首来接。',145,1410,950,24,75,True))
add('看TA在手机里点歌','这次你在旁边，\n看 TA 自己挑歌。','从查手机的“看 TA 玩”进入，看他打开音乐、点开曲目。\n他点的是这张歌单里的歌，播放状态也会跟着改变。','看 TA 玩 × 音乐 · 原界面操作 · 当前曲目改变',lambda:fig('watch-entry','01 / 入口在 TA 的手机桌面。',120,550,530,-.7,maxh=155)+fig('watch-active-row','02 / TA 点开这一首，也放这一首。',155,790,900,.7,maxh=500,dark=True)+fig('watch-bar','03 / 暂停、倍速，或敲一下。',180,1340,850,-.5,maxh=135,dark=True))
add('在聊天里刻一首歌','这首先别忘，\n刻到我们的唱片里。','在主聊天里让 TA 刻歌，也可以由 TA 自己提出。\n搜索并存成功后，歌和那句 B 面刻字会进情侣空间的“我们的唱片”。','主聊天刻歌 → 情侣空间 · 歌与 B 面刻字',lambda:fig('chat-carve-words','01 / 聊天里开口，让 TA 给这首留一句。',120,555,930,-.7)+fig('disc-note','02 / 刻好的那句话，留在唱片 B 面。',155,1120,925,.7)+note('需要已建立情侣关系，并有可用音乐源。\n进去，就能找到你们刻的这首。',145,1395,950,25,95,True))
add('让TA挑共同的唱片','他自己爱听的，\n和想放给你听的。','“让 TA 再刻几首”，让他为你们的共同唱片挑歌。\n每首 B 面写为什么给你听；这张唱片会慢慢添新歌。','私人歌单 / 共同唱片 · 各自选歌 · B 面说给你',lambda:fig('disc-deck','我们的唱片：可以落针，也可以让 TA 来刻。',120,550,555,-.7,maxh=575,dark=True)+note('这张放给你们俩。\n\nB 面写的，\n是为什么给你听。',750,650,340,34,350)+fig('disc-ta-row','TA 自己刻的歌，和留给你的那句话。',160,1180,870,.6,maxh=290))
add('自己刻歌和改B面','你也能选一首，\n把自己的话刻上去。','输入歌名或歌手，写一句 B 面的话，再点“刻进唱片”。\n已有歌的 B 面也能点开改字，写好以后再“刻上”。','手动刻歌 · B 面留言 · 点开改字',lambda:fig('disc-manual-form','01 / 歌与 B 面的话，一起刻进去。',120,545,740,-.6,maxh=480)+fig('disc-manual-result','02 / 新歌和你的话，已经留下。',150,1060,740,.6,maxh=230)+fig('disc-edit-form','03 / 已有 B 面，也能重新刻一句。',180,1340,870,-.5,maxh=135))
add('收进自己的歌单','听到喜欢的，\n就给它留个位置。','在“发现”搜歌，曲目能播放，也能收进自己的曲库。\n播放页点加号，挑已有歌单，或者新建一张来收着。','搜歌 · 曲库收藏 · 加入 / 新建歌单',lambda:fig('search-result-detail','01 / 搜到后，播放或收进歌库。',120,550,930,-.6,maxh=350)+fig('add-playlist-picker','02 / 选歌单，也可以新建。',155,940,790,.6,maxh=320)+fig('personal-playlist-card','03 / 新建的歌单和这首歌都留在“我的”。',185,1310,870,-.5,maxh=155))
add('队列和悬浮播放器','回去聊天，\n音乐还在这里放。','展开当前队列，按这张列表选歌、上一首或下一首。\n也能切列表循环、单曲循环或随机；离开播放页，悬浮播放器继续控制。','当前队列 · 三种播放模式 · 悬浮控制',lambda:fig('player-queue','01 / 这一张队列，按顺序往下听。',130,550,830,-.7,maxh=620)+fig('mini-player','02 / 主聊天里，也能暂停、下一首或回播放页。',170,1290,860,.7,maxh=180))
add('进出空间接着听','进来，换他的歌。\n出去，还你那一首。','进 TA 手机或情侣空间，会接着上次那首的下一首放。\n离开时，原来的曲目、队列、进度和暂停状态会还回来。','查手机 / 情侣空间 · 记住针位 · 返回原曲',lambda:fig('disc-playing-deck','01 / 在情侣空间，听你们这张唱片。',120,550,565,-.7,maxh=590,dark=True)+note('下一次再进来，\n从上次那首\n的下一首接着放。',760,680,325,34,270)+fig('restored-time','02 / 出门后，原来的歌接着 1:12 放。',165,1220,900,.7,maxh=250))

css=(p/'poster.css').read_text();records=[]
for i,d in enumerate(items,1):
    used=[];body=d['build']();r={k:d[k] for k in ['name','title','sub','features']};r.update(id=i,file=f'{i:02d}-{d["name"]}.png',native=used);records.append(r)
    doc=f'<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>秋秋机 · 一起听 · {E(d["name"])}</title><style>{css}</style></head><body class="'+('cover' if i==1 else '')+f'"><div class="veil"></div><div class="edge"></div><div class="brand checked">秋秋机 · 一起听 × 音乐联动</div><div class="edition checked">{i:02d} / {E(d["name"])}</div><div class="stamp checked">一起<br>听见</div><h1 class="checked">{E(d["title"])}</h1><p class="sub checked">{E(d["sub"])}</p>{body}<div class="footer"><div class="features checked">{E(d["features"])}</div><div class="demo checked">真实功能界面 · 人物、曲目、歌词、歌单备注与回复均为虚构演示数据</div></div></body></html>'
    (p/'editable'/f'{i:02d}.html').write_text(doc)
assert len(records)==18
(p/'manifest.json').write_text(json.dumps({'title':'秋秋机 · 一起听 × 音乐联动','size':[1200,1600],'records':records},ensure_ascii=False,indent=2)+'\n')
print('18 poster sources ready.')
