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
  // ── 厂家（她 2026-10-05：「先接可灵和即梦」）──
  //   MiniMax 的设置照旧摊在顶层（老配置一个字不用改）；可灵、即梦各收在自己那一格里。
  //   字段照官方来源核对：即梦＝火山方舟 Ark 的 contents/generations/tasks（volcengine-python-sdk），
  //   可灵＝/v1/videos/image2video（Vercel @ai-sdk/klingai 适配器）。型号名两家都可以手填，以控制台为准。
  const VENDORS = [["minimax", "MiniMax 海螺"], ["kling", "可灵 Kling"], ["seedance", "即梦 Seedance（火山方舟）"]];
  const KLING_SITES = [["国内 北京", "https://api-beijing.klingai.com"], ["海外 新加坡", "https://api-singapore.klingai.com"]];
  const KLING_MODELS = ["kling-v2-1", "kling-v2-1-master", "kling-v2-5-turbo", "kling-v2-6", "kling-v3", "kling-v2-master", "kling-v1-6", "kling-v1-5", "kling-v1"];
  const ARK_SITES = [["火山方舟 北京", "https://ark.cn-beijing.volces.com/api/v3"], ["BytePlus 海外", "https://ark.ap-southeast.bytepluses.com/api/v3"]];
  const ARK_MODELS = ["doubao-seedance-1-0-pro-250528", "doubao-seedance-1-0-pro-fast-251015", "doubao-seedance-1-0-lite-i2v-250428"];
  const KLING_DEFAULT = { baseUrl: KLING_SITES[0][1], apiKey: "", accessKey: "", secretKey: "", model: KLING_MODELS[0], mode: "std", duration: 5 };
  const ARK_DEFAULT = { baseUrl: ARK_SITES[0][1], apiKey: "", model: ARK_MODELS[0], resolution: "720p", duration: 5 };
  const trimUrl = v => cleanBaseUrl(v).replace(/\/+$/, "");
  function normalize(raw) {
    const c = Object.assign({}, DEFAULT, raw || {}); c.baseUrl = base(c.baseUrl); c.apiKey = String(c.apiKey || "").trim();
    c.vendor = VENDORS.some(v => v[0] === c.vendor) ? c.vendor : "minimax";
    const k = Object.assign({}, KLING_DEFAULT, c.kling || {}); k.baseUrl = trimUrl(k.baseUrl) || KLING_DEFAULT.baseUrl; ["apiKey", "accessKey", "secretKey", "model"].forEach(f => { k[f] = String(k[f] || "").trim(); });
    if (!k.model) k.model = KLING_DEFAULT.model; k.mode = k.mode === "pro" ? "pro" : "std"; k.duration = Number(k.duration) === 10 ? 10 : 5; c.kling = k;
    const a = Object.assign({}, ARK_DEFAULT, c.seedance || {}); a.baseUrl = trimUrl(a.baseUrl) || ARK_DEFAULT.baseUrl; a.apiKey = String(a.apiKey || "").trim(); a.model = String(a.model || "").trim() || ARK_DEFAULT.model;
    a.resolution = ["480p", "720p", "1080p"].includes(a.resolution) ? a.resolution : "720p"; a.duration = Math.max(2, Math.min(12, Math.round(Number(a.duration) || 5))); c.seedance = a;
    if (!MODELS.includes(c.model)) c.model = DEFAULT.model;
    if (!resolutions(c.model).includes(c.resolution)) c.resolution = resolutions(c.model)[0];
    const allowed = durations(c.model, c.resolution); c.duration = allowed.includes(Number(c.duration)) ? Number(c.duration) : allowed[0];
    return c;
  }
  const load = () => normalize(loadJSON(CONFIG, {}));
  function save(patch) { const c = normalize(Object.assign(load(), patch)); if (!saveJSON(CONFIG, c)) throw Error("视频设置没有保存成功"); return c; }
  function ready(c) {
    c = c || load(); if (!c.enabled) return false;
    if (c.vendor === "kling") return /^https?:\/\//.test(c.kling.baseUrl) && !!(c.kling.apiKey || (c.kling.accessKey && c.kling.secretKey));
    if (c.vendor === "seedance") return /^https?:\/\//.test(c.seedance.baseUrl) && !!c.seedance.apiKey;
    return !!(c.apiKey && /^https?:\/\//.test(c.baseUrl));
  }
  // 这一家现在的设置摘要：编辑页那行「当前：几秒 · 什么画质」用
  const summary = c => { c = c || load(); return c.vendor === "kling" ? "可灵 " + c.kling.model + " · " + c.kling.duration + " 秒 · " + (c.kling.mode === "pro" ? "高品质" : "标准")
    : c.vendor === "seedance" ? "即梦 · " + c.seedance.duration + " 秒 · " + c.seedance.resolution : c.duration + " 秒 · " + c.resolution; };
  // 可灵的旧式 AccessKey/SecretKey：浏览器里现签一张 30 分钟的 HS256 JWT（官方说法：iss＝AK，exp/nbf）。
  //   新式 API Key 直接当 Bearer 用，不用签。
  async function klingToken(k) {
    if (k.apiKey) return k.apiKey;
    const b64u = buf => btoa(typeof buf === "string" ? unescape(encodeURIComponent(buf)) : String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    const now = Math.floor(Date.now() / 1000), head = b64u(JSON.stringify({ alg: "HS256", typ: "JWT" })), body = b64u(JSON.stringify({ iss: k.accessKey, exp: now + 1800, nbf: now - 5 }));
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(k.secretKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    return head + "." + body + "." + b64u(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(head + "." + body)));
  }
  // 可灵、即梦共用的一枪：超时、掐断、读错都跟 MiniMax 那条同一个说法
  async function vendorRequest(url, token, body, signal) {
    const controller = new AbortController(), relay = () => controller.abort(); if (signal && signal.aborted) throw new DOMException("已停止等待", "AbortError");
    if (signal) signal.addEventListener("abort", relay, { once: true }); const timer = setTimeout(relay, 45000);
    try {
      const r = await fetch(url, { method: body ? "POST" : "GET", headers: Object.assign({ Authorization: "Bearer " + token }, body ? { "Content-Type": "application/json" } : {}), body: body ? JSON.stringify(body) : undefined, signal: controller.signal });
      let d; try { d = JSON.parse(await r.text()); } catch (_) { throw Error("视频接口没有返回可读的内容（HTTP " + r.status + "）"); }
      if (!r.ok || (typeof d.code === "number" && d.code !== 0) || d.error && d.error.message) throw Error((d.error && d.error.message) || d.message || ("视频接口 HTTP " + r.status));
      return d;
    } catch (e) {
      if (e.name === "AbortError") throw e;
      if (e instanceof TypeError) throw Error("视频接口连接失败，请核对站点和网络；浏览器跨域限制也可能阻止请求"); throw e;
    } finally { clearTimeout(timer); if (signal) signal.removeEventListener("abort", relay); }
  }
  function patchMap(key, id, value) { const m = loadJSON(key, {}); if (value == null) delete m[id]; else m[id] = value; if (!saveJSON(key, m)) throw Error("没有保存成功，请检查本机存储空间"); return value; }
  // ── 动态形象库（她 2026-10-05：「公共的，我也确实希望不同场景有不同样子的视频」）──
  //   一个角色一本：{ default, focus, call } 各一格，每格 { videoRef?, imageRef?, updatedAt }。
  //   哪格空着就退回「平时」那格，再空就是静态头像。只挂图不挂视频也行（纯图陪伴）。
  //   ⚠️原来叫 x_pomodoro_media、只有番茄钟用；第一次读的时候整份搬成「专注时」那格，旧键删掉，
  //   不留两份（施工规则/one-public-mechanism.md）。任务记录也一起改名成「谁|哪格」。
  const LIB = "x_charMotion";
  const SCENES = [{ id: "default", zh: "平时", sub: "哪里都没单独挂的时候用它" }, { id: "focus", zh: "专注时", sub: "番茄钟坐在对面" }, { id: "call", zh: "通话时", sub: "视频通话里 TA 那一格" }];
  const sceneOf = id => { const p = String(id || "").split("|"); return { cid: p[0], scene: p[1] || "focus" }; };
  function motionAll() {
    // 旧任务记录按角色 id 记的，改名成「谁|专注时」（只在还有旧名字时写一次）
    const jobs = loadJSON(JOBS, {});
    if (Object.keys(jobs).some(k => k.indexOf("|") < 0)) {
      const moved = {}; Object.keys(jobs).forEach(k => { moved[k.indexOf("|") < 0 ? k + "|focus" : k] = jobs[k]; }); saveJSON(JOBS, moved);
    }
    const lib = loadJSON(LIB, null), old = loadJSON(MEDIA, null);
    if (!old) return lib || {};
    const next = Object.assign({}, lib || {});
    Object.keys(old).forEach(cid => { if (old[cid] && !(next[cid] && next[cid].focus)) next[cid] = Object.assign({}, next[cid] || {}, { focus: old[cid] }); });
    if (!saveJSON(LIB, next)) return next;
    try { saveJSON(MEDIA, null); if (g.localStorage) g.localStorage.removeItem(MEDIA); } catch (_) {}
    return next;
  }
  // 这一格自己的；没有就退回「平时」那格
  const slotOwn = (cid, scene) => { const x = (motionAll()[cid] || {})[scene]; return x && (x.videoRef || x.imageRef) ? x : null; };
  const slotFor = (cid, scene) => slotOwn(cid, scene) || (scene !== "default" ? slotOwn(cid, "default") : null);
  function setSlot(cid, scene, value) {
    const all = motionAll(), mine = Object.assign({}, all[cid] || {});
    if (value == null) delete mine[scene]; else mine[scene] = value;
    if (Object.keys(mine).length) all[cid] = mine; else delete all[cid];
    if (!saveJSON(LIB, all)) throw Error("没有保存成功，请检查本机存储空间");
    return value;
  }
  // 一段视频可能同时挂在好几格（「平时」和「通话时」用同一段），只有没人用了才删文件
  const refUsed = ref => Object.values(motionAll()).some(m => Object.values(m || {}).some(x => x && x.videoRef === ref));
  async function dropIfUnused(ref) { if (ref && !refUsed(ref)) await blobOp(ref, null, true).catch(() => {}); }
  const media = id => { const k = sceneOf(id); return slotOwn(k.cid, k.scene); };
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
    if (c.vendor === "kling" || c.vendor === "seedance") return createVendor(c, id, imageRef, input, prompt, signal);
    const record = { baseUrl: c.baseUrl, model: c.model, protocol: isV2(c.model) ? "v2" : "v1", imageRef, prompt: String(prompt).trim().slice(0, 2000), createdAt: Date.now(), status: "Submitting" };
    patchMap(JOBS, id, record);
    // 超时/断网时不能猜上游没收到：留下 Submitting，不自动补发一笔收费任务。
    const body = record.protocol === "v2" ? { model: c.model, content: [{ type: "text", text: record.prompt }, { type: "image_url", image_url: { url: input }, role: "first_frame" }], duration: c.duration, resolution: c.resolution } : { model: c.model, first_frame_image: input, prompt: record.prompt, duration: c.duration, resolution: c.resolution, prompt_optimizer: false };
    let d; try { d = await request(c, "/" + record.protocol + "/video_generation", body, signal); } catch (e) { if (job(id) && job(id).createdAt === record.createdAt) rememberError(id, e); throw e; }
    if ((signal && signal.aborted) || !job(id) || job(id).createdAt !== record.createdAt) throw new DOMException("已停止等待", "AbortError");
    if (!d.task_id) throw Error("接口没有返回任务编号；请先到控制台核对是否已创建");
    record.taskId = String(d.task_id); record.status = "Preparing"; return patchMap(JOBS, id, record);
  }
  // 可灵、即梦提交：跟 MiniMax 同一个规矩——先记 Submitting，超时断网不补发，拿到编号才算交上去
  async function createVendor(c, id, imageRef, input, prompt, signal) {
    const v = c.vendor, k = c[v], text = String(prompt).trim().slice(0, 2000);
    const record = { vendor: v, baseUrl: k.baseUrl, model: k.model, imageRef, prompt: text, createdAt: Date.now(), status: "Submitting" };
    patchMap(JOBS, id, record);
    let d;
    try {
      if (v === "kling") {
        // 可灵的 image 收【不带 data: 头的纯 base64】或网址
        const image = /^data:/i.test(input) ? input.split(",")[1] : input;
        d = await vendorRequest(k.baseUrl + "/v1/videos/image2video", await klingToken(k), { model_name: k.model, image, prompt: text, mode: k.mode, duration: String(k.duration) }, signal);
      } else {
        d = await vendorRequest(k.baseUrl + "/contents/generations/tasks", k.apiKey, { model: k.model, content: [{ type: "text", text }, { type: "image_url", image_url: { url: input }, role: "first_frame" }],
          duration: k.duration, resolution: k.resolution, ratio: "adaptive", camera_fixed: true, watermark: false }, signal);
      }
    } catch (e) { if (job(id) && job(id).createdAt === record.createdAt) rememberError(id, e); throw e; }
    if ((signal && signal.aborted) || !job(id) || job(id).createdAt !== record.createdAt) throw new DOMException("已停止等待", "AbortError");
    const taskId = v === "kling" ? d.data && d.data.task_id : d.id;
    if (!taskId) throw Error("接口没有返回任务编号；请先到控制台核对是否已创建");
    record.taskId = String(taskId); record.status = "Preparing"; return patchMap(JOBS, id, record);
  }
  // 可灵、即梦查进度：成了就交回下载地址，没成交回 null；失败直接抛
  async function queryVendor(record, signal) {
    const c = load(), k = c[record.vendor]; if (!k) throw Error("找不到这家视频接口的设置");
    if (k.baseUrl !== record.baseUrl) throw Error("请切回创建这段视频时的站点，再查询原任务");
    let status, url, why;
    if (record.vendor === "kling") {
      const d = await vendorRequest(record.baseUrl + "/v1/videos/image2video/" + encodeURIComponent(record.taskId), await klingToken(k), null, signal), t = d.data || {};
      status = t.task_status; why = t.task_status_msg; url = t.task_result && t.task_result.videos && t.task_result.videos[0] && t.task_result.videos[0].url;
    } else {
      const d = await vendorRequest(record.baseUrl + "/contents/generations/tasks/" + encodeURIComponent(record.taskId), k.apiKey, null, signal);
      status = d.status; why = d.error && d.error.message; url = d.content && d.content.video_url;
    }
    if (!status) throw Error("接口缺少任务状态，请稍后查询原任务");
    return { status: String(status), url, why };
  }
  function taskState(record, busy) {
    if (!record) return null;
    const status = String(record.status || "").toLowerCase();
    if (record.draftRef) return { title: "生成完成，等待你选用", detail: "先预览动作，满意后保存；保存后的循环播放不会重新生成。" };
    if (!record.taskId) return { title: busy && !record.lastError ? "正在提交，等待任务编号" : "提交未确认，请核对控制台", detail: "还没拿到任务编号，无法确认是否开始生成或是否失败。请到对应站点控制台核对这次任务；确认后再决定是否放弃记录，避免重复付费。" };
    if (["fail", "failed", "cancelled"].includes(status)) return { title: status === "cancelled" ? "任务已取消" : "生成失败", detail: "这是接口返回的任务状态。任务编号已保留；重新生成是另一笔任务，费用以对应站点为准。" };
    if (["success", "succeeded", "succeed"].includes(status)) return { title: busy ? "生成完成，正在保存视频" : "生成完成，视频尚未保存", detail: "动画已经生成，但本机还没有保存到视频。点「查询原任务 / 重试下载」重试；如果一直连接失败，可复制原视频链接到 Safari 手动保存，再导入这次任务，不会重新生成。" };
    if (record.lastError && !busy) return { title: "查询暂时中断，生成结果未确认", detail: "连接或查询失败不代表生成失败。任务编号已保留，可以查询原任务；不会重新提交。" };
    const title = ({ preparing: "正在准备画面", submitted: "正在排队", queueing: "正在排队", queued: "正在排队", processing: "正在生成动作", running: "正在生成动作" })[status] || "任务已提交，正在查询进度";
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
    let url;
    if (record.vendor === "kling" || record.vendor === "seedance") {
      const q = await queryVendor(record, signal);
      if ((signal && signal.aborted) || !job(id) || job(id).taskId !== record.taskId) throw new DOMException("已停止等待", "AbortError");
      record.status = q.status; delete record.lastError; patchMap(JOBS, id, record);
      const st = q.status.toLowerCase();
      if (["fail", "failed", "cancelled"].includes(st)) throw Error("视频任务" + (st === "cancelled" ? "已取消" : "生成失败") + "：" + (q.why || "请修改图片或动作描述后再试"));
      if (!["succeed", "succeeded"].includes(st)) return record;
      url = q.url;
    } else {
      // 已提交任务沿用当时协议；之后切换模型不能改变原任务的查询地址。
      const v2 = record.protocol === "v2" || (!record.protocol && isV2(record.model));
      const c = taskConfig(record), d = await request(c, v2 ? "/v2/query/video_generation/" + encodeURIComponent(record.taskId) : "/v1/query/video_generation?task_id=" + encodeURIComponent(record.taskId), null, signal);
      if ((signal && signal.aborted) || !job(id) || job(id).taskId !== record.taskId) throw new DOMException("已停止等待", "AbortError");
      const task = v2 ? d.task : d; if (!task || !task.status) throw Error("接口缺少任务状态，请稍后查询原任务");
      record.status = task.status; delete record.lastError; if (!v2 && task.file_id) record.fileId = String(task.file_id); patchMap(JOBS, id, record);
      const status = String(task.status).toLowerCase();
      if (["fail", "failed", "cancelled"].includes(status)) throw Error("视频任务" + (status === "cancelled" ? "已取消" : "生成失败") + "：" + ((task.error && task.error.message) || (typeof task.error === "string" && task.error) || (task.base_resp && task.base_resp.status_msg) || "请修改图片或动作后再试"));
      if (status !== (v2 ? "succeeded" : "success")) return record;
      if (v2) url = task.content && task.content.url;
      else {
        if (!record.fileId) throw Error("任务成功但缺少视频文件编号，请稍后查询原任务");
        const f = await request(c, "/v1/files/retrieve?file_id=" + encodeURIComponent(record.fileId), null, signal); url = f.file && f.file.download_url;
      }
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
  async function importTaskVideo(id, file) { const r = job(id); if (!r || !r.taskId || !["success", "succeeded", "succeed"].includes(String(r.status).toLowerCase())) throw Error("原任务还没有确认生成完成"); return saveDraftFile(id, file, r.taskId); }
  async function queryTracked(id, signal) {
    const previous = job(id); try { return await query(id, signal); } catch (e) { if (previous && job(id) && job(id).taskId === previous.taskId) rememberError(id, e); throw e; }
  }
  function wait(ms, signal) { return new Promise((resolve, reject) => { const stop = () => { clearTimeout(timer); signal.removeEventListener("abort", stop); reject(new DOMException("已停止等待", "AbortError")); }; const timer = setTimeout(() => { if (signal) signal.removeEventListener("abort", stop); resolve(); }, ms); if (signal) { if (signal.aborted) stop(); else signal.addEventListener("abort", stop, { once: true }); } }); }
  async function poll(id, signal, onUpdate) {
    for (let i = 0; i < 120; i++) { const r = await queryTracked(id, signal); if (onUpdate) onUpdate(r); if (r.draftRef) return r; await wait(10000, signal); }
    throw Error("等待较久，任务编号已保留，稍后回来查询即可");
  }
  async function adopt(id) { const r = job(id); if (!r || !r.draftRef || !await blobOp(r.draftRef)) throw Error("还没有可保存的视频"); const k = sceneOf(id), previous = slotOwn(k.cid, k.scene); const value = { videoRef: r.draftRef, imageRef: r.imageRef, updatedAt: Date.now() }; setSlot(k.cid, k.scene, value); patchMap(JOBS, id, null); if (previous && previous.videoRef !== value.videoRef) await dropIfUnused(previous.videoRef); return value; }
  // 只挂一张图（纯图陪伴）：不调接口、不花钱
  async function useImage(id, imageRef) { if (!imageRef) throw Error("先选一张图"); const k = sceneOf(id), previous = slotOwn(k.cid, k.scene); setSlot(k.cid, k.scene, { imageRef, updatedAt: Date.now() }); if (previous && previous.videoRef) await dropIfUnused(previous.videoRef); }
  async function clearSlot(id) { const k = sceneOf(id), previous = slotOwn(k.cid, k.scene); setSlot(k.cid, k.scene, null); if (previous && previous.videoRef) await dropIfUnused(previous.videoRef); }
  // 拿「平时」那格（或别的格）的东西原样挂到这一格：同一个文件，不复制
  function copySlot(fromId, toId) { const a = sceneOf(fromId), b = sceneOf(toId), v = slotOwn(a.cid, a.scene); if (!v) throw Error("那一格还是空的"); setSlot(b.cid, b.scene, Object.assign({}, v, { updatedAt: Date.now() })); }
  // 备份：视频文件不在 localStorage 里，「导出全部数据」要专门来这儿取（她 2026-10-05：很多人就靠导入导出过日子）
  async function allVideos() {
    const refs = new Set(); Object.values(motionAll()).forEach(m => Object.values(m || {}).forEach(x => { if (x && x.videoRef) refs.add(x.videoRef); }));
    const out = []; for (const ref of refs) { const b = await blobOp(ref).catch(() => null); if (b) out.push([ref, b]); } return out;
  }
  const restoreVideo = (ref, blob) => blobOp(ref, blob);
  async function importVideo(id, file, imageRef) { if (!file || !/^video\//.test(file.type) || !file.size || file.size > 100 * 1024 * 1024) throw Error("请选择 100MB 以内的视频文件"); const ref = "pvideo_local_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7); await blobOp(ref, file); const k = sceneOf(id), previous = slotOwn(k.cid, k.scene); setSlot(k.cid, k.scene, { videoRef: ref, imageRef: imageRef || "", updatedAt: Date.now() }); if (previous && previous.videoRef) await dropIfUnused(previous.videoRef); return slotOwn(k.cid, k.scene); }
  async function exportVideo(ref) { const b = await blobOp(ref); if (!b) throw Error("视频不在这台设备上，请重新导入备份"); const ext = /webm/.test(b.type) ? "webm" : /quicktime/.test(b.type) ? "mov" : "mp4"; return saveFile(new File([b], "动态陪伴图." + ext, { type: b.type || "video/mp4" })); }
  function useVideoURL(ref) { const [url, setUrl] = useState(""); useEffect(() => { let live = true, own = ""; setUrl(""); if (ref) blobOp(ref).then(b => { if (b && live) { own = URL.createObjectURL(b); setUrl(own); } }).catch(() => {}); return () => { live = false; if (own) URL.revokeObjectURL(own); }; }, [ref]); return url; }
  // 循环接缝：两层同一段视频叠着放，前一层快播完时后一层从头起、淡进来——
  //   原来靠提示词求「最后回到初始姿态」，接不接得上看运气；这样哪个模型做的、自己导的都接得上，也不多花一分钱。
  const SEAM = 0.45;
  function LoopVideo({ videoRef, poster, style, controls, controlStyle, fit }) {
    const url = useVideoURL(videoRef), a = useRef(null), b = useRef(null), [front, setFront] = useState(0), fading = useRef(false);
    const [paused, setPaused] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const cur = () => (front === 0 ? a : b).current, other = () => (front === 0 ? b : a).current;
    useEffect(() => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      const sync = () => { const v = cur(); if (!v) return; if (document.hidden || paused) { v.pause(); const o = other(); if (o) o.pause(); } else v.play().catch(() => {}); };
      const motionChange = () => setPaused(mq.matches); sync();
      document.addEventListener("visibilitychange", sync); mq.addEventListener("change", motionChange);
      return () => { document.removeEventListener("visibilitychange", sync); mq.removeEventListener("change", motionChange); [a.current, b.current].forEach(v => v && v.pause()); };
    }, [url, paused, front]);
    const onTime = e => {
      const v = e.currentTarget; if (v !== cur() || fading.current || paused || !v.duration || v.duration < SEAM * 3) return;
      if (v.duration - v.currentTime > SEAM) return;
      const o = other(); if (!o) return; fading.current = true;
      try { o.currentTime = 0; } catch (_) {}
      o.play().catch(() => {}); setFront(front === 0 ? 1 : 0);
      setTimeout(() => { v.pause(); fading.current = false; }, SEAM * 1000 + 60);
    };
    const layer = (r, k) => h("video", { ref: r, src: url, poster: k === 0 ? (resolveImg(poster) || undefined) : undefined, muted: true, playsInline: true, preload: "auto",
      onTimeUpdate: onTime, onEnded: e => { if (e.currentTarget === cur()) { e.currentTarget.currentTime = 0; e.currentTarget.play().catch(() => {}); } },
      onError: () => setPaused(true),
      style: { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: fit || "cover", display: "block", opacity: front === k ? 1 : 0, transition: "opacity " + SEAM + "s linear" } });
    return h("div", { style: Object.assign({ position: "relative", overflow: "hidden" }, style), "data-pomodoro-video": "", "data-wk": "pomvideostage" },
      url ? [h(React.Fragment, { key: "a" }, layer(a, 0)), h(React.Fragment, { key: "b" }, layer(b, 1))]
        : poster ? h("img", { src: resolveImg(poster), alt: "陪伴原图", style: { width: "100%", height: "100%", objectFit: fit || "cover" } }) : null,
      controls && url ? h("button", { type: "button", onClick: () => setPaused(!paused), style: Object.assign({ position: "absolute", right: 10, bottom: "calc(env(safe-area-inset-bottom) * 0.4 + 10px)", zIndex: 2, minHeight: 40, padding: "0 12px", border: "1px solid #ffffff88", background: "#24221ecc", color: "#fff", fontFamily: F_BODY }, controlStyle || {}) }, paused ? "播放画面" : "暂停画面") : null,
      !url && videoRef ? h("div", { style: { position: "absolute", bottom: 8, left: 8, right: 8, color: "#fff", background: "#24221ecc", padding: 8, fontSize: 11 } }, "本机视频暂不可用：从「导出全部数据」的备份导回来，或在动态形象里重新导入") : null);
  }
  // 一格的画面：有视频放视频，只有图就放图，都没有就交给调用方（画头像）
  function MotionStage({ slot, style, controls, controlStyle, fit }) {
    if (!slot) return null;
    if (slot.videoRef) return h(LoopVideo, { key: slot.videoRef, videoRef: slot.videoRef, poster: slot.imageRef, style, controls, controlStyle, fit });
    if (slot.imageRef) return h("div", { style: Object.assign({ position: "relative", overflow: "hidden" }, style), "data-wk": "pomvideostage" },
      h("img", { src: resolveImg(slot.imageRef), alt: "", style: { width: "100%", height: "100%", objectFit: fit || "cover", display: "block" } }));
    return null;
  }
  function VideoApiConfig() {
    const t = useTheme(), [c, setC] = useState(load), [err, setErr] = useState("");
    const set = patch => { try { setC(save(patch)); setErr(""); } catch (e) { setErr(e.message); } };
    const input = { width: "100%", minWidth: 0, minHeight: 42, padding: "9px 12px", borderRadius: 6, border: "1px solid " + t.line, background: t.bg, color: t.ink, fontFamily: F_BODY, fontSize: 13 };
    const row = (label, child) => h("div", { style: { display: "block", marginTop: 14, fontFamily: F_BODY, fontSize: 12, color: t.sub } }, h("span", { style: { display: "block", marginBottom: 6 } }, label), child);
    const sites = (list, cur, pick) => h("div", { style: { display: "grid", gap: 6 } }, list.map(([name, url]) => h("button", { key: url, "aria-label": name, type: "button", onClick: () => pick(url), "aria-pressed": cur === url, style: Object.assign({}, input, { textAlign: "left", borderLeft: (cur === url ? "5px" : "1px") + " solid " + (cur === url ? t.accent : t.line) }) }, name)));
    const note = text => h("p", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.7 } }, text);
    // 型号：常用的放进候选，也能手填（两家上新很快，控制台里开通的是哪个就填哪个）
    const modelField = (label, value, list, onSet, id) => h(React.Fragment, null,
      row(label, h("input", { "aria-label": label, list: id, value, onChange: e => onSet(e.target.value), style: input })),
      h("datalist", { id }, list.map(m => h("option", { key: m, value: m }))));
    const kling = () => { const k = c.kling, sk = patch => set({ kling: Object.assign({}, k, patch) });
      return h(React.Fragment, null,
        row("站点（与密钥申请的平台配对）", sites(KLING_SITES, k.baseUrl, url => sk({ baseUrl: url }))),
        row("接口地址", h("input", { "aria-label": "可灵接口地址", value: k.baseUrl, onChange: e => sk({ baseUrl: e.target.value }), style: input })),
        row("API Key（新式，填了就不用下面两格）", h("input", { type: "password", "aria-label": "可灵 API Key", autoComplete: "off", value: k.apiKey, onChange: e => sk({ apiKey: e.target.value }), style: input })),
        row("Access Key（旧式）", h("input", { type: "password", "aria-label": "可灵 Access Key", autoComplete: "off", value: k.accessKey, onChange: e => sk({ accessKey: e.target.value }), style: input })),
        row("Secret Key（旧式）", h("input", { type: "password", "aria-label": "可灵 Secret Key", autoComplete: "off", value: k.secretKey, onChange: e => sk({ secretKey: e.target.value }), style: input })),
        modelField("视频模型", k.model, KLING_MODELS, v => sk({ model: v }), "kling-models"),
        row("品质", h("select", { "aria-label": "可灵品质", value: k.mode, onChange: e => sk({ mode: e.target.value }), style: input }, h("option", { value: "std" }, "标准（std）"), h("option", { value: "pro" }, "高品质（pro，更贵）"))),
        row("时长", h("select", { "aria-label": "可灵时长", value: k.duration, onChange: e => sk({ duration: Number(e.target.value) }), style: input }, [5, 10].map(n => h("option", { key: n, value: n }, n + " 秒")))),
        note("旧式的 Access Key／Secret Key 会在手机上现签一张 30 分钟的令牌，密钥本身不发出去。有的型号不支持「高品质」或 10 秒，以可灵控制台为准。浏览器直连被跨域拦住时，接口地址换成支持可灵的中转站。")); };
    const ark = () => { const a = c.seedance, sa = patch => set({ seedance: Object.assign({}, a, patch) });
      return h(React.Fragment, null,
        row("站点（与密钥申请的平台配对）", sites(ARK_SITES, a.baseUrl, url => sa({ baseUrl: url }))),
        row("接口地址", h("input", { "aria-label": "即梦接口地址", value: a.baseUrl, onChange: e => sa({ baseUrl: e.target.value }), style: input })),
        row("API Key（火山方舟）", h("input", { type: "password", "aria-label": "即梦 API Key", autoComplete: "off", value: a.apiKey, onChange: e => sa({ apiKey: e.target.value }), style: input })),
        modelField("视频模型（填控制台里开通的型号 ID）", a.model, ARK_MODELS, v => sa({ model: v }), "ark-models"),
        row("画质", h("select", { "aria-label": "即梦画质", value: a.resolution, onChange: e => sa({ resolution: e.target.value }), style: input }, ["480p", "720p", "1080p"].map(x => h("option", { key: x, value: x }, x)))),
        row("时长", h("select", { "aria-label": "即梦时长", value: a.duration, onChange: e => sa({ duration: Number(e.target.value) }), style: input }, [3, 4, 5, 6, 8, 10, 12].map(n => h("option", { key: n, value: n }, n + " 秒")))),
        note("走火山方舟的视频生成任务接口：首帧就是你选的那张图，镜头固定、不加水印。型号要先在方舟控制台开通；不同型号支持的时长和画质不一样，以控制台为准。浏览器直连被跨域拦住时，接口地址换成支持方舟的中转站。")); };
    return h("div", { "data-video-api-config": "" },
      h("p", { style: { fontFamily: F_BODY, fontSize: 12, lineHeight: 1.8, color: t.sub } }, "给图片制作一段动态陪伴画面。视频接口独立配置；只有点击生成才创建收费任务，满意后保存，循环播放不再调用。"),
      row("开启视频生成", h("input", { type: "checkbox", "aria-label": "开启视频生成", checked: c.enabled, onChange: e => set({ enabled: e.target.checked }), style: { width: 22, height: 22 } })),
      row("用哪一家", h("select", { "aria-label": "视频厂家", value: c.vendor, onChange: e => set({ vendor: e.target.value }), style: input }, VENDORS.map(([v, zh]) => h("option", { key: v, value: v }, zh)))),
      c.vendor === "kling" ? kling() : c.vendor === "seedance" ? ark() : h(React.Fragment, null,
      row("站点（与密钥申请站点配对）", h("div", { style: { display: "grid", gap: 6 } }, MINIMAX_API_SITES.map(([name, url]) => h("button", { key: url, "aria-label": name, type: "button", onClick: () => set({ baseUrl: url }), "aria-pressed": c.baseUrl === url, style: Object.assign({}, input, { textAlign: "left", borderLeft: (c.baseUrl === url ? "5px" : "1px") + " solid " + (c.baseUrl === url ? t.accent : t.line) }) }, name)))),
      row("接口地址", h("input", { "aria-label": "视频接口地址", value: c.baseUrl, onChange: e => set({ baseUrl: e.target.value }), placeholder: "https://api.minimax.io", style: input })),
      row("视频 API 密钥", h("input", { type: "password", "aria-label": "视频 API 密钥", autoComplete: "off", value: c.apiKey, onChange: e => set({ apiKey: e.target.value }), placeholder: "填写对应站点的 API Key", style: input })),
      row("视频模型", h("select", { "aria-label": "视频模型", value: c.model, onChange: e => set({ model: e.target.value, resolution: resolutions(e.target.value)[0], duration: durations(e.target.value, resolutions(e.target.value)[0])[0] }), style: input }, MODELS.map(m => h("option", { key: m, value: m }, m)))),
      row("画质", h("select", { "aria-label": "视频画质", value: c.resolution, onChange: e => set({ resolution: e.target.value }), style: input }, resolutions(c.model).map(r => h("option", { key: r, value: r }, r)))),
      row("时长", h("select", { "aria-label": "视频时长", value: c.duration, onChange: e => set({ duration: Number(e.target.value) }), style: input }, durations(c.model, c.resolution).map(n => h("option", { key: n, value: n }, n + " 秒")))),
      h("p", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.7 } }, "H3 可选 4～15 秒，H3 Max 可选 5～15 秒；旧型号保留原时长。H3 官方站直连可能被浏览器跨域拦截，此时接口地址需填写支持 MiniMax V2 的中转地址。密钥与语音设置分别保存。到「动态形象」里制作和预览；模型是否开放、费用以对应站点账户为准。")),
      err ? h("p", { role: "alert", style: { color: t.accent } }, err) : null);
  }
  // 动态形象编辑页（她 2026-10-05）：一个角色一本，顶上一条胶片选哪一格（平时 / 专注时 / 通话时）。
  //   番茄钟、角色资料都进这一页，番茄钟进来时直接停在「专注时」。
  function MotionEditor(props) {
    const [scene, setScene] = useState(props.scene || "default");
    return h(PomodoroVideoEditor, Object.assign({}, props, { key: scene, scene, onScene: setScene }));
  }
  // 胶片条：一格一个场景。选中那格拉满高、上墨、齿孔点亮；没选的矮一截、暗着，像还没冲出来的底片
  //   （施工规则/tabs-not-plain-pills.md：形状从「一卷胶片」长出来，不是一排药丸）
  function SceneStrip({ cid, scene, onScene, t }) {
    const holes = on => h("div", { style: { display: "flex", justifyContent: "space-around", padding: "0 6px" } },
      [0, 1, 2, 3].map(i => h("span", { key: i, style: { width: 6, height: 4, borderRadius: 1, background: on ? t.bg2 : "rgba(255,255,255,.25)" } })));
    return h("div", { "data-wk": "motionstrip", className: "flex", style: { gap: 3, alignItems: "flex-end", background: "#24211c", padding: "6px 6px 0", borderRadius: 3, marginTop: 4 } },
      SCENES.map(sc => {
        const on = sc.id === scene, own = slotOwn(cid, sc.id), thumb = own && own.imageRef;
        return h("button", { key: sc.id, onClick: () => onScene(sc.id), "aria-pressed": on, "data-on": on ? "1" : "0", className: "flex-1 active:opacity-80",
          style: { minHeight: on ? 86 : 72, padding: "4px 0 6px", border: "none", background: on ? "#3a352d" : "transparent", opacity: on ? 1 : .62, borderRadius: "2px 2px 0 0", transition: "min-height .2s" } },
          holes(on),
          h("div", { style: { height: on ? 34 : 26, margin: "4px 6px", borderRadius: 2, background: thumb ? "center/cover no-repeat url(\"" + resolveImg(thumb) + "\")" : "rgba(255,255,255,.08)", border: "1px solid " + (on ? "rgba(255,255,255,.7)" : "rgba(255,255,255,.18)") } }),
          h("div", { style: { fontFamily: F_BODY, fontSize: 12, color: on ? "#fff" : "rgba(255,255,255,.75)", fontWeight: on ? 600 : 400 } }, sc.zh),
          h("div", { style: { fontFamily: F_BODY, fontSize: 9.5, color: "rgba(255,255,255,.5)", marginTop: 1 } }, own ? (own.videoRef ? "视频" : "图片") : sc.id === "default" ? "头像" : "跟平时"));
      }));
  }
  function PomodoroVideoEditor({ character, onBack, onSaved, toast, scene: slotScene, onScene }) {
    slotScene = slotScene || "focus";
    const t = useTheme(), id = character.id + "|" + slotScene, existing = media(id);
    const sceneZh = (SCENES.find(x => x.id === slotScene) || {}).zh || "";
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
    const useDraft = () => run(async () => { await adopt(id); onSaved(); toast && toast("「" + sceneZh + "」那格就用这段了"); });
    const keepImage = () => run(async () => { await useImage(id, imageRef); onSaved(); report("「" + sceneZh + "」那格先用这张图，不做动画也行。"); });
    const sameAsDefault = () => run(async () => { copySlot(character.id + "|default", id); onSaved(); report("跟「平时」用同一段，没有另存一份。"); });
    const emptySlot = () => run(async () => { await clearSlot(id); onSaved(); report(slotScene === "default" ? "「平时」空了，没单独挂的地方都回到头像。" : "这一格空了，会跟「平时」一样。"); });
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
      h(Head, { zh: "动态形象", bg: "transparent", onBack, right: h("button", { onClick: () => { savedScroll.current = scroller.current ? scroller.current.scrollTop : 0; setConfigOpen(true); }, style: Object.assign({}, btn, { border: "none", background: "transparent", padding: "0 4px" }) }, "接口") }),
      h("div", { ref: scroller, className: "flex-1 min-h-0 overflow-y-auto px-5", style: { paddingBottom: "calc(env(safe-area-inset-bottom) * 0.4 + 24px)" } },
        h(SceneStrip, { cid: character.id, scene: slotScene, onScene: x => { if (!busy) onScene && onScene(x); }, t }),
        h("p", { style: { fontFamily: F_BODY, fontSize: 12, lineHeight: 1.8, color: t.sub, marginTop: 10 } }, character.name + "「" + sceneZh + "」的样子：" + ((SCENES.find(x => x.id === slotScene) || {}).sub || "") + "。可以只挂一张图，也可以做成一段会动的；哪格空着就跟「平时」一样。"),
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
        h("div", { style: { fontFamily: F_BODY, fontSize: 11, color: t.fog, lineHeight: 1.8, marginTop: 6 } }, "轻动作更合适。播放时首尾会自动淡接，不用强求最后一帧回到原位。当前：" + summary()),
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
          imageRef && !record ? h("button", { disabled: busy, onClick: keepImage, style: btn }, "只用这张图") : null,
          slotScene !== "default" && slotOwn(character.id, "default") && !record ? h("button", { disabled: busy, onClick: sameAsDefault, style: btn }, "跟「平时」用同一段") : null,
          existing ? h("button", { disabled: busy, onClick: emptySlot, style: btn }, "清空这一格") : null)));
  }
  g.VideoApi = { load, save, normalize, ready, taskState, create: createTracked, query: queryTracked, poll, adopt, media, job, importVideo, importTaskVideo, exportVideo, blob: blobOp, imageData, patchMap,
    SCENES, slotFor, slotOwn, useImage, clearSlot, copySlot, allVideos, restoreVideo, motionAll, keys: { CONFIG, MEDIA, JOBS, LIB } };
  g.VideoApiConfig = VideoApiConfig; g.PomodoroVideoEditor = MotionEditor; g.MotionEditor = MotionEditor; g.PomodoroLoopVideo = LoopVideo; g.MotionStage = MotionStage;
})(window);
