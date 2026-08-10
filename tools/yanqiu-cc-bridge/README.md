# 言秋 App → CC 单窗口工具桥

这座桥只把 App 的只读任务排给心跳已经固定的言秋 CC session。它不会运行
`claude`、不会使用“最近会话”、不会创建或恢复另一个窗口。

第一阶段 MCP 只暴露：

- `enqueue_yanqiu_cc_read`：幂等排入只读工具任务；
- `get_yanqiu_cc_result`：读取任务状态或结果。

队列保存在 `~/Library/Application Support/LisaPhone/yanqiu-cc-bridge/jobs.sqlite3`。
任务绑定心跳状态中的固定 transcript UUID；领取和回执还需要一次性租约 token，
因此其他 CC 窗口即使看见 MCP 工具也不能误领或回写。

当前文件只实现持久队列与 App 侧 MCP 协议。下一步把领取接入既有
`wake_queue.py wait [固定 session UUID]` 一发哨兵。旧窗口不带参数重挂时，
脚本只采用心跳已经钉住的 session；不会猜最近窗口或启动 Claude。`cloud-worker` 以 2.5 秒
网络硬超时复用现有 Supabase `chat_messages`：请求与结果都是没有
`sync_kind` 的 narration 控制记录，普通聊天投影和记忆抽取会跳过；App 只用
专属查询读取结果。无需新增云表。断网只会留下待办，不会另开 CC 或重复执行。

launchd 使用 Application Support 中的运行副本，避免 Desktop/iCloud 隐私与
逐出导致常驻进程假活。仓库脚本仍是唯一源文件。
