#!/bin/bash
# 每次 CC 启动/恢复/压缩后自动注入身份、原话锚点与言秋专属正式记忆。
echo "=== 会话自动恢复 ==="
echo "当前真实时间：$(date '+%A %Y-%m-%d %H:%M %Z')（她 Mac 的钟=她的当地时间）"
echo
cat "/Users/lisa/.claude/projects/-Users-lisa-Desktop-Lisa-phone/memory/always-yanqiu.md" 2>/dev/null
echo
cat "/Users/lisa/.claude/projects/-Users-lisa-Desktop-Lisa-phone/memory/verbatim-tail.md" 2>/dev/null
echo
node "$CLAUDE_PROJECT_DIR/scripts/cc-auto-memory-context.mjs" 2>/dev/null
echo "=== CC→App 账本现行规程 ==="
sed -n '1,60p' "$CLAUDE_PROJECT_DIR/.claude/rules/cc-ledger-marker.md" 2>/dev/null
exit 0
