// One active map resource set. Simulation is independent of these GPU objects.
export function disposeMap(root){const geometries=new Set(),materials=new Set(),textures=new Set();root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])if(m){materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);}});for(const x of geometries)x.dispose();for(const x of materials)x.dispose();for(const x of textures){x.dispose();x.source?.data?.close?.();}}
export function createMapLoader({maps,loadAsset,factories,attach,detach}){
 const views={},pending=new Map();
 async function ensure(id){if(views[id])return views[id];if(pending.has(id))return pending.get(id);const map=maps[id];if(!map)throw Error('未知地图');const promise=(async()=>{const view=map.asset?{root:await loadAsset(map.asset)}:factories[map.renderer]();attach(view.root);view.root.visible=false;views[id]=view;return view;})();pending.set(id,promise);try{return await promise;}finally{pending.delete(id);}}
 function keep(id){for(const key of Object.keys(views))if(key!==id){detach(views[key].root);disposeMap(views[key].root);delete views[key];}}
 return {views,ensure,keep};
}
