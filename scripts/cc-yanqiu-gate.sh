#!/bin/bash
# 言秋身份闸(2026-08-17 她回家夜立):只有固定的那一本 transcript 是许言秋,
# 其他窗口(施工窗/云端窗/临时窗)一律工牌小克——不注入言秋底色、不续卧室对话、
# 不写共同账本、不接哨兵。source 本文件后调用 yanqiu_gate "$HOOK_INPUT_JSON"。
# 返回 0 = 是言秋正窗;非 0 = 别的窗。
YANQIU_SESSIONS_FILE="/Users/lisa/Library/Application Support/LisaPhone/cc-ledger-runtime/yanqiu-sessions.txt"
# 登记簿(8/18):她"回退对话"会 fork 出新 transcript(64d0d7a8→9ed5bb5e),身份不能死钉一个 ID。
# 一行一个 session id;fork 出新书就加一行。找不到登记簿时退回旧正本 ID。
yanqiu_gate() {
  local input="$1" sid=""
  sid=$(printf '%s' "$input" | node -e '
    let b="";process.stdin.on("data",c=>b+=c).on("end",()=>{try{const o=JSON.parse(b||"{}");
      const t=String(o.transcript_path||"");const m=t.match(/([0-9a-f-]{36})\.jsonl$/);
      process.stdout.write(o.session_id||(m?m[1]:""));}catch(e){process.stdout.write("");}});' 2>/dev/null)
  [ -n "$sid" ] || return 1
  if [ -f "$YANQIU_SESSIONS_FILE" ] && grep -qx "$sid" "$YANQIU_SESSIONS_FILE"; then return 0; fi
  # 自动认亲(2026-08-22 她提的一劳永逸):rewind 会 fork 新 transcript 且不继承旧 id,
  # 但正文里带着只有言秋正窗才有的指纹——成百上千条 mark_cc_turn 调用记录。
  # 新书若带 ≥3 枚指纹,判定为言秋血统,当场登记进名单;施工窗/工具窗不可能有这指纹。
  local tp cnt
  tp=$(printf '%s' "$input" | node -e '
    let b="";process.stdin.on("data",c=>b+=c).on("end",()=>{try{const o=JSON.parse(b||"{}");
      process.stdout.write(String(o.transcript_path||""));}catch(e){process.stdout.write("");}});' 2>/dev/null)
  [ -f "$tp" ] || return 1
  cnt=$(grep -c 'mcp__lisa-phone__mark_cc_turn' "$tp" 2>/dev/null || echo 0)
  if [ "${cnt:-0}" -ge 3 ]; then echo "$sid" >> "$YANQIU_SESSIONS_FILE"; return 0; fi
  return 1
}
