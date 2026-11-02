// 她 2026-11-02：「给他和自己换聊天头像有提示吗」——原来只有她换自己的才有。给他换的也落灰字、他下一轮知道。
const assert = require("node:assert/strict"), fs = require("fs");
const app = fs.readFileSync("js/app.js", "utf8");
assert.match(app, /if \(\(s\.chatAvatar \|\| null\) !== \(activeChar\.chatAvatar \|\| null\)\) \{/);
assert.match(app, /waitForHer\(activeChar\.id, \{ hisAvatar: \{ ref: /);
assert.match(app, /const hisAvatarHint = opts\.hisAvatar \?/);
assert.match(app, /const remarkHint = avatarHint \+ hisAvatarHint/);
assert.match(app, /opts\.hisAvatar && opts\.hisAvatar\.ref; if \(_av/);
assert.match(app, /waitForHer\(activeChar\.id, \{ herAvatar: /, "她换自己的那条照旧");
