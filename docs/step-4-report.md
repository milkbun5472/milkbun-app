# 三方会客厅 Step 4：localhost 主持界面

日期：2026-07-26

## 结论

Step 4 已完成：会客厅具备仅监听本机的 HTTP/SSE 服务、移动端友好的主持界面、预算与状态呈现，以及“请言秋说 / 请 Codex 说 / 双方各答一轮 / 立即暂停”四条操作路径。

本步没有对真实 CC 或 Codex 再做外呼。`npm start` 使用两个 Fake Adapter，只承担视觉和交互预览；生产接线继续复用 Step 2/3 已验收的 Adapter，由本机宿主注入。

## 视觉与交互

- 暖纸色单列圆桌，不做三栏工程控制台。
- Lisa 固定粉色并居右；言秋固定灰蓝并居左；Codex 固定炭黑并居左。
- 系统状态只显示为窄灰条，不伪装成人物消息。
- 红色暂停键常驻顶部。
- 预算详情默认折叠，70% / 90% 规则保留。
- “双方各答一轮”必须二次确认，可选择先手，并明确提示最多两次调用、两棒后停止。
- 响应式布局覆盖手机宽度和桌面宽度。

## 本地 API

- `POST /api/rooms`
- `GET /api/rooms/:room_id`
- `POST /api/rooms/:room_id/messages`
- `POST /api/rooms/:room_id/dispatch`
- `POST /api/rooms/:room_id/run-one-each`
- `POST /api/rooms/:room_id/pause`
- `POST /api/rooms/:room_id/stop`
- `POST /api/dispatch/:dispatch_id/retry`
- `POST /api/dispatch/:dispatch_id/abandon`
- `GET /api/rooms/:room_id/events`
- `GET /api/health`

## 安全收口

- 服务绑定 `127.0.0.1`。
- 健康与房间快照不返回 session id、thread id、transcript 路径或密钥。
- 浏览器发消息时提交的 `speaker/origin/origin_message_id` 会被忽略；后端强制生成 Lisa 的新自然正文。
- 请求正文封顶 32 KiB，单条消息封顶 6000 字。
- 静态文件做路径边界检查并发送 CSP、nosniff、no-referrer。
- Codex 未明确确认时，在创建 dispatch 和扣预算前拒绝。
- SQLite 与 adapter spool 已加入 `lounge/.gitignore`。

## 验证

```text
node --check server.js
node --check server-main.js
node --check public/app.js
npm test
```

完整测试：**61/61 通过**。

其中新增 HTTP/SSE 测试 8 条：本地健康脱敏、完整主持链、Codex 确认闸、有限双棒、伪造历史拦截、正文边界、SSE 首包、静态 CSP/路径穿越。
