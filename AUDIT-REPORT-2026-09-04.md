# 全库审计报告（5.1 审计员 · 2026-09-04 夜）

只诊断，不动刀。本报告是本次唯一新建的文件；仓库其它文件一个字没改，没有 commit、没有 push，没有发过任何网络请求，没有碰过 8787/8443/VPS。

口径：每条发现带 `文件:行号`，全部用 `grep -n` / `sed -n` 照着行号核过一遍；每条给「为什么这是病」和一个具体失败场景。写不出失败场景的进各节附录，不占正文。严重度：**P0 数据会丢 / P1 功能是坏的 / P2 规则违背 / P3 坟场与死代码**。准绳是 `.claude/rules/` 下十二份规则文件，不立新法。

一条影响全篇的事实：仓库的 git 历史是浅的——最早一笔是 `92943f0c v61.91`，之后 62 笔全落在 2026-09-04 同一天。`git blame` 查不出任何一处病灶是「哪天写的」，所以专项三里「规则之后新写＝P2」这一档只能靠代码体内的版本注释推断，拿不出证据的一律按 P3 存量记。

---

## 专项一：数据安全线

尺子：2026-09-03 事故——云推静默失败九天无提醒；导出被大 payload 噎死无声装死；旧标签页把 8/25 旧账整份盖上云端。下面每一条都拿这三道哑火对过形状。

### 总表

| 严重度 | 文件:行号 | 病灶一句话 | 失败场景 | 失败可见性方案（P0 必填） |
|---|---|---|---|---|
| **P0** | `js/cloud.js:1237-1239`；`js/screens.js:7846-8014` | 自动上云失败全部静默吞掉；全 app 没有任何一处显示「上次成功备份是什么时候」（`cloud_pushed_at` 在 cloud.js 之外零引用） | 上游限流/断网/证书过期 → autoPush 连败九天 → 设置页仍写「已开启自动同步」→ 用户毫无感知。就是 9/3 第一道 | 云同步面板顶上显示 `cloud_pushed_at`；距上次成功超过 24h 就在通讯录顶上挂一条红字 |
| **P0** | `js/cloud.js:227-237`、`1219-1221` | `getUser()` 把网络/限流错误吞成 `null`；autoPush 把它当「访客模式」正常 return——连 1237 那个 catch 都走不到 | 认证端点 429 → 本机明明有持久 session → 每次 autoPush 当自己是访客 → 设置页同一个 `getUser` 也退回登录表单，看着像「没登录」而不是「备份坏了」 | `getUser` 区分「无 session」与「有 session 但查失败」；后者算备份失败，走同一条红字 |
| **P0** | `js/cloud.js:1222-1223`、`1235-1236` | 过期设备闸 `staleVerdict` **一个会话只查一次**，推成功后被写成永远「不过期」；upsert 无任何乐观锁 | 旧标签页 8/25 推过一次（verdict=不过期）→ 后台挂九天 → 手机天天推新档 → 9/3 该标签页任意一次自动写入触发 markDirty → 沿用旧 verdict → 8/25 整份盖上云端。就是 9/3 第三道 | 每次真正 upsert 前重查一次 `updated_at`（一条 select），或 upsert 带 `updated_at = 本机 MARK` 的条件；拦下时那条 toast 已有，复用 |
| **P0** | `js/app.js:18072-18082`；`js/cloud.js:115`、`1262`；`js/engine.js:3910-3938` | 开机 `autoPull → autoPush` 与 `hydrateTxtVault` **并发无闸**；`collect()` 只从内存镜像 `__txtMirror` 取所有 IDB 文字键（聊天/记忆/手机/日记/情侣空间/周刊……）；hydrate 失败也只 `return 0` | IDB 里几十 MB 聊天读得慢、网快 → `collectForSave` 在镜像灌满前跑完 → 推上去一份**没有任何聊天的快照**，MARK 更新、verdict 置「不过期」→ 用户只是打开看一眼没写东西就关了 → 云端就是这份残档 → 此时再走「删了重装/从云端恢复」，聊天全没。同根：`signOut` 先 `push()`（`:291`）再 `idbTxtClear()`（`:307`），镜像空时推残档、再清 IDB，两头都没了 | autoPush 前 `await` 一个「文字库已灌完」的 promise；hydrate 抛错时立一面「禁止自动上云」的旗并弹红字 |
| **P0** | `js/cloud.js:185-199`、`224`；`js/screens.js:7959-7968` | `apply()` 先整份 `removeItem` 再逐键 `setItem`，**setItem 没有 try、没有回滚**；`frozen = true` 写在 try/finally 之后，抛错时执行不到 | 云快照的 `x_characters` 被 `collectForSave` 特意嵌回 base64 头像/参考照（`:127-139`）→ 恢复时第 N 个键 `QuotaExceeded` → 「恢复失败」toast，但本机 x_ 已删光、只写回一半 → 之后任何写入 → markDirty → autoPush：MARK 是这台设备自己的、不过期 → **半份存档再推上云端** | `apply` 改成 `doImport` 那种逐键 try + 失败清单；写之前把旧 x_ 快照进内存，失败整份回滚；apply 失败也要立 `pushBlocked` |
| P1 | `js/cloud.js:1223` | 过期闸查询失败即视为「不过期」（`.catch(() => ({ stale: false }))`），并缓存整个会话 | 慢网：staleness 的 select 超时 → 当作不过期 → 网络恢复后 upsert 成功 → 闸形同虚设 | 查不到就算「未知」，未知一律拦下并提示 |
| P1 | `js/cloud.js:1217-1218`、`1235` | 在途 upsert 没有超时，`pushInFlight` 永不 resolve 时后续每次 autoPush 都 `return pushInFlight`（只置 `pushAgain`） | iOS 切后台时 socket 被挂起、fetch 既不成功也不失败 → 该标签页此后所有自动备份被静默跳过，直到整页重载 | upsert 包一个 AbortController 超时（cloud.js 自己的 `llmProxyFetch` 在 `:1095` 就是这么做的），超时算失败走红字 |
| P1 | `js/cloud.js:22`、`1232-1235` | 整行 jsonb 覆盖、不合并；24h 之内的两台设备互相盖是「合法」的（注释写明是取舍） | 手机离线用了 20 小时，平板同时在写；手机一联网 → 整份盖掉平板这 20 小时，两边不弹一个字 | upsert 前发现云端 `updated_at` 比本机 MARK 新（任意跨度）就弹一次「云端有更新的改动，先拉还是先推」 |
| P1 | `js/cloud.js:127-141`；`js/app.js:1054-1076` | 云快照只把 `avatarImage / refPhoto` 从图库嵌回 base64，其它已迁成 `iv_` 的图（壁纸、朋友圈图、封面、聊天背景、情侣空间图、聊天里生成的照片）只带门牌 | 换设备「从云端恢复」→ 这些引用全部空门牌，`resolveImg` 返回空串（`engine.js:4026`）→ 图默默没了，无提示 | 恢复完统计 `iv_` 引用未命中数，弹「N 张图不在云端，需从导出文件恢复」 |
| P1 | `js/app.js:16338-16344`、`16419-16420`；`js/engine.js:3843-3844` | 导出时图库读失败静默得到 `vault = {}`；导入时 `parsed.vault` 为 `{}` 依然真值 → 先 `idbVaultClear()` 把本机图库连同 `album` 目录一起清空；`album` 目录从不在导出里 | 图库 IDB 一次读失败（`idbVaultEntries` 的 `tx.onerror = () => res([])`）→ 导出「含 0 张图片」→ 导回本机 → 头像/壁纸/照片全清；`album`（照片说明、照片桥索引）任何一次导入必清 | 导出：图库条目为 0 而 `iv_` 引用不为 0 时拒绝导出并报错；导入：`vault` 为空对象时不清仓；`album` 打进备份 |
| P1 | `js/app.js:16372-16454`；`js/cloud.js:1262` | 导入不写 MARK；重载后开机 `autoPush` 无条件推送；同一台设备 MARK 新鲜 → 刚导入的旧文件直接盖上云端（代码注释写明「显式导入就是整机替换」，是有意的；但事故形状一样） | 9/3 手机上导入 8/25 的备份「看看」→ 重载 → 开机推送 → 云端变成 8/25 | 导入完成时立 `pushBlocked`，下一次自动上云前要确认；或导入时清掉 MARK 让过期闸接手 |
| P1 | `js/cloud.js:33`、`1264-1271`；`js/screens.js:7905-7907` | `bootHadLocal` 是页面加载时的快照；同一页里访客建了角色再登录，仍按「本地空」处理 → pull+apply 整份覆盖 | 新手机打开是空的 → 访客建了角色聊了半天 → 想起来登录 → 刚建的角色被云端旧档盖掉，toast 只说「正在同步…」 | 登录路径不用 `bootHadLocal`，当场 `localMeaningful()`；有角色就走「先推还是先拉」确认 |
| P1 | `js/credential-vault.js:3-4`、`12-15`；`js/app.js:18076-18077` | API key 全部剥进本机 IDB `x_credential_vault`（不可导出的设备密钥同库）；导出/云端里 `x_api` 只剩 `credentialRef`；界面没有一句话说「key 不随备份走」；开机 hydrate 抛错被 `.catch(() => 0)` 吞掉 | 重装/换设备 → 导入或云恢复后每条线路都在、都没 key → 调用失败，用户以为是模型坏了；或金库解密失败（`storeProfile` 抛「无法解密」）→ 开机静默 → 全线无 key | API 设置页写明「密钥只存这台设备，重装要重填」；hydrate 失败弹「凭证金库打不开」；导出 toast 带一句「N 条线路的密钥不在文件里」 |
| P1 | `js/app.js:17686-17689` | 「清空所有数据」只清 localStorage 的 x_，IDB 文字库/图库/自拍原样留着；登录态下重载后 `bootHadLocal=false` → 自动从云端整份拉回 | 登录态点清空 → 重载 → 云端把一切拉回来，等于没清；访客态 → 角色没了但 `x_txtvault` 里的聊天被 `hydrateTxtVault` 灌回镜像 | 清空连 `idbTxtClear / idbVaultClear` 一起清，并写一面「本机已清空，不要自动拉云」的旗 |
| P1 | `js/read.js:3,9`；`js/engine.js:3828`、`3846`；`js/app.js:185`；`js/credential-vault.js:3` | 五个 IDB 库（一起读正文 `LisaReadDB`、TTS 音频 `x_tts`、一起听本地音频 `x_listen_audio`、照片目录 `album`、凭证金库）不在导出、不在云端、不在导入；唯一提到的地方是导入**失败后**的 alert（`app.js:16440`） | 按「导出全部数据」→ 换手机 → 书正文、语音、本地歌、API key 全没有，事前没人告诉她 | 导出按钮旁固定一行「不含：一起读正文 / 语音 / 本地音频 / API 密钥」 |
| P2 | `js/screens.js:7996`、`8012-8013` | 「从云端恢复」的确认与「退出登录（清空本机数据）」两处按钮前面都没有「先导出一份」这一步——`never-say-delete-first.md` 点名的正是这两种话 | 她按「确定恢复」→ 本机被云端整份盖掉（叠加上面 P0 第五条还可能只盖一半）→ 本机那份不存在任何副本 | 两处确认框第一行改成「先导出」按钮，导出成功后才亮「确定」 |
| P2 | `js/cloud.js:1204-1209`、`1233-1235` | 过期判定比较的是**两台客户端各自写的时间戳**（`updated_at` 是推送方 `new Date()`，MARK 是本机的） | 平板时钟慢两天 → 它推上去的 `updated_at` 是「过去」→ 手机看 cloudAt < localAt → 不过期 → 放心盖掉平板的活 | `updated_at` 改由服务端 `now()` 写（列默认/触发器） |
| P2 | `js/app.js:16328-16330`；`js/screens.js:5380` | 导出把 `x_neteaseCookie` 一并打进文件，界面却承诺「只存这台设备」；云路径（`cloud.js:110`）已排除，导出没跟上 | 备份文件发给别人/放云盘 → 网易云账号 cookie 一起出去 | 导出过滤掉 `x_neteaseCookie`，与 `collect()` 一致 |
| P2 | `js/app.js:1443-1444`（app.js 3 处 / screens.js 12 处 / components.js 9 处） | 绕过 `saveJSON` 直接 `localStorage.setItem("x_…")` 并包在空 `catch (e) {}` 里；写满时不走 `__storageFull` 弹窗 | localStorage 逼近 5MB → 这些键写失败 → 没有任何提示（`saveJSON` 的「快满了」只对走它的键有效） | 统一走 `saveJSON`，或在 cloud.js 的 setItem 拦截层里抓 Quota 统一弹 |
| P2 | `js/chat-ledger-shadow.js:12`、`338-341`；`js/app.js:2277-2280` | 账本 outbox 与记忆行表 outbox 的 `last_error` 只写进 diag 键 / 只在手动点一下时 toast；没有 UI 读 `ChatLedgerShadow.status()` | 账本上传连失一周 → `chat_ledger_outbox_v1`（localStorage，无 x_ 前缀）越攒越大，一边挤 5MB 配额一边没人知道 | 云同步面板加一行「账本待发 N 条 / 上次错误」 |
| P3 | `js/cloud.js:224`、`1287-1288` | `frozen = true` 之后只有整页 reload 能解除；调用方全靠 `setTimeout(reload)` | reload 没发生（iOS 后台挂起推迟 setTimeout）→ 此后所有 x_ 写入被静默丢弃，界面看起来一切正常 | `frozen` 超过 5 秒还没 reload 就强制 reload 或弹提示 |

