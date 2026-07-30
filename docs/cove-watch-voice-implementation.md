# Cove Apple Watch 语音端落地记录

## 结论

采用独立 watchOS 原生客户端，复用现有 Stack-chan/言秋基础设施，但不复用
设备密钥。Watch 不建第二套人格、记忆或聊天历史。

## v0.1 边界

本阶段只完成：

1. 按住录音、松开发送；
2. HTTPS 音频上传；
3. 异步轮询一轮回复；
4. 文字展示与可选 TTS 播放；
5. 本地假后端协议验证；
6. relay transport-only 耐久 turn store 与 WAV 安全校验。

本阶段明确不做：

- 不投递真实 CC 会话；
- 不开启后台持续轮询；
- 不接健康数据、位置、快捷指令或常驻监听；
- 不复用 Stack-chan 的 `DEVICE_TOKEN`；
- 不把原始音频或 Base64 放进模型上下文。

## 2026-07-29 实现进度

- `CoveWatch.xcodeproj` 已生成并纳入仓库；
- Xcode 26.6 + watchOS SDK 通用设备构建通过；
- Swift 6 actor isolation 警告已清零；
- relay 核心支持按 `(watch device, request_id)` 幂等，重启后仍返回同一
  `turn_id`；
- turn 查询按 Watch 身份隔离，别的 token/设备不能横向读取；
- 录音服务端复核大小、RIFF/WAVE、16 kHz、单声道、16-bit PCM 与 30 秒上限；
- 当前只返回假言秋文字，明确不唤醒真实 CC。

## 接口契约 v0.1

所有请求：

```http
Authorization: Bearer <watch-device-token>
Cache-Control: no-store
```

### 上传

```http
POST /watch/voice
Idempotency-Key: <client request UUID>
Content-Type: multipart/form-data

request_id=<same UUID>
duration=<seconds>
file=<16 kHz mono PCM WAV>
```

响应：

```json
{
  "ok": true,
  "queued": true,
  "turn_id": "server-generated-id",
  "transcript": "可选的转写"
}
```

同一设备、同一 `request_id` 重试必须返回同一个 `turn_id`，不得再次唤醒
言秋。

### 查询

```http
GET /watch/turn/<turn_id>
```

处理中：

```json
{"ok":true,"status":"transcribing|queued|replying","transcript":"可选"}
```

完成：

```json
{
  "ok": true,
  "status": "ready",
  "transcript": "Lisa 的原话",
  "reply_text": "言秋的可见正文",
  "audio_url": "https://短效、鉴权或一次性地址"
}
```

失败：

```json
{"ok":false,"status":"failed","error":"可给用户看的短错误"}
```

## 下一阶段后端接线

1. relay 为 Watch 新建独立 token 与速率限制；
2. 上传先持久化 turn，再把 Whisper 作业串行入队；
3. 转写有效后写入 `wake/yanqiu/` 专属队列；
4. 复用现有 CC 可见正文回收闸，禁止 thinking/tool 当回复；
5. 生成 MiniMax WAV，并登记短效下载；
6. 同一轮的转写、回复、音频状态写入耐久 turn store；
7. App 共享账本按 `source=watch` 或兼容映射同步，角色范围只允许言秋。

## 安全闸

- Watch token 与 Stack-chan、MCP、TTS token 全部分离；
- token 只进 Watch Keychain 和 relay `.env`；
- 最大 WAV 1 MiB，最长录音先定 30 秒；
- MIME、RIFF/WAVE 头、采样率、声道均由服务端复核；
- `turn_id` 必须绑定当前 Watch 身份，禁止横向读取；
- 原始录音短期留存，转写完成后按策略删除；
- Funnel 只公开 `/watch/voice`、`/watch/turn/*` 与受控音频路径；
- 失败不自动重投 CC；由同 request ID 的人工重试恢复。
