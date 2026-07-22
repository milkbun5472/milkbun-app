const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

test("starting a second recording waits for the previous recognizer to really end", async () => {
  const events = [];
  let recognitionId = 0;
  class FakeRecognition {
    constructor() { this.id = ++recognitionId; }
    start() { events.push(`rec${this.id}:start`); }
    stop() {
      events.push(`rec${this.id}:stop`);
      setTimeout(() => {
        events.push(`rec${this.id}:end`);
        if (this.onend) this.onend();
      }, 15);
    }
    abort() { events.push(`rec${this.id}:abort`); }
  }
  class FakeAudioContext {
    constructor() { this.sampleRate = 48000; }
    async resume() {}
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
    createAnalyser() {
      return { fftSize: 0, getFloatTimeDomainData(buf) { buf.fill(0); }, disconnect() {} };
    }
    async close() { events.push("audio:close"); }
  }
  const storage = new Map();
  let streamId = 0;
  const context = {
    window: { AudioContext: FakeAudioContext, SpeechRecognition: FakeRecognition },
    navigator: { mediaDevices: { async getUserMedia() {
      const id = ++streamId;
      events.push(`gum${id}`);
      return { getTracks: () => [{ stop: () => events.push(`track${id}:stop`) }] };
    } } },
    localStorage: {
      getItem: key => storage.has(key) ? storage.get(key) : null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: key => storage.delete(key)
    },
    performance: { now: () => Date.now() },
    setTimeout,
    clearTimeout,
    console
  };
  context.globalThis = context;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../js/ears.js"), "utf8"), context);

  const first = await context.window.Ears.start({});
  const secondPromise = context.window.Ears.start({});
  const second = await secondPromise;

  assert.ok(events.indexOf("rec1:end") < events.indexOf("gum2"), events.join(", "));
  assert.equal(events.filter(x => x === "rec1:stop").length, 1);
  await second.cancel();
  await first.cancel();
});