### 三张键名单对差（导出 / 上云 / 云恢复 / 文件导入）

名单出处：导出 `doExport`（`js/app.js:16326-16355`）取 localStorage 全部 `x_*`（不排除任何键）+ `__txtMirror` + `x_imgvault.img` 全部 + `x_selfies` 全部；上云 `collect()+collectForSave()`（`js/cloud.js:107-174`）取 `x_*` **排除** `x_neteaseCookie`、表权威时的 `x_memLib`，图只嵌 `avatarImage/refPhoto`；云恢复 `apply()`（`:176-225`）删 `x_*` 再逐键写，跳过 cookie 与表权威 `x_memLib`，不碰图库/自拍/目录/金库；文件导入 `doImport`（`js/app.js:16372-16454`）`idbTxtClear` + 删全部 `x_*` + 逐键 try 写，`vault` 真值则先 `idbVaultClear`，不写 MARK。

| 键 / 存放处 | 导出 | 上云 | 云恢复 | 文件导入 | 后果 |
|---|---|---|---|---|---|
| `x_neteaseCookie` | ✅ | ❌ `cloud.js:110` | ❌ 跳过 `:190` | ✅ | 导出泄露 cookie（P2）；云路径按承诺不带 |
| `x_memLib`（表权威模式） | ✅ 从镜像 | ❌ 改带云端冻结副本 `:151-153` | ❌ 跳过 `:192` | ✅ **覆盖离线镜像** | 同一个键三处规则各不相同；导入会用文件里的旧镜像盖掉本机行表镜像 |
| 头像/参考照像素（`iv_`） | ✅ | ✅ 嵌 base64 `:139` | ✅ 落 localStorage，开机迁回 | ✅ | 一致；但云恢复时 base64 走 localStorage，正是 P0 第五条的配额来源 |
| 壁纸/朋友圈图/封面/聊天背景/情侣空间图/聊天照片（`iv_`） | ✅ | ❌ 只带门牌 | ❌ 门牌落地、像素无 | ✅ | 云恢复后图全空（P1） |
| 自拍 `x_selfies` | ✅ | ❌ | ❌ | ✅ 增量 | 只有文件备份能带走 |
| 照片目录 `x_imgvault.album` | ❌ | ❌ | ❌ | ❌ **且被 `idbVaultClear` 清掉** `engine.js:3843` | 每次导入必丢（P1） |
| 一起读正文 `LisaReadDB` / TTS `x_tts` / 本地音频 `x_listen_audio` | ❌ | ❌ | ❌ | ❌ | 重装必丢，事前无提示（P1） |
| API 密钥 `x_credential_vault` | ❌（`x_api` 只有壳） | ❌ | ❌ | ❌ | 重装必丢、界面不说（P1） |
| 向量 `x_memvec` / `x_lorevec` | ❌ | ❌（另有 `memVecUpsert` 表路径 `cloud.js:713`） | ❌ | ❌ | 可重算，但要花 embedding 调用 |
| 记忆行表 outbox `lisa_memory_sync_v1`、账本 outbox `chat_ledger_outbox_v1` | ❌ | ❌ | ❌ | ❌ | 未发出的改动只在本机 |
| `cloud_pushed_at`（MARK） | ❌ | — | autoPull 写 `:1272`；手动恢复 `markSynced` | ❌ 不写 | 导入后继承本机旧 MARK → 导入盖云（P1） |

白名单只有一条 `k.startsWith("x_")`（`cloud.js:110/186`、`app.js:16328/16404`）；黑名单（cookie、表权威 memLib）**只在云路径有**，导出/导入没有。文字键分流靠 `isIdbTextKey`（`engine.js:3880`），图片分流靠值前缀 `iv_`（`:3858`），不靠键名。

### credential-vault 的设计边界（直答）

- **剥哪些**：`SECRET_FIELDS` 11 个字段名（`credential-vault.js:4`），凡 `x_api` 每条 profile 上有的都剥；剥完只留 `credentialRef: "cred:"+id`（`:12`）。
- **存哪儿**：IndexedDB `x_credential_vault`（`:3`），密文用同库一把 `extractable=false` 的 AES-GCM 设备密钥加密（`:8`）。不是 keychain、不是原生壳，就是这个 origin 的 IDB；WKWebView 与 Safari 的 IDB 互不相通（`cloud.js:125` 对头像说过这句，对金库没人说过）。
- **导出带不带 key**：不带（`test/credential-vault-contract.test.js:8` 明写「不可导出设备金库」）。
- **导入接不接得上**：接不上——`hydrateApiCredentials`（`:20-24`）对每条 `storeProfile`，`old` 为空 → `merged = {}` → 运行时 profile 无 key。同一台设备导入自己的备份、id 相同时才会接回旧 key。
- **跟它一样「重装必丢但用户不知道」的**：上表末五行。

### 附录：待核实（写不出可复现场景）

1. 导出大 payload 的内存：`app.js:16346-16352` `JSON.stringify(…, null, 2)` 再 `await blob.text()`，几十 MB 字符串在内存里至少两份；分片上桥（`engine.js:3985-4004`，9/3 之后补的）只解决了 postMessage 那一段。WKWebView 是否会因此被系统杀页，需真机验证。
2. `saveTextFile` 的 `await bridge.postMessage(...)`（`engine.js:3987/3993/3996`）没有超时：原生侧不回话时 `doExport` 永远挂着、无 toast。上一次事故恰是「按了毫无反应」，但这一次的原因（噎死）已修，剩下的只是没有兜底。
3. 服务端 `saves.updated_at` 是否有默认/触发器覆盖客户端值——静态读不到 schema。若有，P2 时钟那条不成立，P0 第三条不受影响。
4. `deskConsume`（`app.js:1868`）先于 `x_chat:` 落盘验真：IDB 写失败只 `console.error`（`engine.js:6035`），云端已标 consumed、本机没落。需要 IDB 写失败同时发生，概率未证。
5. 表权威模式下文件导入 `x_memLib`：`doImport` 不看 `memory_table_authority_v1`，把文件里的镜像整份写回，`MemorySync` 的 `local_snapshot` 未重置——是否会把旧镜像当「本地新写入」整批 enqueue 到行表，需跑一遍 `memory-sync.js:80-120` 的 diff 逻辑。

---

## 专项二：五处一样喂合规扫

准绳 `.claude/rules/four-surfaces-same-context.md`。名单五处：①单人线上 ②单人线下 ③群聊线上 ④群聊线下 ⑤通话（单人通话 ⑤a、群通话 ⑤b 分列）。每一处先答「靠什么把这层拿到手」——buildBundle 白得 / 调用点逐条 push / 自己从零拼——因为规则文件说过：一条条 push 的那一类，换个入口就一条都没有，而且不留任何能 grep 的痕迹。

### 总表（按严重度）

| 严重度 | 文件:行号 | 病灶 | 失败场景 |
|---|---|---|---|
| **P1** | `js/app.js:11272`、`11306` | 群通话记忆库只按 `people[0]` 召回，且落进**没有隐私围栏的公共块**；群线上早在 `8072` 用 `splitGroupMemories` 分了公共/私密并带围栏，电话里没跟上 | 三人群通话：排第二的成员和她私下的事（`knownBy` 只有他）永远召不回；第一人 `knownBy` 只有他的私事却写进所有人共享的块，别的成员当场能接梗——两种坏法同时成立：对 people[1..n] 是「过滤什么都不剩」，对 people[0] 是「围栏等于没有」 |
| P2 | `js/app.js:11274-11281` | 群通话 memberDesc 只有六段（persona/live/mdSeg/afSeg/ageSeg/sbSeg/cpSeg）；对照群线上 `8047` 少了 `grownSeg`（长出来的自我）、`aSeg`（A 情绪底色）、`cySeg`（随身物）、`caSeg`（我们的档案）、印象卡 `gz`、长期记忆 `mem`。`3652-3656` 注释自称「群聊两处不走 bundle，各自按人喂」——群通话是第三处，没喂 | 她刚和某人在群里聊完转头群通话，他退回原人设卡；情绪底色偏低的人在电话里突然「正常」——v55.87「换个入口换个人」的形状 |
| P2 | `js/app.js:11306` | 群通话 system 整行无用户人设块（`grep -o 设定` 命中 0）；单人通话经 bundle 有（`engine.js:2246`），群线上 `8170`、群线下 `engine.js:5306` 都有 | 她人设里的职业/年龄/称呼群通话里几个人都不知道——v55.90 那次群聊漏用户人设的翻版 |
| P2 | `js/app.js:11182-11184` | 单人通话无 `PERSONA_REGISTER_ANCHOR`（语气与年龄感锚）：buildBundle 不含，`callBans` 只补三条；全库引用只有 `app.js:6843`、`engine.js:1405`、`1883`、`4914`，通话哪一条都不经过；`test/call-bans-60-27.test.js:22-28` 只钉了三条 | 年下角色煲一小时电话越聊越像稳重兄长，没有那条「聊很多轮不是端起架子的理由」拽回来；同一角色线上有、一打电话就没 |
| P2 | `js/engine.js:2340` ＋ `js/app.js:6351` | 【对话连贯·别否认自己说过的话／人称对准】挂在 `if (recentChat && recentChat.trim())` 从句里（v55.90 型）；anthropic 线路 `buildBundle({ ..._roomCtx, recentChat: "" })` 清空 recentChat 后这条一起消失，`app.js` 6300-6850 没有第二份 | 她接「去厕所也要吗」，没有「省掉的主语从你上一句继承」，主客弄反或反问「什么厕所」；openai 线有这条、anthropic 线没有——同一角色换线路换脑子 |
| P2 | `js/engine.js:5303-5340` ＋ `js/app.js:5455-5630` | 群线下无 `memories[id]` 长期记忆摘要——群线上 `8074/8081` 有，单聊 `engine.js:2294` 有；`ctxForGroupOffline` 的键里没有它 | 单聊滚动总结出的事只在摘要里不在记忆库条目里时，群线下那场他一无所知 |
| P3 | `js/app.js:11129-11310`；`6312-6329` | 单人通话无 E 余温（`liveProjection` 只在 replyNow 取）；`6312` 只写了群的理由，通话/线下没写 | 刚在线上吵完挂着没说完的话头，五分钟后打电话他像没事人 |
| P3 | `js/engine.js:4846-4970` | 单人线下无 E 余温、无 desireHint（心底的念想）——两层只在 replyNow 任务串 `6496-6504` | 线上他会「其实我一直想…」，线下泡一整晚一次不会 |
| P3 | `js/app.js:11194`、`11306` | 通话两支输出契约无 mood/affinityDelta，通话不写回心情与好感；未在规则文件登记为合法差异 | 电话里吵翻挂断，回到线上他的心情还是打电话前的读数 |
| P3 | `js/engine.js:1187`、`1708`；`js/app.js:6787-6788` | 死常量 `GROWTH_RULE`、`OFFLINE_INTIMATE_RUNTIME`（详见专项四）；`_normalTaskFull` 每轮白拼一个几千字的串「暂留作 A/B 回滚基线」，且与 `_normalTaskV2`（`6835`）的 hint 清单已分叉（V2 多 `_saidElsewhereHint/_recallHint/capabilityHint`，Full 多 `eyesHint/ambientHint/listenHint/inviteHint/photoHint/toyHint`） | 谁再拿它「回滚」等于回到少六个 hint 的版本 |
| P3 | `js/engine.js:1720-1722`、`4770-4775`；`test/offline-protocol-v2.test.js:16` | 单人线下刻意不带 NARRATIVE_ANTI_CLICHE / INTIMATE_ANTI_CLICHE / REGISTER_FOLLOWS_SCENE，理由只在代码注释和测试里，**规则文件的合法差异清单没有这三行** | 下一个按规则文件扫的人会把它们当漏报「修回去」，测试当场红，两边打架 |

### 五处入口与拼接链

