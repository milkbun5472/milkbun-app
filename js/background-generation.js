// Long-running generation tasks that must survive screen navigation.
// This is intentionally in-memory: leaving a React screen no longer cancels the
// promise, while a full iOS process kill still stops network work honestly.
(function (root) {
  const tasks = new Map();
  const listeners = new Map();

  function snapshot(key) {
    const t = tasks.get(key);
    return t ? {
      key: key, status: t.status, busy: t.status === "running",
      label: t.label || "", progress: t.progress || null,
      result: t.result, error: t.error || null,
      startedAt: t.startedAt || 0, finishedAt: t.finishedAt || 0
    } : { key: key, status: "idle", busy: false, label: "", progress: null, result: null, error: null, startedAt: 0, finishedAt: 0 };
  }

  function emit(key) {
    const s = snapshot(key);
    (listeners.get(key) || []).slice().forEach(function (fn) { try { fn(s); } catch (e) {} });
  }

  function subscribe(key, fn) {
    const list = listeners.get(key) || [];
    list.push(fn); listeners.set(key, list);
    return function () { listeners.set(key, (listeners.get(key) || []).filter(function (x) { return x !== fn; })); };
  }

  function list(prefix) {
    const p = prefix == null ? "" : String(prefix);
    return Array.from(tasks.keys()).filter(function (key) { return !p || key.indexOf(p) === 0; }).map(snapshot);
  }

  function start(key, options, runner) {
    options = options || {};
    const old = tasks.get(key);
    if (old && old.status === "running") return old.promise;
    const task = { status: "running", label: options.label || "生成中", progress: null, result: null, error: null, startedAt: Date.now(), finishedAt: 0, promise: null };
    tasks.set(key, task); emit(key);
    function update(progress, label) {
      task.progress = progress || null;
      if (label) task.label = label;
      emit(key);
    }
    task.promise = Promise.resolve().then(function () { return runner(update); }).then(function (result) {
      task.status = "done"; task.result = result; task.finishedAt = Date.now(); emit(key); return result;
    }).catch(function (error) {
      task.status = "error"; task.error = String((error && error.message) || error); task.finishedAt = Date.now(); emit(key); throw error;
    });
    return task.promise;
  }

  // 页面里那种「结果只放在这一页自己的 state 里」的生成（2026-10-01 全 app 查「离开这页就白跑」）：
  //   划线讲解、快刷点评、测验出题、提纲草稿、开场草稿……她走开，结果没地方放，钱照扣。
  // 用法：生成交给 start(key, …) 跑（不挂在页面上，走开照样跑完）；页面里挂 useTask(key, onDone, onError)，
  //   跑完时这一页开着就当场接住，没开着就等她下次进来那一刻接住——同一个结果只交一次（taken）。
  // ⚠️这一层只保「在 app 里切去别处」：整个 app 被 iOS 掐掉就是掐掉了（上面那句注释说的就是这个），也不自动重试。
  function take(key) {
    const t = tasks.get(key);
    if (!t || t.status === "running" || t.taken) return null;
    t.taken = true;
    return { status: t.status, result: t.result, error: t.error || null };
  }
  function useTask(key, onDone, onError) {
    const R = root.React;
    const [s, setS] = R.useState(function () { return snapshot(key); });
    const cb = R.useRef(null); cb.current = { onDone: onDone, onError: onError };
    R.useEffect(function () { setS(snapshot(key)); return subscribe(key, setS); }, [key]);
    R.useEffect(function () {
      const got = take(key);
      if (!got) return;
      try {
        if (got.status === "done") { if (cb.current.onDone) cb.current.onDone(got.result); }
        else if (cb.current.onError) cb.current.onError(got.error);
      } catch (e) {}
    }, [key, s.status, s.finishedAt]);
    return s;
  }

  root.BackgroundGeneration = { start: start, state: snapshot, subscribe: subscribe, list: list, take: take, useTask: useTask };
  if (typeof module !== "undefined" && module.exports) module.exports = root.BackgroundGeneration;
})(typeof window !== "undefined" ? window : globalThis);
