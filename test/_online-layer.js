// 线上语域那三层（ONLINE_CHAT_RULE_V2 + REGISTER_FOLLOWS_SCENE + PERSONA_REGISTER_ANCHOR）
// 2026-10-03 合成了 engine.js 的 onlineRegisterLayer()：拉黑那条链只抄了第一条、
// 另外两条漏了整整一版，正是因为每个调用点都在手抄（one-public-mechanism）。
//
// 各处守「这个通道挂没挂这一层」的测试，原来 grep 的是三个常量名拼在一起的字面量。
// 合并之后字面量没了，但【这一层有没有挂上】这个意图一个字没变——
// 所以统一在这儿把调用展开回三个常量名再给它们扫，别让十来份测试各写一遍这个展开。
const LAYER = 'ONLINE_CHAT_RULE_V2 + "\\n\\n" + REGISTER_FOLLOWS_SCENE + "\\n\\n" + PERSONA_REGISTER_ANCHOR';
module.exports.expand = src => String(src).replace(/onlineRegisterLayer\(\)/g, LAYER);
