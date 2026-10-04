# 存档一律进大仓库（IndexedDB），不许放小仓库（localStorage）

她 2026-10-04 原话：**「以后做东西不准放小仓库！全给我搬过去」**

## 出过的事

Arlota 的地图（`x_worlds`）和几条 API 线路（`x_api`）没了，文字一条没少。
文字早就搬进 IDB 了；地图和线路还挤在 localStorage 那 5MB 里，
满了之后就写不进去——这台手机上剩下的东西照常能用，只有新写的悄悄没存住。

## 现在的规矩（v74.77 起）

1. **所有 `x_` 键默认就进 IDB。** 新功能直接 `loadJSON` / `saveJSON`，什么都不用登记。
   引擎会自己把它放进文字库（`engine.js` 的 `isIdbTextKey`）。
2. 直接写 `localStorage.getItem/setItem("x_…")` 的老代码也不用改：
   `engine.js` 的 `installLsBridge` 在这一个口子上把它们转进 IDB。
   但**新代码还是走 `loadJSON` / `saveJSON`**，别再新写直连。
3. 能留在 localStorage 的只有 `LS_ONLY_KEYS` 那几把——**开机灌库之前就必须读到**的小开关
   （首帧配色、美化 CSS、错误日志、本机凭据）。往里加东西之前先问自己：
   这个值真的要在 React 挂上之前读吗？不是 → 不许加。
4. 别在脚本加载的那一刻（模块顶层）读存档。要读就等 `txtVaultReady()`，
   或者放进组件里（挂载一定在灌库之后）。真漏了也不会丢：引擎会把那把键钉回
   localStorage（`lsPin`，记在本机 `qq_lsPinned`），控制台会喊一声——看见了就去改那段代码。
5. 不带 `x_` 的键（游标、标记）不进存档、不上云、不导出，本来就不归这条管。

## 文字库自己的三条线（改仓库本身时才用得上）

- 文字库内部碰 localStorage 一律用 `lsRaw`，不许用 `localStorage.*`——否则会被转接层转回自己。
- 批量清 localStorage 的地方（云恢复、导入、清空）用 `lsRaw.del`：走转接会连 IDB 那份一起删，
  而那一刻 IDB 里可能正是刚恢复进去的东西。
- 文字库没灌起来时（`txtVaultState().ok === false`），写入只留在内存，绝不落 IDB，
  也不垫进 localStorage——那一刻界面上看到的是空手机，它写下的默认值不能盖掉真存档。
