// 她 2026-09-04：「把主页我的名片和我聊天头像分成俩不一样的吧，我想改名片的。
// 然后名片的背景放了照片没办法移除也弄一下。」
//
// 第二件不是功能缺失——「去掉」一直在，只是做成了最右边一行 12px 的灰字：
// 没边框、没底、跟旁边那段说明挤在一起，右下角那只浮标还压住它半边。
// 「没办法移除」＝【找不到】。这一条钉的是那颗按钮真的看得见、点得着。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const SHEET = comp.slice(comp.indexOf("function HomeCardSheet({"), comp.indexOf("function ProfileSheet({"));
const CARD = comp.slice(comp.indexOf("// 主页名片（v60.84 再改）"), comp.indexOf("function HomeCardSheet({"));
assert.ok(SHEET.length > 1500 && CARD.length > 1500, "抠不出名片那两段");

test("名片头像跟聊天头像是两份，没单独设就跟着聊天那张", () => {
  // 原来名片上画的就是 profile.avatarImage——改名片等于改聊天，她要分开
  assert.match(CARD, /avatarImage: c\.avatar \|\| profile\.avatarImage/,
    "名片还在直接画 profile.avatarImage，改一处两处都变");
  assert.match(SHEET, /const \[avatar, setAvatar\] = useState\(c\.avatar \|\| ""\);/);
  assert.match(SHEET, /avatar: avatar \|\| ""/, "保存时没把名片头像写进去");
});

test("编辑名片里能换、也能换回来", () => {
  assert.match(SHEET, /名片头像/);
  assert.match(SHEET, /onChange: pickAvatar/, "选图那条线没接上");
  assert.match(SHEET, /removeBtn\("换回跟聊天同一张", \(\) => setAvatar\(""\)\)/);
  // 说明得跟着状态变：没设时要说清「现在跟聊天是同一张」
  assert.match(SHEET, /avatar \? "这张只用在名片上[^"]*" : "现在跟聊天里的「我」是同一张[^"]*"/);
});

test("移除封面是一颗看得见的按钮，不是角落里一行灰字", () => {
  assert.match(SHEET, /const removeBtn = \(label, onClick\) => h\("button"/);
  const rb = SHEET.slice(SHEET.indexOf("const removeBtn ="), SHEET.indexOf("}, label);"));
  // 有框、有底、用强调色——三样里一样都不能少，不然又变成「看不见的功能」
  assert.match(rb, /border: "1px solid " \+ t\.line/, "没有边框");
  assert.match(rb, /background: t\.bg/, "没有底");
  assert.match(rb, /color: t\.accent/, "还是灰字");
  assert.match(rb, /padding: "7px 15px"/, "点击区太小");
  assert.match(SHEET, /removeBtn\("移除封面", \(\) => setCover\(""\)\)/);
  // 旧那颗灰字要删掉（撤东西是删掉，不是留着）
  assert.doesNotMatch(SHEET, /fontSize: 12, color: t\.fog, flexShrink: 0 \} \}, "去掉"\)/, "角落那行灰字还在");
});

test("两颗移除按钮排在说明底下，不再挤在最右边被浮标压住", () => {
  // 病根是 flex 那一行把按钮塞到最右：右下角那只浮标正好压在那儿。
  // 现在它们是说明的下一行（alignSelf:flex-start），横向不占最右边。
  assert.match(SHEET, /alignSelf: "flex-start"/);
  const rows = [...SHEET.matchAll(/h\("div", \{ className: "flex items-(start|center)", style: \{ gap: 12/g)].map(m => m[1]);
  assert.deepEqual(rows, ["start", "start"], "头像行和封面行要顶对齐（按钮在第二行，居中会把整行撑歪）");
  // 两行都得是竖排——只改一行的话，另一行的按钮又会被挤回最右边（浮标底下）
  assert.equal((SHEET.match(/className: "flex-1 min-w-0 flex flex-col"/g) || []).length, 2,
    "头像行和封面行要各有一栏竖排的说明，按钮才落得到下一行");
});

test("名片上的名字也跟着名片走", () => {
  // 头像分开了，名字还跟着 profile 的话，名片上会出现「她的头像 + 别处的名字」
  assert.match(CARD, /name: c\.name \|\| profile\.name/);
});

test("名片头像外面不再镶一圈白框", () => {
  // 她 2026-09-04：「名片头像那个白框也去掉吧」。那圈白是 padding:2.5 + 一层白底
  // 垫出来的——当初为了让头像在封面照上跳出来，代价是它永远镶在一个跟主题无关的白框里。
  // 分离改交给投影：压在照片上重一档、没封面轻一档。
  const btn = CARD.slice(CARD.indexOf('h("button", { onClick: onEditProfile'), CARD.indexOf("size: 53, radius: 13"));
  assert.ok(btn.length > 100 && btn.length < 900, "抠不出头像那颗按钮");
  assert.doesNotMatch(btn, /padding: 2\.5/, "那圈白框的 padding 又回来了");
  assert.doesNotMatch(btn, /rgba\(255,255,255,\.85\)/, "白底又回来了");
  assert.doesNotMatch(btn, /background:/, "头像按钮又垫了一层底");
  // 投影得跟着有没有封面走，不然压在深色照片上就糊了
  assert.match(btn, /boxShadow: onCover \? "0 3px 12px rgba\(0,0,0,\.42\)" : "0 3px 10px rgba\(30,28,24,\.2\)"/);
});