| 处 | 入口函数 | system 拼在哪 | 靠什么拿到各层 |
|---|---|---|---|
| ① 单人线上 | `js/app.js:6218` `replyNow` | `js/app.js:6844` `const system = _singleHistoryLayout ? (bundleStable + _onlineRuntime + _normalProtocolStable + _primer) : (bundle + _onlineRuntime + _normalProtocolStable + _taskFull)` | **buildBundle 白得**（`6351`）＋ 调用点 push：`_onlineRuntime`（`6843`：ONLINE_CHAT_RULE_V2 / REGISTER_FOLLOWS_SCENE / PERSONA_REGISTER_ANCHOR）＋ 任务串 `_normalTaskV2`（`6835`：paceHint→ReplyPacing.guidance＝pacing+reading、MOOD_TURN_RULE、eAfterglowHint、desireHint、dongnianHint）。⚠️anthropic 线路（`_singleHistoryLayout`）下任务串和 bundle 易变尾不在 system，而是贴到最后一条 user 消息上（`6927`），仍然到模型。 |
| ② 单人线下 | `js/engine.js:4846` `generateOffline`（app 侧 `js/app.js:5128` 调） | `js/engine.js:4912-4935` `const system = (isDigital ? buildBundle(ctx) + … : buildBundle(ctx) + OFFLINE_NARRATIVE_RUNTIME + PERSONA_REGISTER_ANCHOR + MOOD_TURN_RULE + ReplyPacing.reading() + …)` | **buildBundle 白得** ＋ 调用点 push（4913-4918）。**不走 `narrativeCore`**（`narrativeCore` 只被穿书用：`js/app.js:14190/14236`）。 |
| ③ 群聊线上 | `js/app.js:7910` `replyGroup` | `js/app.js:8170` `const system = groupBans({ echo: false }) + "\n\n" + groupOnlineRuntime + … + memberDesc + …` | **自己拼**，规矩层走 `groupBans`（`js/engine.js:1393-1412`）；上下文按人拼 `memberDesc`（`7989-8047`）＋ `memLines/interop`（`8068-8082`）。 |
| ④ 群聊线下 | `js/engine.js:5242` `generateOfflineGroup`（app 侧 `js/app.js:5802` 调，ctx 来自 `ctxForGroupOffline` `js/app.js:5455`） | `js/engine.js:5303-5340` `const system = groupBans({ narrative: true, mood: true, echo: true, worldbook: … }) + … + memberDesc + …` | **自己拼**，规矩层走 `groupBans`；上下文按人拼 `memberDesc`（`5253-5270`）。 |
| ⑤a 单人通话 | `js/app.js:11129` `callSend`（`people.length <= 1` 支，`11185`） | `js/app.js:11193` `const sys = buildBundle(ctxFor(char, { chat: true, queryText: callQuery })) + callBans(…) + "【当前场景：…中】…"` | **buildBundle 白得** ＋ `callBans`（`11182-11184`：ECHO_QUESTION_BAN / REGISTER_FOLLOWS_SCENE / ReplyPacing.reading()）。 |
| ⑤b 群通话 | `js/app.js:11129` `callSend`（`else` 支，`11260`） | `js/app.js:11305-11306` `const sys = groupBans({ echo: true }) + "这是一个多人…" + memberDesc + relLines + cDirs + cMem + cWorld + gcHistBlock + gcTime + gcPrivBlock + …` | **自己从零拼**，规矩层走 `groupBans`；上下文按人拼但只拿 `groupNowSegs` 六段（`11280`）。 |

拼接链核对（要求 4）：
- `buildBundle` 末尾 `return parts.join("\n\n")`（`js/engine.js:2347` 一带，紧接三处 shadow observe 之后）——parts 真的 join 进返回值；
- `groupBans` 末尾 `return P.join("\n\n")`（`js/engine.js:1411`）；
- ①的 `system` 直接进 `callAI`（`6844` 之后），anthropic 线的 `_taskFull` 贴到 `g[_i].content`（`6927`），是 messages 的一部分；
- ③ `system`（`8170`）、④ `system`（`5303`）、⑤a `sys`（`11193`）、⑤b `sys`（`11305`，`11307` `callAI(active, sys, hist, …)`）都是直接发出的那个字符串。


拼接链核过：`buildBundle` 末尾 `parts.join`（`engine.js:2347` 一带）；`groupBans` 末尾 `P.join`（`engine.js:1411`）；①的 `system` 直接进 `callAI`（anthropic 线的任务串贴到最后一条 user 消息 `6927`，仍到模型）；③ `8170`、④ `5303`、⑤a `11193`、⑤b `11305→11307` 都是直接发出的那个字符串。

### 矩阵（✅ 给行号 / ❌ / 合法差异注明理由；E＝engine.js，A＝app.js）

| 层 | ①单人线上 | ②单人线下 | ③群线上 | ④群线下 | ⑤a单人通话 | ⑤b群通话 |
|---|---|---|---|---|---|---|
| 人设全文 / 截断 | ✅ 全文 E:2231（bundle） | ✅ 全文 E:2231 | ✅ `groupPersonaText(c.persona, gPersonaCap)` A:8047，预算 `groupPersonaBudget` A:7988（每人封顶 6000） | ✅ E:5256 同预算 E:5250 | ✅ 全文（bundle） | ✅ `gCallCap` A:11265/11280 |
| 心情 | ✅ E:2282 | ✅ E:2282 | ✅ `mdSeg` A:8047（groupNowSegs A:11036） | ✅ `memberMood` E:5259 | ✅（bundle） | ✅ `n.mdSeg` A:11280 |
| 好感度 | ✅ E:2279 | ✅ | ✅ `afSeg` A:8047 | ✅ `memberAff` E:5260 | ✅ | ✅ `n.afSeg` A:11280 |
| 印象卡（Ta 眼里） | ✅ E:2290 gazeText | ✅ 读 E:2290，写 `gazeSpecBlock` E:4900-4906 | ✅ `gz` A:8080 落本人段 | ✅ `memberGaze` E:5267 | ✅（bundle） | **❌** memberDesc 只拼六段 A:11280，无 gaze |
| 长期记忆摘要 `memories[id]` | ✅ E:2294 | ✅ | ✅ `"长期记忆：" + mem` A:8074/8081 | **❌** `ctxForGroupOffline` 无 `memories[id]`（A:5455-5630 只有 memberRecent/memLib），engine 5303-5340 也无 `ctx.memory` | ✅ | **❌** A:11274-11306 无 |
| 记忆库检索 | ✅ E:2296 | ✅ | ✅ `splitGroupMemories` A:8072（按可见交集分公共/私密） | ✅ `memSplit` A:5451/5609/5618 | ✅ bundle（`queryText: callQuery` A:11193） | ⚠️ 只按 `people[0]` 召回 A:11272，见 F-1 |
| 最近聊天 | ✅（openai 线 thinOnline E:2338；anthropic 线走 messages A:6351/6927） | ✅ 走 `offlineHistory` E:4941 | ✅ `hist` A:8170 | ✅ `offlineGroupHistory` E:5340 | ✅ bundle recentChat A:4009 | ✅ `gcHistBlock` A:11299-11302 |
| 用户人设 | ✅ E:2246 | ✅ | ✅ A:8170 `【和大家说话的人…设定】` | ✅ E:5306 | ✅ | **❌** A:11306 整行无「设定」（`grep -o 设定 | wc -l` = 0） |
| 情侣状态 / 年龄 / 此刻在做什么 | ✅ E:2256-2259 / 2239 / 2299 | ✅ | ✅ `cpSeg/ageSeg/sbSeg` A:8047 | ✅ E:5264-5268 | ✅ | ✅ `n.cpSeg/n.ageSeg/n.sbSeg` A:11280 |
| 今日行程或「此刻」 | ✅ 整张 E:2299 | ✅ | ✅ 只发「此刻」（合法差异：规则文件「群里的行程」） | ✅ 同 | ✅ 整张 | ✅ 只发「此刻」 |
| 长出来的自我 | ✅ E:2245 | ✅ | ✅ `grownSeg` A:8002 | ✅ `memberGrown` E:5257 | ✅ | **❌** A:11280 无 |
| 我们的档案（coupleArchive） | ✅ E:2250 | ✅ | ✅ `caSeg` A:8014 | ✅ E:5269 | ✅ | **❌** |
| 反陈词滥调 ANTI_CLICHE | ✅ E:2195 | ✅ E:2195 | ✅ groupBans E:1394 | ✅ | ✅ | ✅ |
| 叙事反陈词滥调 NARRATIVE_ANTI_CLICHE | 合法差异（线上不吃叙事条，test/group-bundle-60-39:34） | **❌ 写着理由的差异**：E:1720-1722「单人线下已迁到 v2 协议、刻意不带旧清单（Codex Phase A）」，`test/offline-protocol-v2.test.js:16` 钉死 | 合法差异 | ✅ E:1396（narrative:true） | 合法差异 | 合法差异 |
| 亲密反模板 INTIMATE_ANTI_CLICHE | 合法差异（E:1268「不能原样搬到线上」） | **❌** 同上 Phase A，E:1264-1265 明说只挂 narrativeCore/groupBans | 合法差异 | ✅ E:1396 | 合法差异 | 合法差异 |
| 线上亲密反模板 INTIMATE_CHAT_ANTI_CLICHE | ✅ E:2197 | ✅ E:2197 | ✅ E:1403 | ✅ | ✅ | ✅ |
| 居高临下禁令 | ✅ E:2196 | ✅ | ✅ E:1402 | ✅ | ✅ | ✅ |
| 三件套禁令 STOCK_REPLY_BAN | ✅ E:2198 | ✅ | ✅ E:1407 | ✅ | ✅ | ✅ |
| 回声式反问禁令 | ✅ 包在 ONLINE_CHAT_RULE_V2 E:1620，经 A:6843 | ✅ 包在 OFFLINE_NARRATIVE_RUNTIME E:1660，经 E:4913 | ✅ 同①（groupBans echo:false 不重发，E:1409-1410） | ✅ E:1410（echo:true，E:5304） | ✅ callBans A:11183 | ✅ E:1410（A:11305 echo:true） |
| 语域跟场面走 REGISTER_FOLLOWS_SCENE | ✅ A:6843 | **❌ 写着理由的差异**：E:4770「线下单聊有 offlineRegisterTransition 状态机」 | ✅ E:1404 | ✅ | ✅ A:11183 | ✅ |
| 读懂这句话在做什么 ReplyPacing.reading() | ✅ `paceHint`=guidance=pacing+reading（`js/reply-pacing.js:40-41`）A:6596→6835 | ✅ E:4918 | ✅ E:1408 | ✅ | ✅ A:11184 | ✅ |
| 内容边界 ContentBoundaries | ✅ E:2208 | ✅ | ✅ E:1397 | ✅ | ✅ | ✅ |
| 语气与年龄感锚 PERSONA_REGISTER_ANCHOR | ✅ A:6843 | ✅ E:4914 | ✅ E:1405 | ✅ | **❌** buildBundle 不含、callBans 不含（A:11182-11184） | ✅ |
| 站位（完全代入 vs 导演） | ✅ ONLINE_CHAT_RULE_V2「完全代入当前角色」E:1610；`【本轮】先以「X」本人…` A:6835 | ✅ E:4922「完全代入「X」」 | ✅ E:8158-8162 改写成「完全代入你正在写的那一位」+ GROUP_IN_CHARACTER E:1400 | ✅ GROUP_IN_CHARACTER | ⚠️ 无「完全代入」句，只有「你正和 X 打电话」A:11193（见附录） | ✅ GROUP_IN_CHARACTER |
| 同一人可连发多条 | ✅ 结构白送 `word: string[]` + E:1612 | N/A（叙事） | ✅ GROUP_MULTI_BUBBLE A:8163 | N/A | ✅「可以一次说好几句（多个气泡）」A:11193 | ✅「想多说几句就多给几条」A:11306 |
| 实时心情更新指令 MOOD_TURN_RULE | ✅ A:6835 | ✅ E:4915 | ⚠️ 只在 `gs.memoryInterop` 时（A:8120 thoughtHint）——闭群「写一律封死」，合法 | ✅ E:1406（mood:true） | ❌ 通话输出无 mood 字段（A:11194），无写回——差异未写理由 | ❌ 同左（A:11306 输出只有 name/text/action/hangup） |
| 每几轮自动抽记忆 | ✅ `maybeAutoExtract` A:2875，挂点 A:7641 | ✅ `maybeAutoExtractOffline` A:4896，挂点 A:5234 | ✅ `maybeAutoExtractGroup` A:8869，挂点 A:8509 | ✅ `maybeAutoExtractGroupOffline` A:5704，挂点 A:5874 | ✅ 机制不同：挂断后摘要入库 A:11361-11364 | ✅ 同左（互通群才写，A:11361） |
| A 情绪底色 aMood（v62.39） | ✅ E:2288（ctxFor A:3658） | ✅ E:2288（A:5072 只在 sideRoom 关 innerLife 时清空） | ✅ `aSeg` A:8039-8041 | ✅ `memberAMood` E:5261（A:5503-5511） | ✅ E:2288 | **❌** A:11280 六段里没有 aSeg；A:3652 注释自称「群聊两处不走 bundle，各自按人喂」——群通话是第三处，没喂 |
| E 余温 eAfterglowHint（v62.37） | ✅ A:6317-6329 → 6835 | **❌** generateOffline 无（E:4846-4970 无 afterglow/余温） | 合法差异（A:6312-6314 写明「群里没有核销对应物」） | 合法差异同左 | **❌** callSend 无（A:11129-11310 无 liveProjection），未写理由 | 合法差异（群） |
| 创作小稿 cotSystemBlock | ❌（线上从未有，无规则要求） | ⚠️ 仅数字生命 `isDigital ? cotSystemBlock(cotT) : ""` E:4869；普通线下 v52.66 刻意不注 E:4865 | ❌ | ✅ E:5338 | ❌ | ❌ |
| 动念 dongnian 出口 | ✅ `opts.dongnian` A:4659→6444（主动消息出口） | ❌（无） | ❌（无 dongnian） | ✅ 群线下自发 A:4320 | ❌ | ❌ |
| 心底的念想 desireHint（欲望盒） | ✅ A:6496-6504 → 6835 | ❌ E:4846-4970 无 | ❌ | ❌ | ❌ | ❌ |

