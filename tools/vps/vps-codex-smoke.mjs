// VPS 值班室端到端验收：投一封真实短笺，等待 rescue consumer + Codex 正窗写回答。
import { readFileSync } from 'node:fs';

const env = Object.fromEntries(readFileSync(process.argv[2] || '.env', 'utf8').split(/\r?\n/)
  .map((line) => line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/)).filter(Boolean)
  .map((m) => [m[1], m[2].trim().replace(/^['"]|['"]$/g, '')]));
const base = String(env.SUPABASE_URL || '').replace(/\/$/, '');
if (!base || !env.SUPABASE_SERVICE_KEY || !env.TARGET_USER) throw new Error('smoke test 缺云端凭据');
const headers = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`, 'Content-Type': 'application/json' };
const created = await fetch(base + '/rest/v1/rescue_remote_commands', {
  method: 'POST', headers: { ...headers, Prefer: 'return=representation' },
  body: JSON.stringify({ user_id: env.TARGET_USER, action: 'codex_chat', payload: { text: '这是值班室接线验收。请只回复：VPS值班室通路已到达。' } }),
});
const rows = await created.json();
if (!created.ok || !rows[0]?.id) throw new Error(`创建验收信失败：${JSON.stringify(rows).slice(0, 300)}`);
const id = rows[0].id;
for (let i = 0; i < 30; i += 1) {
  await new Promise((resolve) => setTimeout(resolve, 3000));
  const response = await fetch(`${base}/rest/v1/rescue_remote_commands?id=eq.${encodeURIComponent(id)}&select=state,result,error_text`, { headers });
  const current = (await response.json())[0];
  if (current?.state === 'completed') { console.log(current.result?.reply || 'completed_without_reply'); process.exit(0); }
  if (current?.state === 'failed') throw new Error(current.error_text || '值班室验收失败');
}
throw new Error('值班室验收等待超时');
