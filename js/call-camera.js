// 真实视频通话：网页摄像头仅本地预览，发话时取一帧走现有 callAI 识图协议。
// 不录视频、不另开识图请求；画面只活在本轮请求，关闭/后台/缩小/挂断释放设备。
(function () {
  function environmentError(env) {
    if (env.webkit && env.webkit.messageHandlers && (env.webkit.messageHandlers.nativeMedia || env.webkit.messageHandlers.nativeHttp)) {
      // 仓库现役 iOS 壳 Info.plist 没有 NSCameraUsageDescription；纯网页无法补原生权限。
      return "这个 App 壳还没有摄像头权限。请在 Safari 打开秋秋机网页使用摄像头。";
    }
    if (!env.isSecureContext) return "摄像头需要安全网页，请用 https 地址打开。";
    if (!env.navigator || !env.navigator.mediaDevices || !env.navigator.mediaDevices.getUserMedia) return "这个浏览器不能打开摄像头，请用 Safari 或 Chrome 打开。";
    return "";
  }
  function errorText(e) {
    if (e && (e.name === "NotAllowedError" || e.name === "PermissionDeniedError")) return "没有获得摄像头权限。允许此网页使用摄像头后，再点一次开启。";
    if (e && e.name === "NotFoundError") return "没有找到可用的摄像头。";
    if (e && (e.name === "NotReadableError" || e.name === "AbortError")) return "摄像头暂时打不开，关掉其他正在用镜头的页面后重试。";
    return "摄像头没有打开：" + String(e && e.message || e || "请重试");
  }
  function validFrame(frame) {
    if (!frame || typeof frame.imageDataUrl !== "string" || frame.imageDataUrl.length > 1000000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(frame.imageDataUrl)) return null;
    const at = Number(frame.capturedAt);
    if (!Number.isFinite(at) || at <= 0 || Math.abs(Date.now() - at) > 30000) return null;
    return { imageDataUrl: frame.imageDataUrl, capturedAt: at, facing: frame.facing === "environment" ? "environment" : "user" };
  }
  function withFrame(messages, frame) {
    const rows = (messages || []).map(m => ({ ...m }));
    if (!frame) return rows;
    for (let i = rows.length - 1; i >= 0; i--) {
      if (rows[i].role !== "user") continue;
      rows[i].imageDataUrls = [frame.imageDataUrl]; break;
    }
    return rows;
  }
  function prompt(frame) {
    return frame ? "\n\n【本轮真实摄像头画面】视觉输入附了对方在发话时展示的手机" + (frame.facing === "environment" ? "后置" : "前置") + "镜头画面，拍摄时间 " + new Date(frame.capturedAt).toISOString() + "。这是那一刻的真实截图，不是角色背景图，也不是持续可见的整段视频。顺着对方的话和看清的东西自然接话；看不清就按你自己的口吻说没看清、让对方换角度。"
      : "\n\n【本轮镜头输入】没有附上真实摄像头画面。现实中的外貌、物品和环境依据对方说的话及此前通话中已观察到的信息；需要看新的东西时可以请对方开启镜头展示。";
  }
  function create(onChange, env) {
    env = env || window;
    let stream = null, element = null, epoch = 0, disposed = false, phase = "off", facing = "user";
    const emit = (next, message) => { phase = next; if (!disposed) onChange({ phase, facing, message: message || "" }); };
    const ended = () => close("镜头已关闭，可以重新开启。");
    const release = s => {
      if (!s) return;
      s.getTracks().forEach(t => { if (t.removeEventListener) t.removeEventListener("ended", ended); t.stop(); });
    };
    const preview = () => {
      if (!element) return;
      element.srcObject = stream;
      if (stream) { const p = element.play(); if (p && p.catch) p.catch(() => {}); }
    };
    function close(message) {
      epoch++; const old = stream; stream = null;
      if (element) element.srcObject = null;
      release(old); emit("off", message);
    }
    async function open(nextFacing) {
      if (disposed) return;
      close(); facing = nextFacing === "environment" ? "environment" : "user";
      const token = epoch, unavailable = environmentError(env);
      if (unavailable) { emit("error", unavailable); return; }
      emit("opening", "正在打开镜头…");
      try {
        const result = await env.navigator.mediaDevices.getUserMedia({ audio: false, video: { facingMode: { ideal: facing }, width: { ideal: 640 }, height: { ideal: 480 } } });
        if (disposed || token !== epoch) { release(result); return; }
        stream = result;
        const track = result.getVideoTracks()[0], actual = track && track.getSettings && track.getSettings().facingMode;
        if (actual === "user" || actual === "environment") facing = actual;
        if (track && track.addEventListener) track.addEventListener("ended", ended);
        emit("on"); preview();
      } catch (e) { if (!disposed && token === epoch) emit("error", errorText(e)); }
    }
    return {
      open, close,
      switch: () => open(facing === "user" ? "environment" : "user"),
      attach: el => { if (element && element !== el) element.srcObject = null; element = el; preview(); },
      snapshot: () => {
        if (phase === "off" || phase === "error" || disposed) return null;
        if (!stream || !element || element.readyState < 2 || !element.videoWidth || !element.videoHeight) throw new Error("镜头还没准备好，这句话先留在输入框，等画面出来再发送。");
        const canvas = env.document.createElement("canvas"), scale = Math.min(1, 768 / Math.max(element.videoWidth, element.videoHeight));
        canvas.width = Math.max(1, Math.round(element.videoWidth * scale)); canvas.height = Math.max(1, Math.round(element.videoHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("这次没取到画面，请重新开启镜头再发。");
        // 前置预览可镜像，传给模型的原始像素不镜像，物品上的字保持正向。
        context.drawImage(element, 0, 0, canvas.width, canvas.height);
        const frame = validFrame({ imageDataUrl: canvas.toDataURL("image/jpeg", .72), capturedAt: Date.now(), facing });
        if (!frame) throw new Error("这次没取到可用画面，请重新开启镜头再发。");
        return frame;
      },
      dispose: () => { disposed = true; close(); element = null; }
    };
  }
  window.CallCamera = { create, validFrame, withFrame, prompt, environmentError };
})();