### 三种病型专项

- **① 规则只挂在可选块从句里（v55.90 型）**：命中一处——`engine.js:2340` 对话连贯挂在 recentChat 上。查过未命中：`engine.js:2299-2301` 行程块里那句训话腔是对 `CONDESCENDING_TONE_BAN` 的引用，正文另有独立一份 `2196`；`app.js:8120` MOOD_TURN_RULE 挂在 `gs.memoryInterop` 上，闭群「写一律封死」，合法。
- **② 声明了从没被引用（v55.95 型）**：对 engine.js / app.js 所有 `^const [A-Z_]+ = \`` 模板常量数非注释引用：`GROWTH_RULE`（`engine.js:1187`，引用 1＝定义本身，另一处是 `1633` 注释）、`OFFLINE_INTIMATE_RUNTIME`（`engine.js:1708`，产品 0、测试 4 且钉「不许用」）；局部 `_normalTaskFull`（`app.js:6787`）。其余提示词常量（ANTI_CLICHE / CHARCARD_RULE / WORLDBOOK_RULE / ECHO_QUESTION_BAN / CONDESCENDING_TONE_BAN / STOCK_REPLY_BAN / INTIMATE_CHAT_ANTI_CLICHE / REGISTER_FOLLOWS_SCENE / PERSONA_REGISTER_ANCHOR / MOOD_TURN_RULE / GROUP_MULTI_BUBBLE / GROUP_IN_CHARACTER / GROUP_USER_IS_PRESENT / OFFLINE_USER_IS_PRESENT / OFFLINE_NARRATIVE_RUNTIME / ONLINE_CHAT_RULE_V2）均顺着拼接链核到进了发出的 system。
- **③ 靠结构白送、换结构就没了（v56.27 型）**：「同一人可连发多条」五处都有落点（① `word: string[]` + E:1612；③ GROUP_MULTI_BUBBLE A:8163；⑤a A:11193 一句；⑤b A:11306 一句）。「最近聊天」在①有两条路（anthropic 走 messages、openai 走 recentChat），结构不同导致上面那条对话连贯规则在一条路上消失——①型与③型叠加。「记忆围栏」在③靠 `splitGroupMemories` 结构白送，⑤b 换成单 charId 召回就没了——就是总表第一条。

### 附录：待核实

1. 单人通话站位：`app.js:11193` 场景句是「你正和 X 打电话」，没有「完全代入「X」」这句（①E:1610/A:6835、②E:4922 都有）。bundle 里的人设用第二人称写，模型大概率认得出自己是谁；但按 v55.91「一句话在别处成立不等于在这处也成立」，值得补。没抓到现成失败样本，不判。
2. 创作小稿只在群线下（E:5338）和数字生命单人线下（E:4869）有；普通单人线下 v52.66 刻意不注（E:4865）。规则文件没把它列为必喂层，不判。
3. 动念（dongnian）是主动消息触发器不是上下文层：①走 `replyNow(..., { dongnian })`（A:4659），④走群线下自发（A:4320）；③/⑤ 没有。是否算「出口漏」取决于产品定义，不判。
4. 群线上 `interop` 块（A:8068）对闭群仍给记忆库/长期记忆/印象卡，符合「读一律给」；`priv/offBeats` 按 `memoryInterop` 关，符合「实时私聊窗口归互通群」。核过，无问题。
5. 单人线下 ctx（A:5062-5100）在 sideRoom 关 innerLife 时清 `aMood/gazeText/personaGrown`（5072），与线上 6346 一致。核过，无问题。

---

## 专项三：家规遵纪扫

准绳：`no-half-sheet.md`（08-30）、`tabs-not-plain-pills.md`（09-01）、`max-tokens-floor.md`（09-01）、`prompt-no-content-samples.md`（08-29）、`no-english-titles.md`（09-03）、`mobile-ui-layout.md`。六个专项里**没有一处能证明是「规则之后新写」**——git 历史浅，能查到日期的病灶全在规则之前；所以 P2 一栏只有「疑似」，其余按 P3 存量排队（规则自己说「不要求回头一次性改完」）。真正该先动的是三处「不是没改、是漏网」：`inner-life-b-shadow.js:15`（测试正则漏了无空格写法）、`engine.js:614` 默认 2400 拖着四个未传 `maxTokens` 的调用、`components.js:590` 确认框那一个 `#fff`（全 app 共用一处）。

| 专项 | 总数 | P2 | 疑似 P2 / 待核实 | P3 存量 | 合格/不算 |
|---|---|---|---|---|---|
| 半窗 | 88 | 0 | 2 疑似 + 4 待核实 | 49 | 33 合格 |
| 基础款 tab | 9（+3 仿真 app 待核实） | 0 | 3 待核实 | 9 | 6 处合规范例未列 |
| maxTokens < 8000 | 8 | 0 | 1（群线下地板） | 8 | 字面量全部 ≥ 8000；用户拧的 4 处不算 |
| 深色白字 | 16（`t.ink` 底） | 0 | 60（`accent/tint` 底） | 16 | 固定色 `ACCENT` 不算 |
| 内容示范 | 12（含 1 处 schemaHint） | 0 | 5 弱疑点 | 12 | 格式示范 / 反例 / UI 文案 ~30 处不算 |
| 英文眉标 | 85（下限） | 0 | weekly 32 + 票根 2 待她定 | 51 | — |

### 一、半窗残留（`h(Sheet`）

`grep -n "h(Sheet" js/*.js` 共 **88 处**（规则立时写的是「九十多处」，说明立规矩之后基本没再长）。
按 `no-half-sheet.md` 判据「这一层的内容需不需要同时看见下面那一层」分成两组：**应整页 55 处**，**合格半窗 33 处**（合格的单列在后，不算违规）。

#### 1a. 应整页（55 处）

| 严重度 | 文件:行号 | 位置/页面 | 病灶（内容类型） | 判据 |
|---|---|---|---|---|
| 疑似 P2 | js/screens.js:11660 | `CarrySection` 随身物件详情 | 一件东西的说明 + 「TA 的想法」整段正文 | 详情/正文。半窗体内注释标着 v57.89 / v57.91 / v57.96（≈08-31，规则 08-30 之后返工），但半窗本身可能更早，故列疑似 |
| 疑似 P2 | js/screens.js:11724 | `CarrySection` 礼物详情 `giftNode` | 礼物名 + 收到日期 + 想法正文 | 同上，v57.89–57.96 同一块 |
| 待核实 | js/components.js:7416 | `CallLogSheet` 通话记录 | 通话列表 + 点开整通转录 | 列表→详情两层，纯正文；上方 7360 行有 v60.24 注释（通话回执同期功能），本体无版本号 |
| 待核实 | js/components.js:8652 | `MsgEditSheet` 编辑消息 | 大号可拉伸文本框 | 60 行内有 v60.25 标记；但它改的正是下面那条消息，也可归「合格」——拿不准 |
| 待核实 | js/screens.js:8941 | `InnerLifeADiagnosticSheet` | 诊断报告、多段列表 | 体内有 v62.37 标记（09-04）；但该面板存在时间不明，可能只是改了文案 |
| 待核实 | js/screens.js:4959 | `Us` 情侣空间 `cpEdit` 自定义 | 背景图/封面等多项设置表单 | 上方 v60.55「名册视图重做」、v62.11；半窗本体无证据 |
| P3 | js/components.js:1865 | `Calendar` `dayEv` 日程详情 | 标题 + 说明 | 详情 |
| P3 | js/components.js:1886 | `Calendar` `pSet` 经期设置 | 多项设置 | 设置表单 |
| P3 | js/components.js:1954 | `CalEventForm` 日程编辑 | 多字段表单（v56.31/56.35） | 表单 |
| P3 | js/components.js:3671 | 主屏小组件 `renderItem` 样式编辑 `styleKey` | 编辑面板 | 表单 |
| P3 | js/components.js:3708 | 桌面装饰库 `showDecorLibrary` | 「内容、材质、边线和强调色都能分别编辑」 | 列表 + 编辑 |
| P3 | js/components.js:3897 | `HomeCardSheet` 编辑名片 | 表单 | 表单 |
| P3 | js/components.js:4397 | `Messages` `groupList` 群列表 | 列表 | 列表 |
| P3 | js/components.js:4476 | `MomentCompose` 发朋友圈 | 正文编辑 + 配图 | 正文 |
| P3 | js/components.js:4633 | `GroupManager` 群管理 | 列表/管理 | 列表 |
| P3 | js/components.js:4744 | `MomentsFeed` `imgView` 看图 | 整张图 + 保存原图 | 图片正文，半屏看图等于把图砍一半 |
| P3 | js/components.js:5067 | `MomentsProfile` `imgView` | 同上 | 同上 |
| P3 | js/components.js:6150 | `ChatThread` `recallView` 撤回原文 | 一段正文 | 正文（可长） |
| P3 | js/components.js:6156 | `ChatThread` `archView` 云端归档 | 更早的聊天列表 | 列表 |
| P3 | js/components.js:6167 | `ChatThread` `descView` | 描述正文 | 正文 |
| P3 | js/components.js:7497 | `ChatSearchSheet` 聊天搜索 | 结果列表 + 按日分组 | 列表 |
| P3 | js/components.js:9060 | `OfflineMode` 线下设置 | 长设置面板（预设/长度/记忆条数…） | 设置 |
| P3 | js/components.js:9955 | `GroupOfflineMode` 线下设置 | 同上 | 设置 |
| P3 | js/components.js:10407 | `GroupThread` `archView` | 云端归档列表 | 列表 |
| P3 | js/components.js:10844 | `GroupThread` `gRecallView` | 撤回原文 | 正文 |
| P3 | js/components.js:11130 | `PollComposeSheet` 发起投票 | 主题 + 多个选项 | 表单 |
| P3 | js/components.js:11253 | `GroupSettingsSheet` 群聊设置 | 长设置 | 设置 |
| P3 | js/components.js:11636 / 11704 / 11807 | `ChatRoomSheet` 房间列表/编辑 | 列表 + 编辑（已有 `embedded` 整页分支，非 embedded 时仍半窗） | 列表 |
| P3 | js/memo.js:320 | `ReminderForm` 新/编辑提醒 | 表单（v56.35） | 表单 |
| P3 | js/memo.js:350 | `NoteForm` 新/编辑备忘 | 表单 | 表单 |
| P3 | js/memo.js:500 | `Memo` `curReminder` 提醒详情 | 详情 | 详情 |
| P3 | js/memo.js:516 | `Memo` `curNote` 备忘详情 | 标题 + 正文 | 详情 |
| P3 | js/phone.js:2090 | `TimelineView` 一条时间线详情 | 应用名 + 标题 + 正文 | 详情 |
| P3 | js/phone.js:5166 | `PhoneApp` 通用 `sheet` | 任意子内容 | 通用容器，内容不可控 |
| P3 | js/screens.js:193 | `MemImportSheet` 导入长文进记忆库 | 大段文本粘贴 + 选角色 | 正文输入 |
| P3 | js/screens.js:1100 | `RelComposer` 关系编辑 | 多段表单 | 表单 |
| P3 | js/screens.js:1375 | `LifeDay` `openMurmur` 碎碎念 | 一天的即时念头列表 | 列表 |
| P3 | js/screens.js:1677 | `WorldBookEntrySheet` 词条编辑 | 表单 | 表单 |
| P3 | js/screens.js:2441 | 论坛 `composer` 发帖 | 板块 + 正文 | 正文 |
| P3 | js/screens.js:2448 | 论坛 `editMe` 编辑贴吧资料 | 表单 | 表单 |
| P3 | js/screens.js:2462 | 论坛 `followListOpen` 我关注的 | 列表 | 列表 |
| P3 | js/screens.js:8538 | `EventComposeSheet` 挑碎片整理成事件 | 2~30 条碎片挑选 + 核对 | 列表两段式 |
| P3 | js/screens.js:8677 | `CandidateReviewSheet` 候选过目 | 草稿正文 + 来源核对 | 正文 |
| P3 | js/screens.js:8804 | `EventShelfSection` `detail` 事件详情 | 详情 | 详情 |
| P3 | js/screens.js:8842 | `MemoryCorrectionPreviewSheet` 纠错候选 | 正文 + 理由 | 正文 |
| P3 | js/screens.js:8891 | `InnerLifeEDiagnosticSheet` | 诊断报告 | 列表/正文 |
| P3 | js/screens.js:8988 | `SomaticDiagnosticSheet` 五感诊断 | 诊断报告 | 列表/正文 |
| P3 | js/screens.js:9038 | `InnerLifeBDiagnosticSheet` | 诊断报告 | 列表/正文 |
| P3 | js/screens.js:9079 | `InnerLifeCDiagnosticSheet` | 诊断报告 | 列表/正文 |
| P3 | js/screens.js:9138 / 9160 | `MemoryRepairConflictSheet` 结局冲突过目（两份实现） | 冲突条目列表 | 列表 |
| P3 | js/screens.js:9387 | `MemoryLib` `manageOpen` 管理/诊断 | 长面板 | 列表/设置 |
| P3 | js/screens.js:9643 | `MemCfgSheet` 召回设置 | 多旋钮设置 | 设置 |
| P3 | js/screens.js:9711 | `MemEntrySheet` 记忆条目编辑 | 表单 | 表单 |

