// 她 2026-11-02：「给他和自己换聊天头像有提示吗」——原来只有她换自己的才有。给他换的也落灰字、他下一轮知道。
const assert = require("node:assert/strict"), fs = require("fs");
const app = fs.readFileSync("js/app.js", "utf8");
assert.match(app, /if \(\(s\.chatAvatar \|\| null\) !== \(activeChar\.chatAvatar \|\| null\)\) \{/);
assert.match(app, /waitForHer\(activeChar\.id, \{ hisAvatar: \{ ref: /);
assert.match(app, /const hisAvatarHint = opts\.hisAvatar \?/);
assert.match(app, /const remarkHint = avatarHint \+ hisAvatarHint/);
assert.match(app, /opts\.hisAvatar && opts\.hisAvatar\.ref; if \(_av/);
assert.match(app, /waitForHer\(activeChar\.id, \{ herAvatar: /, "她换自己的那条照旧");
// 她 2026-11-02：换了没说话他当没看见；第二轮提起头像他就看不到了。记半天，提起头像时把那张再给他看
assert.match(app, /const noteAvatarChange = /);
assert.equal((app.match(/noteAvatarChange\(activeChar\.id, "(his|her)"/g) || []).length, 2);
assert.match(app, /const remarkHint = avatarHint \+ hisAvatarHint \+ avatarLaterHint/);
assert.match(app, /if \(_avLaterRefs\.length\) g\[_i\] = /);
assert.match(app, /但别当它没发生/);
assert.doesNotMatch(app, /看见了想说就说，不想说也行/);
