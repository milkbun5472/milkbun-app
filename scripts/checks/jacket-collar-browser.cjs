// Actual lazy-loaded jacket, close views and body/dye/action regressions.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.CLOTH_TEST_URL || 'http://127.0.0.1:18931';
const out = process.env.CLOTH_TEST_OUT || '/tmp/jacket-collar';
fs.mkdirSync(out, { recursive: true });
(async () => {
 const browser = await chromium.launch({ channel: 'chrome', headless: true });
 try {
  const page = await browser.newPage({ viewport: { width: 1800, height: 700 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/pet.mjs*', r => r.fulfill({ body: '', contentType: 'text/javascript' }));
  if (process.env.JACKET_MODEL) await page.route('**/outfits/jacket.glb*', r => r.fulfill({ path: process.env.JACKET_MODEL, contentType: 'model/gltf-binary' }));
  await page.goto(base + '/apps/companion/');
  await page.evaluate(async () => {
   const T = await import('three');
   const { GLTFLoader } = await import('../fairy-garden/vendor/GLTFLoader.js');
   const { DRACOLoader } = await import('../fairy-garden/vendor/DRACOLoader.js');
   const { createTraveler, preloadOutfits, preloadHair } = await import('../fairy-garden/traveler.mjs');
   const decoder = new DRACOLoader(); decoder.setDecoderPath('../fairy-garden/vendor/draco/');
   const loader = new GLTFLoader(); loader.setDRACOLoader(decoder);
   const source = (await loader.loadAsync('../fairy-garden/doll.glb')).scene;
   await Promise.all([preloadOutfits(), preloadHair(['curtains'])]);
   const catalog = await (await fetch('../fairy-garden/doll.json')).json();
   const scene = new T.Scene(); scene.background = new T.Color('#f0e8db');
   scene.add(new T.HemisphereLight('#fff', '#aaa', 2.3));
   const light = new T.DirectionalLight('#fff', 1.5); light.position.set(2, 3, 4); scene.add(light);
   const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
   renderer.setSize(1800, 600); renderer.domElement.id = 'collar-qa';
   document.body.replaceChildren(renderer.domElement);
   const camera = new T.OrthographicCamera(-.18, .18, .18, -.18, .1, 20);
   window.collarQA = { T, source, catalog, createTraveler, scene, renderer, camera, dolls: [] };
  });
  for (const mode of ['default', 'min', 'max', 'tinted', 'stretch', 'wave', 'sit']) {
   const visiblePixels = await page.evaluate(mode => {
    const { T, source, catalog, createTraveler, scene, renderer, camera, dolls } = collarQA;
    for (const d of dolls) scene.remove(d.root); dolls.length = 0;
    renderer.setScissorTest(true);
    [0, .85, 3.14].forEach((angle, col) => {
     dolls.forEach(d => { d.root.visible = false; });
     const dims = Object.fromEntries(catalog.dims.map(d => [d.key, ['min', 'max'].includes(mode) ? d[mode] : 1]));
     const d = createTraveler(source, false, { outfit: 'jacket', hair: 'curtains', dims });
     if (mode === 'tinted') d.setLook({ outfitColors: { cloth: '#829b79', trim: '#e9c9cb' } });
     scene.add(d.root); dolls.push(d);
     for (let f = 0; f < 30; f++) d.animate(f * .1, { gesture: ['stretch', 'wave'].includes(mode) ? mode : 'rest', progress: .5, seated: mode === 'sit' });
     d.root.rotation.y = angle;
     renderer.setViewport(col * 600, 0, 600, 600); renderer.setScissor(col * 600, 0, 600, 600);
     const p = new T.Vector3(0, .716, 0);
     d.root.getObjectByName('TravelerVisual').localToWorld(p);
     camera.position.set(0, p.y, 6); camera.lookAt(0, p.y, 0);
     renderer.render(scene, camera);
    });
    renderer.setScissorTest(false);
    const pixels = new Uint8Array(1800 * 600 * 4), gl = renderer.getContext();
    gl.readPixels(0, 0, 1800, 600, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let ink = 0; for (let i = 0; i < pixels.length; i += 4) if (pixels[i] < 200) ink++;
    return ink;
   }, mode);
   assert(visiblePixels > 10000, mode + ' must actually render the garment');
   await page.locator('#collar-qa').screenshot({ path: `${out}/${mode}.png` });
  }
  const dye = await page.evaluate(() => {
   const { T, source, createTraveler, scene, renderer, camera, dolls } = collarQA;
   for (const d of dolls) scene.remove(d.root); dolls.length = 0;
   const d = createTraveler(source, false, { outfit: 'jacket', hair: 'curtains' });
   scene.add(d.root); d.animate(0, { height: 0 });
   const p = new T.Vector3(0, .716, 0); d.root.getObjectByName('TravelerVisual').localToWorld(p);
   camera.position.set(0, p.y, 6); camera.lookAt(0, p.y, 0);
   renderer.setSize(600, 600); renderer.setViewport(0, 0, 600, 600);
   const gl = renderer.getContext(), capture = () => {
    renderer.render(scene, camera); const pixels = new Uint8Array(600 * 600 * 4);
    gl.readPixels(0, 0, 600, 600, gl.RGBA, gl.UNSIGNED_BYTE, pixels); return pixels;
   };
   const result = [];
   for (const part of ['folded_collar', 'shirt_collar', 'shirt_yoke']) {
    const mesh = d.root.getObjectByName('outfit_jacket_' + part);
    if (!mesh?.userData.dyeSlot) throw Error('Missing authored fabric ' + part);
    d.root.traverse(o => { if (o.isMesh) o.visible = o === mesh; });
    d.setLook({ outfitColors: { cloth: '#888888', trim: '#888888' } });
    d.root.traverse(o => { if (o.isMesh) o.visible = o === mesh; });
    const plain = capture(), changes = {};
    for (const slot of ['cloth', 'trim']) {
     d.setLook({ outfitColors: { cloth: '#888888', trim: '#888888', [slot]: '#ee3344' } });
     d.root.traverse(o => { if (o.isMesh) o.visible = o === mesh; });
     const color = capture(); let changed = 0;
     for (let i = 0; i < plain.length; i += 4) if (Math.max(...[0, 1, 2].map(k => Math.abs(plain[i + k] - color[i + k]))) > 8) changed++;
     changes[slot] = changed;
    }
    result.push({ part, owner: mesh.userData.dyeSlot, changes });
   }
   return result;
  });
  for (const r of dye) for (const slot of ['cloth', 'trim']) {
   assert(r.owner === slot ? r.changes[slot] > 500 : r.changes[slot] === 0, JSON.stringify(r));
  }
  const mobile = await browser.newPage({ viewport: { width: 390, height: 520 } });
  mobile.on('pageerror', e => errors.push(e.message));
  await mobile.goto(base + '/apps/companion/');
  await mobile.waitForFunction(() => window.petDebug);
  await mobile.evaluate(async () => {
   document.body.style.background = '#f0e8db';
   window.postMessage({ type: 'pet-look', ta: '领口验图', characterId: 'collar-qa', look: { outfit: 'jacket', hair: 'curtains', face: 'default' } }, '*');
   await new Promise(requestAnimationFrame); await petDebug.ready();
  });
  await mobile.waitForFunction(() => petDebug.frames > 200);
  for (const width of [320, 390]) {
   await mobile.setViewportSize({ width, height: 520 });
   await mobile.evaluate(async () => { petDebug.play('look', .4); await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); });
   await mobile.screenshot({ path: `${out}/companion-${width}.png` });
   assert.equal(await mobile.evaluate(() => PetGame.getOutfit().id), 'jacket');
  }
  assert.deepEqual(errors, []);
  fs.writeFileSync(`${out}/result.json`, JSON.stringify({ views: 21, dye, mobileWidths: [320, 390], errors }, null, 2));
  console.log('PASS: 21 jacket views, 3 independent fabric dyes, 2 actual companion widths; no page errors');
 } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
