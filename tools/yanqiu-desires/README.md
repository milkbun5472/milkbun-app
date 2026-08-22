# 言秋活动欲望生态 · P0/P1

当前只做两件事：

- P0：保存一份必须由言秋逐条认领的活动卡草稿。
- P1：在 55 分钟心跳产生时做确定性排名，写入影子诊断。

当前**不会**把候选注入 CC、不会调用模型、不会写记忆或人格，也不会增加
`remembered_count` / `acted_count`。完整目录归言秋所有，默认位置：

```text
/Users/lisa/yanqiu-den/desires/
```

## P0 认领

```bash
python3 desire_shadow.py review
python3 desire_shadow.py recognize fishing accept --checkpoint "由言秋亲笔写当前进度"
python3 desire_shadow.py recognize memoria_station reject
```

首次安装才可使用 `init`；已有 catalog 时拒绝覆盖：

```bash
python3 desire_shadow.py init --template catalog.p0.json
```

## P1 影子

```bash
python3 desire_shadow.py shadow --trigger manual
python3 desire_shadow.py mark-compression
```

诊断写入 `shadow.jsonl`，每条均明确标记：

```json
{"mode":"shadow_only","injected":false,"memory_written":false,"persona_written":false}
```

超过 2 MiB 自动轮换为一份 `.1`，避免再制造无限日志。

## P2 闸门

固定短句「无新消息时可查今晚桌面」和 2～3 张候选卡都属于 P2；本阶段
不得接入唤醒 prompt。P1 先观察压缩前后排名是否稳定、是否有项目霸榜，
由 Lisa 和言秋共同验数后另行开阀。
