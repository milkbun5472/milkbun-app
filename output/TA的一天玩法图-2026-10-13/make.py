from pathlib import Path
from PIL import Image
import json,html
P=Path(__file__).parent
specs=[
 ('跟着TA过一天','他在过日子，你能走进去。','按TA当地的日程，他会去工作、吃饭、散步，再回家。\n选人时就能看此刻、刚才和下一段；点日程还能预览。','24个场景 · 晨昏随时间变化 · 日程按阶段推进 · 小人真的走过去',
  ('picker-full','先看看他在哪、忙了多久。'),('work-scene-full','到了工坊，就做那一段安排。')),
 ('走进小家陪他','给你留的位置，真的能坐。','他在家时，你的小人也能在；点空地走过去，坐到身边。\n牵手、靠肩、拥抱、亲亲，可以你来，也可以让TA先靠近。','坐着、躺着、站着都能相处 · 自动小互动可开关 · 手动选择优先',
  ('home-thought-full','看见他此刻没说出口的念头。'),('pair-cuddle-full','TA先靠近，坐在一起搂搂肩。')),
 ('家务和兴趣角','一起过日子，谁也不用闲着。','选自己的活动，也能分配TA做家务，扫地、洗碗、收拾小家。\n添好兴趣家具，就能弹琴、弹吉他、画画、举哑铃或拉伸。','两个人各有活动 · 动作习惯参考人设 · 家具和通道真的影响行动',
  ('hobby-guitar-full','摆好的吉他，走过去就能弹。'),('chores-controls-full','这次谁来做，自己选。')),
 ('一起出门逛逛','不等日程，今天也能一起出门。','24个地点，想自己去看看，或邀请TA一起，都可以。\n小街并肩散步，小店坐着喝一杯；逛完再回到TA的安排。','自己逛／邀请TA · 依地点选互动 · 自动跟随与手动走动都可以',
  ('outings-picker-full','选地方，也选这趟和谁去。'),('outing-walk-full','从菜单走出来，真的并肩走。')),
 ('选菜与TA想菜单','今晚吃什么，跟他一起定。','32道两人份料理，按菜名、食材找，也能收藏常做的。\n自己搭一到三道，或告诉TA想吃什么，让他按你们的人设选。','菜单、备料单和分工一起留住 · 补齐缺料 · 辣度、咸淡、甜度可调',
  ('kitchen-book-full','翻菜谱，挑今晚想做的。'),('kitchen-menu-full','你说想法，TA来提几桌菜单。')),
 ('动手切菜与炒锅','这顿饭，要你们亲手做。','拖食材上砧板，手指划着切；下锅后调火、搅拌、翻面。\nTA和你分着做，想换手就换；也能交给两个人自动做。','七类做法 · 切菜、揉面、拌料、翻锅、摆盘 · 做到哪儿可以接着来',
  ('kitchen-board-full','放大砧板，真的划开食材。'),('kitchen-pan-full','下到锅里，再继续拌、炒、翻。')),
 ('一起吃和装便当','做好的这一份，给你们两个人。','端上桌一起吃，尝一口，也能夹给TA；一桌可放一到三道。\n留一份便当给他带走，还能把喜欢的口味记成你们的菜谱。','两人份餐盒 · 自己起名字 · 标记TA爱吃的版本 · 重进还在',
  ('kitchen-meal-full','从锅边来到同一张餐桌。'),('kitchen-bento-full','给他带走，也把这份做法留下。')),
 ('在厨房搭把手和聊天','他尝过的那一口，还能接着聊。','递食材、扶锅、一起揉面、擦掉面粉，也能让TA尝味道。\n聊聊这锅，会带上实际做过的事和口味；厨房有自己的聊天页。','边做边搭把手 · 给TA尝一口 · 料理和吃饭的细节能带进聊天',
  ('kitchen-taste-full','做到这一步，让他尝一口。'),('kitchen-chat-full','接着聊刚才那口的咸淡。')),
 ('自己布置小家','住在一起，小家照你喜欢的搭。','挑家具、拖着挪、转个方向，或先收起来；墙地也能换。\n每件家具、每个部件可以分别配色，空间不够还能扩建。','三档户型 · 单件与部件配色 · 材质、墙地纹样 · 按角色分别留住',
  ('decor-scene-full','在真实的小家里试着摆。'),('decor-piece-full','同款家具，也能搭成你的颜色。')),
 ('样貌与相处习惯','你和他，各有自己的样子。','给你的小人选头发、衣服和身形，也能取用庭院的样貌。\nTA的外观和陪伴同步；两个人的动作、亲近习惯都能分别调。','样貌可预览 · TA与我的动作习惯 · 手选的设置会记住',
  ('wardrobe-full','边看小人，边搭自己喜欢的样子。'),('motion-styles-full','同样一起坐着，也有各自的节奏。')),
 ('今天的小相册和同框照','他的一天，和你们的这一刻。','小相册自动存各段日程，没看到的能补拍；一次配每张的念头。\n想留下你们一起的样子，就拍同框照、写一句，再导出。','小相册留最近七天 · 同框照取景预览 · 日期、地点和当时的活动',
  ('daily-album-full','今天去过的地方，串成小相册。'),('sameframe-saved-full','这一张，留住此刻的两个人。')),
 ('主屏小组件和聊天','想他时，先看一眼他在干嘛。','主屏放一个「TA在干嘛」：看他此刻在哪、多久、接下来做什么。\n点进去边看边聊，这里发的话也会回到你们的主聊天。','小组件可轮换或固定一人 · 已存念头也能显示 · 直接点进TA的一天',
  ('home-widget-full','不用翻日程，主屏就看得到。'),('main-chat-sync-full','在这个画面里聊，主聊天也接得上。'))
]
def esc(s):return html.escape(s).replace('\n','<br>')
records=[]
for i,(name,title,sub,features,a,b) in enumerate(specs,1):
 native=[];body=''
 for col,(shot,caption) in enumerate([a,b]):
  iw,ih=Image.open(P/'raw'/f'{shot}.png').size;w=min(474,20+1072*iw/ih);x=(75 if col==0 else 649)+(474-w)/2
  native.append({'file':shot+'.png','originalSize':[iw,ih],'displayWidth':w-20,'scope':'complete native viewport'})
  body+=f'<figure class="native checked" style="left:{x}px;top:335px;width:{w}px"><img class="checked" src="../raw/{shot}.png"><figcaption class="checked">{esc(caption)}</figcaption></figure>'
 doc=f'''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><title>{esc(name)}</title><link rel="stylesheet" href="../poster.css"><body><div class="wash"></div><div class="rim"></div><div class="brand checked">秋秋机 · TA的一天</div><div class="number checked">{i:02d} / {len(specs):02d}</div><div class="rule"></div><h1 class="checked">{esc(title)}</h1><p class="sub checked">{esc(sub)}</p>{body}<footer class="footer checked"><span class="features checked">{esc(features)}</span><span class="demo checked">真实功能界面 · 人物、日程与对话为演示数据 · 入口：小世界 → TA的一天</span></footer></body></html>'''
 (P/'editable'/f'{i:02d}.html').write_text(doc);records.append({'id':i,'name':name,'file':f'{i:02d}-{name}.png','title':title,'sub':sub,'native':native})
(P/'manifest.json').write_text(json.dumps({'title':'TA的一天 · 12张玩法图','size':[1200,1600],'count':len(records),'records':records},ensure_ascii=False,indent=2))
print('Ready',len(records),'poster sources')
