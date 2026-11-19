// Decode the authoring donor with the same bundled Draco library as the viewer.
const fs = require('node:fs');
const path = require('node:path');
const vendor = path.join(__dirname, '../../../apps/fairy-garden/vendor/draco');
async function main() {
  const file = fs.readFileSync(process.argv[2]);
  const size = file.readUInt32LE(12);
  const doc = JSON.parse(file.subarray(20, 20 + size));
  const node = doc.nodes.find(n => n.name === 'outfit_argyle_trim');
  const compressed = doc.meshes[node.mesh].primitives[0].extensions.KHR_draco_mesh_compression;
  const view = doc.bufferViews[compressed.bufferView];
  const start = 28 + size + (view.byteOffset || 0);
  const api = await require(path.join(vendor, 'draco_wasm_wrapper.js'))({
    wasmBinary: fs.readFileSync(path.join(vendor, 'draco_decoder.wasm'))
  });
  const buffer = new api.DecoderBuffer(), mesh = new api.Mesh(), decoder = new api.Decoder();
  buffer.Init(new Int8Array(file.subarray(start, start + view.byteLength)), view.byteLength);
  const status = decoder.DecodeBufferToMesh(buffer, mesh);
  if (!status.ok()) throw Error(status.error_msg());
  const data = {};
  for (const key of ['POSITION', 'TEXCOORD_0']) {
    const attr = decoder.GetAttributeByUniqueId(mesh, compressed.attributes[key]);
    const values = new api.DracoFloat32Array();
    decoder.GetAttributeFloatForAllPoints(mesh, attr, values);
    data[key] = Array.from({length: values.size()}, (_, i) => values.GetValue(i));
    api.destroy(values);
  }
  const face = new api.DracoInt32Array();
  data.faces = Array.from({length: mesh.num_faces()}, (_, i) => {
    decoder.GetFaceFromMesh(mesh, i, face);
    return [0, 1, 2].map(j => face.GetValue(j));
  });
  process.stdout.write(JSON.stringify(data));
}
main().catch(e => { console.error(e); process.exitCode = 1; });
