(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.StoragePolicy = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const LOCAL_LIMIT = 5 * 1024 * 1024;
  // 本机每个会话留最近多少条。
  // ⚠️v61.78 整体抬了五倍（200 → 1000）。原来那几个数是照着 localStorage 那 5MB
  //   定的，但聊天早就搬进 IndexedDB 了（IDB_TEXT_PREFIXES 里有 "x_chat:"/"x_gchat:"），
  //   IDB 的配额是几百 MB 起，跟那 5MB 没关系——**这个数在防一个已经不存在的墙**。
  //   而它的代价是真的：留得少＝上下文里能取的原文就少（她 2026-09-04 报刚建回来的
  //   角色收不到旧聊天，本地只有那么点）。
  //   下面两档压力线保留着当安全阀，但也一起抬——localStorage 挤爆的现在多半不是聊天，
  //   靠砍聊天来救那 5MB 本来就救不到几个字节。
  //   ⚠️这个数不决定【喂给模型多少】：那是「短期窗字符预算」管的。它只决定本机手上
  //   有多少原文可供那个预算去取——手上没有，预算再大也取不到。
  function chatKeep(bytes, limit) {
    const cap = Number(limit) > 0 ? Number(limit) : LOCAL_LIMIT;
    const ratio = Math.max(0, Number(bytes) || 0) / cap;
    if (ratio >= 0.9) return 400;
    if (ratio >= 0.8) return 600;
    return 1000;
  }
  return { LOCAL_LIMIT, chatKeep };
});
