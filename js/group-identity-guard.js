(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.GroupIdentityGuard = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  function aliases(member) {
    const name = String(member && member.name || "").trim(), out = [];
    if (name) out.push(name);
    const chars = Array.from(name);
    if (chars.length >= 2 && chars.length <= 4 && /[\u3400-\u9fff]/.test(chars[chars.length - 1])) out.push("阿" + chars[chars.length - 1]);
    return [...new Set(out)];
  }
  function selfVocative(text, member) {
    const names = aliases(member);
    if (!names.length) return false;
    const lead = "(?:哎呀|哎|呀|欸|诶|唉|喂|好啦|不是|我说)?[，,、\\s]*";
    const re = new RegExp("^" + lead + "(?:" + names.map(esc).join("|") + ")[，,！!？?～~：:]", "u");
    return re.test(String(text || "").trim());
  }
  function sanitize(rawItems, members, userName) {
    const roster = new Map((members || []).filter(x => x && x.name).map(x => [String(x.name).trim(), x]));
    const items = [], dropped = [], thoughtsDropped = [];
    (Array.isArray(rawItems) ? rawItems : []).forEach((raw, index) => {
      const name = String(raw && raw.name || "").trim(), speaker = roster.get(name);
      if (!speaker || (userName && name === String(userName).trim())) { dropped.push({ index, reason: "not_a_member", name }); return; }
      if (selfVocative(raw.text, speaker)) { dropped.push({ index, reason: "self_vocative", name }); return; }
      const next = { ...raw, name };
      if (next.thought && selfVocative(next.thought, speaker)) { delete next.thought; thoughtsDropped.push({ index, reason: "self_vocative", name }); }
      items.push(next);
    });
    return { items, dropped, thoughtsDropped };
  }
  function splitBubbles(text) {
    const out = [];
    String(text || "").split(/\n+/).map(x => x.trim()).filter(Boolean).forEach(line => {
      const pieces = line.match(/.*?(?:……|\.\.\.|[。！？!?]+[”’"]?)(?=\s*|$)|.+$/gu) || [line];
      pieces.map(x => x.trim()).filter(Boolean).forEach(x => out.push(x));
    });
    return out;
  }
  return { aliases, selfVocative, sanitize, splitBubbles };
});
