const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.GARDEN_TEST_URL || 'http://127.0.0.1:18897';
const out = process.env.HAIR_SCREENSHOTS || '/tmp/garden-source-hair/browser';
fs.mkdirSync(out, { recursive: true });
function hashes(file) {
  const bytes = fs.readFileSync(file), size = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + size)), binary = bytes.subarray(28 + size);
  return json.images.map(i => { const v = json.bufferViews[i.bufferView]; return createHash('sha256').update(binary.subarray(v.byteOffset || 0, (v.byteOffset || 0) + v.byteLength)).digest('hex'); }).sort();
}
const assetTextures = hashes(path.join(__dirname, 'traveler-hairstyles.glb'));
assert.ok(hashes(path.join(__dirname, '../clay-reference.glb')).every(hash => assetTextures.includes(hash)));
assert.equal(assetTextures.length, 4);
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1120, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + '/art/fairy-garden/source-hairstyles/preview.html');
    await page.waitForFunction(() => window.bodySliderReview?.hairstyles?.length === 12, null, { timeout: 90000 });
    const styles = await page.evaluate(() => bodySliderReview.hairstyles);
    assert.equal(await page.locator('[data-hair]').count(), 12);
    await page.screenshot({ path: path.join(out, 'preview.png') });
    for (const style of styles) {
      await page.locator(`[data-hair="${style.id}"]`).click();
      const visible = await page.evaluate(() => { const a = []; bodySliderReview.traveler.root.traverse(o => { if (o.isMesh && o.visible && /^hair_/.test(o.name)) a.push(o.name); }); return a; });
      assert.deepEqual(visible, ['hair_' + style.id]);
      assert.equal(await page.locator(`[data-hair="${style.id}"]`).getAttribute('aria-pressed'), 'true');
      for (const angle of ['front', 'side', 'back']) {
        await page.locator('#' + angle).click();
        await page.locator('#view canvas').screenshot({ path: path.join(out, `${style.id}-${angle}.png`) });
      }
    }
    const geometry = await page.evaluate(async () => {
      const T = await import('three'), r = bodySliderReview;
      r.setDimensions(Object.fromEntries(r.dims.map(d => [d.key, 1])));
      r.traveler.root.updateMatrixWorld(true);
      const meshes = [], samples = [], v = new T.Vector3();
      r.traveler.root.traverse(o => { if (o.isMesh && (/^hair_/.test(o.name) || o.userData.hairSupport || o.userData.sourceBodySliders || o.userData.sourceFaceOriginal)) meshes.push(o); });
      for (const mesh of meshes) {
        if (r.dims.some(d => mesh.morphTargetDictionary[d.key] == null)) throw Error('Missing slider on ' + mesh.name);
        const hair = /^hair_/.test(mesh.name) || mesh.userData.hairSupport;
        for (let i = 0; i < mesh.geometry.attributes.position.count; i += 73) {
          mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld);
          if (hair || v.y >= .98 || v.y <= .145) samples.push({ mesh, i, base: v.clone(), hair });
        }
      }
      let headError = 0, soleError = 0;
      for (let mask = 0; mask < 64; mask++) {
        const dims = Object.fromEntries(r.dims.map((d, i) => [d.key, d[(mask >> i) & 1 ? 'max' : 'min']]));
        r.setDimensions(dims);
        for (const { mesh, i, base, hair } of samples) {
          mesh.getVertexPosition(i, v).applyMatrix4(mesh.matrixWorld);
          if (![v.x, v.y, v.z].every(Number.isFinite)) throw Error('Non-finite vertex');
          if (hair || base.y >= .98) {
            const pivot = new T.Vector3(0, .962, -.018);
            const expected = base.clone().sub(pivot).multiplyScalar(dims.head).add(pivot);
            expected.y += .36 * (dims.height - 1);
            headError = Math.max(headError, v.distanceTo(expected));
          } else soleError = Math.max(soleError, v.distanceTo(base));
        }
      }
      return { combinations: 64, styles: 12, sampledVertices: samples.length, headError, soleError, meshes: meshes.length };
    });
    assert.ok(geometry.headError < 3e-6, JSON.stringify(geometry));
    assert.ok(geometry.soleError < 3e-6, JSON.stringify(geometry));
    const preservation = await page.evaluate(async () => {
      const T = await import('three');
      const { GLTFLoader } = await import('../../../apps/fairy-garden/vendor/GLTFLoader.js');
      const { createTraveler } = await import('../../../apps/fairy-garden/traveler.mjs');
      const r = bodySliderReview;
      r.setDimensions(Object.fromEntries(r.dims.map(d => [d.key, 1])));
      r.setStyle('korean'); r.setView(0);
      const source = await new GLTFLoader().loadAsync('../source-base/traveler-sliders.glb');
      const intact = createTraveler(source.scene, false, { dims: { ...r.values } });
      intact.root.traverse(o => { if (o.name === 'DailyActionProps' || o.name === 'IceBlade') o.visible = false; });
      r.scene.add(intact.root); intact.root.visible = false;
      const gl = r.renderer.getContext(), width = gl.drawingBufferWidth, height = gl.drawingBufferHeight;
      const before = new Uint8Array(width * height * 4), after = new Uint8Array(before.length);
      r.render(); gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, after);
      r.traveler.root.visible = false; intact.root.visible = true;
      r.render(); gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, before);
      let error = 0, changed = 0;
      for (let i = 0; i < before.length; i += 4) {
        let maximum = 0;
        for (let j = 0; j < 3; j++) { const d = before[i+j] - after[i+j]; error += d*d; maximum = Math.max(maximum, Math.abs(d)); }
        if (maximum > 10) changed++;
      }
      r.scene.remove(intact.root); r.traveler.root.visible = true; r.render();
      const ray = new T.Raycaster(), facialSamples = [[-.095,1.12],[.095,1.12],[-.15,1.065],[.15,1.065],[0,1.03]];
      let rays = 0;
      for (const style of r.hairstyles) {
        r.setStyle(style.id); r.traveler.root.updateMatrixWorld(true);
        const visible = [];
        r.traveler.root.traverseVisible(o => { if (o.isMesh) visible.push(o); });
        for (const [x,y] of facialSamples) {
          ray.set(new T.Vector3(x,y,4), new T.Vector3(0,0,-1));
          const hit = ray.intersectObjects(visible, false)[0];
          const expected = style.id === 'korean' ? 'SourceHeadOriginal' : 'ScalpSupport';
          if (hit?.object.name !== expected) throw Error(style.id + ': face covered at ' + [x,y] + ' by ' + hit?.object.name);
          rays++;
        }
      }
      return { sourceAppearanceRmse: Math.sqrt(error / (width*height*3)), significantPixelFraction: changed/(width*height), unobstructedFaceRays: rays };
    });
    assert.ok(preservation.sourceAppearanceRmse < 2, JSON.stringify(preservation));
    assert.ok(preservation.significantPixelFraction < .005, JSON.stringify(preservation));
    // Real combined endpoints on the long styles expose shoulder/nape collisions.
    for (const style of ['curtains', 'airbang', 'hush', 'bun', 'wavy']) {
      await page.locator(`[data-hair="${style}"]`).click();
      for (const end of ['min', 'max']) {
        await page.evaluate(end => bodySliderReview.setDimensions(Object.fromEntries(bodySliderReview.dims.map(d => [d.key, d[end]]))), end);
        for (const angle of ['front', 'side', 'back']) {
          await page.locator('#' + angle).click();
          await page.locator('#view canvas').screenshot({ path: path.join(out, `${style}-${end}-${angle}.png`) });
        }
      }
    }
    await page.getByRole('button', { name: '恢复原比例' }).click();
    assert.ok(await page.evaluate(() => bodySliderReview.body.morphTargetInfluences.every(v => v === 0)));
    await page.locator('#front').click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('[data-hair="hush"]').scrollIntoViewIfNeeded();
    await page.locator('[data-hair="hush"]').click();
    await page.locator('summary').click();
    await page.locator('#dim-head').scrollIntoViewIfNeeded();
    await page.locator('#dim-head').focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#value-head').textContent(), '101%');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(out, 'mobile-sliders.png') });
    await page.locator('summary').click();
    await page.locator('[data-hair="curtains"]').scrollIntoViewIfNeeded();
    await page.locator('[data-hair="curtains"]').click();
    await page.screenshot({ path: path.join(out, 'mobile.png') });
    await page.goto(base + '/art/fairy-garden/source-hairstyles/gallery.html');
    await page.evaluate(() => Promise.all([...document.images].map(image => { image.loading = 'eager'; return image.decode(); })));
    assert.equal(await page.locator('main img').count(), 3);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    // The focused review must open the new M02, and its original comparison
    // must restore the intact face without leaving the forehead support on.
    await page.goto(base + '/art/fairy-garden/source-hairstyles/m02.html');
    await page.waitForFunction(() => window.bodySliderReview?.style === 'curtains', null, { timeout: 90000 });
    assert.equal(await page.locator('[data-hair]').count(), 2);
    await page.locator('[data-hair="korean"]').click();
    assert.ok(await page.evaluate(() => { let visible = false; bodySliderReview.traveler.root.traverse(o => { if(o.userData.hairSupport && o.visible) visible = true; }); let original = false; bodySliderReview.traveler.root.traverse(o => { if(o.userData.sourceFaceOriginal && o.visible) original = true; }); return !visible && original; }));
    await page.locator('[data-hair="curtains"]').click();
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(out, 'm02-mobile.png') });
    await page.goto(base + '/art/fairy-garden/source-hairstyles/m02-views.html');
    await page.evaluate(() => Promise.all([...document.images].map(image => { image.loading='eager'; return image.decode(); })));
    assert.equal(await page.locator('main img').count(), 3);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'browser-validation.json'), JSON.stringify({ modelSha256: createHash('sha256').update(fs.readFileSync(path.join(__dirname, 'traveler-hairstyles.glb'))).digest('hex'), ...geometry, ...preservation, originalTextureBytes: true, reset: true, mobile: true, focusedM02: true, focusedGallery: true, errors }, null, 2) + '\n');
    console.log('PASS hair switching, 64 slider combinations, source textures, reset, mobile', geometry);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
