// 线上气泡里混进【线下那种身体动作描写】时，把它挪回动作行，别冒充「发出去的消息」。
//
// 她 2026-09-22 给的样张（读者截图）：四条白气泡、条条带已读时间戳——
//   「我把脸颊在她怀里贴紧了蹭两下」
//   「白发全蹭乱了堆在她锁骨边」
//   「环在她后腰的手微微收紧」
//   「不让她滑下去」
// 整整一轮，一句话都没说。这不是消息，是一段线下正文被塞进了聊天框。
//
// ⚠️为什么不去提示词里再加一条禁令：ONLINE_CHAT_RULE_V2 早就写着
//   「word 只包含角色此刻真正会发送出去的内容，不写旁白、动作、神态」——
//   规则已经发到了，还漏，说明这一层压不住（施工规则/bans-make-it-dumber：
//   已经有人管了就别再加一条）。要确定性就得上代码这把刀。
//
// ⚠️判据必须【整轮】看，不许一条一条判：
//   单看一条，「我妈来了」「她带了汤」跟动作描写分不开；
//   但【一整轮里一个「你」都没有、还条条在写身体和位置】的聊天是不存在的。
//   宁可漏判也不许误判——漏了只是维持现状，误判是把她真收到的话降级成旁白。
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.BubbleActGuard = api;
})(typeof window !== "undefined" ? window : globalThis, function () {
  const clean = v => String(v == null ? "" : v).replace(/\s+/g, " ").trim();

  // 对着她说话的痕迹。有这个就一定是消息，不用再往下看。
  const SECOND_PERSON = /[你妳您]/;
  // 问号、叹号、引号——都是「在说话」。动作描写不长这样。
  const SPEAKING = /[?？!！「」“”『』]/;

  // 硬证据：第三人称指代对方，后面紧跟身体部位、相对位置或贴身动作。
  // 这一族才是那张样张的病灶——线下正文原样搬进了聊天框。
  // ⚠️这张表不全也没关系：认不出来就什么都不做，维持现状。它只负责【确认】，不负责兜底。
  const BODY = "怀里|怀中|身上|身前|身后|身侧|后腰|腰上|腰间|腰|肩膀|肩头|肩|锁骨|脖子|颈窝|颈|头发|发顶|脸颊|脸|下巴|额头|眉心|耳朵|耳后|耳|唇|嘴角|手心|手腕|手背|手指|指尖|手|胳膊|臂弯|胸口|后背|背|腿上|腿|膝盖|膝|脚|眼睛|睫毛|皮肤|衣领|袖子|裙摆";
  const CONTACT = "滑|蹭|贴|靠|抱|搂|揽|环|箍|按|压|拽|揉|摸|捏|吻|亲|钻|缩|挣|僵|软|颤|抖|喘|扣|勾|攥|拢|托|扶";
  const THIRD = "(?:她|他|TA|Ta|ta)";
  // ⚠️只认【指着她】的那两种。原来还有第三种「身体部位＋贴身动作」、不要求出现她——
  //   她 2026-09-24 截图：「两手按在案边，别往后缩」是他【说出口的话】（祈使句，没有你、没有问号），
  //   却被这一条认成动作描写，整句挪进了居中的动作行。亲密场景里的台词大量是这种形状，
  //   不指着「她」的身体描写分不清是说还是做，分不清就不落刀。
  const ACT_EVIDENCE = new RegExp(
    THIRD + "(?:的)?\\s*(?:" + BODY + ")" +
    "|" + THIRD + "\\s*(?:就|又|才|还|也|会|要|在|正|慢慢|轻轻)?\\s*(?:" + CONTACT + ")"
  );

  // 这一条【有没有可能】是动作描写：只排除明显在说话的。宽进严出——
  // 真正定性靠 ACT_EVIDENCE 那一条硬证据，这儿只负责把会说话的先摘出去。
  function couldBeAct(value) {
    const text = clean(value);
    if (!text) return false;
    if (SECOND_PERSON.test(text)) return false;
    if (SPEAKING.test(text)) return false;
    return true;
  }

  function hasActEvidence(value) {
    return ACT_EVIDENCE.test(clean(value));
  }

  // words → { words, acts }。认不出来时原样返回（words 不变、acts 为空）。
  // opts.secondPerson：本场「怎么称呼对方」是不是第二人称。她把称谓设成第三人称时，
  //   「她」本来就是对的，这把刀整个不许落（施工规则/no-yes-unless：不成立就不出手，
  //   不是出手之后再挂一句除非）。
  function split(words, opts) {
    const list = (Array.isArray(words) ? words : []).map(clean).filter(Boolean);
    const o = opts || {};
    const nothing = { words: Array.isArray(words) ? words : [], acts: [] };
    if (o.secondPerson === false) return nothing;
    if (list.length < 2) return nothing;
    if (!list.every(couldBeAct)) return nothing;
    // 至少一半的行要有硬证据，不是「有一行就够」：一轮里夹一句写她身体的，
    //   不足以把其余几句台词一起判成动作。
    if (list.filter(hasActEvidence).length * 2 < list.length) return nothing;
    return { words: [], acts: list };
  }

  return { split, couldBeAct, hasActEvidence };
});