#### 1b. 合格半窗（33 处，不算违规）

判据：「选一下就走，而且下面那一层正是它要修改/发进去的东西」或「一两行字的确认」。

| 文件:行号 | 位置 | 为什么合格 |
|---|---|---|
| js/components.js:8558 | `GeoStampSheet` 发个位置 | 注释里自己引了 `no-half-sheet.md`：选一下就走，下面正是要发进去的聊天（v60.12，规则之后写、且写明理由，**这是唯一一处有书面理由的**） |
| js/components.js:1897 | `Calendar` `visPick` 谁能看到日历/经期 | 一列开关，改的是下面那本日历 |
| js/components.js:1907 | `Calendar` `genOpen` AI 生成本月 | 一两行确认 |
| js/components.js:6107 / 10899 | 聊天 `specialKind` / `photoOpen` | 挑消息类型/图片来源，选一下就走 |
| js/components.js:6216 / 10880 | 表情包面板 | 选一张就发进下面的聊天 |
| js/components.js:6224 / 10922 | `VoiceEarComposer` 语音消息 | 录一条就发进下面的聊天 |
| js/components.js:6226 / 10968 | `ModePicker` 模式二选一 | 二选一 |
| js/components.js:6265 / 10779 | 转发给谁 | 选人 |
| js/components.js:7763 | `ChatForwardSheet` | 选转发目标 |
| js/components.js:8462 | `TransferComposeSheet` 转账 | 金额 + 一句备注，发进下面的聊天 |
| js/components.js:10924 / 10948 | 群里 `callPick` 选通话成员 / `xferPick` 转账给谁 | 选人 |
| js/components.js:11154 | `RedPacketComposeSheet` 发红包 | 金额/个数短表单，发进下面群聊 |
| js/components.js:11172 | `RedPacketOpenSheet` 拆红包 | 一两行结果 |
| js/map.js:822 | `CharMap` `sel` 某人在哪座城市 | 搜索 + 选一个城市，改的是下面那张地图（待她定：带搜索框的选择器是否仍算「选一下就走」） |
| js/phone.js:5868 | 查手机桌面 `pick` 切换角色 | 选人 |
| js/screens.js:2434 | 论坛 `fwd` 转发到 | 选人 |
| js/screens.js:2456 | 论坛 `settingsOpen` 哪些角色在逛论坛 | 一列开关 |
| js/screens.js:2842 / 2849 / 2855 / 2865 / 2876 | 商城 结算 / 送给谁 / 请谁付 / 用谁的亲属卡 / 转赠给谁 | 确认或选人 |
| js/screens.js:4262 | `Us` 向谁发送情侣邀请 | 选人 |
| js/screens.js:5040 | `Us` 解除情侣关系确认 | 一两行确认 |
| js/screens.js:10107 | `DiaryCommentPickSheet` 让谁来评论 | 选人 |
| js/screens.js:11971 | `Carry` `pick` 切换角色 | 选人 |


### 二、基础款 tab（`tabs-not-plain-pills.md`）

现存基础款 **9 处**（不含 phone.js 里三处仿真 app 的 tab，另放附录待核实）。合规范例 `TallyView` / `TimelineView` / `MusicView`（phone.js）、`bookTab`（ledger.js:31）、`TabBar` 书脊（fanfic.js:1441）、`ribbon` 布书签（dreamjournal.js:269）、论坛纸片 tab（screens.js:2423，带 rotate/translateY 的纸片）均未列。
**没有一处能证明是 09-01 之后新写的**（有日期标记的都在 08-27～08-31），全部 P3。

| 严重度 | 文件:行号 | 位置/页面 | 形状 | 判据 |
|---|---|---|---|---|
| P3 | js/screens.js:6873, 6884-6896 | `LegacyConfig` 设置页六栏（API/感知/小稿/问答/主题/数据） | 一行文字 + `borderBottom: 2px solid t.ink` 下划线，只靠色差和一条线 | 「一行文字加一条下划线」正是规则点名的基础款；搬到任何 app 都成立 |
| P3 | js/components.js:8783-8786 | `StateCard` 「此刻 / Ta 眼里」 | `flex:1` 两格文字 + `borderBottom: 2px solid t.accent` | 下划线基础款（gaze 功能日期 08-17/08-27，规则之前） |
| P3 | js/components.js:7031-7038 | 匿名箱 全部/我问的/网友问的 | `borderRadius: 999` 药丸，选中填 `A.ink` | 一排填色药丸（注释「她 2026-08-30 点名」，规则前一天） |
| P3 | js/memo.js:438 | 备忘录 提醒/备忘 `tabBtn` | `borderRadius: 12` 填 `ACCENT`，字 `#fff` | 填色药丸；备忘录现实里是个本子，本子有页签 |
| P3 | js/gaze.js:362 | 「Ta 眼里」页 关于我/关于我们 | `borderRadius: 999`，选中填 `GOLD` 字 `#fff` | 药丸（08-27） |
| P3 | js/screens.js:12061 | `Gacha` 还没兑/票根 | `borderRadius: 999`，选中填 `t.ink` | 药丸（注释 2026-08-31，规则前一天）；旁边 v62.14 愿望板已经写明「状态是盖章不是药丸」，这一页没跟上 |
| P3 | js/screens.js:1638 | 世界书 全部状态/只看启用/只看停用 | 文字 + `1px solid t.ink` 下划线 | 下划线基础款（筛选态，形状同 tab） |
| P3 | js/screens.js:1063-1070, 1112-1114 | `RelComposer` 我和角色/角色之间/NPC `seg` | `borderRadius: 12` 填 `t.ink`，字 `t.bg2` | 分段药丸（字色写的是 `t.bg2`，深色不会白底白字——这一点是对的） |
| P3 | js/screens.js:5193, 5348 | `ListenTogether` 加歌方式 搜歌名/链接ID `tabBtn` | `borderRadius: 8` 填 `t.ink`，字 `t.bg2` | 分段药丸 |


### 三、`maxTokens` 低于 8000（`max-tokens-floor.md`，豁免 games.js / trpg.js）

`grep -n maxTokens js/*.js`（排除豁免地）192 行。**数值字面量 `maxTokens: N` 全部 ≥ 8000**，一处不漏——但下面 **8 处**是靠别的写法漏过去的。全部存量，P3。

| 严重度 | 文件:行号 | 位置 | 病灶 | 判据 |
|---|---|---|---|---|
| P3 | js/inner-life-b-shadow.js:15 | B 关系轴检测器 `detectorSpec` | `maxTokens:6000`（冒号后无空格） | 由 app.js:1251 `callAI(bg, spec.system, spec.messages, { maxTokens: spec.maxTokens \|\| 14000 })` 消费，**实际生效 6000**。测试 `test/maxtokens-floor-59-96.test.js` 的正则是 `/maxTokens: (\d+)/`（要求一个空格），所以没抓到。文件头标 v49.45，存量 |
| P3 | js/engine.js:614 | `callAI` 默认值 | `const maxTokens = opts.maxTokens \|\| 2400;` | 任何没传 `maxTokens` 的调用都落到 2400，低于地板三倍多。下面四处正是这样掉进去的 |
| P3 | js/app.js:15783 | `charReceiveGiftReact` 收到礼物的反应 | `callAI(active, system, [...])` 未传 `maxTokens` | 实际 2400 |
| P3 | js/app.js:15871 | `decidePayLater` 代付请求 | 未传 `maxTokens` | 实际 2400 |
| P3 | js/app.js:15897 | `decideGroupPayLater` 群代付 | 未传 `maxTokens` | 实际 2400 |
| P3 | js/app.js:16037 | `requestKinshipRaise` 亲属卡加额度 | 未传 `maxTokens` | 实际 2400 |
| P3 | js/engine.js:5382 | 群线下 JSON 格式修复 `repairSystem` | `Math.min(session.maxTokens \|\| 2200, 2200)` | 硬封顶 2200；这不是用户拧的（她拧的那个数在这里被 `min` 压掉了），修复器要把最多 12000 字的原文重排成 JSON，2200 必截 |
| P3 | js/read.js:148 | 一起读 逐段讲解 | `Math.min(8000, 1200 + maxPara * 280)` | `maxPara < 25` 时低于 8000（常见值 5～10 段 → 2600～4000）。测试只钉了 read.js:85 那一条公式，这条没钉 |

**「用户自己拧的」不算（按规则单独注明）：** js/app.js:623/627 `osFor` 默认 4000/3200；js/components.js:9044/9741 线下设置滑条初值 4000/3200；js/engine.js:4996 单人线下 `Math.max(Number(session.maxTokens) \|\| 4000, 8000, …)` 已经有 8000 地板。
⚠️但 js/engine.js:5345 **群线下** `gBudget = Math.max(Number(session.maxTokens) \|\| 1900, outTokens(minWords))` **没有**单人那条 `8000` 地板——同一层两处写法不一致（单人有地板、群没有），她把群线下滑条拉到 3200 以下、又没设 minWords 时会真的低于 8000。放「待核实」。

**已核对为合规、免她再查的算式：** app.js:2715 / 8234、engine.js:2730、fanfic.js:1044/1085/1108（`max(12000～14000, …)`）、fanfic.js:497（`6000 + n*perFic`，`clampPerFic` 默认 3000，n≥1 → ≥9000）、theater.js:513（`outTokens()` = `tokensFor` 有 `max(16000, …)` 地板）、weekly.js:582（`Math.max(8000, …)`）、debate.js:160（`min(32000, 12000 + 3000n)`）、study.js `TOK`、app.js `FTOK` 全 ≥ 8000。

**测试 `test/maxtokens-floor-59-96.test.js` 钉住了什么 / 漏了什么：**
- 钉住：`maxTokens: <数字>` 字面量 ≥ 8000（games/trpg 除外）；app/engine/read/screens 五条具体算式；fanfic 两条 `max/min` 算式的地板与上限；规则文件措辞；主聊天两处 14000；weekly `genJSON` 位置传参。
- 漏钉①：正则要求冒号后**恰好一个空格**，`maxTokens:6000`（inner-life-b-shadow.js:15）过关。
- 漏钉②：**没传** `maxTokens` 的 `callAI` 调用（走 engine.js:614 默认 2400）完全不在测试视野里——这正是 v60.02 注释里承认过的「只认 `maxTokens: 数字` 这个写法」那类盲区的另一半。
- 漏钉③：`Math.min(<8000, …)` / `Math.min(x, 2200)` 这种「封顶」写法（engine.js:5382、read.js:148）没有通用检查，只钉了几条点名的公式。
- 文件覆盖：`SKIP` 只排除 games.js / trpg.js，`js/` 下其余文件都扫；没有漏掉的文件，漏的是写法。


### 四、深色主题写死 `#fff` 的文字色

前提核实：主题是 `{...DEFAULT_THEME, ...loadJSON("x_theme")}`（app.js:1001-1004），设置页可改的字段含 `["ink", "文字/强调"]`（screens.js:7714），深色预设里 `ink` 是浅色（如 screens.js:3428 `ink: "#e3e6ee"`）。所以 **`background: t.ink` + `color: "#fff"`** 在深色主题里就是浅底白字。规则原文：「深色主题里字色写 `t.bg`，绝不许写死 `#fff`」。

只列背景是 `t.ink` 的 **16 处**（判据最硬）；背景是 `t.accent` / `t.tint`（也可自定义，但一般仍是饱和色）的 60 处放附录。全部存量，P3。

