# 做一套聊天美化（她 2026-11-10，做完「骨头小狗」以后立）

一套美化＝一个 `chat-look` 包：`{kind:"chat-look", v:1, name, look:{…气泡皮肤…, customCSS}, assets:{}}`，
在某个人的聊天设置里「导入一套」，只管那一个单聊（线上、线下、通话、状态卡都跟着走，别的聊天不受影响）。

**开新的一套：** 复制 `bone-puppy/` 改名，改 `build.mjs` 顶上的配色和图形，`node themes/新名字/build.mjs` 出 json，发给她导入。

## 规矩（每一条都是这一套里踩出来的）

- 每条声明带 `!important`；只用 `[data-wk]` 挂点，不写页面前缀（导入时自动限到那个聊天）。
- 顶栏、底栏**不许**写 padding 简写或固定上下内边距，安全区一律 `var(--app-safe-top/bottom)`——
  写过一次 `padding-bottom:var(--app-safe-bottom)`，底栏高了一截（app 只留 0.4 倍）。
- 图标是 svg，换色用 `stroke`；整颗换图：按钮上 `background:url(svg)`，里面的 `svg{opacity:0}`，还要 `*{opacity:0}` 防字/加号透出来。
- 浅色小装饰（白骨头）放浅底上会糊：**一律带深色描边**（`BONE_S`），别靠 drop-shadow。
- 要「圆头像＋外圈边」：别用 `clip-path`（会把 box-shadow 的边一起裁掉），用 `border-radius:50%`＋`overflow:hidden`。
  头像框伪元素要露出头像外时才给 `overflow:visible`，名片这类小头像单独改回去。
- 固定长度的东西（好感骨头条）按**最窄的手机**算，别按预览宽度。
- 挂点不够：先给 app 补挂点再写样式。**只加不改名**，进 `theme-studio.js` 名单，写测试，发版
  （这一套补了 statemood / stateaffval / stateheartknob / gazeempty / statehist* / geo*）。
  她手机上版本没到，新挂点的样式就看不到——先让她刷新，别以为没生效。
- 同一个地方线上线下都有（chathead、composer）：线下单独写 `[data-wk="offline"] …`，别改到线上。

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

## 别忘的几处（每套都漏过一次）

- 「输入中」：单聊 `[data-wk="bubble"][data-kind="typing"]` 那颗气泡＋里面的 `typingdot`（换成这套的小图标），**还有通话里的**（`callbubble` 带 `data-kind="typing"`）。气泡的伪元素装饰（耳朵、雪帽、尾巴）在输入中那颗上要关掉。

- Ta 眼里卡片顶上的米色贴条（`gazetape`，展开的信和旧版也是它）：每套都换成自己的样子。

- 线下两颗加号：底栏「给 Ta 看真实照片」（`[data-wk="offcomposer"] button[title="给 Ta 看真实照片"]`）**藏掉**；顶栏「给 Ta 一个提示」（`[data-wk="offline"] [data-wk="chathead"] button[title="给 Ta 一个提示"]`）换成这套的加号图。

- 顶栏高度：跟前几套一样矮（本体约 70px），下沿装饰用负的 top 往上叠进顶栏，别往下拖一大截；聊天区 padding-top 只留够挂件露出来。

- 线下小结卡、系统提示（sysnote）、拍一拍、通话结束胶囊、动描那一框。
- 排版设置跟着包走：包里不写 `layout` 就会沿用上一套的排版（头像只留第一条之类），每套都写明。
- 今天的月相 `html[data-lisa-moon]`、好日子光圈 `[data-halo]` 会跟头像框叠在一起，换框时一起看。
- 小窝传不上去：图一律用 base64 写（build 里的 `svg()` 已经是），单张矢量图要在 8KB 以内；用 encodeURIComponent 写的大图（满天星、山和月亮）会被小窝拦下。
