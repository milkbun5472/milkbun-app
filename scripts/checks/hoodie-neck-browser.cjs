// Actual hoodie neck: visible cut diagnostic, all body endpoints and poses.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.CLOTH_TEST_URL || 'http://127.0.0.1:18931';
const out = process.env.CLOTH_TEST_OUT || '/tmp/hoodie-neck';
fs.mkdirSync(out, { recursive: true });
(async () => {
 const browser = await chromium.launch({ channel: 'chrome', headless: true });
 try {
  const page = await browser.newPage({ viewport: { width: 2400, height: 700 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('**/pet.mjs*', r => r.fulfill({ body: '', contentType: 'text/javascript' }));
  if (process.env.HOODIE_MODEL) await page.route('**/outfits/ranger.glb*', r => r.fulfill({ path: process.env.HOODIE_MODEL, contentType: 'model/gltf-binary' }));
  await page.goto(base + '/apps/companion/');
  await page.evaluate(async () => {
   const T = await import('three');
   const { GLTFLoader } = await import('../fairy-garden/vendor/GLTFLoader.js');
   const { DRACOLoader } = await import('../fairy-garden/vendor/DRACOLoader.js');
   const { createTraveler, preloadOutfits, preloadHair } = await import('../fairy-garden/traveler.mjs');
   const decoder = new DRACOLoader(); decoder.setDecoderPath('../fairy-garden/vendor/draco/');
   const loader = new GLTFLoader(); loader.setDRACOLoader(decoder);
   const source = (await loader.loadAsync('../fairy-garden/doll.glb')).scene;
   await Promise.all([preloadOutfits(), preloadHair(['longpart'])]);
   const catalog = await (await fetch('../fairy-garden/doll.json')).json();
   const scene = new T.Scene(); scene.background = new T.Color('#f0e8db');
   scene.add(new T.HemisphereLight('#fff', '#aaa', 2.3));
   const light = new T.DirectionalLight('#fff', 1.5); light.position.set(2, 3, 4); scene.add(light);
   const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
   renderer.setSize(2400, 600); renderer.domElement.id = 'collar-qa';
   document.body.replaceChildren(renderer.domElement);
   const camera = new T.OrthographicCamera(-.18, .18, .18, -.18, .1, 20);
   window.collarQA = { T, source, catalog, createTraveler, scene, renderer, camera, dolls: [] };
  });
  for (const mode of ['default', 'min', 'max', 'tinted', 'stretch', 'wave', 'sit']) {
   const visiblePixels = await page.evaluate(mode => {
    const { T, source, catalog, createTraveler, scene, renderer, camera, dolls } = collarQA;
    for (const d of dolls) scene.remove(d.root); dolls.length = 0;
    renderer.setScissorTest(true);
    [0, .55, 1.57, 3.14].forEach((angle, col) => {
     dolls.forEach(d => { d.root.visible = false; });
     const dims = Object.fromEntries(catalog.dims.map(d => [d.key, ['min', 'max'].includes(mode) ? d[mode] : 1]));
     const d = createTraveler(source, false, { outfit: 'ranger', hair: 'longpart', dims });
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
    const pixels = new Uint8Array(2400 * 600 * 4), gl = renderer.getContext();
    gl.readPixels(0, 0, 2400, 600, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let ink = 0; for (let i = 0; i < pixels.length; i += 4) if (pixels[i] < 200) ink++;
    return ink;
   }, mode);
   assert(visiblePixels > 10000, mode + ' must actually render the garment');
   await page.locator('#collar-qa').screenshot({ path: `${out}/${mode}.png` });
  }

  const result = await page.evaluate(() => {
   const { T, source, catalog, createTraveler, scene, renderer, camera, dolls } = collarQA;
   for (const d of dolls) scene.remove(d.root); dolls.length = 0;
   renderer.setSize(400, 400); renderer.setViewport(0, 0, 400, 400);
   const pixels = new Uint8Array(400 * 400 * 4), gl = renderer.getContext();
   const count = () => {
    renderer.render(scene, camera); gl.readPixels(0, 0, 400, 400, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let n = 0; for (let i = 0; i < pixels.length; i += 4) if (pixels[i] > 230 && pixels[i + 1] < 25 && pixels[i + 2] > 230) n++;
    return n;
   };
   const prepare = dims => {
    const d = createTraveler(source, false, { outfit: 'ranger', hair: 'longpart', dims }); scene.add(d.root);
    const body = d.root.getObjectByName('DollBody'), old = body.material.onBeforeCompile;
    body.material.onBeforeCompile = shader => {
     old(shader);
     shader.fragmentShader = shader.fragmentShader.replace('#include <dithering_fragment>', 'if(vSkinArm<.5 && vSkinRest.y>=uCoveredTorso && vSkinRest.y<uCoveredTorso+.0015) gl_FragColor=vec4(1.,0.,1.,1.);\n#include <dithering_fragment>');
    };
    body.material.customProgramCacheKey = () => 'hoodie-cut-rim-diagnostic'; body.material.needsUpdate = true;
    return d;
   };
   const place = (d, angle, pose) => {
    d.animate(.3, { gesture: 'rest', height: 0 }); if (pose) d.contactPose({ nod: .25, neckTurn: .25, neckLean: .18 });
    d.root.rotation.y = angle;
    const p = new T.Vector3(0, .716, 0); d.root.getObjectByName('TravelerVisual').localToWorld(p);
    camera.position.set(0, p.y, 6); camera.lookAt(0, p.y, 0);
   };
   const control = prepare({}); place(control, 0, false);
   const uniform = control.root.getObjectByName('DollBody').userData.skinCoverageUniforms.torso;
   const lining = control.root.getObjectByName('outfit_ranger_neck_lining');
   uniform.value = .705; lining.visible = false;
   const oldCutPixels = count(); scene.remove(control.root);
   let frames = 0, maxCutPixels = 0, worst = null;
   for (let bits = 0; bits < 64; bits++) {
    const dims = Object.fromEntries(catalog.dims.map((d, i) => [d.key, d[bits & (1 << i) ? 'max' : 'min']]));
    const d = prepare(dims);
    for (const angle of [0, .55, 1.57, 3.14]) for (const pose of [false, true]) {
     place(d, angle, pose); const n = count(); frames++;
     if (n > maxCutPixels) { maxCutPixels = n; worst = { bits, dims, angle, pose }; }
    }
    scene.remove(d.root);
   }
   const a = createTraveler(source, false, { outfit: 'ranger', hair: 'longpart' });
   const b = createTraveler(source, true, { outfit: 'jacket', hair: 'longpart' });
   const ua = a.root.getObjectByName('DollBody').userData.skinCoverageUniforms.torso;
   const ub = b.root.getObjectByName('DollBody').userData.skinCoverageUniforms.torso;
   const masks = [ua.value, ub.value]; a.setLook({ outfit: 'jacket' }); masks.push(ua.value, ub.value);
   a.setLook({ outfit: 'ranger' }); masks.push(ua.value, ub.value);
   return { oldCutPixels, frames, maxCutPixels, worst, masks };
  });
  const mobile = await browser.newPage({ viewport: { width: 390, height: 520 } });
  mobile.on('pageerror', e => errors.push(e.message));
  await mobile.goto(base + '/apps/companion/');
  await mobile.waitForFunction(() => window.petDebug);
  await mobile.evaluate(async () => {
   document.body.style.background = '#f0e8db';
   window.postMessage({ type: 'pet-look', ta: '领口验图', characterId: 'collar-qa', look: { outfit: 'ranger', hair: 'longpart', hairColor: '#e8e4dd', face: 'default' } }, '*');
   await new Promise(requestAnimationFrame); await petDebug.ready();
  });
  await mobile.waitForFunction(() => petDebug.frames > 200);
  for (const width of [320, 390]) {
   await mobile.setViewportSize({ width, height: 520 });
   await mobile.evaluate(async () => { petDebug.play('look', .4); await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame); });
   await mobile.screenshot({ path: `${out}/companion-${width}.png` });
   assert.equal(await mobile.evaluate(() => PetGame.getOutfit().id), 'ranger');
  }
  fs.writeFileSync(`${out}/result.json`, JSON.stringify({ result, errors }, null, 2));
  assert(result.oldCutPixels > 20, 'diagnostic must catch the original exposed cut');
  assert(result.maxCutPixels === 0, JSON.stringify(result));
  assert.deepEqual(result.masks, [.675, .705, .705, .705, .675, .705]);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify(result));

 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
