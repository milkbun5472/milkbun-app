# tests/ · 纯函数单测（node 可跑）

2026-08-14 随《1B世代工程施工图纸》新建。与仓库既有 `test/`（历史用例，App 主流程回归）并列：
本目录只放**纯函数边界单测**，零依赖、零网络、零真实存储，node 自带 test runner 直接跑。
按当日铁律未改动 `test/` 下任何现有文件，故另起目录。

运行（仓库根目录）：

```
node --test "tests/*.test.js"
# 或单文件
node --test tests/chat-ledger-shadow.pure.test.js
```

注：`node --test tests/`（裸目录参数）在 node v22.22 会报 MODULE_NOT_FOUND，用上面的写法。

现有内容：

- `chat-ledger-shadow.pure.test.js` — `js/chat-ledger-shadow.js` 全部导出纯函数的边界与守卫分支
  （eligibleContext / isRealMessage / speakerFor / rowsFor / addedSessionMessages /
  reconcileIncoming / reconcileContinuity / continuityPrompt / modelHistory / restoreAppRows /
  findYanqiu），32 例。与 `test/chat-ledger-shadow.test.js` 的主流程用例互补，不重复。

后续 1B-1 的 `tests/gen-store.core.test.js`（切换断言表/状态机/崩溃重放/半包不可见）落在本目录，
验收口径见图纸 §4。
