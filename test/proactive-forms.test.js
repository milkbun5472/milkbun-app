const fs = require("fs"), assert = require("assert");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
// 她 2026-11-28「主动消息基本上就是纯文字」：主动那一轮说清楚也能发图、发表情，只给真能用的
assert(/const _proForms = opts\.proactive && !_body \? \[\]\.concat\(canSelfie && canSelfieImg \? \["拍一张此刻的照片"\] : \[\], emotes\.length \? \["发个表情包"\] : \[\]\)/.test(app));
assert(/const _taskFull = \(_body \? _digitalTaskFull : _normalTaskV2\) \+ _roomHint \+ _dirHint \+ _proHint;/.test(app));
console.log("ok proactive-forms");
