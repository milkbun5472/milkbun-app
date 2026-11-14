# 做一套聊天美化（她 2026-11-10，做完「骨头小狗」以后立）

一套美化＝一个 `chat-look` 包：`{kind:"chat-look", v:1, name, look:{…气泡皮肤…, customCSS}, assets:{}}`，
在某个人的聊天设置里「导入一套」，只管那一个单聊（线上、线下、通话、状态卡都跟着走，别的聊天不受影响）。

**开新的一套：** 复制 `bone-puppy/` 改名，改 `build.mjs` 顶上的配色和图形，`node themes/新名字/build.mjs` 出 json，发给她导入。

## 规矩

见下面「踩过的坑」。

## 清单：一套要过的地方

| 批 | 地方 | 主要挂点 |
|---|---|---|
| 底 | 背景花纹、顶栏（含下沿装饰）、底栏（输入框、加号/发送/回复三颗换图、上下爪印条） | chat, chathead, composer, chatinput, chatplus, send, chatreply |
| 底 | 顶栏头像框、双头像（headme）、主页键 sameroom、更多 chatmore | avatar, headme, headname |
| 气泡 | 文字气泡两色＋角上小装饰、尾巴；时间戳胶囊；已读 meta；正在输入 | bubble[data-kind], time, meta, typingdot |
| 气泡 | 动描/旁白那一框 | narr, narrink |
| 卡片 | 转账（待收/已收/已退三种印）、红包（卡、领完、拆开前、拆开后） | transfer*, rpcard, rpenvelope, rp* |
| 卡片 | 表情包、卡片结尾的已读（cardmeta，默认藏，要显示自己开） | cardmeta |
| 卡片 | 照片（有图/没图）、语音、天气、位置、名片、拍一拍、系统纸条、通话结束胶囊＋记录 | photo*, voice, wxcard*, geo*, namecard*, note[data-part], sysnote*, callpill |
| 面板 | 加号面板 | chatpanel, chattool* |
| 引用 | 三处都要做：输入框上待发送那条（quotedraft）、气泡上方「回复了哪句」（quote，data-me）、气泡里的引用字（quotetext） | quotedraft, quote, quotetext, quoteicon, quoteclear |
| 状态卡 | 此刻（看得见的、心里想的、好感条）、翻旧的、Ta 眼里（含空的那块） | state*, statehist*, gaze* |
| 线下 | 顶栏按键、底栏、背景、两人的卡片、心声、台词高亮 | offline, off* |
| 线下小结 | 聊天里那张「线下经过」卡：卡本身、标题、正文、看原文／重新总结／放回往期、展开的原文 | [data-part="offlog"], offlog* |
| 通话 | 气泡、动作字、大头像（背景和挂断键不动） | call* |

每一批截图给她看一眼再往下做。预览脚本在 `themes/_preview/`（起 `python3 -m http.server 8765`，
`NODE_PATH=$(npm root -g) node themes/_preview/preview.cjs <出图目录> <美化.json> [额外消息.json]`；
状态卡 state.cjs、翻旧 hist.cjs、线下 off.cjs、红包拆开 env.cjs；线下小结卡用 preview.cjs 带 offlog.json，**每套都要出这张图**）。

