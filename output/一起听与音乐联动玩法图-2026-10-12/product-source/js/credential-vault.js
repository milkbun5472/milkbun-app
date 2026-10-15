(function (root) {
  "use strict";
  const DB_NAME = "x_credential_vault", DB_VERSION = 1;
  const SECRET_FIELDS = ["apiKey", "key", "token", "authorization", "secret", "accessToken", "access_token", "authToken", "auth_token", "bearerToken", "bearer_token"];
  const cache = new Map();
  function openDb() { return new Promise((resolve, reject) => { const r = indexedDB.open(DB_NAME, DB_VERSION); r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains("keys")) r.result.createObjectStore("keys"); if (!r.result.objectStoreNames.contains("credentials")) r.result.createObjectStore("credentials"); }; r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); }); }
  function req(store, mode, action) { return openDb().then(db => new Promise((resolve, reject) => { const tx = db.transaction(store, mode), r = action(tx.objectStore(store)); r.onsuccess = () => resolve(r.result == null ? null : r.result); r.onerror = () => reject(r.error); tx.oncomplete = () => db.close(); })); }
  async function deviceKey() { let key = await req("keys", "readonly", s => s.get("device")); if (key) return key; key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]); await req("keys", "readwrite", s => s.put(key, "device")); return key; }
  async function encrypt(value) { const iv = crypto.getRandomValues(new Uint8Array(12)); const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await deviceKey(), new TextEncoder().encode(JSON.stringify(value))); return { iv: Array.from(iv), cipher }; }
  async function decrypt(row) { const clear = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(row.iv) }, await deviceKey(), row.cipher); return JSON.parse(new TextDecoder().decode(clear)); }
  function splitProfile(profile) { const clean = { ...(profile || {}) }, secrets = {}; for (const field of SECRET_FIELDS) { if (Object.prototype.hasOwnProperty.call(clean, field)) { if (clean[field] != null && String(clean[field]) !== "") secrets[field] = clean[field]; delete clean[field]; } } const id = String(clean.id || profile && profile.id || ""); if (id) clean.credentialRef = "cred:" + id; return { clean, secrets }; }
  async function storeProfile(profile, options = {}) {
    const { clean, secrets } = splitProfile(profile); if (!clean.id) throw new Error("API 配置缺少 id");
    const ref = clean.credentialRef, old = await req("credentials", "readonly", s => s.get(ref)); let oldSecrets = {};
    if (old) try { oldSecrets = await decrypt(old); } catch (_) { throw new Error("本机 API 凭证金库无法解密，旧配置未改动"); }
    const merged = { ...oldSecrets, ...secrets }, now = new Date().toISOString(), encrypted = await encrypt(merged);
    const row = { ...encrypted, schema: 1, providerHint: String(clean.provider || clean.baseUrl || "").slice(0, 160), createdAt: old && old.createdAt || now, updatedAt: now };
    if (old && old.quarantine) row.quarantine = old.quarantine;
    if (options.quarantine && profile) row.quarantine = await encrypt({ profile: { ...profile }, migratedAt: now });
    await req("credentials", "readwrite", s => s.put(row, ref));
    const verified = await req("credentials", "readonly", s => s.get(ref)).then(decrypt);
    if (JSON.stringify(verified) !== JSON.stringify(merged)) throw new Error("API 凭证金库验真失败，旧配置未改动");
    cache.set(ref, verified); return { clean, runtime: { ...clean, ...verified } };
  }
  async function hydrateApiCredentials() {
    let list; try { list = JSON.parse(localStorage.getItem("x_api") || "[]"); } catch (_) { return 0; }
    if (!Array.isArray(list)) return 0; const cleanList = [], runtime = [];
    for (const profile of list) { const hasPlain = SECRET_FIELDS.some(k => Object.prototype.hasOwnProperty.call(profile || {}, k)); const result = await storeProfile(profile, { quarantine: hasPlain }); cleanList.push(result.clean); runtime.push(result.runtime); }
    root.__apiRuntimeProfiles = runtime; const serialized = JSON.stringify(cleanList); if (localStorage.getItem("x_api") !== serialized) localStorage.setItem("x_api", serialized); return runtime.length;
  }
  function materializeApiProfiles(list) { if (Array.isArray(root.__apiRuntimeProfiles)) return root.__apiRuntimeProfiles.map(p => ({ ...p })); return (Array.isArray(list) ? list : []).map(profile => ({ ...profile, ...(cache.get(profile.credentialRef) || {}) })); }
  async function persistApiProfiles(list) { const clean = [], runtime = []; for (const profile of Array.isArray(list) ? list : []) { const result = await storeProfile(profile); clean.push(result.clean); runtime.push(result.runtime); } localStorage.setItem("x_api", JSON.stringify(clean)); root.__apiRuntimeProfiles = runtime; return runtime; }
  root.CredentialVault = { SECRET_FIELDS: SECRET_FIELDS.slice(), splitProfile, hydrateApiCredentials, materializeApiProfiles, persistApiProfiles };
})(window);
