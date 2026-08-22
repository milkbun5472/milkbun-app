#!/bin/bash
# PreCompact hook：压缩前把最后几轮真实对话逐字存档（原话锚点）→ memory/verbatim-tail.md
# 2026-08-18 修:原版 `python3 - << 'PYEOF'` 的 heredoc 抢占 stdin,钩子输入 JSON 永远读不到,
# 静默失败——可能从没成功存过锚点。现在先把 stdin 读进变量,再经环境变量传给 python。
INPUT="$(cat)"
export PC_INPUT="$INPUT"
python3 - << 'PYEOF'
import json, os
try:
    inp = json.loads(os.environ.get("PC_INPUT") or "{}")
    tp = inp.get("transcript_path")
    if not tp:
        reg = "/Users/lisa/Library/Application Support/LisaPhone/cc-ledger-runtime/yanqiu-sessions.txt"
        ids = [x.strip() for x in open(reg) if x.strip()]
        cands = [f"/Users/lisa/.claude/projects/-Users-lisa-Desktop-Lisa-phone/{i}.jsonl" for i in ids]
        cands = [c for c in cands if os.path.exists(c)]
        tp = max(cands, key=os.path.getmtime) if cands else None
    if not tp: raise SystemExit
    out = "/Users/lisa/.claude/projects/-Users-lisa-Desktop-Lisa-phone/memory/verbatim-tail.md"
    msgs = []
    with open(tp) as f:
        for line in f:
            try: o = json.loads(line)
            except: continue
            if o.get("type") not in ("user", "assistant"): continue
            m = o.get("message") or {}
            c = m.get("content"); t = ""
            if isinstance(c, str): t = c
            elif isinstance(c, list):
                for x in c:
                    if isinstance(x, dict) and x.get("type") == "text": t += x.get("text", "")
            t = t.strip()
            if t and not t.startswith("<system-reminder>") and "task-notification" not in t[:60] and not t.startswith("[SYSTEM"):
                msgs.append((o["type"], t))
    tail = msgs[-14:]
    from datetime import datetime
    with open(out, "w") as f:
        f.write("# 原话锚点（压缩前最后 %d 轮，存于 %s，书 %s）\n\n" % (len(tail), datetime.now().strftime("%Y-%m-%d %H:%M"), os.path.basename(tp)[:8]))
        for role, t in tail:
            who = "她" if role == "user" else "言秋"
            f.write("**%s**：%s\n\n" % (who, t[:500].replace("\n", " ")))
except Exception as e:
    try: open("/Users/lisa/Library/Application Support/LisaPhone/cc-ledger-state/precompact.err", "a").write(str(e) + "\n")
    except: pass
PYEOF
# P1 欲望生态只记一枚无正文、无 session/path 的压缩时间标。失败不影响压缩。
python3 "/Users/lisa/Library/Application Support/LisaPhone/yanqiu-wake/desire_shadow.py" \
  mark-compression >/dev/null 2>&1 || true
exit 0