## 踩过的坑（只留对的做法；错的旧说法已删）
- **美化名字一律四个字**（她 2026-11-12 定）：新做一套先想四字名，json 文件名跟着走。
- 想按好感分档换图又不想动 js：心那几层都继承 `--sc-heart-lvl`（0～1），可以把形状变量换成整块方形，每层放一张图，用 `opacity: calc(clamp(0,(var(--sc-heart-lvl) - a)*1000,1) - clamp(0,(var(--sc-heart-lvl) - b)*1000,1))` 只亮落在 [a,b) 的那一层（月湖天鹅的蛋→小鸭→天鹅就是这么做的）。别再给 `[data-wk="stateheart"] > div` 写 `opacity:1 !important`，它比单个挂点的选择器更具体，会把分档全盖掉。
- 每套的按键（加号、房子、⋯、发送、回复、线下几颗）都不能只是给原图标包一层框或写字：要换成这套自己画的配套图案（她 2026-11-12：霓虹「發送」灯牌、回复灯框被打回）。
- 想要「里面再一圈细金线」别写 `inset 0 0 0 4px transparent, inset 0 0 0 4.6px 金`：透明那层盖不住后面的金，会变成 4.6px 粗金边。中间那层要填卡片本身的底色。
- 背景里要跟某个点对齐的长条（月光倒影对月亮）别用 `background-position: calc(68% - 100px)`：百分比是按（容器宽−图宽）算的，会跑偏。单独放进一个伪元素，用 `left: calc(68% - 半宽)` 定位。
- 顶栏右边按键（回家、更多、线下提示、结束）要量着收小，给名字留 ≥84px；名字后面的装饰字（如 my dearest）挪到副标题行，别跟名字抢一行，否则长名字会被截成「测试…」。
- 滴落的帘子（糖浆、蜡、奶油）要用**一条路径**画：带子底边和每一滴连成同一根白描边，不要把带子和水滴分开画再叠起来（会变成一块白边帘子上挂几颗单独描边的水滴）。
- 头像框整套改形状（拱形、圆形）时，别给 `img[data-wk="avatar"]` 写 `overflow:visible`：图片元素 overflow 一放开，圆角就不裁图了，线框是拱形、里面照片还是方的。顶栏头像就是 img。
- 「我的」头像发光框要同时写 `[data-wk="msg"][data-me="1"] [data-wk="avatar"]` 和 `[data-wk="cardrow"][data-me="1"] [data-wk="avatar"]`：卡片那一行的头像是 span 不是 button，只写 button 会让转账、红包旁边我的头像掉回他的颜色。顶栏双头像要锁 width/height/aspect-ratio，否则被名字挤成椭圆。
- 不要每套都画纸飞机、小房子、三个点：发送、回家、更多也要按这套的主题重新想图案（霓虹夜：闪电、带月亮的门、三根长短不一的灯柱）。
- 线下顶栏副标题后面会拼「· 第N轮」：别给 `[data-wk="offline"] [data-wk="chathead"] *` 一刀切 nowrap 不放，要给 `[data-wk="headname"] > div:last-child` 放开 `white-space:normal`，右边按键收到 26px，否则轮数被加号压住。

### 听她的话
- **她说「照做 X」只照做 X**。给参考图说「头像框照这个」，别把整套都照图重做（Y2K 踩过）。拿不准范围就先问一句。
- **她给了参考图就照图**，别自己往上加发挥；她没给图、只给方向时才自己设计。
- **每套要有一处结构上的不同，不只是换色**（礼物卡挂灯串、弹窗叠窗、圣诞树状态卡）。卡片、状态卡这两批最容易沦为换皮，动手前先想「形状/排法哪里变了」。她说「保持形状、只换主题色加小巧思」时就别改形状。
- 要做的改动不确定是哪一处（「引用有问题」是哪种引用、「这片蓝」是哪片）→ 先对着截图找准，再动手。

