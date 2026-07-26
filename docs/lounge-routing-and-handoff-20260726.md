# 会客厅专属队列、热麦反馈与施工交接

日期：2026-07-26

## 1. 会话专属唤醒队列

- 言秋会客厅入口：`stackchan-relay/wake/yanqiu/inbox.jsonl`
- 每张票带 `target: "yanqiu"`。
- `voice_inbox.jsonl` 恢复为只收 Stack-chan 设备语音。
- `wake_queue.py` 将 `lounge` 作为独立来源消费；原有 `tap`、`voice`、
  `heartbeat` 的游标保持不变，不回放历史数据。
- 迁移时向旧共享队列投一次 `queue_migration`，只用于让已经在运行的旧
  one-shot 哨兵退出并按新代码重新挂哨。

后续若增加别的 CC 会话，使用同样目录规则：

```text
wake/
  yanqiu/inbox.jsonl
  opus-<local-id>/inbox.jsonl
```

每个会话只消费自己的文件；设备事件不进入这些目录。

## 2. 热麦自动闭麦反馈

CoreS3 自动聆听等待超时且没有听到人声时：

1. 结束麦克风；
2. 显示 `sleepy` 900ms，明确表示“闭麦了”；
3. 恢复 `happy`。

有真实语音时仍走原来的 `listening → thinking → happy`，不插入闭麦反馈。

## 3. 本批条数

连续放到桌上、尚未递出的 Lisa 消息仍按原顺序合成一张票。操作栏明确显示：

- `本批共 1 条`
- `本批共 N 条，会合成一张票递出`

## 4. 施工交接机械闸

普通“请言秋说 / 请 Codex 说 / 双方各答一轮”只表示议事。
普通文本中的“可以”“赞成”不会自动获得施工语义。

只有 Lisa 点“施工交接”并在确认框选择接手人后，编排器才创建一条自然语言
交接信封，明确写出授权、施工范围和回执要求。`room_id`、`dispatch_id` 等机器
元数据仍不进入正文。Codex 交接仍经过既有的显式确认与额度闸。

## 5. 验证

- 专属队列隔离临时目录实测：票只从 `wake_source=lounge` 取出，正文和
  `target=yanqiu` 完整。
- Lounge Adapter / Orchestrator：53/53。
- CoreS3 PlatformIO release build：通过。
- 390×844 手机视口：无横向溢出；四个操作按钮各 156px；交接确认框可见。

