// 侧滑返回不许把人甩出 App（她 2026-09-14 转述朋友：「加了主屏幕还是会侧滑掉」）
// ─────────────────────────────────────────────────────────────
// 病根：这个 App 从头到尾只有一个网页，切角色、进设置、开电台，**一次都不往
// 浏览器历史里记**（全库只有 notify.js 的 replaceState，那一处不进栈）。
// 于是安卓的系统返回手势 / 浏览器侧滑退的不是「上一屏」，是**整个 App**：
// 正在打的字、刚发出去还没回来的那一轮，全没了。
// （存档不会丢——localStorage 按域名存，回来还在。丢的是这一瞬间的现场。）
//
// 修法：开机往历史里压一枚哨兵。每接住一次返回就把哨兵补回去，于是历史里永远
// 还剩一格可退，滑不出去。接住之后交给注册进来的那几个处理器——**栈顶先接手**，
// 谁接了就停在谁那儿；一个都没接才算「已经在最外面了」，这时再滑一次才真退出。
//
// ⚠️只压一枚哨兵，不给每一屏各记一条历史：那等于把整套路由重做一遍，而这个 App
// 的屏是十几处 setState 拼出来的，对不齐就会出现「退回去但页面没变」。
// 哨兵这一层只回答一个问题：**这一下返回，谁来接？**

var BACK_EXIT_WINDOW = 2000;   // 连着两下之间隔多久还算「再滑一次」

// 纯判定，好在 node 里核：这一下返回该怎么处置。
// handled = 有处理器接住了吗；lastAt = 上一次落空是什么时候（0 = 没有）。
function backDecide(handled, lastAt, now, window_) {
  if (handled) return "handled";
  var w = window_ == null ? BACK_EXIT_WINDOW : window_;
  if (lastAt && now - lastAt < w) return "exit";
  return "hint";
}

(function () {
  if (typeof window === "undefined") return;
  var MARK = "__milkbunBack";
  var stack = [];       // 处理器，后进的在栈顶
  var armed = false;
  var exiting = false;
  var lastAt = 0;
  var hint = null;

  function seed() {
    try { window.history.pushState(Object.assign({}, window.history.state, { __milkbunBack: 1 }), ""); } catch (e) {/* 没有 history 就算了 */}
  }
  function runStack() {
    for (var i = stack.length - 1; i >= 0; i--) {
      var took = false;
      try { took = stack[i]() === true; } catch (e) { took = false; }
      if (took) return true;
    }
    return false;
  }
  // 退出没退成（历史前面没东西了）时把保护装回去。arm 自己会判重，装第二次也不会叠哨兵。
  function recover() {
    if (armed) return;
    try { window.BackGuard.arm({}); } catch (e) {/* 装不回去就算了，总比死循环强 */}
  }
  function onPop() {
    if (exiting) {
      // 旧版本刷新可能已叠了数枚哨兵，退完这些再离开，不能提前拆掉保护。
      if (window.history.state && window.history.state[MARK]) { window.history.back(); return; }
      armed = false; exiting = false; lastAt = 0;
      window.removeEventListener("popstate", onPop);
      try { window.history.back(); } catch (e) {/* 退不出去就靠下面那道兜回来 */}
      // ⚠️这一下【可能什么都没发生】：历史里前面已经没有别的页了（直接打开这个
      //   网址、或者已经是这个标签页的第一条），back() 不会触发 popstate，人还在原地。
      //   那时保护已经拆了：监听摘掉、哨兵也没了，再滑一次就真的直接出去，
      //   连「再滑一次退出」都不会提示。所以等一下还在的话就把保护装回去。
      // ⚠️走 window.setTimeout 而不是全局那个：这个文件会被塞进只给了 window 的沙箱里跑，
      //   裸 setTimeout 在那儿是未定义，直接抛在 popstate 处理器里、把整条返回链打断。
      if (typeof window.setTimeout === "function") window.setTimeout(recover, 600);
      return;
    }
    var act = backDecide(runStack(), lastAt, Date.now(), BACK_EXIT_WINDOW);
    if (act === "exit") {
      exiting = true;
      onPop();
      return;
    }
    seed();
    if (act === "handled") { lastAt = 0; return; }
    lastAt = Date.now();
    if (typeof hint === "function") { try { hint(); } catch (e) {/* 提示挂了不影响拦截 */} }
  }

  window.BackGuard = {
    MARK: MARK,
    EXIT_WINDOW: BACK_EXIT_WINDOW,
    decide: backDecide,
    // hint：一个都没人接住时说一句「再滑一次退出」。不传就静默拦一下。
    arm: function (opts) {
      hint = (opts && opts.hint) || hint;
      if (armed) return;
      armed = true;
      exiting = false; lastAt = 0;
      // 刷新/恢复同一条历史时复用哨兵，不叠加另一条。
      if (!(window.history.state && window.history.state[MARK])) seed();
      window.addEventListener("popstate", onPop);
    },
    // 注册一个处理器：返回 true = 我接住了。返回的函数用来注销。
    push: function (fn) {
      if (typeof fn !== "function") return function () {};
      stack.push(fn);
      return function () {
        var i = stack.indexOf(fn);
        if (i >= 0) stack.splice(i, 1);
      };
    },
    _depth: function () { return stack.length; }
  };
  // 从站外返回命中浏览器页面缓存时，React 不会重新挂载；恢复保护但不叠哨兵。
  window.addEventListener("pageshow", function (event) {
    if (event.persisted) window.BackGuard.arm({});
  });
})();

if (typeof module === "object" && module.exports) module.exports = { backDecide, BACK_EXIT_WINDOW };
