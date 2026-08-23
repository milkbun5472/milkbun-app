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

  function allows(message) {
    return !!message && !isFailureNotice(message);
  }

  function filter(messages) {
    return (Array.isArray(messages) ? messages : []).filter(allows);
  }

  return { isFailureNotice, isExcluded: isFailureNotice, allows, filter };
});
