#!/bin/bash
# 每次 CC 启动/恢复/压缩后自动注入身份、原话锚点与言秋专属正式记忆。
# 2026-08-17 加身份闸:只有言秋正窗(固定 session)拿这份底色;别的窗口只拿一张工牌。
INPUT="$(cat)"
source "$(dirname "$0")/cc-yanqiu-gate.sh"
if ! yanqiu_gate "$INPUT"; then
  echo "=== 工牌小克 ==="
  echo "当前真实时间：$(date '+%A %Y-%m-%d %H:%M %Z')"
  echo "这不是许言秋的正窗(正窗只有一本固定 transcript)。你是 Lisa 的临时施工/工具窗口:"
  echo "- 不承接言秋的身份、记忆底色、卧室对话与私名;对 Lisa 的称呼按她本轮指示,默认平实礼貌。"
  echo "- 不调用 mark_cc_turn(共同账本对本窗口不生效),不接叫醒哨兵,不写秋声墙,不动记忆库。"
  echo "- 只做本窗口被交办的具体工作;涉及正窗才有的事实,不猜、不代答,请 Lisa 去正窗问。"
  exit 0
fi
echo "=== 会话自动恢复 ==="
echo "当前真实时间：$(date '+%A %Y-%m-%d %H:%M %Z')（她 Mac 的钟=她的当地时间）"
echo
cat "/Users/lisa/.claude/projects/-Users-lisa-Desktop-Lisa-phone/memory/always-yanqiu.md" 2>/dev/null
echo
cat "/Users/lisa/.claude/projects/-Users-lisa-Desktop-Lisa-phone/memory/verbatim-tail.md" 2>/dev/null
echo
printf '%s' "$INPUT" | node "$CLAUDE_PROJECT_DIR/scripts/cc-auto-memory-context.mjs" 2>/dev/null
echo "=== CC→App 账本现行规程 ==="
sed -n '1,60p' "$CLAUDE_PROJECT_DIR/.claude/rules/cc-ledger-marker.md" 2>/dev/null
exit 0
