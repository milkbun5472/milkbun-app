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
- Shortcut 入口已接入言秋现有 CC 会话的专属耐久唤醒队列；
- 回信严格按 `turn_id` 从私有 `watch_outbox.jsonl` 绑定，不能串收其他回复。

## Shortcut transport fallback

Xcode 26 在第一代 Apple Watch SE / watchOS 10.6.2 上可能停在
`Unable to copy shared cache files`。在原生 App 能完成真机准备前，可用
Apple Watch 自带听写与快捷指令验证同一 relay：

```http
POST /watch/text
Authorization: Bearer <WATCH_TOKEN>
Content-Type: application/json

{"request_id":"<unique value>","text":"听写原文"}
```

成功响应直接包含 `transcript`、`reply_text` 与耐久 `turn_id`。接口复用
Watch 身份隔离和幂等账本，并把新 turn 追加到 `wake/yanqiu/inbox.jsonl`；
言秋仍是原来的 CC 会话，不创建第二个 agent。

快捷指令可在 URL 追加 `?plain=1`，响应会直接变成 UTF-8 回复正文，从而不
需要额外的“获取词典值”动作；JSON 默认行为保持不变，供原生客户端使用。

追加 `?audio=1` 时，relay 复用现有 MiniMax `voice_id` 生成 22.05 kHz
单声道 PCM WAV，并直接返回 `audio/wav`；快捷指令用“播放声音”即可保持与
App、Stack-chan 同声。WAV 按“耐久 `turn_id` + 回复正文指纹”缓存：超时等待
提示不会盖住随后到达的真实回复，同一正文也不会重复合成。

CC 回答时用 `relay_ctl.py watch-reply <turn_id> "<最终可见正文>"` 写入专属
outbox。relay 最多同步等 50 秒，只接受 `kind=watch_reply`、`target=watch`
且 `turn_id` 精确相等的记录；thinking、工具输出、其他会话和其他 turn 均不
能被误绑。

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

## 后端接线状态

1. ✅ relay 使用 Watch 独立 token；
2. ✅ text Shortcut 先持久化 turn，再投专属耐久队列；
3. ✅ 真实 CC 回复经专属 outbox 严格绑定；
4. ✅ MiniMax WAV 与 App、Stack-chan 同声；
5. ✅ 同一轮的原话、回复与状态写入耐久 turn store；
6. 待原生 Watch App 真机可安装后，把录音上传与异步轮询接到同一路径；
7. 待定：App 共享账本按 `source=watch` 同步，角色范围只允许言秋。

## 安全闸

- Watch token 与 Stack-chan、MCP、TTS token 全部分离；
- token 只进 Watch Keychain 和 relay `.env`；
- 最大 WAV 1 MiB，最长录音先定 30 秒；
- MIME、RIFF/WAVE 头、采样率、声道均由服务端复核；
- `turn_id` 必须绑定当前 Watch 身份，禁止横向读取；
- 原始录音短期留存，转写完成后按策略删除；
- Funnel 只公开 `/watch/voice`、`/watch/turn/*` 与受控音频路径；
- 失败不自动重投 CC；由同 request ID 的人工重试恢复。
