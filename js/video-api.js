// MiniMax 视频：独立配置，创建任务只由用户点击；任务编号持久化，恢复只查询。
(function (g) {
  "use strict";
  const CONFIG = "x_videoApi", MEDIA = "x_pomodoro_media", JOBS = "x_pomodoro_video_jobs";
  const DEFAULT = { enabled: false, baseUrl: "https://api.minimax.io", apiKey: "", model: "MiniMax-H3", resolution: "768P", duration: 4 };
  const MODELS = ["MiniMax-H3", "MiniMax-H3-Max", "MiniMax-Hailuo-2.3-Fast", "MiniMax-Hailuo-2.3", "MiniMax-Hailuo-02", "I2V-01-live", "I2V-01-Director", "I2V-01"];
  const MOTION = "[Static shot] 人物保持原来的位置，轻轻呼吸、自然眨眼，头发轻微摆动，动作幅度很小，最后回到初始姿态，适合循环播放。";
  function base(value) { return cleanBaseUrl(value).replace(/\/v[12](?:\/.*)?$/i, ""); }
  const isV2 = model => model === "MiniMax-H3" || model === "MiniMax-H3-Max";
  const resolutions = model => model === "MiniMax-H3" ? ["768P", "2K"] : model === "MiniMax-H3-Max" ? ["768P", "480P"] : model.startsWith("I2V-") ? ["720P"] : ["768P", "1080P", ...(model === "MiniMax-Hailuo-02" ? ["512P"] : [])];
  const durations = (model, resolution) => isV2(model) ? Array.from({ length: model === "MiniMax-H3" ? 12 : 11 }, (_, i) => i + (model === "MiniMax-H3" ? 4 : 5)) : model.startsWith("I2V-") || resolution === "1080P" ? [6] : [6, 10];
  function normalize(raw) {
    const c = Object.assign({}, DEFAULT, raw || {}); c.baseUrl = base(c.baseUrl); c.apiKey = String(c.apiKey || "").trim();
    if (!MODELS.includes(c.model)) c.model = DEFAULT.model;
    if (!resolutions(c.model).includes(c.resolution)) c.resolution = resolutions(c.model)[0];
    const allowed = durations(c.model, c.resolution); c.duration = allowed.includes(Number(c.duration)) ? Number(c.duration) : allowed[0];
    return c;
  }
  const load = () => normalize(loadJSON(CONFIG, {}));
  function save(patch) { const c = normalize(Object.assign(load(), patch)); if (!saveJSON(CONFIG, c)) throw Error("视频设置没有保存成功"); return c; }
  const ready = c => !!((c || load()).enabled && (c || load()).apiKey && /^https?:\/\//.test((c || load()).baseUrl));
  function patchMap(key, id, value) { const m = loadJSON(key, {}); if (value == null) delete m[id]; else m[id] = value; if (!saveJSON(key, m)) throw Error("没有保存成功，请检查本机存储空间"); return value; }
  const media = id => loadJSON(MEDIA, {})[id] || null;
  const job = id => loadJSON(JOBS, {})[id] || null;
  function openStore() { return new Promise((resolve, reject) => { const r = indexedDB.open("x_companion_video", 1); r.onupgradeneeded = () => r.result.createObjectStore("video"); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); }
  async function blobOp(key, value, remove) {
    const db = await openStore();
    try { return await new Promise((resolve, reject) => { const tx = db.transaction("video", value || remove ? "readwrite" : "readonly"), st = tx.objectStore("video"); const rq = remove ? st.delete(key) : value ? st.put(value, key) : st.get(key); let result; rq.onsuccess = () => { result = rq.result; }; tx.oncomplete = () => resolve(result || null); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error || Error("视频保存中断")); }); }
    finally { db.close(); }
  }
  async function request(c, path, body, signal) {
    const controller = new AbortController(), relay = () => controller.abort(); if (signal && signal.aborted) throw new DOMException("已停止等待", "AbortError");
    if (signal) signal.addEventListener("abort", relay, { once: true }); const timer = setTimeout(relay, 45000);
    try {
      const r = await fetch(base(c.baseUrl) + path, { method: body ? "POST" : "GET", headers: Object.assign({ Authorization: "Bearer " + c.apiKey }, body ? { "Content-Type": "application/json" } : {}), body: body ? JSON.stringify(body) : undefined, signal: controller.signal });
      let d; try { const raw = await r.text(); d = JSON.parse(raw.replace(/("(?:task_id|file_id)"\s*:\s*)(\d{16,})(?=\s*[,}])/g, '$1"$2"')); } catch (_) { throw Error("视频接口没有返回可读取的结果（HTTP " + r.status + "）"); }
      if (!r.ok || d.error || (d.base_resp && Number(d.base_resp.status_code) !== 0)) throw Error((d.base_resp && d.base_resp.status_msg) || (d.error && d.error.message) || ("视频接口 HTTP " + r.status));
      return d;
    } catch (e) {
      if (e.name === "AbortError") throw e;
      if (e instanceof TypeError) throw Error("视频接口连接失败，请核对站点和网络；浏览器跨域限制也可能阻止请求"); throw e;
    } finally { clearTimeout(timer); if (signal) signal.removeEventListener("abort", relay); }
  }
  async function imageData(ref) {
    if (/^data:image\/(jpeg|png|webp);base64,/i.test(ref || "") || /^https?:\/\//i.test(ref || "")) return ref;
    const b = String(ref || "").startsWith("iv_") ? await imgVaultFetchBlob(ref) : String(ref || "").startsWith("img_") ? await idbImgGet(ref) : null;
    if (!b) throw Error("原图不在这台设备上，请重新选择图片"); return blobToDataUrl(b);
  }
  async function create(id, imageRef, prompt, signal) {
    const c = load(); if (!ready(c)) throw Error("先开启并填写视频 API"); if (job(id)) throw Error("已有视频任务，请先查询结果或明确放弃");
    const input = await imageData(imageRef); if (!String(prompt || "").trim()) throw Error("写一下想让人物怎么动");
    if (job(id)) throw Error("已有视频任务，请先查询结果或明确放弃");
    const record = { baseUrl: c.baseUrl, model: c.model, protocol: isV2(c.model) ? "v2" : "v1", imageRef, prompt: String(prompt).trim().slice(0, 2000), createdAt: Date.now(), status: "Submitting" };
    patchMap(JOBS, id, record);
    // 超时/断网时不能猜上游没收到：留下 Submitting，不自动补发一笔收费任务。
    const body = record.protocol === "v2" ? { model: c.model, content: [{ type: "text", text: record.prompt }, { type: "image_url", image_url: { url: input }, role: "first_frame" }], duration: c.duration, resolution: c.resolution } : { model: c.model, first_frame_image: input, prompt: record.prompt, duration: c.duration, resolution: c.resolution, prompt_optimizer: false };
    let d; try { d = await request(c, "/" + record.protocol + "/video_generation", body, signal); } catch (e) { if (job(id) && job(id).createdAt === record.createdAt) rememberError(id, e); throw e; }
    if ((signal && signal.aborted) || !job(id) || job(id).createdAt !== record.createdAt) throw new DOMException("已停止等待", "AbortError");
    if (!d.task_id) throw Error("接口没有返回任务编号；请先到控制台核对是否已创建");
    record.taskId = String(d.task_id); record.status = "Preparing"; return patchMap(JOBS, id, record);
  }
  function taskState(record, busy) {
    if (!record) return null;
    const status = String(record.status || "").toLowerCase();
    if (record.draftRef) return { title: "生成完成，等待你选用", detail: "先预览动作，满意后保存；保存后的循环播放不会重新生成。" };
    if (!record.taskId) return { title: busy && !record.lastError ? "正在提交，等待任务编号" : "提交未确认，请核对控制台", detail: "还没拿到任务编号，无法确认是否开始生成或是否失败。请到对应站点控制台核对这次任务；确认后再决定是否放弃记录，避免重复付费。" };
    if (["fail", "failed", "cancelled"].includes(status)) return { title: status === "cancelled" ? "任务已取消" : "生成失败", detail: "这是接口返回的任务状态。任务编号已保留；重新生成是另一笔任务，费用以对应站点为准。" };
    if (["success", "succeeded"].includes(status)) return { title: busy ? "生成完成，正在保存视频" : "生成完成，视频尚未保存", detail: "动画已经生成，但本机还没有保存到视频。点「查询原任务 / 重试下载」重试；如果一直连接失败，可复制原视频链接到 Safari 手动保存，再导入这次任务，不会重新生成。" };
    if (record.lastError && !busy) return { title: "查询暂时中断，生成结果未确认", detail: "连接或查询失败不代表生成失败。任务编号已保留，可以查询原任务；不会重新提交。" };
    const title = ({ preparing: "正在准备画面", queueing: "正在排队", queued: "正在排队", processing: "正在生成动作", running: "正在生成动作" })[status] || "任务已提交，正在查询进度";
    return { title, detail: "已取得任务编号，正在等待原任务。离开后仍保留记录，回来只查询进度。" };
  }
  function rememberError(id, error) {
    const r = job(id); if (r && error.name !== "AbortError") patchMap(JOBS, id, Object.assign({}, r, { lastError: String(error.message || "连接中断").slice(0, 240) }));
  }
  async function createTracked(id, imageRef, prompt, signal) {
    return create(id, imageRef, prompt, signal);
  }
  function taskConfig(record) { const c = load(); if (!c.apiKey) throw Error("先填写视频 API 密钥"); if (base(c.baseUrl) !== record.baseUrl) throw Error("请切回创建这段视频时的站点，再查询原任务"); return c; }
  async function query(id, signal) {
    const record = job(id); if (!record || !record.taskId) throw Error("没有拿到任务编号，请先在控制台核对，避免重复付费");
    if (record.draftRef) return record;
    // 已提交任务沿用当时协议；之后切换模型不能改变原任务的查询地址。
    const v2 = record.protocol === "v2" || (!record.protocol && isV2(record.model));
    const c = taskConfig(record), d = await request(c, v2 ? "/v2/query/video_generation/" + encodeURIComponent(record.taskId) : "/v1/query/video_generation?task_id=" + encodeURIComponent(record.taskId), null, signal);
    if ((signal && signal.aborted) || !job(id) || job(id).taskId !== record.taskId) throw new DOMException("已停止等待", "AbortError");
    const task = v2 ? d.task : d; if (!task || !task.status) throw Error("接口缺少任务状态，请稍后查询原任务");
    record.status = task.status; delete record.lastError; if (!v2 && task.file_id) record.fileId = String(task.file_id); patchMap(JOBS, id, record);
    const status = String(task.status).toLowerCase();
    if (["fail", "failed", "cancelled"].includes(status)) throw Error("视频任务" + (status === "cancelled" ? "已取消" : "生成失败") + "：" + ((task.error && task.error.message) || (typeof task.error === "string" && task.error) || (task.base_resp && task.base_resp.status_msg) || "请修改图片或动作后再试"));
    if (status !== (v2 ? "succeeded" : "success")) return record;
    let url;
    if (v2) url = task.content && task.content.url;
    else {
      if (!record.fileId) throw Error("任务成功但缺少视频文件编号，请稍后查询原任务");
      const f = await request(c, "/v1/files/retrieve?file_id=" + encodeURIComponent(record.fileId), null, signal); url = f.file && f.file.download_url;
    }
    if (!url || !/^https?:\/\//i.test(url)) throw Error("接口没有返回可用的视频下载地址");
    record.downloadUrl = url; patchMap(JOBS, id, record);
    const controller = new AbortController(), relay = () => controller.abort(), timer = setTimeout(relay, 90000);
    if (signal && signal.aborted) { clearTimeout(timer); throw new DOMException("已停止等待", "AbortError"); } if (signal) signal.addEventListener("abort", relay, { once: true });
    try {
      const r = await fetch(url, { signal: controller.signal }); if (!r.ok) throw Error("下载视频失败（HTTP " + r.status + "），可以查询原任务重试下载");
      return await saveDraftFile(id, await r.blob(), record.taskId, signal);
    } catch (e) {
      if (e instanceof TypeError) throw Error("视频下载连接失败，可能是网络或下载站点的跨域限制。可复制原视频链接到 Safari 手动保存，再导入这次任务；不需要重新生成。");
      throw e;
    } finally { clearTimeout(timer); if (signal) signal.removeEventListener("abort", relay); }
  }
  async function saveDraftFile(id, b, taskId, signal) {
    const record = job(id); if (!record || record.taskId !== taskId) throw Error("原任务记录已变化，请重新打开页面");
    if (!b || !b.size || b.size > 100 * 1024 * 1024 || /text|json|image/.test(b.type)) throw Error("请选择 100MB 以内的 MP4 或 WebM 视频文件");
    const head = new Uint8Array(await b.slice(0, 12).arrayBuffer()); const ftyp = String.fromCharCode(...head.slice(4, 8)) === "ftyp", webm = head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3;
    if (!ftyp && !webm) throw Error("文件内容不是 MP4 或 WebM 视频，请选择下载好的视频");
    const ref = "pvideo_" + taskId; await blobOp(ref, new Blob([b], { type: webm ? "video/webm" : "video/mp4" }));
    if ((signal && signal.aborted) || !job(id) || job(id).taskId !== taskId) { await blobOp(ref, null, true); throw new DOMException("已停止等待", "AbortError"); }
    record.draftRef = ref; delete record.lastError; return patchMap(JOBS, id, record);
  }
  async function importTaskVideo(id, file) { const r = job(id); if (!r || !r.taskId || !["success", "succeeded"].includes(String(r.status).toLowerCase())) throw Error("原任务还没有确认生成完成"); return saveDraftFile(id, file, r.taskId); }
  async function queryTracked(id, signal) {
    const previous = job(id); try { return await query(id, signal); } catch (e) { if (previous && job(id) && job(id).taskId === previous.taskId) rememberError(id, e); throw e; }
  }
  function wait(ms, signal) { return new Promise((resolve, reject) => { const stop = () => { clearTimeout(timer); signal.removeEventListener("abort", stop); reject(new DOMException("已停止等待", "AbortError")); }; const timer = setTimeout(() => { if (signal) signal.removeEventListener("abort", stop); resolve(); }, ms); if (signal) { if (signal.aborted) stop(); else signal.addEventListener("abort", stop, { once: true }); } }); }
  async function poll(id, signal, onUpdate) {
    for (let i = 0; i < 120; i++) { const r = await queryTracked(id, signal); if (onUpdate) onUpdate(r); if (r.draftRef) return r; await wait(10000, signal); }
    throw Error("等待较久，任务编号已保留，稍后回来查询即可");
  }
  async function adopt(id) { const r = job(id); if (!r || !r.draftRef || !await blobOp(r.draftRef)) throw Error("还没有可保存的视频"); const previous = media(id); const value = { videoRef: r.draftRef, imageRef: r.imageRef, updatedAt: Date.now() }; patchMap(MEDIA, id, value); patchMap(JOBS, id, null); if (previous && previous.videoRef !== value.videoRef) await blobOp(previous.videoRef, null, true).catch(() => {}); return value; }
  async function importVideo(id, file, imageRef) { if (!file || !/^video\//.test(file.type) || !file.size || file.size > 100 * 1024 * 1024) throw Error("请选择 100MB 以内的视频文件"); const ref = "pvideo_local_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7); await blobOp(ref, file); return patchMap(MEDIA, id, { videoRef: ref, imageRef: imageRef || "", updatedAt: Date.now() }); }
  async function exportVideo(ref) { const b = await blobOp(ref); if (!b) throw Error("视频不在这台设备上，请重新导入备份"); const ext = /webm/.test(b.type) ? "webm" : /quicktime/.test(b.type) ? "mov" : "mp4"; return saveFile(new File([b], "动态陪伴图." + ext, { type: b.type || "video/mp4" })); }
  function useVideoURL(ref) { const [url, setUrl] = useState(""); useEffect(() => { let live = true, own = ""; setUrl(""); if (ref) blobOp(ref).then(b => { if (b && live) { own = URL.createObjectURL(b); setUrl(own); } }).catch(() => {}); return () => { live = false; if (own) URL.revokeObjectURL(own); }; }, [ref]); return url; }
  function LoopVideo({ videoRef, poster, style, controls, controlStyle }) {
    const url = useVideoURL(videoRef), ref = useRef(null), [paused, setPaused] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    useEffect(() => { const mq = window.matchMedia("(prefers-reduced-motion: reduce)"); const sync = () => { const v = ref.current; if (!v) return; if (document.hidden || paused) v.pause(); else v.play().catch(() => {}); }; const motionChange = () => setPaused(mq.matches); sync(); document.addEventListener("visibilitychange", sync); mq.addEventListener("change", motionChange); return () => { document.removeEventListener("visibilitychange", sync); mq.removeEventListener("change", motionChange); if (ref.current) ref.current.pause(); }; }, [url, paused]);
    return h("div", { style: Object.assign({ position: "relative" }, style), "data-pomodoro-video": "", "data-wk": "pomvideostage" },
      url ? h("video", { ref, src: url, poster: resolveImg(poster) || undefined, muted: true, loop: true, playsInline: true, preload: "metadata", onError: () => setPaused(true), style: { width: "100%", height: "100%", objectFit: "cover", display: "block" } }) : poster ? h("img", { src: resolveImg(poster), alt: "陪伴原图", style: { width: "100%", height: "100%", objectFit: "cover" } }) : null,
      controls && url ? h("button", { type: "button", onClick: () => setPaused(!paused), style: Object.assign({ position: "absolute", right: 10, bottom: "calc(env(safe-area-inset-bottom) * 0.4 + 10px)", zIndex: 2, minHeight: 40, padding: "0 12px", border: "1px solid #ffffff88", background: "#24221ecc", color: "#fff", fontFamily: F_BODY }, controlStyle || {}) }, paused ? "播放画面" : "暂停画面") : null,
      !url && videoRef ? h("div", { style: { position: "absolute", bottom: 8, left: 8, right: 8, color: "#fff", background: "#24221ecc", padding: 8, fontSize: 11 } }, "本机视频暂不可用，可在动态陪伴图里重新导入") : null);
  }
  function VideoApiConfig() {
    const t = useTheme(), [c, setC] = useState(load), [err, setErr] = useState("");
    const set = patch => { try { setC(save(patch)); setErr(""); } catch (e) { setErr(e.message); } };
    const input = { width: "100%", minWidth: 0, minHeight: 42, padding: "9px 12px", borderRadius: 6, border: "1px solid " + t.line, background: t.bg, color: t.ink, fontFamily: F_BODY, fontSize: 13 };
    const row = (label, child) => h("div", { style: { display: "block", marginTop: 14, fontFamily: F_BODY, fontSize: 12, color: t.sub } }, h("span", { style: { display: "block", marginBottom: 6 } }, label), child);
    return h("div", { "data-video-api-config": "" },
      h("p", { style: { fontFamily: F_BODY, fontSize: 12, lineHeight: 1.8, color: t.sub } }, "给图片制作一段动态陪伴画面。视频接口独立配置；只有点击生成才创建收费任务，满意后保存，循环播放不再调用。"),
      row("开启视频生成", h("input", { type: "checkbox", "aria-label": "开启视频生成", checked: c.enabled, onChange: e => set({ enabled: e.target.checked }), style: { width: 22, height: 22 } })),
      row("站点（与密钥申请站点配对）", h("div", { style: { display: "grid", gap: 6 } }, MINIMAX_API_SITES.map(([name, url]) => h("button", { key: url, "aria-label": name, type: "button", onClick: () => set({ baseUrl: url }), "aria-pressed": c.baseUrl === url, style: Object.assign({}, input, { textAlign: "left", borderLeft: (c.baseUrl === url ? "5px" : "1px") + " solid " + (c.baseUrl === url ? t.accent : t.line) }) }, name)))),
      row("接口地址", h("input", { "aria-label": "视频接口地址", value: c.baseUrl, onChange: e => set({ baseUrl: e.target.value }), placeholder: "https://api.minimax.io", style: input })),
      row("视频 API 密钥", h("input", { type: "password", "aria-label": "视频 API 密钥", autoComplete: "off", value: c.apiKey, onChange: e => set({ apiKey: e.target.value }), placeholder: "填写对应站点的 API Key", style: input })),
      row("视频模型", h("select", { "aria-label": "视频模型", value: c.model, onChange: e => set({ model: e.target.value, resolution: resolutions(e.target.value)[0], duration: durations(e.target.value, resolutions(e.target.value)[0])[0] }), style: input }, MODELS.map(m => h("option", { key: m, value: m }, m)))),
      row("画质", h("select", { "aria-label": "视频画质", value: c.resolution, onChange: e => set({ resolution: e.target.value }), style: input }, resolutions(c.model).map(r => h("option", { key: r, value: r }, r)))),
      row("时长", h("select", { "aria-label": "视频时长", value: c.duration, onChange: e => set({ duration: Number(e.target.value) }), style: input }, durations(c.model, c.resolution).map(n => h("option", { key: n, value: n }, n + " 秒")))),
      h("p", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.7 } }, "H3 可选 4～15 秒，H3 Max 可选 5～15 秒；旧型号保留原时长。H3 官方站直连可能被浏览器跨域拦截，此时接口地址需填写支持 MiniMax V2 的中转地址。密钥与语音设置分别保存。到番茄钟的「动态陪伴图」制作和预览；模型是否开放、费用以对应站点账户为准。"),
      err ? h("p", { role: "alert", style: { color: t.accent } }, err) : null);
  }
  function PomodoroVideoEditor({ character, onBack, onSaved, toast }) {
    const t = useTheme(), id = character.id, existing = media(id);
    const [imageRef, setImageRef] = useState(() => { const r = job(id); return (r && r.imageRef) || (existing && existing.imageRef) || character.refPhoto || character.avatarImage || ""; });
    const [imageURL, setImageURL] = useState(""), [motion, setMotion] = useState(() => (job(id) || {}).prompt || MOTION);
    const [scene, setScene] = useState("坐在桌边安静陪我专注，半身构图，保留人物原来的长相与画风。");
    const [record, setRecord] = useState(() => job(id)), [busy, setBusy] = useState(false), [message, setMessage] = useState("");
    const [configOpen, setConfigOpen] = useState(false), controller = useRef(null), working = useRef(false), live = useRef(true), savedScroll = useRef(0), scroller = useRef(null);
    const localVideo = useRef(null), imagePicker = useRef(null), taskVideoPicker = useRef(null);
    useEffect(() => { live.current = true; return () => { live.current = false; if (controller.current) controller.current.abort(); }; }, []);
    useEffect(() => { let active = true; imageData(imageRef).then(url => { if (active) setImageURL(url); }).catch(() => { if (active) setImageURL(""); }); return () => { active = false; }; }, [imageRef]);
    useEffect(() => { if (!configOpen && scroller.current) scroller.current.scrollTop = savedScroll.current; }, [configOpen]);
    const report = value => { if (live.current) setMessage(value); };
    const run = async action => {
      if (working.current) return; working.current = true; setBusy(true); setMessage(""); const ac = new AbortController(); controller.current = ac;
      try { await action(ac.signal); }
      catch (e) { if (e.name !== "AbortError") report(e.message || "暂时没有完成，请稍后再试"); }
      finally { working.current = false; if (live.current) { setBusy(false); setRecord(job(id)); } }
    };
    const update = r => { if (live.current) { setRecord(r); report(r.draftRef ? "生成好了，看看动作喜欢吗？" : ({ Preparing: "正在准备画面…", Queueing: "正在排队…", Processing: "正在生成动作…", queued: "正在排队…", running: "正在生成动作…", succeeded: "正在保存视频…", Success: "正在保存视频…" }[r.status] || "正在查询原任务…")); } };
    const inspect = signal => poll(id, signal, update);
    // 自动恢复只读已有任务，不调用创建接口，也不会重做已经存好的视频。
    useEffect(() => { const r = job(id); if (r && r.taskId && !r.draftRef && !["fail", "failed", "cancelled"].includes(String(r.status || "").toLowerCase())) run(inspect); }, [id]);
    const createVideo = () => run(async signal => { const r = await createTracked(id, imageRef, motion, signal); update(r); await inspect(signal); });
    const storeImage = async b => {
      if (!b || !/^image\/(jpeg|png|webp)$/.test(b.type) || b.size >= 20 * 1024 * 1024) throw Error("请选择小于 20 兆的图片（支持 jpg / png / webp）");
      const data = await blobToDataUrl(b), dims = await new Promise((resolve, reject) => { const im = new Image(); im.onload = () => resolve([im.naturalWidth, im.naturalHeight]); im.onerror = () => reject(Error("图片无法读取")); im.src = data; });
      if (Math.min(...dims) <= 300 || dims[0] / dims[1] < .4 || dims[0] / dims[1] > 2.5) throw Error("图片短边要大于 300 像素，宽高比例请在 2:5 到 5:2 之间");
      const ref = await imgToVault(data); if (!String(ref).startsWith("iv_")) throw Error("原图保存失败，请检查本机存储空间"); return ref;
    };
    const chooseImage = e => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) run(async () => { const ref = await storeImage(f); if (live.current) setImageRef(ref); report("原图已选好，点生成才会制作视频。"); }); };
    const generateImage = () => run(async () => {
      if (!scene.trim()) throw Error("先写一下想要的画面");
      const out = await generateSelfieImage(scene.trim(), character.refPhoto || imageRef || null, { singleShot: true, size: "1024x1536" });
      let b = out.blob; if (!b && out.dataUrl) b = dataUrlToBlob(out.dataUrl); if (!b && out.url) { const r = await fetch(out.url); if (!r.ok) throw Error("原图下载失败"); b = await r.blob(); }
      const ref = await storeImage(b); if (live.current) setImageRef(ref); report("新图已保存。喜欢这张图，再点生成动画。");
    });
    const useDraft = () => run(async () => { await adopt(id); onSaved(); toast && toast("这段画面已设为陪伴图，以后一直用它"); onBack(); });
    const forgetJob = () => requestAppConfirm("放弃这次视频任务？", "已经提交的任务不会取消或退款。之后重新生成会另计费；当前已选中的陪伴图保留。", () => { if (controller.current) controller.current.abort(); const old = job(id); patchMap(JOBS, id, null); if (old && old.draftRef && (!media(id) || media(id).videoRef !== old.draftRef)) blobOp(old.draftRef, null, true).catch(() => {}); setRecord(null); setMessage(""); }, "放弃任务");
    const importTask = e => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) run(async () => { const r = await importTaskVideo(id, f); update(r); }); };
    const importLocal = e => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) run(async () => { await importVideo(id, f, imageRef); onSaved(); toast && toast("视频已导入并设为陪伴图"); onBack(); }); };
    const btn = { minHeight: 44, padding: "10px 12px", border: "1px solid " + t.line, background: t.bg2, color: t.ink, fontFamily: F_BODY, fontSize: 12, borderRadius: 3 };
    const input = { width: "100%", minWidth: 0, padding: 12, border: "1px solid " + t.line, background: t.bg2, color: t.ink, fontFamily: F_BODY, fontSize: 13, lineHeight: 1.7, borderRadius: 3 };
    const heading = text => h("div", { style: { fontFamily: F_DISPLAY, fontSize: 16, color: t.ink, margin: "18px 0 8px" } }, text);
    const paper = { backgroundImage: "repeating-linear-gradient(96deg,rgba(120,96,58,.035) 0 2px,transparent 2px 26px),linear-gradient(163deg," + t.bg + "," + t.bg2 + ")" };
    if (configOpen) return h("div", { className: "h-full flex flex-col", style: paper }, h(Head, { zh: "视频 API", bg: "transparent", onBack: () => setConfigOpen(false) }), h("div", { className: "flex-1 min-h-0 overflow-y-auto px-5", style: { paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4 + 24px)" } }, h(VideoApiConfig)));
    const showRef = record && record.draftRef || existing && existing.imageRef === imageRef && existing.videoRef;
    const exportRef = showRef || existing && existing.videoRef;
    const state = taskState(record, busy);
    const showPoster = record && record.draftRef ? record.imageRef : imageRef;
    return h("div", { className: "h-full flex flex-col", "data-pomodoro-video-editor": "", "data-wk": "pomvideoeditor", style: paper },
      h(Head, { zh: "动态陪伴图", bg: "transparent", onBack, right: h("button", { onClick: () => { savedScroll.current = scroller.current ? scroller.current.scrollTop : 0; setConfigOpen(true); }, style: Object.assign({}, btn, { border: "none", background: "transparent", padding: "0 4px" }) }, "接口") }),
      h("div", { ref: scroller, className: "flex-1 min-h-0 overflow-y-auto px-5", style: { paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4 + 24px)" } },
        h("p", { style: { fontFamily: F_BODY, fontSize: 12, lineHeight: 1.8, color: t.sub } }, character.name + " 的画面：选一张喜欢的图，制作一次动画，满意后一直用。点击语音时只播放声音，画面独立循环。"),
        showRef ? h(LoopVideo, { key: showRef, videoRef: showRef, poster: showPoster, controls: true, style: { width: "100%", aspectRatio: "3 / 4", maxHeight: 420, overflow: "hidden", borderRadius: 3, background: t.bg2 } }) : imageURL ? h("img", { src: imageURL, alt: "待制作的陪伴原图", style: { width: "100%", maxHeight: 420, objectFit: "contain", display: "block", background: t.bg2 } }) : h("div", { style: { padding: "40px 20px", background: t.bg2, textAlign: "center", color: t.sub, fontFamily: F_BODY } }, "先放一张人物图在桌上"),
        record && record.draftRef ? h("button", { onClick: useDraft, disabled: busy, style: Object.assign({}, btn, { width: "100%", marginTop: 12, background: t.ink, color: t.bg2 }) }, "满意，就一直用这段") : null,
        h("div", { role: message ? "status" : undefined, style: { fontFamily: F_BODY, fontSize: 12, lineHeight: 1.8, color: t.sub, marginTop: 10, whiteSpace: "pre-wrap", overflowWrap: "anywhere" } }, message || (record && !record.taskId ? "上次提交没有拿到任务编号。请先到 MiniMax 控制台核对，避免重复付费。" : "画面与声音分开保存，视频本体保存在这台设备；换设备前请导出备份。")),
        heading("原图"),
        h("input", { ref: imagePicker, type: "file", accept: "image/jpeg,image/png,image/webp", onChange: chooseImage, hidden: true }),
        h("button", { disabled: busy || !!record, onClick: () => imagePicker.current.click(), style: btn }, "上传图片"),
        h("textarea", { "aria-label": "原图画面描述", value: scene, onChange: e => setScene(e.target.value), disabled: busy || !!record, rows: 3, style: Object.assign({}, input, { marginTop: 10 }) }),
        h("button", { disabled: busy || !!record, onClick: generateImage, style: Object.assign({}, btn, { width: "100%", marginTop: 8 }) }, "用图像 API 生成新图"),
        heading("让它怎么动"),
        h("textarea", { "aria-label": "视频动作描述", value: motion, onChange: e => setMotion(e.target.value), disabled: busy || !!record, maxLength: 2000, rows: 4, style: input }),
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.8, marginTop: 6 } }, "轻动作更适合专注。首尾能否自然衔接，以预览效果为准。当前：" + load().duration + " 秒 · " + load().resolution),
        state ? h("div", { "data-video-task-status": "", role: "status", style: { marginTop: 14, padding: "12px 0", borderTop: "1px solid " + t.line, borderBottom: "1px solid " + t.line, fontFamily: F_BODY, color: t.ink, overflowWrap: "anywhere" } },
          h("div", { style: { fontSize: 14, fontWeight: 600, marginBottom: 6 } }, state.title),
          h("div", { style: { fontSize: 12, lineHeight: 1.8, color: t.sub } }, state.detail),
          record.taskId ? h("div", { style: { fontSize: 11, lineHeight: 1.8, color: t.sub, marginTop: 6 } }, "任务编号：" + record.taskId) : null,
          record.lastError ? h("div", { style: { fontSize: 11, lineHeight: 1.8, color: t.sub, marginTop: 6 } }, "上次请求提示：" + record.lastError) : null) : null,
        !record ? h("button", { disabled: busy || !imageRef, onClick: createVideo, style: Object.assign({}, btn, { width: "100%", marginTop: 12, background: t.ink, color: t.bg2 }) }, busy ? "正在处理…" : "生成动画（按视频接口计费）") : h("div", { style: { display: "grid", gap: 8, marginTop: 12 } },
          record.taskId && !record.draftRef ? h("button", { disabled: busy, onClick: () => run(inspect), style: btn }, busy ? "正在等待原任务…" : "查询原任务 / 重试下载") : null,
          record.downloadUrl && /^https?:\/\//i.test(record.downloadUrl) && !record.draftRef ? h("button", { onClick: async () => { const ok = await copyText(record.downloadUrl); toast && toast(ok ? "链接已复制，切到 Safari 粘贴打开" : "请长按下方链接复制"); report(ok ? "链接已复制。请切到 Safari，粘贴到地址栏打开，保存到文件后回来导入。" : "自动复制没有成功，请长按下面的链接复制，再切到 Safari 打开。"); }, style: btn }, "复制原视频链接（去 Safari 打开）") : null,
          record.downloadUrl && !record.draftRef ? h("div", null,
            h("p", { style: { fontFamily: F_BODY, fontSize: 12, lineHeight: 1.8, color: t.sub } }, "复制链接后切到 Safari，粘贴到地址栏打开；保存到「文件」后回来导入。请在 Safari 打开，原生壳内打开可能触发重新开屏。链接过期可查询原任务更新。"),
            h("input", { "aria-label": "原视频下载链接", type: "text", readOnly: true, value: record.downloadUrl, onFocus: e => e.target.select(), style: Object.assign({}, input, { marginBottom: 8 }) }),
            h("input", { ref: taskVideoPicker, type: "file", accept: "video/mp4,video/webm", hidden: true, onChange: importTask }),
            h("button", { disabled: busy, onClick: () => taskVideoPicker.current.click(), style: Object.assign({}, btn, { width: "100%" }) }, "导入这次任务的视频")) : null,
          h("button", { onClick: forgetJob, style: btn }, record.draftRef ? "不满意，放弃这段" : "放弃任务记录")),
        heading("已有视频也能直接用"),
        h("input", { ref: localVideo, type: "file", accept: "video/mp4,video/webm,video/quicktime", onChange: importLocal, hidden: true }),
        h("div", { style: { display: "flex", flexWrap: "wrap", gap: 8 } },
          h("button", { disabled: busy || !!record, onClick: () => localVideo.current.click(), style: btn }, "导入本机视频"),
          exportRef ? h("button", { onClick: () => run(() => exportVideo(exportRef)), disabled: busy, style: btn }, "导出视频备份") : null,
          existing ? h("button", { disabled: busy, onClick: () => { patchMap(MEDIA, id, null); onSaved(); onBack(); }, style: btn }, "恢复静态头像") : null)));
  }
  g.VideoApi = { load, save, normalize, ready, taskState, create: createTracked, query: queryTracked, poll, adopt, media, job, importVideo, importTaskVideo, exportVideo, blob: blobOp, imageData, patchMap, keys: { CONFIG, MEDIA, JOBS } };
  g.VideoApiConfig = VideoApiConfig; g.PomodoroVideoEditor = PomodoroVideoEditor; g.PomodoroLoopVideo = LoopVideo;
})(window);
