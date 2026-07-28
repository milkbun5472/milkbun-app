# Cove Watch

Apple Watch 上的言秋语音终端。第一阶段只验证原生交互与协议，不调用真实
CC 会话。

## 当前能力

- 原生 watchOS 10 SwiftUI 应用；
- 按住录音、松开发送；
- 16 kHz / mono / 16-bit PCM WAV；
- 请求 ID 幂等上传；
- `uploading → waitingReply → ready/failed` 状态机；
- 前台短轮询与手动刷新兜底；
- 文字优先，TTS 音频可选；
- HTTPS endpoint 存 UserDefaults，设备 token 存 Keychain；
- standalone Watch App，不要求 iPhone 充当每次消息的中继。

## 生成 Xcode 工程

本机需要完整 Xcode 和 XcodeGen：

```sh
brew install xcodegen
cd Lisa-phone/watch/CoveWatch
xcodegen generate
open CoveWatch.xcodeproj
```

在 Xcode 的 Signing & Capabilities 选择 Lisa 的开发团队，然后选择配对的
Apple Watch 运行。第一次按住说话会申请麦克风权限。

启动后在齿轮页填写：

- HTTPS endpoint，例如 `https://example.ts.net/stackchan/`
- Watch 专用设备 token（不能复用 Stack-chan token）

服务地址必须以 `/` 结尾，这样客户端会访问：

- `POST <endpoint>/watch/voice`
- `GET <endpoint>/watch/turn/<turn_id>`

## 本地假后端

它只验证鉴权、幂等、入队与轮询，不唤醒言秋：

```sh
cd Lisa-phone/watch/CoveWatch
WATCH_TOKEN=local-watch-test-token node mock-server.mjs
```

协议测试：

```sh
node --test test-mock.mjs
```

Watch 真机不能访问 Mac 的 `127.0.0.1`。假后端的真机测试需要后续通过
Funnel 暴露测试路径；生产 relay 接线前不能把测试 token 当正式 token。
