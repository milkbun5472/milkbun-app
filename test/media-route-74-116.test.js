// 试听「在播」却没声音：iPhone 静音键会把网页里的声音整个吞掉。所有 audio/video 开播时切到 playback，停了还回去。
const assert = require("node:assert/strict");
const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "components.js"), "utf8");
const a = src.indexOf("function routeCallAudio("), b = src.indexOf("(function routeAllMedia()"), e = src.indexOf("})();", b) + 5;
const log = [];
Object.defineProperty(globalThis, "navigator", { value: { audioSession: { type: "auto" } }, configurable: true, writable: true });
class Media { constructor() { this.l = {}; } play() { log.push("play"); return Promise.resolve(); } addEventListener(k, f) { (this.l[k] = this.l[k] || []).push(f); } removeEventListener(k, f) { this.l[k] = (this.l[k] || []).filter(x => x !== f); } fire(k) { (this.l[k] || []).slice().forEach(f => f()); } }
global.HTMLMediaElement = Media;
new Function(src.slice(a, src.indexOf("\n}\n", a) + 3) + src.slice(b, e))();
const m = new Media();
m.play();
assert.equal(navigator.audioSession.type, "playback", "plays through the media channel, not the ringer");
m.fire("ended");
assert.equal(navigator.audioSession.type, "auto", "gives it back when done");
assert.deepEqual(log, ["play"]);
console.log("media route 74.116 ok");
