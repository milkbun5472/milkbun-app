// 宠物监控（她 2026-11-02 群友「云养」）：只读这间房小镇存档里存下的那一份，不调模型；卡片发进这间房自己的聊天
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const seg = comp.slice(comp.indexOf("const PET_TASK_ZH = "), comp.indexOf("function PetWatchSheet("));
const { petWatchOf, petShareText } = new Function(seg + "; return { petWatchOf, petShareText };")();
const now = Date.now();
// 照 apps/pets/routine.mjs 写存档的样子：worlds.pets.pets[].{profile,care,life}
const store = { worlds: { pets: { pets: [
  { id: "p1", profile: { name: "团子", species: "cat" }, care: { satiety: 22.4, energy: 81, mood: 75, bowl: 0, task: { kind: "sleep", phase: "doing" }, recent: [] },
    life: { at: now - 3 * 3600e3, notes: [{ at: now - 5 * 3600e3, text: "团子自己到饭碗边吃过了。" }, { at: now - 4 * 3600e3, text: "团子在自己的窝里睡下了。" }] }, town: { place: "home" } },
  { id: "p2", profile: { name: "旺财", species: "dog" }, care: { satiety: 90, energy: 40, mood: 50, bowl: 30, task: null,
    recent: [{ text: "追着球跑了一圈。", wallAt: now - 600e3 }] }, life: {} },
  { id: "bad" } ] } } };
const pets = petWatchOf(store);
assert.equal(pets.length, 2, "没写完的那只不摆");
assert.equal(pets[0].satiety, 22); assert.equal(pets[0].doing, "在睡觉"); assert.equal(pets[0].bowl, 0);
assert.equal(pets[0].notes[0].text, "团子在自己的窝里睡下了。", "新的在前");
assert.equal(pets[1].doing, "闲着"); assert.equal(pets[1].notes[0].text, "追着球跑了一圈。", "没有 life.notes 时用最近那几件");
const txt = petShareText(pets[0]);
assert.match(txt, /^团子此刻在睡觉；饿了，精神很好，心情很好。最近：4 小时前，团子在自己的窝里睡下了。/);
assert.deepEqual(petWatchOf(null), []); assert.deepEqual(petWatchOf({ worlds: {} }), []);
// 不调模型
assert.doesNotMatch(comp.slice(comp.indexOf("const PET_TASK_ZH = "), comp.indexOf("function RoomWorldBanner(")), /callAI|runProbe/);
// 接线：这间房自己的存档；卡片发进这间房的聊天；玻璃账本皮不把它画成小票
assert.match(app, /petWatchKey: gardenRoomOf\(activeChar\.id, activeRoomId\) && window\.ChatRooms \? "x_fairyGarden::" \+ window\.ChatRooms\.chatKey\(activeChar\.id, activeRoomId\) : null,/);
assert.match(comp, /sendRich\(\{ role: "user", kind: "petshare",[^\n]*content: "\[宠物\] 给你看看" \+ txt \}\)/);
assert.match(comp, /m\.kind === "ledgershare" \|\| m\.kind === "petshare" \|\| m\.kind === "impshare"/);
assert.match(comp, /m\.kind !== "petshare" && m\.kind !== "impshare" && typeof window !== "undefined" && window\.ledgerIsGlass/);
console.log("ok");
