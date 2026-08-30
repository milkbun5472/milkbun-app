(function (root) {
  "use strict";
  const KEY = "x_autoRefreshPolicy_v1";
  const FEATURES = [
    { id: "phone", group: "content", title: "查手机", sub: "每周补刷角色手机内容", globalDefault: true, charDefault: false },
    { id: "weekly", group: "content", title: "周刊", sub: "进入新刊期后自动装订", globalDefault: false, charDefault: true },
    { id: "diary", group: "content", title: "日记", sub: "每天补写前一天日记", globalDefault: true, charDefault: true },
    { id: "wallet", group: "content", title: "钱包", sub: "跨天补齐日常收支", globalDefault: true, charDefault: true },
    { id: "schedule", group: "content", title: "角色日程", sub: "每周补排与白天临时改计划", globalDefault: true, charDefault: true },
    { id: "desire", group: "content", title: "欲望盒子", sub: "每日灵光与周期整理", globalDefault: true, charDefault: true },
    { id: "moments", group: "social", title: "朋友圈", sub: "低频主动发动态", globalDefault: true, charDefault: true },
    { id: "forum", group: "social", title: "论坛", sub: "低频主动发帖", globalDefault: true, charDefault: true },
    { id: "whisper", group: "social", title: "悄悄话", sub: "关系内低频留言", globalDefault: true, charDefault: true },
    { id: "capsule", group: "social", title: "时光胶囊", sub: "低频主动埋下胶囊", globalDefault: true, charDefault: true },
    { id: "proactive", group: "social", title: "主动私聊", sub: "生日、提醒、想念与主动找你", globalDefault: true, charDefault: true }
  ];
  const byId = Object.fromEntries(FEATURES.map(x => [x.id, x]));
  function normalize(raw, legacyPhoneOn) {
    const src = raw && typeof raw === "object" ? raw : {};
    const old = src.features && typeof src.features === "object" ? src.features : {};
    const features = {};
    FEATURES.forEach(f => {
      const v = old[f.id] && typeof old[f.id] === "object" ? old[f.id] : {};
      let chars = v.chars && typeof v.chars === "object" ? { ...v.chars } : {};
      if (f.id === "phone" && !Object.keys(chars).length && legacyPhoneOn) chars = { ...legacyPhoneOn };
      features[f.id] = { global: typeof v.global === "boolean" ? v.global : f.globalDefault, chars };
    });
    return { version: 1, features };
  }
  function enabled(policy, id, charId) {
    const f = byId[id]; if (!f) return false;
    const p = normalize(policy).features[id];
    if (!p.global) return false;
    if (!charId) return true;
    return Object.prototype.hasOwnProperty.call(p.chars, charId) ? p.chars[charId] !== false : f.charDefault;
  }
  function setGlobal(policy, id, on) {
    const n = normalize(policy); n.features[id] = { ...n.features[id], global: !!on }; return n;
  }
  function setChar(policy, id, charId, on) {
    const n = normalize(policy), cur = n.features[id];
    n.features[id] = { ...cur, chars: { ...cur.chars, [charId]: !!on } }; return n;
  }
  root.AutoRefreshPolicy = { KEY, FEATURES, normalize, enabled, setGlobal, setChar };
  if (typeof module !== "undefined" && module.exports) module.exports = root.AutoRefreshPolicy;
})(typeof window !== "undefined" ? window : globalThis);
