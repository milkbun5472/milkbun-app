# Stack-chan 随身 Remote MCP · Lisa / 言秋适配稿

> 2026-07-19 初稿；2026-07-25 到货后改为 Mac + Tailscale Funnel 方案。参考
> `yebieshi/stackchan-remote-mcp`，但不直接照搬其明文 MQTT / HTTP 照片链路。
> 目标：Stack-chan 跟 Lisa 走手机热点；言秋在 CC 里仍是唯一大脑，远程调用同一具身体，不另起一个代写人格的 LLM。

## 1. 最终体验

- 在家：Stack-chan 连家中 2.4 GHz Wi-Fi。
- 出门：Stack-chan 连 Lisa 手机的 2.4 GHz 兼容热点，不需要家中电脑在线。
- CC 中的言秋可以调用：查看在线状态、换表情、转头/点头、说一句话、拍一张眼前照片。
- 实际发生的面对面对话只追加进 `desk_log`，由 App 收回小克聊天；不直写 `saves`，不制造第二份记忆。
- 远程硬件工具本身不调用 LLM。言秋已经在 CC 里完成思考，工具只负责把动作送到身体，因此每个表情/动作/拍照不额外花一次模型调用。

## 2. 架构定稿

```text
言秋 / CC（唯一大脑）
  ├─ lisa-phone MCP：人格、记忆、事件、App 上下文
  └─ stackchan-remote MCP：身体工具（无人格、无 LLM）
             │ HTTPS + 强鉴权
             ▼
       Mac relay + Tailscale Funnel
        ├─ GET /poll ◄── Stack-chan 主动短轮询（家里 Wi-Fi / 手机热点）
        ├─ POST /event ◄── 敲击与命令执行回执
        └─ Supabase desk_log（仅真实说话回流，append-only）
                                   │
                                   ▼
                              Lisa-phone App
```

CoreS3 不需要加入 tailnet，也不接受入站连接；它只向 Funnel HTTPS 地址主动短轮询。
Mac 留在家中并保持开机、联网、Tailscale 与 relay 运行时，Stack-chan 在手机热点下也能使用。
Mac 离线时设备安静重试，旧命令因 TTL 过期不会补演。

接口细节见 `docs/stackchan-http-contract-v1.md`；固件与刷机见
`firmware/stackchan-cores3/` 和 `docs/stackchan-cores3-flashing.md`。

## 3. 工具契约（到货前可定稿）

| 工具 | 输入 | 输出 | 是否额外调用 LLM |
|---|---|---|---|
| `stackchan_status` | 无 | online、last_seen、电量、网络、当前 sleep phase | 否 |
| `stackchan_face` | `expression` | 已执行/离线排队/拒绝 | 否 |
| `stackchan_move` | `yaw`, `pitch`, `duration_ms` | 限幅后的动作结果 | 否 |
| `stackchan_nod` / `stackchan_shake` | 次数（1~3） | 动作结果 | 否 |
| `stackchan_say` | `text`，可选 `voice_audio_url` | 播放结果；真实对话可追加 `desk_log` | 否（TTS 可能计费） |
| `stackchan_see` | 可选 `reason` | 本次新拍 JPEG 的 MCP image | 否 |

动作安全边界：舵机角度、速度、次数由服务器和固件双重限幅；离线时动作默认不长期排队，避免几个小时后突然执行。只有明确允许的 `say` 可做短时队列。

## 4. 与 Lisa-phone / 人格系统衔接

1. **唯一人格**：Remote MCP 不组角色 prompt、不读取或改写人格，也不自己调用 Fable。言秋先用 `get_xiaoke_context` 接上 App，再调用身体工具。
2. **唯一记忆流**：真实面对面对话由 relay `insert desk_log`；App 现有 `deskFetch → deliverDeskLog → deskConsume` 收回。永不直写 `saves` 或 `memories`。
3. **睡眠闸**：`stackchan_say` 和以后主动发声在生成/播放前读取 `character_sleep_presence`。`asleep` 时不说；用户明确“敲门/叫醒”走 C 模块同版敲门能力。小克现有睡眠豁免照当前产品决定保留，不由 Remote MCP 私自改变。
4. **照片边界**：`stackchan_see` 的照片只为本次工具调用短驻留；不会自动进 Lisa-phone 相册、记忆或 `photo_bridge_index`。Lisa 明确说“保存/分享这张”时才走照片桥。
5. **桌面与随身同一来源标记**：继续使用消息的 `deskTop: true`。以后 UI 名字可从“桌面”改成“实体/Stack-chan”，数据结构不用迁移。

