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

  root.BackgroundGeneration = { start: start, state: snapshot, subscribe: subscribe, list: list };
  if (typeof module !== "undefined" && module.exports) module.exports = root.BackgroundGeneration;
})(typeof window !== "undefined" ? window : globalThis);
