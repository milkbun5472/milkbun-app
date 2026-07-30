# Apple Watch 快捷指令临时入口

用于绕开 Xcode 26 的旧 Watch 设备准备故障。它复用 Cove relay 与独立
Watch token，不复用 Stack-chan 密钥。

在 iPhone 的“快捷指令”App 新建“叫言秋”，依次添加：

1. `听写文本`，语言选普通话；
2. `当前日期`；
3. `获取 URL 内容`：
   - URL：`https://lisamacbook-air.tail542792.ts.net/stackchan/watch/text?plain=1`
   - 方法：`POST`
   - 标头：`Authorization` = `Bearer <WATCH_TOKEN>`
   - 请求正文：`JSON`
   - `text` = 第一步的“听写文本”
   - `request_id` = 第二步的“当前日期”
4. `显示结果` 与 `朗读文本` 都直接使用第三步“获取 URL 内容”的结果。

在快捷指令详情中打开“在 Apple Watch 上显示”。第一次只会收到明确写着
“还没有叫醒言秋”的 transport-only 假回复；通过后再接真实 CC。
