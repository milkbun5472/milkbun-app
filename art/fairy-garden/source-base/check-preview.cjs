const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.GARDEN_TEST_URL || 'http://127.0.0.1:18897';
const out = process.env.SLIDER_SCREENSHOTS || '/tmp/garden-source-sliders/screenshots';
fs.mkdirSync(out, { recursive: true });

function textureHashes(file) {
  const bytes = fs.readFileSync(file), size = bytes.readUInt32LE(12);
  const json = JSON.parse(bytes.subarray(20, 20 + size));
  const binary = bytes.subarray(28 + size);
  return json.images.map(image => {
    const view = json.bufferViews[image.bufferView], offset = view.byteOffset || 0;
    return createHash('sha256').update(binary.subarray(offset, offset + view.byteLength)).digest('hex');
  }).sort();
}
assert.deepEqual(textureHashes(path.join(__dirname, 'traveler-sliders.glb')),
  textureHashes(path.join(__dirname, '../clay-reference.glb')));

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1120, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + '/art/fairy-garden/source-base/preview.html');
    await page.waitForFunction(() => window.bodySliderReview, null, { timeout: 60000 });
    const dims = await page.evaluate(() => bodySliderReview.dims);
    assert.equal(dims.length, 6);
    assert.equal(await page.locator('input[type=range]').count(), 6);
    await page.screenshot({ path: path.join(out, 'neutral.png') });
    for (const dim of dims) {
      for (const end of ['min', 'max']) {
        await page.getByRole('button', { name: '恢复原比例' }).click();
        await page.locator('#dim-' + dim.key).evaluate((input, value) => {
          input.value = value;
          input.dispatchEvent(new Event('input', { bubbles: true }));
        }, dim[end]);
        assert.equal(await page.locator('#value-' + dim.key).textContent(), Math.round(dim[end] * 100) + '%');
        const influence = await page.evaluate(key => {
          const b = bodySliderReview.body;
          return b.morphTargetInfluences[b.morphTargetDictionary[key]];
        }, dim.key);
        assert.ok(Math.abs(influence - (dim[end] - 1)) < 1e-7);
        await page.locator('#view canvas').screenshot({ path: path.join(out, `${dim.key}-${end}.png`) });
      }
    }
    const geometry = await page.evaluate(async () => {
      const T = await import('three');
      const r = bodySliderReview, b = r.body;
      r.setDimensions(Object.fromEntries(r.dims.map(d => [d.key, 1])));
      b.updateWorldMatrix(true, false);
      const sample = [], v = new T.Vector3();
      for (let i = 0; i < b.geometry.attributes.position.count; i++) {
        b.getVertexPosition(i, v).applyMatrix4(b.matrixWorld);
        const palm = Math.abs(v.x) >= .30 && v.y >= .525 && v.y <= .595 && Math.abs(v.z) < .075;
        if ((v.y >= .98 || v.y <= .145 || palm) && i % 17 === 0) sample.push({ i, base: v.clone() });
      }
      let headError = 0, soleError = 0, palmError = 0;
      for (let mask = 0; mask < 64; mask++) {
        const dims = Object.fromEntries(r.dims.map((d, i) => [d.key, d[(mask >> i) & 1 ? 'max' : 'min']]));
        r.setDimensions(dims);
        for (const { i, base } of sample) {
          b.getVertexPosition(i, v).applyMatrix4(b.matrixWorld);
          assertFinite(v);
          if (base.y <= .145) soleError = Math.max(soleError, v.distanceTo(base));
          else if (base.y >= .98) {
            const pivot = new T.Vector3(0, .962, -.018);
            const expected = base.clone().sub(pivot).multiplyScalar(dims.head).add(pivot);
            expected.y += .36 * (dims.height - 1);
            headError = Math.max(headError, v.distanceTo(expected));
          } else {
            const expected = base.clone().add(new T.Vector3(Math.sign(base.x) * .19 * (dims.shoulder - 1), .36 * (dims.height - 1), 0));
            palmError = Math.max(palmError, v.distanceTo(expected));
          }
        }
      }
      function assertFinite(v) { if (![v.x, v.y, v.z].every(Number.isFinite)) throw Error('non-finite vertex'); }
      return { combinations: 64, sampleCount: sample.length, headError, soleError, palmError,
        textures: !!b.material.map && !!b.material.normalMap && !!b.material.roughnessMap };
    });
    assert.ok(geometry.headError < 2e-6, JSON.stringify(geometry));
    assert.ok(geometry.soleError < 2e-6, JSON.stringify(geometry));
    assert.ok(geometry.palmError < .002, JSON.stringify(geometry));
    assert.equal(geometry.textures, true);
    for (const end of ['min', 'max']) {
      await page.evaluate(end => bodySliderReview.setDimensions(Object.fromEntries(bodySliderReview.dims.map(d => [d.key, d[end]]))), end);
      for (const view of ['front', 'side', 'back']) {
        await page.locator('#' + view).click();
        await page.locator('#view canvas').screenshot({ path: path.join(out, `combined-${end}-${view}.png`) });
      }
    }
    await page.getByRole('button', { name: '恢复原比例' }).click();
    assert.ok(await page.evaluate(() => bodySliderReview.body.morphTargetInfluences.every(v => v === 0)));
    await page.locator('#front').click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('#dim-head').scrollIntoViewIfNeeded();
    await page.locator('#dim-head').focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#value-head').textContent(), '101%');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: path.join(out, 'mobile.png') });
    await page.getByRole('button', { name: '恢复原比例' }).click();
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'browser-validation.json'), JSON.stringify({ ...geometry, errors, reset: true, narrowScreen: true, textureBytesPreserved: true }, null, 2));
    console.log('PASS six controls, actual garden setLook, 64 combined endpoints, original textures, reset and narrow-screen controls', geometry);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
