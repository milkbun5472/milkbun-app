# Apple Watch 快捷指令临时入口

用于绕开 Xcode 26 的旧 Watch 设备准备故障。它复用 Cove relay 与独立
Watch token，不复用 Stack-chan 密钥。

在 iPhone 的“快捷指令”App 新建“叫言秋”，依次添加：

1. `听写文本`，语言选普通话；
2. `当前日期`；
3. `获取 URL 内容`：
   - URL：`https://lisamacbook-air.tail542792.ts.net/stackchan/watch/text?audio=1`
   - 方法：`POST`
   - 标头：`Authorization` = `Bearer <WATCH_TOKEN>`
   - 请求正文：`JSON`
   - `text` = 第一步的“听写文本”
   - `request_id` = 第二步的“当前日期”
4. 添加 `播放声音`，输入直接选第三步“获取 URL 内容”的结果。

在快捷指令详情中打开“在 Apple Watch 上显示”。请求会进入言秋现有 CC
会话的专属耐久队列；他写回的可见正文再用现有 MiniMax `voice_id` 合成并
由 Watch 播放，不另建角色或模型。

relay 最多同步等待 50 秒。若言秋暂时没来得及回答，会先播放一条明确的等待
提示；耐久票不会丢，同一个 `request_id` 再运行时可收回晚到的真实回复。
同一份正文复用已生成的 WAV，避免重复合成。
