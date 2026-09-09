// 独立 Chromium + 真 React/CallScreen；TTS、翻译、存档全为桩，不访问用户数据或收费服务。
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'js/components.js'), 'utf8');
const fn = name => { const i = src.indexOf('function ' + name + '('); return src.slice(i, src.indexOf('\n}\n', i) + 3); };
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const width of [390, 320]) for (const mode of ['voice', 'video']) {
      const ctx = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: 'block' });
      const page = await ctx.newPage(), errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.route('**/*', r => r.abort());
      await page.setContent('<div id="root" style="height:100vh;position:relative"></div>');
      for (const f of ['react.production.min.js', 'react-dom.production.min.js', 'tailwind.js']) await page.addScriptTag({ content: fs.readFileSync(path.join(root, 'vendor', f), 'utf8') });
      await page.evaluate(() => {
        Object.assign(window, { useState: React.useState, useRef: React.useRef, useEffect: React.useEffect, h: React.createElement,
          F_BODY: 'sans-serif', F_DISPLAY: 'serif', useTheme: () => ({ ink: '#222', line: '#ddd' }), BUBBLE_SKIN: {},
          useIdbImgUrl: () => null, callBackdrop: () => '#252a30', callBubble: u => ({ background: u ? '#f0bec7' : '#aac8e2', color: '#222' }),
          ttsReady: () => true, markTtsCached: () => {}, translatableLang: t => /^[A-Z]/.test(t) ? '英文' : '', transCacheGet: () => null });
        ['Svg', 'IPulse', 'ISend', 'CGlyph'].forEach(n => window[n] = () => h('svg', { width: 18, height: 18 }));
        window.saved = {}; window.loadJSON = (k, d) => saved[k] ?? d; window.saveJSON = (k, v) => { saved[k] = v; return true; };
        window.requests = []; window.pending = []; window.sources = []; window.overlap = false; window.activeSounds = 0; window.translations = [];
        window.Audio = class {
          play() { if (this.src && !this.active) { this.active = true; activeSounds++; if (activeSounds > 1) overlap = true; } return Promise.resolve(); }
          pause() { if (this.active) { this.active = false; activeSounds--; } }
        };
        window.ttsSpeak = (text, voice) => { requests.push({ text, voice }); return new Promise(resolve => pending.push(() => resolve(new Blob(['fixture'])))); };
        window.translateLongToZh = async text => { translations.push(text); return { zh: '译文：' + text, by: '测试' }; };
        window.AudioContext = class {
          constructor() { this.state = 'suspended'; this.destination = {}; }
          async resume() { this.state = 'running'; }
          async close() { this.state = 'closed'; }
          createBuffer() { return { silent: true }; }
          async decodeAudioData() { return { duration: 30 }; }
          createBufferSource() {
            const s = { connect() {}, start() { if (s.buffer.silent) return; s.started = true; activeSounds++; if (activeSounds > 1) overlap = true; sources.push(s); },
              stop() { if (s.started && !s.done) { s.done = true; activeSounds--; if (s.onended) s.onended(); } } };
            return s;
          }
        };
      });
      await page.addScriptTag({ content: ['onlineTranslationAuto', 'setOnlineTranslationAuto', 'useOnlineTranslationAuto', 'OnlineTranslationControl', 'useTtsPlayer', 'TransText', 'TransTextState', 'CallScreen'].map(fn).join('\n') });
      await page.evaluate(mode => {
        window.props = { mode, participants: [{ id: 'a', name: '甲', voiceId: 'va' }, { id: 'b', name: '乙', voiceId: 'vb' }, { id: 'c', name: '无音色' }],
          msgs: [{ role: 'char', senderId: 'a', content: 'History', zh: '旧消息' }], sending: false,
          onSend: () => {}, onHangup: () => { rootRender.unmount(); }, onMinimize: () => draw({ minimized: true }), onRestore: () => draw({ minimized: false }) };
        window.rootRender = ReactDOM.createRoot(document.getElementById('root'));
        window.draw = changes => { Object.assign(props, changes); rootRender.render(h(CallScreen, props)); };
        draw({});
      }, mode);
      await page.getByRole('button', { name: '连续播报：关' }).waitFor();
      assert.equal(await page.locator('[data-wk="translatebody"]').count(), 0);
      await page.getByRole('button', { name: '译文：点击显示' }).click();
      await page.locator('[data-wk="translatebody"]').waitFor();
      assert.deepEqual(await page.evaluate(() => translations), []); // 附带译文零调用
      await page.getByRole('button', { name: '译文：直接显示' }).click();
      await page.waitForFunction(() => !document.querySelector('[data-wk="translatebody"]'));
      await page.getByRole('button', { name: '连续播报：关' }).click();
      await page.getByRole('button', { name: '连续播报：开' }).waitFor();
      assert.deepEqual(await page.evaluate(() => requests), []); // 开启不补历史
      await page.evaluate(() => draw({ msgs: [...props.msgs, { role: 'user', content: 'User' }, { role: 'char', act: true, content: 'Action' },
        { role: 'char', senderId: 'a', content: 'First', zh: '第一句' }, { role: 'char', senderId: 'b', content: 'Second', zh: '第二句' },
        { role: 'char', senderId: 'c', content: 'No voice' }] }));
      await page.waitForFunction(() => requests.length === 1);
      await page.evaluate(() => pending.shift()());
      await page.waitForFunction(() => sources.length === 1);
      assert.equal(await page.evaluate(() => requests.length), 1);
      await page.evaluate(() => { draw({ minimized: true }); });
      await page.waitForFunction(() => !document.querySelector('[data-call-options]'));
      await page.evaluate(() => { draw({ minimized: false }); sources[0].stop(); });
      await page.waitForFunction(() => requests.length === 2);
      assert.deepEqual(await page.evaluate(() => requests), [{ text: 'First', voice: 'va' }, { text: 'Second', voice: 'vb' }]);
      // 合成中的第二句被关闭，不允许迟到音频响起。
      await page.getByRole('button', { name: '连续播报：开' }).click();
      await page.evaluate(() => pending.shift()());
      await page.waitForTimeout(50);
      assert.equal(await page.evaluate(() => sources.length), 1);
      await page.getByRole('button', { name: '连续播报：关' }).click();
      await page.evaluate(() => draw({ msgs: [...props.msgs, { role: 'char', senderId: 'b', content: 'Third' }] }));
      await page.waitForFunction(() => requests.length === 3);
      await page.evaluate(() => pending.shift()());
      await page.waitForFunction(() => sources.length === 2);
      await page.getByRole('button', { name: '连续播报：开' }).click();
      assert.equal(await page.evaluate(() => activeSounds), 0);
      // 窄屏控件不出界，只有消息区滚动。
      const layout = await page.evaluate(() => { const controls = [...document.querySelectorAll('[data-call-options] button')].map(e => { const r = e.getBoundingClientRect(); return { left: r.left, right: r.right }; }); return { controls, width: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth }; });
      assert.equal(layout.overflow, false);
      assert.ok(layout.controls.every(r => r.left >= 0 && r.right <= layout.width));
      if (width === 320 && mode === 'video') await page.screenshot({ path: '/tmp/lisa-call-options.png' });
      await page.getByRole('button', { name: '连续播报：关' }).click();
      await page.evaluate(() => draw({ msgs: [...props.msgs, { role: 'char', senderId: 'a', content: 'Late' }] }));
      await page.waitForFunction(() => requests.length === 4);
      await page.evaluate(() => { rootRender.unmount(); pending.shift()(); });
      await page.waitForTimeout(50);
      assert.equal(await page.evaluate(() => sources.length), 2);
      assert.equal(await page.evaluate(() => overlap), false);
      assert.equal(await page.evaluate(() => saved.x_callAutoVoice), true);
      // 新通话记住偏好但等待手势；单人也走相同队列，开麦本身不补播。
      await page.evaluate(() => {
        window.SpeechRecognition = class { start() { if (this.onaudiostart) this.onaudiostart(); } stop() {} };
        window.rootRender = ReactDOM.createRoot(document.getElementById('root'));
        draw({ msgs: [], participants: [props.participants[0]], bye: null });
      });
      await page.getByRole('button', { name: '连续播报：点此启用' }).waitFor();
      await page.getByRole('button', { name: '开启麦克风' }).click();
      await page.getByRole('button', { name: '关闭麦克风' }).waitFor();
      await page.getByRole('button', { name: '连续播报：开' }).waitFor();
      assert.equal(await page.evaluate(() => requests.length), 4);
      await page.getByRole('button', { name: '连续播报：开' }).click();
      await page.evaluate(() => draw({ msgs: [{ role: 'char', content: 'Manual', zh: '手动' }] }));
      await page.getByRole('button', { name: '播放这句' }).click();
      await page.waitForFunction(() => requests.length === 5);
      await page.evaluate(() => pending.shift()());
      await page.waitForFunction(() => activeSounds === 1);
      // 自动接管先停止手动音频，原生识别也不会同时听扬声器。
      await page.getByRole('button', { name: '连续播报：关' }).click();
      await page.getByRole('button', { name: '连续播报：开' }).waitFor();
      assert.equal(await page.evaluate(() => activeSounds), 0);
      await page.getByRole('button', { name: '译文：点击显示' }).click();
      await page.evaluate(() => draw({ msgs: [...props.msgs, { role: 'char', content: 'Goodbye', zh: '再见' }] }));
      await page.waitForFunction(() => requests.length === 6);
      await page.waitForFunction(() => [...document.querySelectorAll('[data-wk="translatebody"]')].some(e => e.textContent.includes('再见')));
      assert.equal(await page.evaluate(() => requests[5].voice), 'va');
      // 对方挂断时尚未完成的合成不得播放。
      await page.evaluate(() => draw({ bye: { name: '甲' } }));
      await page.waitForFunction(() => document.body.textContent.includes('甲挂断了'));
      await page.evaluate(() => pending.shift()());
      await page.waitForTimeout(50);
      assert.equal(await page.evaluate(() => sources.length), 2);
      // 两个入口和五种线上译文同时挂载，修改全局偏好要即时联动。
      await page.evaluate(() => {
        rootRender.unmount();
        rootRender = ReactDOM.createRoot(document.getElementById('root'));
        setOnlineTranslationAuto(false);
        rootRender.render(h('div', { style: { padding: 12 } }, h(OnlineTranslationControl, {}), h(OnlineTranslationControl, { compact: true }),
          ...['Single', 'Group', 'Voice', 'Video', 'Receipt'].map(text => h('div', { key: text, style: { marginTop: 12 } }, h(TransText, { text, zhReady: '译文' + text }))),
          h(TransText, { text: '纯中文' })));
      });
      await page.waitForFunction(() => document.querySelector('[data-online-translation-setting]'));
      await page.waitForFunction(() => document.querySelectorAll('[data-wk="translatebody"]').length === 0);
      await page.getByRole('button', { name: '译文：点击显示' }).first().click();
      await page.waitForFunction(() => document.querySelectorAll('[data-wk="translatebody"]').length === 5);
      assert.equal(await page.getByRole('button', { name: '译文：直接显示' }).count(), 2);
      await page.locator('[data-wk="translatebutton"]').first().click();
      assert.equal(await page.locator('[data-wk="translatebody"]').count(), 4); // 仍可逐条收起
      await page.getByRole('button', { name: '译文：直接显示' }).last().click();
      await page.waitForFunction(() => document.querySelectorAll('[data-wk="translatebody"]').length === 0);
      assert.equal(await page.evaluate(() => saved.x_onlineAutoZh), false);
      if (width === 320 && mode === 'voice') await page.screenshot({ path: '/tmp/lisa-global-translation.png' });
      assert.deepEqual(errors, []);
      console.log('PASS', width, mode, 'queue/cancel/unmount/translation/layout');
      await ctx.close();
    }
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
