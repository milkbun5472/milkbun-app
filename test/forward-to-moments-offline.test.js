// 她 2026-11-22：多选 → 转发 加「发到朋友圈」（已有的图直接带进发朋友圈的框，不重画）；线下多选也能转发，照片原图落进单聊
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const app = fs.readFileSync("js/app.js", "utf8"), cp = fs.readFileSync("js/components.js", "utf8");
const slice = (src, from, to) => { const a = src.indexOf(from); const b = src.indexOf(to, a); assert.ok(a >= 0 && b > a, from); return src.slice(a, b); };
const fwdBlock = slice(app, "const fwdImageRef = async m =>", "const genScheduleWeek = async");

function harness() {
  const log = { chats: {}, groups: {}, drafts: [], toasts: [], screens: [], vault: 0 };
  const env = {
    groups: [{ id: "g1", name: "群" }], characters: [{ id: "c1", name: "阿秋" }], profile: { name: "我" },
    groupProfileFor: () => ({}), toast: m => log.toasts.push(m), gameChatText: m => String(m.content || ""),
    pChat: (id, f) => { log.chats[id] = f(log.chats[id] || []); }, pGChat: (id, f) => { log.groups[id] = f(log.groups[id] || []); },
    idbImgGet: async () => null, imgToVault: async x => { log.vault++; return x; },
    setMomCardDraft: d => log.drafts.push(d), setMsgTab: () => {}, setScreen: s => log.screens.push(s)
  };
  const names = Object.keys(env);
  const fn = new Function(...names, fwdBlock + "\nreturn { fwdImageRef, forwardEachTo, forwardMergeTo, forwardOfflineTo, momentDraftFromMsgs };");
  return { api: fn(...names.map(k => env[k])), log };
}

test("发到朋友圈：只有选中的里有图才出现那一行", () => {
  const src = slice(cp, "function chatSelImgItems(", "async function saveChatSelImgs");
  const chatSelImgItems = new Function(src + "\nreturn chatSelImgItems;")();
  assert.equal(chatSelImgItems([{ role: "user", content: "嗯" }], [0]).length, 0);
  assert.equal(chatSelImgItems([{ role: "user", content: "嗯" }, { role: "assistant", kind: "selfie", imgKey: "img_1" }], [0, 1]).length, 1);
  // 两处聊天都按这一份判：有图才把 onMoment 交给转发面板
  assert.equal((cp.match(/const fwdMoment = onToMoments && chatSelImgItems\(messages, selIds\)\.length \?/g) || []).length, 2);
  assert.equal((cp.match(/onSend: doForwardMany, onMoment: fwdMoment \}/g) || []).length, 2);
  // 面板里那一行只在给了 onMoment 时画
  const sheet = slice(cp, "function ForwardPickSheet(", "function ChatForwardSheet(");
  assert.match(sheet, /onMoment \? h\("button", \{ key: "moment", "data-wk": "fwdmoment", onClick: onMoment/);
});

test("发到朋友圈走她自己发朋友圈那一条：MomentCompose → onPostMoment(postUserMoment)", async () => {
  const { api, log } = harness();
  await api.momentDraftFromMsgs([{ role: "user", content: "字不带" }, { role: "user", kind: "photo", imageRef: "iv_a" }, { role: "assistant", kind: "photo", imgUrl: "https://x/y.png" }]);
  assert.deepEqual(log.drafts, [{ pics: ["iv_a", "https://x/y.png"] }]);
  assert.equal(log.vault, 0, "已有的引用原样用，不另存一份");
  assert.deepEqual(log.screens, ["messages"]);
  await api.momentDraftFromMsgs([{ role: "user", content: "只有字" }]);
  assert.equal(log.drafts.length, 1, "没有图不开框");
  // 带过去的图进的是同一个发朋友圈框，发出去还是 postUserMoment 那一处
  assert.match(cp, /pics0: \(cardDraft && cardDraft\.pics\) \|\| null,\n    onPost: onPostMoment,/);
  assert.match(cp, /const \[pics, setPics\] = useState\(\(\) => \(pics0 \|\| \[\]\)\.slice\(0, 9\)\)/);
  assert.equal((app.match(/onPostMoment: postUserMoment/g) || []).length, 2);
  assert.equal((app.match(/onToMoments: momentDraftFromMsgs/g) || []).length, 2);
});

test("线下照片逐条转发：落成她发的照片消息，用的是同一个图引用", async () => {
  const { api, log } = harness();
  const off = [
    { id: "u1", role: "user", kind: "photo", imageRef: "iv_off", desc: "海边" },
    { id: "c1", role: "char", content: "他笑了一下。" }
  ];
  await api.forwardOfflineTo(off, { type: "chat", id: "c1" }, "each", { from: "阿秋 · 线下", sourceId: "c1", nameOf: () => "x" });
  const rows = log.chats.c1;
  assert.equal(rows.length, 2);
  assert.equal(rows[0].role, "user"); assert.equal(rows[0].kind, "photo"); assert.equal(rows[0].imageRef, "iv_off"); assert.equal(rows[0].desc, "海边");
  assert.equal(rows[1].content, "他笑了一下。");
  assert.equal(log.vault, 0);
  // 合并：一张线下记录卡，照片还带着同一张图
  await api.forwardOfflineTo(off, { type: "chat", id: "c1" }, "merge", { from: "阿秋 · 线下", sourceId: "c1", nameOf: m => m.role === "user" ? "我" : "阿秋" });
  const card = log.chats.c1[2];
  assert.equal(card.kind, "chatforward"); assert.equal(card.forward.sourceType, "offline"); assert.equal(card.forward.items[0].img, "iv_off");
  // 线下底栏用的是线上那张转发面板
  const bar = slice(cp, "function OffPickBar(", "function OffCard(");
  assert.match(bar, /h\(ForwardPickSheet, \{/);
  assert.equal((app.match(/onForward: \(ms, d, mode\) => forwardOfflineTo\(/g) || []).length, 2);
});