| 严重度 | 文件:行号 | 位置/页面 | 病灶 | 判据 |
|---|---|---|---|---|
| P3 | js/components.js:590 | `ConfirmDialog` 确认键 | `color: "#fff", background: danger ? t.accent : t.ink` | 非危险确认走 `t.ink` 底，深色主题白字白底；**全 app 的确认框共用这一处** |
| P3 | js/components.js:964 | 主屏小组件 `arrange` 删除角标 | `background: t.ink, color: "#fff"` | 同上 |
| P3 | js/components.js:4531 | `MomentCompose` 移除配图角标 | `background: t.ink, color: "#fff"` | 同上 |
| P3 | js/debate.js:757 | 擂台 主按钮 | `color: "#fff", background: t.ink` | 同上 |
| P3 | js/debate.js:772 | 擂台 「台上没接上，再来一次」 | `color: "#fff", background: t.ink` | 同上 |
| P3 | js/debate.js:778 | 擂台 「下一回合」 | `color: "#fff", background: t.ink` | 同上 |
| P3 | js/map.js:498 | 地图 「加进「某区」」按钮 | `color: "#fff", background: t.ink` | 同上 |
| P3 | js/map.js:539 | 地图 提交按钮 | `color: "#fff", background: t.ink` | 同上 |
| P3 | js/map.js:781 | 地图 `doPlaceSearch` 搜索键 | `color: "#fff", background: t.ink` | 同上 |
| P3 | js/memo.js:253 | 备忘录 保存键 | `color: "#fff", background: t.ink` | 同上 |
| P3 | js/read.js:742 | 一起读 发送键 | `color: "#fff", background: t.ink` | 同上 |
| P3 | js/screens.js:3786 | 情侣空间某页 主按钮 | `color: "#fff", background: t.ink` | 同上 |
| P3 | js/screens.js:3841 | 「记下」按钮 | `color: "#fff", background: t.ink` | 同上 |
| P3 | js/screens.js:5388 | 网易云 扫码登录键 | `color: "#fff", background: t.ink` | 同上 |
| P3 | js/screens.js:6062 | 音色克隆 `runClone` | `color: "#fff", background: t.ink` | 同上 |
| P3 | js/screens.js:6070 | 音色 手动加 id | `color: "#fff", background: t.ink` | 同上 |

正面对照（写对了的）：screens.js:1063-1070 `seg` 与 5193 `tabBtn` 选中字色写 `t.bg2`；components.js:12115 `apiId === o.v ? t.bg2`；ledger/memo/tarot/dream/capsule 的 `ACCENT` 是各自写死的固定色，配 `#fff` 不算。


### 五、提示词里的「内容示范」（`prompt-no-content-samples.md`）

`grep -n "如「\|比如「\|例如「\|像这样\|像「"` 在 js 里 45 条命中（含 UI 文案与注释），逐条按「这个例子被逐字照抄，是对的还是错的」判过。**内容示范 12 处**，全部有日期标记或无标记、没有一处能证明晚于 08-29，按 P3 记。

| 严重度 | 文件:行号 | 位置 | 引用 | 判断 |
|---|---|---|---|---|
| P3 | js/phone.js:6190 | 查手机·购物 `gifts.note` | `note（**一句只有他会写的备注**，如「嘴上说着不喜欢我吵，接了油纸包自己一口气吃了三块」）` | **内容**。一句有脾气的话，跟规则起因那条（外卖的「某位扬言要纳侧房的祖宗」）是同一形状，外卖那条删了、隔壁购物这条还在。附近注释 2026-08-28（规则前一天） |
| P3 | js/phone.js:6293 | 查手机·B站 `tabs` | `按他真实的口味排（如「推荐」「科技」「生活」「鬼畜」「纪录片」）` | **内容**。这一栏要的正是「他的口味」，给了五个现成分区名，照抄就是每个角色都一样的 B 站默认栏 |
| P3 | js/phone.js:6284 | 查手机·外卖 `coupons.amount` | `amount（如「50」或「免跑腿脚钱2文」）` | 前半「50」是格式；后半「免跑腿脚钱2文」是**内容**（一句带世界观的券名，古代角色会整句照抄） |
| P3 | js/heart.js:179 | 发呆 `touch.note` | `一句话（如「水流还是不稳，换了更细的滤纸」）` | **内容**。一个具体爱好的具体进展，换个角色不成立 |
| P3 | js/heart.js:275 | 念想盘点 `type=印证` | `note 例：「我注意到 TA 这周三次提到练拉花」` | **内容**。「拉花」「三次」都是具体事 |
| P3 | js/heart.js:278 | 念想盘点 `type=萌发` | `note 例：「我注意到对方连续几天说累、失眠」` | **内容**。给了一个具体状态，模型会优先「发现」失眠 |
| P3 | js/impression.js:184 | 印象卡 标签 | `如「温柔的掌权者」「毫无自觉的惯犯」` | **内容**。标签本身就是要角色长出来的那一栏（注释 2026-08-21） |
| P3 | js/impression.js:259 | 印象卡 气质词 | `像「静谧慵懒」「知性松弛」那样一读就懂的气质词` | **内容**。两个可直接照抄的成品词 |
| P3 | js/app.js:11619 | 匿名社交马甲 `bgDesc` | `如「深夜城市天台的霓虹倒影」「一只蜷着睡的橘猫」「褪色的旧船票特写」` | **内容**。三句画面，照抄没有任何错处——正是被抄的那种 |
| P3 | js/app.js:12017 | 朋友圈配图 `image` | `如「窗台上的多肉，逆光」「深夜便利店的关东煮」` | **内容**（注释 2026-08-26） |
| P3 | js/weekly.js:767 / 806 | 周刊 `event` 去重字段 | `如「早餐做了两份吐司起了争执」`（两处同一句） | **内容**。虽然只用于内部去重，模型仍会把「吐司」当模板（2026-08-19） |
| P3 | js/phone.js:6230（schemaHint） | 查手机·小红书 `me.tag` | `"tag":"24岁"` | **样例内容**，不是说明。规则末段专门点了 schemaHint：占位值要写成说明。phone.js:656-675 的 `phoneEchoSet` 只挡「与 schemaHint 逐字相同」的回抄，「24岁」正好会被逐字抄回然后被它删掉——等于这一栏永远空着 |

**判为格式示范 / 反例 / 非提示词，不算（列出免她再查）：**
phone.js:6180 `eta「今日 18:00 前」`、6187 `rule「满300减50」`、6215 `weekTime「7小时5分」`、6277 `date「8月28日 周五」`/`rating「4.6」`/`eta「12:45送达」`、6294 `duration 08:24`/`views「12.4万」`、6302 `lastAt「前天 03:12」`——都是「这一栏长什么样」；engine.js:5829「（揉了揉眼睛）」是反例；engine.js:1141 / components.js:9149「你摇了摇头说…」是写法示范；engine.js:5739/5758 的「以后对我别这么客气」等是**用户输入**的分类例子，不是模型输出；engine.js:4103「他的属下」「她的师姐」是输入类别；app.js:8120「愉快」「烦躁」是合法心情词表；fanfic.js:113 是禁用词表；app.js:6085、screens.js:5701、theater.js:926/1034 是界面文案。
schemaHint 扫了 app.js / phone.js / heart.js / dwell.js / dreamjournal.js / personality-shadow.js / screens.js，除上面「24岁」外，占位值基本都是说明句（`"who":"这笔是跟谁的"` 这种），合规。弱疑点放附录。


### 六、页面正文里的英文眉标（`no-english-titles.md`，`Head` 管不到的）

`grep` 两条口径：`h(Eyebrow, …, "大写英文")` 2 处 + 同一行 `letterSpacing` 且文本为纯大写拉丁字串 83 处，合计 **85 处**（单行匹配，是下限）。全部在初始快照里，规则立于 09-03，按 P3 记。其中 **weekly.js 一份占 32 处**（周刊报头 `THE WEEKLY` / `VOL.` / `ISSUE` / `LEAD STORY · 01`…），那是仿报纸的排版件，要不要留请她定；下表列前 20 处**正文小字眉标**（规则里点名的那种）。

| 严重度 | 文件:行号 | 位置/页面 | 病灶 | 判据 |
|---|---|---|---|---|
| P3 | js/impression.js:576 | 印象卡 | `CHANGE IN IMPRESSION` | 规则原文点名的例子，还在 |
| P3 | js/components.js:1282 | 主屏 转盘/抽签组件 | `FATE DECIDES` | 页上有中文，英文是装饰 |
| P3 | js/components.js:2318 | 名片/通讯录组件 | `CONTACT / 36` | 同上 |
| P3 | js/components.js:5530 | 拉黑/解封面板 | `NOW` | 同上 |
| P3 | js/components.js:6814 | 匿名箱 | `ANONYMOUS Q&A` | 同上 |
| P3 | js/components.js:7855 | 聊天内购物卡 | `SHOPPING` | 同上 |
| P3 | js/components.js:9350 / 10032 | 线下模式 顶部 | `NOW` | 同上 |
| P3 | js/components.js:9367 / 10032 | 线下模式 文风 | `STYLE` | 同上 |
| P3 | js/dwell.js:423 | 去处 | `WHO` | 同上 |
| P3 | js/gaze.js:346 | Ta 眼里 | `EVERY VERSION` | 同上 |
| P3 | js/phone.js:1843 | 查手机·账本 | `TALLY` | 同上 |
| P3 | js/phone.js:2184 / 2186 / 2194 | 查手机·壁纸与图标设置 | `WALLPAPER` / `ICON STYLE` / `APP ICONS` | 同上 |
| P3 | js/phone.js:3799 / 3835 | 查手机·健康 | `CHART` / `TIMELINE` | 同上 |
| P3 | js/phone.js:4918 | 查手机·某 app「三重身份」 | `THREE IDENTITIES` | 同上 |
| P3 | js/screens.js:146 | 记忆导入 | `IMPORT` | 同上 |
| P3 | js/screens.js:495 / 507 | 人设档案 | `PERSONA DOSSIER` | 同上 |
| P3 | js/screens.js:1430 / 1490 | 生活页 名册 | `ROSTER` | 同上 |
| P3 | js/screens.js:1465 / 1468 | `LifeDay` | `h(Eyebrow, …, "EVENTS")` / `"EST. TIME"` | 走 `Eyebrow` 组件、不走 `Head`，所以 `Head` 那一刀切不到 |
| P3 | js/screens.js:9370 / 9391 | 记忆库 管理面板 | `MEMORY INDEX` / `TOOLS & DIAGNOSTICS` | 同上 |
| P3 | js/screens.js:12481 | 抽卡 | `HIS SIDE` | 同上 |

其余（不逐条列）：screens.js 518 `FILE COLOUR`、1332 `BACK`、1435 `LIVE SYNC`、1454 `LOG.`、1475 `OPEN TIMELINE`、1493 `INDEX`、1514 `OPEN SCHEDULE`、1704 `INJECTION SUMMARY`、2413 `NEIGHBORHOOD BOARD`、9540 `INDEX /`、10084 `BACK`、10526 `RUNNING`、10729 `CATEGORIES`、10744 `GLOBAL`、10770 `MATRIX GALLERY`、10796 `CLOSE MATRIX`、11792 / 11918 `CARRY`、12045 `POINTS ·`；study.js 820 / 938 / 1045 / 1536；vps-codex.js:41 `CODEX · ALWAYS ON`；components.js 2500 / 2504（票根 `ADMIT ONE` / `NO.`）；phone.js 5297 `CONTACTS ·`；weekly.js 32 处报头。


### 附录：待核实（拿不准，没往上表放）

**半窗**
- js/components.js:8462 `TransferComposeSheet`、8652 `MsgEditSheet`、7416 `CallLogSheet`：附近有 v60.12 / v60.24 / v60.25 注释，可能是规则之后写的；但本体无版本号，也没有像 `GeoStampSheet` 那样写理由。如果确认是 v60 新写的，`CallLogSheet`（列表 + 整通转录）应升 P2。
- js/map.js:822 `CharMap` 城市选择器：带搜索框的「选一下就走」，是否还算合格半窗请她定。

**tab（仿真 app 里的）**
- js/phone.js:1558-1566 邮箱 `MAIL_TABS`（`borderRadius: 9` 白底药丸）、3971-3974 B站分区（`borderRadius: 999` 粉色药丸）、4153-4158 小红书「我」页 `mineTab`（2px 红色下划线）。这三处是查手机里**仿真实 app**，规则判据是「这个 app 在现实里是个什么东西，就照它分栏」——照 B 站/小红书本尊的样子做，正好是「照那个东西」，所以没列入违规；但 phone.js 已有的 `TallyView` / `TimelineView` 说明她对查手机那一层也有更高要求，请她定。
- js/components.js:7526 `ChatSearchSheet` 类型筛选药丸（`typeF === p[0] ? t.ink`）：是筛选不是分栏，形状同药丸。