### 写法
- 每条声明带 `!important`；只用 `[data-wk]` 挂点，不写页面前缀（导入时自动限到那个聊天）。
- **不许写**：`@supports`（导入时被吃掉）、`overscroll-behavior`（安全检查当成脚本，整套静默失效）。
- **SVG 里不放 `<filter>`**：iPhone 会把整张图按低分辨率糊掉；投影写在 CSS 的 `filter:drop-shadow()`。
- 图一律 base64（build 里 `svg()`），单张 ≤8KB，不然小窝传不上去。
- 包里每套都写 `layout`，不写会沿用上一套的排版。
- 顶栏、底栏**不写 padding 简写或固定上下内边距**，安全区一律 `var(--app-safe-top/bottom)`。
- **悬浮胶囊顶栏/底栏：胶囊贴着栏本身画（`::before` 的 top/bottom 跟栏走），别给栏强撑 `min-height`**——撑高后栏里的按钮名字还按原位排，手机上全乱（Y2K 踩过）。
- 改字的样式（描边、字号）**只挂在 `[data-wk="headname"] > [data-wk="headink"]`**；`headink` 是整条顶栏共用的，返回键旁的未读数也吃得到。
- 副标题「说话 · 轻触切换」、线下「离开」等一律 `white-space:nowrap`，不然窄屏一字一行把顶栏撑胖。
- **头像框别用 padding/margin 加宽头像**——会占位把头像和气泡往中间挤。框一律画在 `box-shadow` 或伪元素上。
- 头像框要露出头像外：别用 `clip-path`（会裁掉 box-shadow），用 `border-radius:50%`＋`overflow:hidden`。
- 浅色小装饰放浅底上：带深色描边，别靠 drop-shadow。
- 固定长度的东西（好感条）按**最窄的手机**算。
- 「连发」用 `[data-first="0"]`、`[data-last="0"]`（不要 `[data-run]` 前缀，文字消息行没有它）；一串只留最后一条的已读：`[data-wk="msg"][data-last="0"] [data-wk="meta"]{display:none}`。
- 时间胶囊给 `min-width`（约 150px），只有「21:55」时不至于挤成一小块。
- 能滚动的块会裁掉伸出去的装饰（挂扣、吊线）：让**里面那段字**滚，外框不滚。
- 顶栏下沿挂装饰（彩灯、布边）会盖住顶栏下面那条**日程条**：`[data-wk="chathead"] + *:not([data-wk="body"])` 往下让，被灯挡一点没关系。
- **待发送的引用条 `quotedraft` 是底栏上面的一条兄弟元素**：背景里画了贴底的场景（窗台、雪地、楼群，`chat::after` 那种），它会被压在底下看不见。给它 `position:relative; z-index:3` 和不透明的底；引用功能每套都要真点一次引用看。
- **深底的套要把 app 自带的灰字一起提亮**：顶栏下面那条日程条（`[data-wk="chathead"] + *:not([data-wk="body"])`）、线下「文风」那行和空页提示（`offbody > div:not([data-wk])`）、线下「离开」（`chatback`）——不写就是 app 默认的深灰，深底上看不见。
- 同一个地方线上线下都有（chathead、composer）：线下单独写 `[data-wk="offline"] …`。

- **别藏聊天里的头像**（她要两边都看得到）；参考图里没头像也照样留着，只换框的样子。头像是点开状态卡的入口。

- 好感条换成多个小图形（星星排一排）时：描边别用 stateheartline 那层缩进叠（会错位），把 line 层设透明，在 stateheart 上用四个方向的 `drop-shadow` 描边。
- **最右边永远是「让他回复」（chatreply）**，发送在它左边。**不许给 send 加 `order` 挪到最右**——参考图里大按钮在最右也一样，那颗大的就画在 chatreply 上、里面换成「回复」的图案，发送用原来小钮的样子放左边——**不是挪位置，是把图案和功能对调**（她 2026-11-12：「最右边永远应该是让他回复」「不是移动，是把原来对应的图案功能换一下」）。

- **好感别老做成横进度条**：每套都想一个跟主题有关的图形（一颗会灌满的心、一排星、打孔卡、树顶的星），横条只在实在没东西可用时才用。
- **好感也别每套都是「一个容器灌满＋数字在中间」**（杯子、宫灯、霓虹心、香水瓶连着做了四个，她说是又套了一个模板）。**换机制**，不只换形状：`stateheart` 上有变量 `--sc-heart-lvl`（0～1），`stateheartknob` 在它里面、默认藏着——拿它做会转的指针（`transform:rotate(calc(var(--sc-heart-lvl) * 360deg))`，座钟、罗盘、唱片）、会走的小人、会长的东西；不用灌水的就把 `stateheart > div` 全藏掉，底图直接画在 stateheart 上。数字摆哪也跟着想（铭牌、标签），别总压在图形正中。
- **好感一栏照原来的排法：图形在左、字在右**（`stateaff` 本来就是一行 flex）。别把图形 absolute 到底下正中、再用大 padding 空出一大块地方只放一个摆件——看着很怪。

### app 挂点
- 挂点不够：先给 app 补挂点（只加不改名，进 `theme-studio.js` 名单，写测试，`ship.mjs` 发版），**提醒她先刷新 app**。
- 已补过的：statemood / stateaffval / stateheartknob / gazeempty / statehist* / geo* / cardmeta / offlog* / gazetape（Ta 眼里贴条）/ meta 的 `data-read`（已送达 0、已读 1）。

## 别忘的几处（每套都漏过一次）

- **顶栏的房子（sameroom）、三个点（chatmore）、底栏加号（chatplus），线下顶栏加号、线下底栏照片键**：每套都换成这套自己的样式，不要留 app 默认的线条图标。

