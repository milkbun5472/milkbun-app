import * as T from 'three';
import { GLTFLoader } from '../../../apps/fairy-garden/vendor/GLTFLoader.js';
import { createTraveler } from '../../../apps/fairy-garden/traveler.mjs';

// Use the actual garden setLook path. No second implementation of morph mixing.
const config = document.documentElement.dataset;
const hairMode = Boolean(config.hairCatalog);
const host = document.querySelector('#view');
const status = document.querySelector('#status');
const scene = new T.Scene();
scene.background = new T.Color('#eee6d8');
scene.add(new T.HemisphereLight(0xffffff, 0x9b8870, 2));
for (const [x, y, z, power] of [[-3, 5, 4, 2.3], [3, 2, 2, 1], [-2, 2, -3, 1.3]]) {
  const light = new T.DirectionalLight(0xfff1df, power);
  light.position.set(x, y, z);
  scene.add(light);
}
const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
host.prepend(renderer.domElement);
const camera = new T.PerspectiveCamera(30, 1, .01, 30);
const aim = new T.Vector3(0, hairMode ? 1.19 : .91, 0);
let azimuth = 0, elevation = .04, radius = hairMode ? 3.1 : 4.6;
let traveler, body, dims, originalMaterial, hairstyles;
let selectedStyle = config.initialHair || 'korean';
const hairButtons = new Map(), supports = [];
const values = {}, inputs = new Map();
function render() {
  camera.position.set(radius * Math.sin(azimuth) * Math.cos(elevation), aim.y + radius * Math.sin(elevation), radius * Math.cos(azimuth) * Math.cos(elevation));
  camera.lookAt(aim);
  renderer.render(scene, camera);
}
function resize() {
  const { width, height } = host.getBoundingClientRect();
  renderer.setSize(width, height);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  render();
}
new ResizeObserver(resize).observe(host);
function setDimensions(next) {
  for (const dim of dims) {
    const value = Number(next[dim.key] ?? values[dim.key]);
    values[dim.key] = Number.isFinite(value) ? T.MathUtils.clamp(value, dim.min, dim.max) : 1;
    const { input, output } = inputs.get(dim.key);
    input.value = values[dim.key];
    output.value = `${Math.round(values[dim.key] * 100)}%`;
  }
  traveler.setLook({ dims: { ...values }, ...(hairMode ? { hair: selectedStyle, hairColor: '#ffffff' } : {}) });
  render();
}
document.querySelector('#reset').onclick = () => {
  if (dims) setDimensions(Object.fromEntries(dims.map(d => [d.key, 1])));
};
for (const [id, angle] of [['front', 0], ['side', Math.PI / 2], ['back', Math.PI]]) {
  document.getElementById(id).onclick = () => { azimuth = angle; elevation = .04; render(); };
}
let pointer;
renderer.domElement.onpointerdown = e => {
  pointer = { x: e.clientX, y: e.clientY };
  renderer.domElement.setPointerCapture(e.pointerId);
};
renderer.domElement.onpointermove = e => {
  if (!pointer) return;
  azimuth -= (e.clientX - pointer.x) * .008;
  elevation = T.MathUtils.clamp(elevation + (e.clientY - pointer.y) * .006, -.45, .65);
  pointer = { x: e.clientX, y: e.clientY };
  render();
};
renderer.domElement.onpointerup = renderer.domElement.onpointercancel = () => { pointer = null; };
renderer.domElement.addEventListener('wheel', e => {
  e.preventDefault();
  radius = T.MathUtils.clamp(radius + e.deltaY * .003, hairMode ? 2.3 : 3.7, 6);
  render();
}, { passive: false });

try {
  const [catalog, gltf] = await Promise.all([
    fetch(config.dimensions || './sliders.json').then(r => { if (!r.ok) throw Error('体型清单加载失败'); return r.json(); }),
    new GLTFLoader().loadAsync(config.model || './traveler-sliders.glb'),
  ]);
  dims = catalog.dims;
  for (const dim of dims) values[dim.key] = 1;
  traveler = createTraveler(gltf.scene, false, { dims: { ...values }, ...(hairMode ? { hair: selectedStyle, hairColor: '#ffffff' } : {}) });
  // Review the source body and hairstyles without action props or a borrowed rig.
  traveler.root.traverse(o => {
    if (o.userData.sourceBodySliders) body = o;
    if (o.userData.hairSupport) supports.push(o);
    if (hairMode && o.userData.sourceSurfacePartition === 'hair_korean') o.material.roughness = 1;
    if (o.name === 'DailyActionProps' || o.name === 'IceBlade') o.visible = false;
  });
  if (!body || dims.some(d => body.morphTargetDictionary[d.key] == null)) throw Error('模型缺少体型形态键');
  originalMaterial = body.material;
  scene.add(traveler.root);
  for (const dim of dims) {
    const control = document.createElement('div');
    control.className = 'control';
    control.innerHTML = `<label for="dim-${dim.key}">${dim.label}<output id="value-${dim.key}" for="dim-${dim.key}">100%</output></label><input type="range" id="dim-${dim.key}" min="${dim.min}" max="${dim.max}" step="0.01" value="1"><div class="ends"><span>${dim.low}</span><span>${dim.high}</span></div>`;
    const input = control.querySelector('input'), output = control.querySelector('output');
    input.oninput = () => setDimensions({ [dim.key]: input.value });
    inputs.set(dim.key, { input, output });
    document.querySelector('#controls').append(control);
  }
  function setStyle(id) {
    if (!hairstyles?.some(style => style.id === id)) throw Error('未知发型：' + id);
    selectedStyle = id;
    traveler.setLook({ hair: id, hairColor: '#ffffff' });
    supports.forEach(o => { o.visible = id !== 'korean'; });
    hairButtons.forEach((button, key) => button.setAttribute('aria-pressed', String(key === id)));
    const item = hairstyles.find(style => style.id === id);
    document.querySelector('#current-style').textContent = `${item.code} · ${item.label}`;
    render();
  }
  if (hairMode) {
    const response = await fetch(config.hairCatalog);
    if (!response.ok) throw Error('发型清单加载失败');
    hairstyles = await response.json();
    for (const style of hairstyles) {
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.hair = style.id;
      button.innerHTML = `<small>${style.code}</small>${style.label}`;
      button.setAttribute('aria-pressed', 'false');
      button.onclick = () => setStyle(style.id);
      hairButtons.set(style.id, button);
      document.querySelector('#hair-controls').append(button);
    }
    setStyle(selectedStyle);
    document.querySelector('#frame').onclick = () => {
      const full = aim.y > 1;
      aim.y = full ? .91 : 1.19;
      radius = full ? 4.6 : 3.1;
      document.querySelector('#frame').textContent = full ? '看发型' : '看全身';
      render();
    };
  }
  status.textContent = hairMode ? (config.reviewLabel || '十二款可试换 · 拖动看侧背面') : '拖动旋转 · 滚轮缩放 · 六项可组合调整';
  resize();
  window.bodySliderReview = { body, traveler, scene, renderer, dims, values, setDimensions,
    neutralMaterial: originalMaterial, render, hairstyles, setStyle,
    get style() { return selectedStyle; },
    setView(angle, distance = radius, height = aim.y) { azimuth = angle; elevation = .04; radius = distance; aim.y = height; render(); } };
} catch (error) {
  status.classList.add('error');
  status.textContent = '载入失败：' + error.message;
  console.error(error);
}
