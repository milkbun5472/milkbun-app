(function (root) {
  "use strict";
  const h = React.createElement;
  const SERVICE_ZH = { codex_lounge: "Codex 会客正窗", codex_worker: "Codex 工位", fable: "言秋订阅桥", memory: "记忆网关", courier: "回流投递员", push: "锁屏推送" };
  const ACTION_ZH = { status: "刷新状态", checkpoint: "建立恢复点", restart: "重启服务", rescue_ticket: "生成互救票", rewind_preview: "回退预览" };

  function RescueConsole({ onBack, toast }) {
    const t = useTheme();
    const [rows, setRows] = useState([]), [busy, setBusy] = useState(false), [err, setErr] = useState("");
    const [service, setService] = useState("codex_lounge"), [symptom, setSymptom] = useState("");
    const load = async function () {
      try { setRows(await window.Cloud.rescueRemoteList(16)); setErr(""); }
      catch (e) { setErr(/relation.*does not exist|404/i.test(String(e && e.message || e)) ? "互救台云表还没安装：回家后只需运行 supabase/rescue_remote_commands.sql。" : String(e && e.message || e)); }
    };
    useEffect(function () { load(); const id = setInterval(load, 5000); return () => clearInterval(id); }, []);
    const send = async function (action, payload, confirmText) {
      if (confirmText && !window.confirm(confirmText)) return;
      setBusy(true); setErr("");
      try { await window.Cloud.rescueRemoteEnqueue(action, payload || {}); toast && toast("已交给 VPS 急救室，结果会自动回来"); await load(); }
      catch (e) { setErr(String(e && e.message || e)); }
      finally { setBusy(false); }
    };
    const latestStatus = rows.find(r => r.action === "status" && r.state === "completed" && r.result);
    const services = latestStatus && latestStatus.result && latestStatus.result.services || {};
    return h("div", { className: "h-full flex flex-col", style: { background: t.bg, color: t.ink } },
      h(Head, { zh: "互救台", onBack: onBack }),
      h("div", { className: "flex-1 overflow-y-auto px-5 pb-8" },
        h("div", { style: { fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.7, color: t.fog, marginBottom: 14 } }, "手机发命令，VPS 常驻急救室执行；Mac 合盖也能看体征和重启白名单服务。这里只保存 VPS 运行态检查点，不会擅自改写聊天历史。"),
        err && h("div", { style: { padding: 12, borderRadius: 12, background: "rgba(194,90,74,.10)", color: t.accent, fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.6, marginBottom: 12 } }, err),
        h("button", { disabled: busy, onClick: () => send("status", {}), className: "w-full py-3 active:opacity-70 disabled:opacity-40", style: { borderRadius: 12, background: t.ink, color: t.bg2, fontFamily: F_DISPLAY } }, "刷新 VPS 状态"),
        h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: "12px 0 16px" } }, Object.keys(SERVICE_ZH).map(k => h("div", { key: k, style: { padding: "10px 12px", border: "1px solid " + t.line, borderRadius: 12, background: t.bg2 } }, h("div", { style: { fontFamily: F_BODY, fontSize: 11.5, color: t.fog } }, SERVICE_ZH[k]), h("div", { style: { fontFamily: F_DISPLAY, fontSize: 13, marginTop: 3, color: services[k] && services[k].state === "running" ? "#4d7b58" : t.ink } }, services[k] ? services[k].state : "待刷新")))),
        h("div", { className: "flex gap-2 mb-4" },
          h("button", { disabled: busy, onClick: () => send("checkpoint", { reason: "Lisa 手机手动恢复点" }), className: "flex-1 py-3", style: { borderRadius: 12, border: "1px solid " + t.line, background: t.bg2, fontFamily: F_BODY, fontSize: 13 } }, "建立恢复点"),
          h("button", { disabled: busy, onClick: () => send("rewind_preview", { before: new Date().toISOString() }), className: "flex-1 py-3", style: { borderRadius: 12, border: "1px solid " + t.line, background: t.bg2, fontFamily: F_BODY, fontSize: 13 } }, "回退预览")),
        h("div", { className: "flex gap-2 mb-4" },
          h("select", { value: service, onChange: e => setService(e.target.value), className: "flex-1 px-3", style: { borderRadius: 12, border: "1px solid " + t.line, background: t.bg2, fontFamily: F_BODY } }, Object.keys(SERVICE_ZH).map(k => h("option", { key: k, value: k }, SERVICE_ZH[k]))),
          h("button", { disabled: busy, onClick: () => send("restart", { service, confirmed: true }, "确认重启「" + SERVICE_ZH[service] + "」？正在进行的那一轮可能会中断。"), style: { padding: "12px 16px", borderRadius: 12, background: t.accent, color: "#fff", fontFamily: F_BODY } }, "确认重启")),
        h("textarea", { value: symptom, onChange: e => setSymptom(e.target.value), rows: 3, placeholder: "哪里不对劲？例如：言秋突然变成 Haiku、不回话、回流停止…", className: "w-full p-3 outline-none", style: { resize: "none", border: "1px solid " + t.line, borderRadius: 12, background: t.bg2, fontFamily: F_BODY, fontSize: 13, lineHeight: 1.6 } }),
        h("button", { disabled: busy || !symptom.trim(), onClick: () => send("rescue_ticket", { symptom: symptom.trim() }), className: "w-full py-3 mt-2 disabled:opacity-40", style: { borderRadius: 12, border: "1px solid " + t.line, color: t.tint, fontFamily: F_BODY } }, "生成互救诊断票"),
        h("div", { style: { fontFamily: F_DISPLAY, fontSize: 15, margin: "22px 0 9px" } }, "最近命令"),
        rows.length ? rows.map(r => h("div", { key: r.id, style: { padding: "10px 12px", borderTop: "1px solid " + t.line, fontFamily: F_BODY, fontSize: 12.5, lineHeight: 1.55 } }, h("span", null, ACTION_ZH[r.action] || r.action), " · ", h("span", { style: { color: r.state === "failed" ? t.accent : t.fog } }, r.state), r.error_text ? h("div", { style: { color: t.accent } }, r.error_text) : null)) : h("div", { style: { color: t.fog, fontFamily: F_BODY, fontSize: 12 } }, "还没有远程命令。")));
  }
  root.RescueConsole = RescueConsole;
})(window);