- **动描（narr / narrink）和系统提示（sysnote / sysnotetext）都要跟他的气泡长得不一样**：不写就会套用通用框，看着跟气泡一模一样。每套第一批就做掉。系统提示走「不带框的一行小字」最稳。
- 线下两颗加号：底栏「给 Ta 看真实照片」、顶栏「给 Ta 一个提示」——**按钮留着，里面 `*{opacity:0}`，换成这套的图案**，不要整颗藏掉。
- 「输入中」：单聊 typing 气泡＋typingdot，**还有通话里的** callbubble[data-kind="typing"]；气泡的装饰伪元素在它上面关掉。
- Ta 眼里贴条 `gazetape`、线下小结卡、系统提示、拍一拍、通话结束胶囊、动描、引用三处、加号面板。
- 今天的月相 `html[data-lisa-moon]`、好日子光圈 `[data-halo]` 跟头像框叠在一起，换框时一起看。
- **顶栏名字要露全**：右边换了大图标、名字就被挤成「测试…」。每套第一批就写：`headname`（和包着它的 button）`flex:1 1 auto; min-width:0`，`sameroom`／`chatmore` 收到 30px 上下，别给 sameroom 写 `margin-left:auto`（它会把名字那块挤窄）。拿长名字（四五个字）的人看一眼。
- **名字后面别再挂英文小字（`headink::after`）**：长名字会被挤得只剩半截。英文副标题放第二行，替掉「说话 · 轻触切换」（`headname > headdim` 字号设 0，`::before` 写字），名字那行加 `overflow:hidden; text-overflow:ellipsis`。
- **嵌板式底栏（`composer::before` 画一块面板）**：面板 top/bottom 用固定的几 px 盖满整条底栏，别拿安全区去减——手机上安全区一大，面板就比输入框短一截、对不齐。
- **顶栏别每套都做成框／胶囊**：一条横贯全宽的细线（两头淡出、正中一个小饰）分开顶栏和聊天就够，底子透明或很淡的渐变（她 2026-11-13：「一定要每次都搞框嘛，就不能一条横线分过去」）。
- **顶栏装饰别按屏幕左边写死位置**：返回键旁边会冒出未读数（「16」），一挤，写死 left 的装饰就跟头像错开、右边的键被挤出屏幕。装饰挂在头像／headme 自己的伪元素上跟着走，右边两颗键写 `flex:none`。预览时种一个有未读的别人再看。
- 顶栏高度跟前几套一样矮（约 70px），下沿装饰用负 top 叠进顶栏。

## 预览
预览只截得到有测试数据的地方：红包拆开 env.cjs、线下小结 offlog.json、线下 off.cjs（没有对话）、通话截不到。截不到的要在回话里**明说没看过**。

- **头像别每套都是圆的**（她：「所有头像都是圆的了偶尔也可以换换」）：形状跟着这套的故事走——红帽夜访里他是圆角方相框、我是右上收尖的兜帽水滴（`border-radius:50% 4px 50% 50%`）。用 border-radius 改形状，box-shadow 的框还能跟着走；clip-path 会把框一起剪掉。
- **私聊红包那一行是 `rpsingle`，不是 cardrow，也没有 `data-me`**：只写 msg/cardrow 的头像框，红包旁边的头像就会掉回通用样子。他的头像是这一行的第一个孩子，我的紧跟在 `rpcard` 后面。
- **动描不只 narr/narrink 一处**：她自己写的动作是 `myact`/`myactink`，旁白模式底下还有一条 `narrbar`/`narrkind`。三处一起做，漏一处就会冒出通用灰字。
- **电话小结（`note[data-part="callsum"]`）每套都要做**：通话结束那一行底下的那段总结，不写就是一段裸灰字。顺手把 `noteink`、`callact`、拆红包里的 `rpavatar` 一起带上。
- **别把装饰挂在 `msg` 行的伪元素上**：那一行可能连着上面的时间条，装饰会飘到时间旁边、离头像老远（饭团的竹叶就这么飞走的）。
- **打电话那一屏也要做**：`[data-wk="call"][data-video="0"]` 是整屏底色（原本深灰渐变写在行内），`callbtns button > span:first-child` 是三个圆按键（中间那个是挂断），`calltitle` 是名字。只做 callbubble/callavatar 等于没做。预览可用 `themes/_preview/callpv.cjs <outdir> <pack>`（点开面板里的语音通话，截 call.png）。
