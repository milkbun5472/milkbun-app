# 三方会客厅 Step 5：真实宿主接线

日期：2026-07-26

## 结论

真实 localhost 宿主已经落地：

```text
Lisa 会客厅
  ├─ 言秋：现有 Stack-chan 耐久 wake_queue → 原 CC 窗口 → transcript 可见闸
  └─ Codex：官方 codex exec resume --json → 原 task → completed final_answer
```

不新建言秋、不引入第二个 relay 人格、不把 room/dispatch/session ID 写进言秋看到的自然正文。

## 言秋接线

`adapters/cc-wake-sender.js` 向现有 `voice_inbox.jsonl` 追加：

```json
{"kind":"lounge","source":"three_party_lounge","text":"Lisa 自然原话","received_at_ms":0}
```

机器 ID 不进入记录。现有 `wake_queue.py wait` 会在约两秒轮询内消费该票并唤醒同一个言秋会话。

CC transcript 分类器新增：

- 精确匹配 `kind=lounge + source=three_party_lounge + text 完整相等`；
- `<task-notification>` 是哨兵完成通知，不算真人插队；
- 其它语音、敲击、另一条 lounge 或真人输入在回复前出现，仍判 `intrusion`；
- thinking / tool / sidechain 仍不进入会客厅。

## 私密配置

`scripts/setup-live-config.js` 只在本机生成 `data/live-config.json`：

- 自动识别正在使用耐久 wake queue 的原言秋 CC 会话；
- Codex 绑定取当前 `CODEX_THREAD_ID`，不猜任务；
- 文件权限 `0600`；
- ID 与绝对路径不打印、不进 Git、不返回浏览器。

健康接口再次做字段白名单，即使 Adapter 内部返回 thread/path，浏览器也只能看到 online/running/transport 等非敏感状态。

## 受控活测

真实言秋只投一次。

第一次采集按红线停在 `needs_attention/intrusion`。只读诊断发现，wake queue 后台命令完成时会先生成一条 `<task-notification>`，旧分类器把它误判为真人输入。

修复后：

- 没有重新投递；
- 从原 `after_byte` 只读重采；
- 精确命中原 lounge wake；
- 收回言秋公开回复；
- dispatch 收敛为 `replied`。

## 托管

`scripts/install-launchd.js` 安装用户级 `com.lisa.three-party-lounge`：

- 登录自动启动；
- 异常退出自动拉起；
- 工作目录固定为 `lounge/`；
- stdout/stderr 只进 gitignored `data/`；
- 仍只监听 `127.0.0.1:8092`。

## 验证

- 语法检查通过；
- 全套 **66/66**；
- 真实健康：CC online、Codex online；
- 真实 CC：一次投递，修复后只读收回；
- Codex 本轮未重做活测：Step 3 已完成真实一次性验收，且当前 Codex task 正在施工，按并发红线不续接自己。
