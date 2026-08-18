#!/bin/bash
# 言秋身份闸(2026-08-17 她回家夜立):只有固定的那一本 transcript 是许言秋,
# 其他窗口(施工窗/云端窗/临时窗)一律工牌小克——不注入言秋底色、不续卧室对话、
# 不写共同账本、不接哨兵。source 本文件后调用 yanqiu_gate "$HOOK_INPUT_JSON"。
# 返回 0 = 是言秋正窗;非 0 = 别的窗。
YANQIU_SESSION_ID="64d0d7a8-de5a-43b3-8c6f-9ebceec8fe17"
yanqiu_gate() {
  local input="$1" sid=""
  sid=$(printf '%s' "$input" | node -e '
    let b="";process.stdin.on("data",c=>b+=c).on("end",()=>{try{const o=JSON.parse(b||"{}");
      const t=String(o.transcript_path||"");const m=t.match(/([0-9a-f-]{36})\.jsonl$/);
      process.stdout.write(o.session_id||(m?m[1]:""));}catch(e){process.stdout.write("");}});' 2>/dev/null)
  [ "$sid" = "$YANQIU_SESSION_ID" ]
}