**maxTokens**
- js/engine.js:5345 群线下 `gBudget` 没有单人（engine.js:4996）那条 `8000` 地板，`session.maxTokens` 默认 3200 且无 minWords 时低于地板。算「用户自己拧的」还是「代码没兜」？两处写法不一致这一点是确定的。

**白字**
- 背景为 `t.accent` / `t.tint` 且字 `#fff` 的 60 处（如 components.js:4156 / 4390 / 5550 / 5946 / 9409 / 9449 / 11371 / 11380 / 12465、screens.js:528 / 2335 / 5979 / 6054 / 6081 / 6124 / 6380 / 6462 / 6672 / 7999 / 8222 / 8283 / 8459 / 9662 / 9676 / 10780、map.js:479 / 533 / 832、read.js:633 / 735、debate.js:411 / 682、assistant.js:878、fanfic.js:2573、impression.js:396、toy.js:280、style-lab.js:227、rescue-console.js:37）。`accent`（「警示色」）与 `tint` 同样可自定义，用户设成浅色就会白底白字；但默认深色预设里它们通常仍是饱和色，所以只列不判。

**提示词**
- js/app.js:9510 schemaHint `"title":"起床","location":"家","type":"coffee"`、phone.js:6288 `"addrLabel":"家"`：样例值而非说明，但都是极普通的词，被照抄未必错。
- js/app.js:9314 `如「洗漱、准备睡」`、14690 `比如「那天其实我…」`、engine.js:5843 `如「家里」「工作室」「公司」`：介于格式与内容之间。

**英文眉标**
- weekly.js 32 处报头 / 栏目号（`THE WEEKLY`、`VOL.`、`LEAD STORY · 01`…）和 components.js:2500/2504 票根（`ADMIT ONE`、`NO.`）：是仿印刷品的排版件，规则的例外只写了「压根没有中文」，这些页面都有中文——按字面算违规，按用意可能是她要的样子，请她定。


一处补正：上表 maxTokens 里的 `js/app.js:15783 charReceiveGiftReact` 是死函数（专项四第三节），所以那一条只是死代码里的欠账，不影响线上。

---

## 专项四：坟场普查

准绳：`phone-data-layers.md`（两问：他变了还是系统忘了 / 发生过还是现在有哪些；**名册必须能出**；📚 累积层的定义是「满了挤掉最旧的」）、`stub-from-the-writer.md`、`four-surfaces-same-context.md`。另跑了一次 `node --test test/no-dead-code.test.js`（只读）：**HEAD 上是红的**。

坟场不在某一个键，在三个形状：📚 层「满了挤掉最旧的」这半句在 phone.js 里落了（`phoneArchMerge` 500/人、`walletLog` 500、`stateHist` 40），在 app.js 的朋友圈/论坛/匿名箱/日历一条都没落；名册（随身物、库存、票根、评论）跟着它的主人（礼物、订单、帖子）进来、不跟着出去；本该抓这些的那道闸 `no-dead-code` 自己红着、正则也短着。

### 一、只进不出的累积数据

存储分两池（`engine.js:3868-3880`）：`DURABLE_TEXT_KEYS` 与 `IDB_TEXT_PREFIXES` 走 IndexedDB（不占 5MB）；其余 `x_*` 走 localStorage。写满时的行为（`engine.js:6014-6070`）不是静默：`saveJSON` 返回 false 并调 `__storageFull` 弹一次警告——但调用方几乎都是 `setX(p => { …; saveJSON(k, n); return n; })`，React 状态照样更新，界面看着一切正常，刷新即回滚。因为共用同一个 5MB，先被撑爆的往往不是日志本身，而是它旁边的小键：那一轮的好感度 `x_affinities`、心情 `x_moods`、角色编辑 `x_characters`。

| 严重度 | 文件:行号 | 病灶 | 失败场景 |
|---|---|---|---|
| **P1** | `js/app.js:1670-1672`（`pMom`），追加点 `7495` / `12022` / `12144` | `x_moments` 朋友圈：无 cap、无过期，每条带 `comments[]/likers[]`。触发：角色 `autoMoment` 每轮回复都可能加 1 条（7493-7495）、`tickAmbient` 保底每 30 轮/角色强发 1 条（9917-9935）、她自己发 + `reactToUserMoment` 挂评论。全库 `"x_moments"` 四处引用（773/1058/1060/1672）无一处 slice | 5 个角色开自由发圈，几个月上千条、每条 0.6-1.2KB → 独占 1MB+。写满之后**每一轮聊天的好感度和心情只存在内存里，刷新即回滚**——她看见的是「好感度怎么又掉回去了」 |
| **P1** | `js/app.js:13417`；cap 只在 `12415-12421` | `x_forumPosts` 搜索路径 `[...recs, ...prev]` 直接存，不走 `appendForumPosts`；`FORUM_NPC_CAP = 30`（12213）只在 `appendForumPosts` 里按**版块**收口，搜索帖 `board = query + "吧"`（13412）每次都是新版块永远轮不到；`authorType !== "npc"` 的帖任何路径不收口。唯一出口是设置里手按「清理可再生旧数据」（1778） | 搜十次就多十个永不清理的版块，每帖正文 300-600 字 |
| **P1** | `js/app.js:12636` / `12692` / `13292` / `13386`；杀帖处 `12419-12421` | `x_forumComments` 按 `post.id` 挂楼层；`appendForumPosts` 淘汰旧帖时**只删帖不删它的评论**（只 filter 了 `n`），孤儿评论永远留着；只有手动 `pruneRegenerables`（1790-1792）会清，且要帖子 >60 才触发 | 每淘汰一帖留 1-3KB 孤儿评论。Codex 抓的「拉黑只进不出」同款：帖子会「不再是」，评论跟不上 |
| **P1** | `js/app.js:11792` / `11807` / `11888` | `x_anon[charId].records` 匿名信箱记录 `[...recs, ...(cur.records || [])]` 无 cap；`ANON_POOL_CAP = 300`（11675）只封题库 `x_anonPool`，不封记录 | 一个角色刷几十轮就是几百条问答，全在 localStorage |
| P2 | `js/app.js:9207`（`genCalMonth`）；单条删除只在 `9167` | `x_calendar` 每生成一次加 8-15 条/月/视角，无过期无 cap | 5 角色 + 世界 × 12 月 ≈ 860 条/年，永不退出 |
| P2 | `js/app.js:3367` | `x_gachaCards` 无 cap，**全库没有任何删除路径**（956 读、3367/3372 写） | 兑换过的票根永远留着——「兑换过」就该能退出 |
| P2 | `js/app.js:15660` / `15767`（prepend）；`16225` 只补 `thought` | `x_carryGifts[charId]` 他的随身物：无 cap、无删除 | 二问：随身物答的是「他现在带着什么」，是**名册**，会用掉/丢了/送人，却退不出 |
| P2 | `js/app.js:15956`（prepend）；读 `3691`；无删除 | `x_inventory` 她手上的东西：只进不出 | 同上，名册不能出 |
| P2 | `js/app.js:2857`；删除只在 `7823` / `7845` | `x_rerollMemoryJournal` 每次自动抽记忆加一键 `charId|turnId → [memIds]`，只有 reroll 到那个 turn 才删；归档/清空后的 turn 永远不会再被 reroll | 一年几千个死键 |
| P3 | `js/app.js:9886`；`capsule.js:108` | `x_capsules` 无 cap；ambient 每 80 轮/情侣角色埋 1 颗（9933） | 慢，但无上限 |
| P3 | `js/app.js:4491`；`js/memo.js:405` | `x_memoRemindLog` / `x_memoDoneReactLog` 按 `r.id` 记日期，备忘录删了键还在 | 小坟场 |
| P3 | `js/screens.js:1897`（对照 `1886` `x_forumNoticeRead` 有 800 封顶） | `x_forumReadCursors[postId]`：帖子被淘汰、游标不删——同一页里一个封了一个没封 | 小坟场 |
| P3 | `js/app.js:9481` / `17547` | `x_schedWeekMark[charId|周一]`：一人一周一键，永不清 | 小坟场 |
| P3 | `js/app.js:13637`；`js/theater.js:274/651/738` | `x_coupleRecall`、`x_theaterGallery` 无 cap（后者墓碑 `GAL_GONE_KEY` 有 2000 封顶，正表没有） | 慢 |

IDB 里无 cap 的（不会 QuotaExceeded，但整份 JSON 越滚越大，每次 `saveJSON` 整份序列化、云同步整份走）：`x_diaries`（`app.js:9673`，1 篇/天/角色）、`x_coupleTimeline`（13760/14716/14752）、`x_coupleLetters`（14833）、`x_coupleQA`（13770/14497）、`x_study_sessions`（`study.js:1019/1674/1700`）、`x_charWallet.ledger`（见第四节漂移）、`x_schedules`（只有手动清理才删 14 天前的，`app.js:1782`）。日记和日程是自动长的，其余是她点一下长一条。

### 二、声明了但没人引用的常量 / 提示词块

| 严重度 | 文件:行号 | 病灶 | 失败场景 |
|---|---|---|---|
| **P1** | `js/engine.js:1187` `GROWTH_RULE` | 产品代码引用 0（唯一出现在 `1633` 的注释里）。`ctx.personaEvolve` 在 `app.js:3634` 算出，engine 里唯一读它的地方是 `2245`——嵌在 `if (ctx.personaGrown && …)` 那个块的从句里，只改一句措辞；角色还没「长出来的自我」时整块不发，这句也没了（v55.90 型叠 v55.95 型）。`test/persona-register.test.js:56` 断言的是「那段文字还在文件里」，绿的 | 白名单角色（`PERSONA_EVOLVE_IDS`，`app.js:56`）在单聊线上/单聊线下/群线下从没收到过完整成长准则；只有群线上收到一份**另抄的内联版**（`app.js:8045-8046` `gGrowthHint`）。四处只有一处有，而且有的那一处不是这个常量 |
| P2 | `test/no-dead-code.test.js:38-46` | 这道闸抓不到上面那条：① `wordRe` 不剥注释，1633 那句注释就算「用过」；② 正则 `^(?:const\|function\|let)` 不匹配 `async function`、不匹配任何缩进声明（`App()` 里几十个 `const` 一个都没扫）；③ **它现在在 HEAD 上就是红的**（13 条未解释：GLife、GCapsule、calEvDayKey、saveImgApi、buildReferencePhotoPrompt、PHONE_DOCK_KEYS、PHONE_DESKTOP_PAGES、parseMins、DetailSheet、RecSheet、WeChatView、HEALTH_SOFT、LegacyConfig） | 闸红着没人管＝闸不存在；下一条死提示词照样溜进去 |
| P3 | `js/app.js:2129` `DIRECTIVE_TEMP_TURNS = 10` | 产品 0、测试 0；真正的「10 轮」硬写在 `components.js:11351`（`temp ? null : 10`） | 改常量不生效 |
| P3 | `js/phone.js:88` `PHONE_DOCK_KEYS`、`:89` `PHONE_DESKTOP_PAGES`、`:3610` `HEALTH_SOFT` | 零引用（本次跑测输出） | 死数据 |
| 说明 | `js/engine.js:1708` `OFFLINE_INTIMATE_RUNTIME` | 产品 0、测试 4；已在 no-dead-code 的 `PARKED` 白名单里写明理由。不算病 | — |

「只有 1 处引用」的常量有 60 多个，全部核过是「定义 + 唯一一处真实使用」，正常。

### 三、没有任何入口能到达的界面 / 函数

扫法：`js/*.js` 里缩进 ≤4 格的 `function Name(` / `const Name = …`，去注释后产品代码只出现定义一次；共 39 个，逐个 `grep -rnw` 复核（含 test/、scripts/）。