## 5. 安全版与参考仓库的差异

参考仓库的明文 MQTT / HTTP 与可能存在的默认口令 FTP 不进入 Lisa 的版本。
正式版不运行 MQTT：CoreS3 只通过 HTTPS 主动访问 Funnel。

正式版必须满足：

- `/poll` 与 `/event` 全部走 HTTPS；设备校验 CA，并使用绑定单一 device ID 的强随机 Bearer token。
- CoreS3 不开放入站端口、FTP、调试页或裸 MCP；Funnel 只转发 relay 的必要 HTTP 路径。
- 设备 token、MCP token 与 TTS provider secret 彼此独立，均不进 Git。
- `stackchan_see` 加速率限制、审计时间与调用方；拍照时屏幕/LED 明示。
- relay 验证 JPEG magic、Content-Type、尺寸上限；文件权限 `0600`。
- 照片默认读取成功后删除，失败兜底 TTL 10 分钟清理；服务日志不记正文、token 或图片。
- 固件没有 FTP；若以后确需维护，只允许 USB 或局域网临时开启并使用新口令。
- relay secrets 只住 Mac 本地 `0600` env 文件；设备 secrets 只住被 Git 忽略的 `config.local.h`。

## 6. 分步施工与验收

### P0 · 到货后第一轮

- [x] 架构、工具契约、App 回流边界定稿。
- [x] `desk_log` 幂等 SQL 入仓。
- [x] `GET /poll`、`POST /event` 与三种命令 payload 定稿。
- [x] CoreS3 PlatformIO 身体客户端骨架、刷机文档与 launchd 模板入仓。
- [ ] 言秋 relay 对齐 `docs/stackchan-http-contract-v1.md`，生成 device ID 与独立 device/MCP secret。
- [ ] 用 curl/模拟设备验 Funnel 的 204、取命令、过期丢弃与事件幂等。

### P1 · 到货当天（先本地，不碰公网）

- [ ] 核验主控确为 CoreS3、摄像头/舵机型号、出厂固件版本。
- [ ] 备份原固件与 SD 卡。
- [ ] 先备份再刷本仓 CoreS3 客户端；舵机保持关闭，只验屏幕、Wi-Fi、敲击和声音。
- [ ] 核对底座针脚后才开舵机，加入动作双重限幅与实体急停。

### P2 · 随身联网

- [ ] 写入家中 Wi-Fi + 手机热点两个网络；断开家网后 60 秒内自动连热点。
- [ ] HTTPS 轮询、断线重连；切换网络后 device ID 不变。
- [ ] HTTPS 拍照上传；连续两拍以 version + SHA-256 区分。

### P3 · 言秋验收

- [ ] `status → face → nod → see → say` 顺序逐项验。
- [ ] 关机/断网时不误报成功，旧动作不上演。
- [ ] 照片读取后 Mac relay 无残留；未读取照片 10 分钟后清除。
- [ ] 一轮真实对话只产生一行 `desk_log`，App 收到两条带实体标记的消息，重复拉取不叠加。
- [ ] 任意错误 token 均 401/403；公网没有 MQTT、明文照片 HTTP 或裸 MCP 端口。

## 7. 真机前还需要 Lisa 当面确认

- 设备背面/系统页显示的具体型号与出厂固件版本。
- Stack-chan 底座或舵机适配板的型号、接线与电源方式。
- 用 USB 数据线接 Mac 后出现的 `/dev/cu.usbmodem*` 端口。
- 家中 2.4 GHz Wi-Fi 与手机兼容热点（只填设备本地配置，不发聊天、不进 Git）。

其中前三项没核对前，可以编译和模拟接口，但不刷机、不启用舵机。
