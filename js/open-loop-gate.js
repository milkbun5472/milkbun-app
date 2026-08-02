// 自动记忆的开环资格闸：
// “未来会做”不等于“值得持续惦记”。只收明确承诺、共同约定、关系裂口、
// 悬而未决的心事与有后果的等待；普通吃饭/洗澡/上班安排仍可记，但不标 open。
(function (root) {
  "use strict";

  const STRONG = /约好|说好|答应|承诺|保证|欠(?:你|他|她|对方)|等(?:你|他|她|对方)(?:回来|回复|回应|答复)|陪(?:你|他|她|对方)|陪.{1,10}(?:去|到)(?:医院|看医生|手术|接机|送机|考试|面试)|给(?:你|他|她|对方)(?:做|带|买|送|写|打|回)|一起(?:去|做|看|吃|玩|见|过)|见面|赴约|兑现|没和好|还没和好|争执未解决|矛盾未解决|心结|悬着|等待.{0,8}(?:结果|答复|回应|决定|消息)|待确认|待决定|尚未决定|还没决定|没有结果/;
  const RELATION = /关系|恋人|分手|复合|边界|信任|道歉|原谅|释怀|冷战|争执|矛盾|心事|心结|承诺|约定/;
  const ROUTINE = /(?:今天|今晚|今早|明天|明早|明晚|后天|当天|当晚|待会|一会儿|等会儿|稍后|下午|晚上|早上|中午|周[一二三四五六日天]|周末|下班后|放学后|醒来后|吃完(?:饭|早餐)|忙完后|到家后|早点)?.{0,18}(?:想|要|会|准备|一起|陪(?:你|他|她|对方))?(?:吃|喝|煮|点|买)(?:什么|啥|点东西|一顿|粥|饭|面|早餐|午饭|晚饭|晚餐|夜宵|咖啡|奶茶|水果|火锅|烧烤)|洗澡|洗头|睡觉|起床|上班|下班|上课|下课|健身|跑步|散步|做饭|收拾|打扫|洗衣|看剧|看电影|看动画|刷视频|刷手机|打游戏|打球|羽毛球|按摩|揉(?:脖子|肩|腿|肚子)|回宿舍|回家|过夜/;
  const SHORT_TIME = /今天|今晚|今早|明天|明早|明晚|后天|当天|当晚|待会|一会儿|等会儿|稍后|下午|晚上|早上|中午|周[一二三四五六日天]|周末|下班后|放学后|醒来后|吃完(?:饭|早餐)|忙完后|到家后|早点/;
  const SHORT_ACTIVITY = /吃|喝|饭|粥|早餐|午饭|晚饭|晚餐|夜宵|做饭|买菜|超市|揉|按摩|打球|羽毛球|运动|健身|刷手机|看电影|看动画|睡|过夜|回来|陪伴|洗澡|散步|逛街|喝咖啡|发照片|发语音|拍照|聊天|玩游戏|打牌|约会/;
  // 日常里偶尔也真有不能漏的重约定，例如生日饭、接送/就医等有明确后果的安排。
  // 只有正文自己带这些证据才允许越过日常闸；模型随手打的“约定”标签不算证据。
  const ROUTINE_EXCEPTION = /生日|纪念日|婚礼|求婚|赴约|预约|医院|看医生|手术|接机|送机|航班|考试|面试|截止|deadline|过敏|忌口/;

  function evaluate(entry) {
    const e = entry || {};
    if (!e.open) return { open: false, reason: "not_proposed" };
    if (e.source === "manual") return { open: true, reason: "manual" };
    const text = String(e.text || "").replace(/\s+/g, " ").trim();
    const tags = (Array.isArray(e.tags) ? e.tags : []).join(" ");
    const hay = text + " " + tags;
    // v51.39：必须先挡日常。真实抽取常把“今晚一起吃粥”写成“共同约定”，
    // 若先测 STRONG，就会被“一起吃/约定”绕过，造成数百条伪开环。
    if ((ROUTINE.test(text) || (SHORT_TIME.test(text) && SHORT_ACTIVITY.test(text))) && !ROUTINE_EXCEPTION.test(text)) {
      return { open: false, reason: "routine_plan" };
    }
    // 强证据只认正文，不认模型标签；标签只能辅助高情绪关系裂口，不能凭空制造承诺。
    if (STRONG.test(text)) return { open: true, reason: "explicit_commitment_or_unresolved" };
    if (RELATION.test(hay) && Number(e.a || 0) >= 2) return { open: true, reason: "relationship_weight" };
    return { open: false, reason: "future_fact_without_open_loop_evidence" };
  }

  function normalize(entry) {
    const verdict = evaluate(entry);
    return Object.assign({}, entry, { open: verdict.open });
  }

  const api = Object.freeze({ evaluate, normalize });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.OpenLoopGate = api;
})(typeof window !== "undefined" ? window : globalThis);