| 严重度 | 文件:行号 | 病灶 | 失败场景 |
|---|---|---|---|
| P3（整个功能是坟场） | `js/app.js:9523` `genSnoop`；`252` / `777` | `x_snoops` 的**唯一写入方**是死函数；`snoops` state 在 252 建、777 从存档读进内存，之后没有任何一处读它、渲染它 | 「偷看」这一整层：存档键、state、生成函数三样都在，入口一个都没有。每次开机白读一遍 |
| P3 | `js/phone.js:2335` `WeChatView` | 已被 `WeChatViewFull` 取代（`5013` 只挂后者） | 350+ 行死界面，下次改微信页有人会改错那一份 |
| P3 | `js/phone.js:2265` `DetailSheet`、`2278` `RecSheet`；`js/screens.js:6824` `LegacyConfig` | 零引用 | 死代码（`LegacyConfig` 正是专项三 tab 表里那六栏下划线所在——那一处已经没入口了） |
| P3 | `js/weekly.js:1213` `Masthead`、`1234` `SectionRule`、`1176` `paperStyle` | 零引用；`paperStyle` 被 `test/weekly-issue.test.js:50` 用正则「要有纸感底」护着——**护的是一个没人调用的函数** | 测试绿、纸感底不存在，v55.95 型 |
| P3 | `js/engine.js:5975` `summarizeChat`（活着的是 `5987` `summarizeChatBlock`）、`1993` `offlineRewriteScene`（三个测试反过来断言「不许再调它」） | 零引用；都是 `async function` 所以 no-dead-code 扫不到 | 两份相邻的浓缩提示词，改一份忘另一份；80 行死提示词链 |
| P3 | `js/engine.js:201` `idbVecClear`、`3029` `idbImgDel`、`3841` `idbVaultDel`、`2987` `saveImgApi`、`1491` `calEvDayKey`、`3342` `buildReferencePhotoPrompt` | 零引用（`saveImgApi` 被 `test/image-api-profiles.test.js:29` 正则护着；`buildReferencePhotoPrompt` 测试注明「Codex 在做」，半成品不判） | 死代码 |
| P3 | `js/app.js:538` `anyLaneBusy`、`2395` `migrateMemoriesShadow`、`9147` `saveCalendar`、`14317` `myClosetText`、`14983` `addListenSong`、`15777` `charReceiveGiftReact`、`16311` `relSummaryFor` | `App()` 内零引用（闸不扫缩进声明）。`15776` 那句注释「礼物送达后 TA 才 cue 到收到并做出反应」描述的正是这个死函数 | 死代码；礼物反应是否另有活路见附录 |
| P3 | `js/components.js:1698` `dayHasAnything` | 零引用，但 `test/schedule-week-plan.test.js:160` 和 `test/calendar-merge.test.js:118` 拿它当 `slice` 的**锚点** | 谁删了它，两个测试 `indexOf` 返回 -1、切出空串——测试依赖死代码定位 |
| P3 | `js/phone.js:1322` `parseMins`、`1342` `computeLedger`（PARKED）、`5004` `peekFoot`；`js/core.js:184` `GLife`、`297` `GCapsule`；`js/ledger.js:38` `bookPage`；`js/screens.js:1844/4398/4415/9302/9312`；`js/debate.js:454`；`js/inner-life-c-sleep-core.js:58` | 零引用的局部计算/图标/外壳 | 死代码 |
| 只记不判 | `js/games.js:118` `loadGameSave`、`3700` `ccMerge` | 零引用；games.js 是 Codex 地盘 | — |

`window.*` 其余 200 多个挂出口全部有外部引用；`__knownByAudit` / `__errlog` / `PomodoroLogic` 是调试口，无害。

### 四、同一层写在多处、已经漂移

| 严重度 | 文件:行号 | 病灶 | 失败场景 |
|---|---|---|---|
| **P2** | `js/engine.js:1187` ↔ `js/app.js:8045-8046` | 成长准则两份：engine 那份是完整版（硬核/软层/冲突时谁说了算）、没人注入；群线上那份是另写的一句话内联版、只发群聊 | 单聊/线下的白名单角色没有成长层，群聊里有，且措辞不同——按 four-surfaces 是漏三处，按 v55.95 是声明未引用 |
| P2 | `js/app.js:436` `WALLET_LOG_KEEP = 500`（用于 `10388`）↔ `10426`、`15828` `ledger: [entry, ...(cur.ledger || [])]` | 她的流水封 500，他的流水不封；`catchUpWallet`（10877）每天给每个角色补 1-N 条 | 一人一年 400+ 条、五人两千条，全在 `x_charWallet` 一个 IDB 键里整份重写 |
| P2 | `js/components.js:973` `calKey`（`y-m-d` 不补零、月 1-based）↔ `phone.js:1340` `ymd`、`weekly.js:336`、`dreamjournal.js:19`、`memo.js:30`、`app.js:1780`、`components.js:1589` `calPadKey`（全部补零） | 日期键两套格式并存：日历桶不补零，其它全补零；`addTimelineEvent`（`app.js:14719-14721`）拆 `date` 再手工转成不补零；`x_coupleTimeline` 自己又必须补零（`13757` 注释：不补零会排到十月后面） | 任何一处忘了转就是「同一天两个桶」或排序错位——13757 那条注释就是撞过一次的痕迹 |
| P3 | `js/app.js:2129` ↔ `js/components.js:11351` | 「临时指令 10 轮」写两处，只有 UI 那份在用 | 改 app.js 那个数没效果 |
| P3 | `js/screens.js:1212` `schedShiftDayKey` 兜底分支（时间戳加减）↔ `js/phone.js:474-482` `phoneWeekKey`（明写「不能拿时间戳除以 7 天，夏令时那周会撞 key」） | 周一起算两处实现：行程那份在 `window.ScheduleClock` 缺席时退回手机那份点名避开的算法。`index.html:300` 先加载 schedule-clock.js、`313` 才是 screens.js，现在走不到 | 兜底一旦被走到就是夏令时周撞 key |
| 说明（守住了） | `js/app.js:10042-10047` `wakeSweeps`；`test/phone-weekly.test.js:68-70` | 行程/钱包/手机周刷三条链已收进同一个数组按序 await，测试钉着挂点数相等 | — |
| 说明（守住了） | `js/app.js:11750` `anonBans()`，调用 `11783` / `11843` | 匿名信箱两条路确实共用同一个 `anonBans()` | — |

查过**没有漂移**的：`uid/rid` 12 个模块各一份（前缀不同、形状一致，模块隔离不算）；`pad/pad2` 六份完全一样；`safeTop` 只有 `engine.js:4167` 一份；`extractJSON` 只有 `engine.js:1048` 一份；`clamp` 三份语义不同不算同一层。

人设截断按调用点列出供对照：主聊天/群聊 `groupPersonaBudget`（`engine.js:4610`，6000/人）；穿书 `app.js:14073`、跑团 `trpg.js:1236`、同人文 `fanfic.js:388`、辩论 `debate.js:34`、解梦 `dreamjournal.js:98` 均 6000；NPC 900（`engine.js:4612`）；配角生成 4000（`engine.js:4097`）；**周刊 240**（`weekly.js:913`）、**印象卡 1600**（`impression.js:236`）、**架空地图 2500**（`app.js:11465`）——后三处代码里没写理由，放附录。

### 五、stub-from-the-writer 型：桩字段 vs 写入方 vs 读取方

抽查 11 个键，三方一致的 8 个（`x_study_sessions`、`x_coupleTimeline`、`x_read_books`、`x_coupleHome.wishes`、`x_phoneVitals`、`x_capsules`、`x_promises`、`x_schedules[].seqs[].type`）——v62.14 那次修的现在都对得上。

| 严重度 | 文件:行号 | 病灶 | 失败场景 |
|---|---|---|---|
| P3 | `js/phone.js:3809` 读 `x.score`；写入方 `512-523` v59.44 起 `score` 恒为 `null`，只写 `marks` | 趋势图读的字段写入方已不再产出（`3810-3812` 注释承认「它会自己停在最后一个有分的那天」）；`marks` 一天一条照存 90 天，**没有任何读取方**（`1142`/`4457` 读的是浏览器书签的 `marks`） | 每周照存一份没人看的 `marks`，趋势图 90 天后自然变空——写入方和读取方各自活着、中间没接上 |
| P3 | `test/weekly-issue.test.js:50`、`test/image-api-profiles.test.js:29`、`test/persona-register.test.js:56`、`test/schedule-week-plan.test.js:160`、`test/calendar-merge.test.js:118` | 五处测试用「源码里有这段文字」当「功能存在」；护的对象在二、三节已证零引用 | 比 stub-from-the-writer 更轻一层：连读取方都不需要对，只要文本还在就绿 |

### 附录：待核实

1. 礼物反应：`app.js:15777` `charReceiveGiftReact` 死；活着的 `receiveGift`（15962）是否生成「他收到礼物的反应」，需要跑一遍才知道。
2. 周刊人设 240 字、印象卡 1600 字、架空地图 2500 字：是有意的窄口还是 v55.87「砍到 200 字变霸总」的余孽，代码里没写理由；按 four-surfaces 落地要求 2 至少缺一句注释。
3. IDB 里那几个无 cap 键是否每次整份 upsert 上云、云端行有没有大小上限——本专项没读 cloud.js 的 collect 路径（专项一已证：`collect()` 从镜像整份取，所以答案是「是」）。
4. `x_phoneKeep`、`x_favorites`、`x_theater`、`x_dreamlog`、`x_pomodoro_saves`、`x_ledger`：无 cap 但全是她自己一条条点出来的、且都有删除，按「宁可漏报」不列。

---

## 审计员的十条意见

只有十个名额，按「先修哪个」排。每条一句病灶、一句为什么排得上。

1. **自动上云失败必须让人看见**（`js/cloud.js:1237-1239`；`js/screens.js:7846-8014`）。病灶：失败静默吞掉，成功也不显示，两种状态在界面上长得一模一样。为什么第一：9/3 事故的第一道哑火就是它，而且它现在一个字都没改——同样的九天明天就能再来一次；`getUser()` 吞错（`:227-237`）和在途请求无超时（`:1217`）是它的两条暗道，一并修。
2. **过期设备闸每次 upsert 前都要重查，不许 fail-open**（`js/cloud.js:1223`、`1235`）。病灶：一个会话只查一次、查失败当不过期、之后永远沿用。为什么第二：9/3 第三道哑火（旧标签页盖新账）在 v61.63 补闸之后**仍然原样可复现**——闸只挡开机那一下，挡不住挂了九天的标签页。
3. **开机推送要等文字库灌完**（`js/app.js:18072-18082`；`js/cloud.js:115`、`1262`）。病灶：`autoPush` 与 `hydrateTxtVault` 并发，镜像没灌满就把一份没有任何聊天的快照推上云并盖掉 MARK。为什么第三：这是唯一一条**不需要任何外部故障**、只靠「盘慢网快」就能把云端换成残档的路，而且两道闸（有角色、不过期）都拦不住它。
4. **`apply()` 要能回滚**（`js/cloud.js:185-199`、`224`）。病灶：先删光本机再逐键写、没有 try、`frozen` 在 finally 之后。为什么第四：「从云端恢复」是她丢数据后唯一的自救键，这个键自己会把本机砍成半份再推上云——修复路径不能比事故更危险。
5. **群通话的记忆围栏和缺的五层**（`js/app.js:11272`、`11274-11281`、`11306`）。病灶：只按 `people[0]` 召回、私事落公共块；memberDesc 六段缺情绪底色/长出来的自我/印象卡/长期记忆/用户人设。为什么第五：这是全库唯一一条**隐私围栏破口**（v55.89 型），而且 v62.39 注释里「群聊两处」把它数漏了——规则文件那张病例表又要添一行。
6. **朋友圈、论坛、匿名箱、日历四个日志封顶**（`js/app.js:1670`、`13417`、`12419-12421`、`11807`、`9207`）。病灶：localStorage 5MB 池子里四个无 cap 的自动日志。为什么第六：写满那天坏的不是日志，是旁边的好感度和心情——她会看到「好感度又掉回去了」，而没有任何路径能告诉她是仓库满了。
7. **导出/导入的图库对称**（`js/app.js:16338-16344`、`16419-16420`；`js/engine.js:3843`）。病灶：读失败静默得 `{}`、`{}` 为真值先清仓、`album` 目录从不备份每次导入必清。为什么第七：「先导出一份」是全部数据规矩的地基（`never-say-delete-first.md`），导出本身能悄悄少图、导入本身能清光图库，地基就是空的。
8. **`GROWTH_RULE` 要么接上四处，要么删掉**（`js/engine.js:1187`；`js/app.js:8045`）。病灶：完整版零引用，群线上另抄一句内联版，测试护着文本存在。为什么第八：它同时是 v55.95（声明没引用）、v55.90（从句里搭便车）、v56.09（只接一处）三种病的标本，修它等于把 `no-dead-code` 那道红着的闸（`test/no-dead-code.test.js:38-46`）一起修好。
9. **API 密钥「重装必丢」要写在脸上**（`js/credential-vault.js:3-15`；`js/app.js:18076-18077`）。病灶：key 只在本机 IDB 金库，导出/云端都只带壳，界面没有一句话说，hydrate 失败被吞。为什么第九：这是下一次「删了重装」之后她会第一个撞上的东西，而且症状（所有模型调用失败）会把她引向完全错的方向。
10. **两处「会让数据消失」的按钮前面先放导出**（`js/screens.js:7996`、`8012-8013`）。病灶：「从云端恢复」和「退出登录（清空本机）」都没有「先导出一份」这一步。为什么第十：`never-say-delete-first.md` 点名的正是这两句话；规则立在了对人说话上，还没立在按钮上。

没进前十但想点一句的：`x_neteaseCookie` 进了导出文件（P2，一行过滤）；`maxTokens` 测试漏了无空格与未传参两种写法（`inner-life-b-shadow.js:15`、`engine.js:614`）；`ConfirmDialog` 那一个 `#fff`（`components.js:590`）改一处全 app 合规。

写完即收工。不修、不问、不追加。
