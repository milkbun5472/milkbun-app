(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ChatContextFilter = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  // 旧版本没有落 contextExcluded 标记，只能按 App 自己生成的固定失败气泡补认。
  // 必须锚定开头和括号，不能误伤用户正常说的「这次发送失败让我很烦」。
  const LEGACY_FAILURE_NOTICE = /^\s*[（(]\s*(?:发送失败\s*[：:]|群聊生成失败(?:\s*[·・][^：:）)]*)?\s*[：:])/;

  function isFailureNotice(message) {
    if (!message) return false;
    if (message.contextExcluded === true || message.systemFailure === true) return true;
    return LEGACY_FAILURE_NOTICE.test(String(message.content || ""));
  }

  // 失败提示长什么样，只有这一处说了算（她 2026-09-14：「单聊的是系统提示可以叉掉，
  // 群聊的是气泡，改成跟单聊一样，用公共的格式」）。
  // ⚠️原来两边各拼各的：单聊写 kind:"system"（渲染那头认 kind），群聊写
  //   senderName:"系统"（渲染那头认 role）——同一件事两种形状，于是群里那条掉进了
  //   普通气泡，既叉不掉、也长得像谁说的话。
  //   这一份同时管【怎么写】和【怎么认】，两头再也分不了家。
  function failureNotice(text, extra) {
    return Object.assign({
      role: "assistant",
      kind: "system",
      contextExcluded: true,
      systemFailure: true,
      content: String(text == null ? "" : text),
      ts: Date.now()
    }, extra || {});
  }

  function allows(message) {
    return !!message && !isFailureNotice(message);
  }

  function filter(messages) {
    return (Array.isArray(messages) ? messages : []).filter(allows);
  }

  return { isFailureNotice, isExcluded: isFailureNotice, failureNotice, allows, filter };
});
