# 言秋心跳唤醒：自助排障卡

这套系统有两层，职责不要混：

1. **耐久主时钟**：Mac 上的 `com.lisa.yanqiu-heartbeat` 每分钟检查一次言秋最后一段可见正文；静默约 55 分钟后，往 `wake_inbox.jsonl` 投一张票。Lisa 发消息不会推迟这只钟。
2. **一次性哨兵**：现有的 `wake_queue.py wait` 取到票后退出，借此唤醒原窗口。

## 先看，不要先改

在终端运行：

```bash
cd /Users/lisa/Desktop/lisa-practice/yanqiu-den/stackchan-relay
python3 wake_queue.py status
```

它只显示安全的运行数字，不会打印聊天正文、密钥或 transcript 路径。

- `seconds_until_due` 大于 0：还没到 55 分钟，**不是故障**。
- `overdue_seconds` 大于 0 且 `pending.heartbeat` 大于 0：救援票已投，等哨兵取；这通常表示本回合没有重挂 `wake_queue.py wait`。
- `overdue_seconds` 大于 0 且 `pending.heartbeat` 是 0：看 `last_claim`。这表示票被一次性哨兵取走了；若之后没有新的可见活动，系统十分钟后只补一张 retry 票。
- `awaiting_sentinel: true`：重试票仍在等哨兵，说明上一次醒来后没有把 `wake_queue.py wait` 重挂成功；不要清 cursor，下一次正常回合重挂即可。
- `last_rescued_at` 有值：这次是 Mac 的兜底看门狗救回来的，不是原生发条。

## 言秋每轮该做什么

只做两件事，顺序固定：

1. 先把真正想对 Lisa 说的完整正文发出来。
2. 再在后台重挂一次性哨兵：

```bash
cd /Users/lisa/Desktop/lisa-practice/yanqiu-den/stackchan-relay && python3 wake_queue.py wait
```

不需要调用 `ScheduleWakeup`；它现在被刻意禁用，避免旧工具遗迹把时钟带偏。不要把 shell 路径、诊断、工具回执当作正文；thinking 也不算正文。

心跳票把人叫醒后，不能只在 thinking 里决定“继续睡/去玩”。至少留一个可见落点：自然说一句、发一次墙/论坛动作，或明确记一笔休息。这样 Lisa 才能区分“真的醒过”与“票被取走但没有回应”。

## 这次（2026-08-06）修了什么

- 禁用旧的 `com.lisa.yanqiu-hourly-wake`：它会额外制造一套 60 分钟票，和 55 分钟看门狗混在一起，容易误判。
- 保留唯一的 `com.lisa.yanqiu-heartbeat`：每 60 秒检查一次，但只在该投票时才投。
- 看门狗一旦识别到言秋的 transcript，会固定盯这一扇窗口，不再因为项目目录里别的 CC 窗口更新而改掉言秋的时钟。
- 增加 `status`，用来判断“未到点 / 已投票等哨兵 / 真异常”。
- 票的“领取”与“可见活动”分开记录；领取十分钟后仍没有可见活动时，只补一次耐久重试票，不会无限烧额度。
- cursor、时钟、领取回执迁到 `~/Library/Application Support/LisaPhone/yanqiu-wake`；即使 iCloud 误搬桌面的 `yanqiu-den`，运行状态不会跟着消失。

## 不要做

- 不要清空或手改 `.wake_cursor.json`；会重放历史敲击、语音和心跳票。
- 不要再启用 `com.lisa.yanqiu-hourly-wake`。
- 不要为了修一张没到点的票，连续调用 `ScheduleWakeup` 或创建第二个会话。
- 不要把失败的 CC 回流重新编造一份新方法来绕过验真；保留样本、报告即可。

## 需要 Lisa / Codex 的情况

- `status` 持续逾期且没有待取票；
- launchd 服务被卸载或提示 Python 路径错误；
- 哨兵明明已经在岗、票也被取走，但 CC 原窗口没有被唤醒。

届时把 `wake_queue.py status` 的一行结果和发生时间带来即可；不要贴 `.env`、token 或真实 transcript。
