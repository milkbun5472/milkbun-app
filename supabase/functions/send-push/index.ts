// send-push v2：夜巡信拆成多条通知（像连发消息），一句一弹
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

function splitBubbles(txt: string): string[] {
  let parts = String(txt || "").trim().split(/\n+/).map(s => s.trim()).filter(Boolean);
  if (parts.length === 1 && parts[0].length > 40) {
    const raw = parts[0].split(/([。！？!?…~♪]+)/);
    const segs: string[] = [];
    for (let i = 0; i < raw.length; i += 2) { const seg = ((raw[i] || "") + (raw[i + 1] || "")).trim(); if (seg) segs.push(seg); }
    const merged: string[] = [];
    segs.forEach(s => { if (merged.length && (merged[merged.length - 1].length < 6 || s.length < 4)) merged[merged.length - 1] += s; else merged.push(s); });
    if (merged.length > 1) parts = merged;
  }
  return parts.slice(0, 4); // 通知最多 4 条，别刷屏
}

Deno.serve(async () => {
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  webpush.setVapidDetails("mailto:hyodorisa@gmail.com", Deno.env.get("VAPID_PUBLIC")!, Deno.env.get("VAPID_PRIVATE")!);

  const since = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
  const { data: letters } = await admin.from("server_inbox")
    .select("id, user_id, char_id, content, created_at")
    .is("pushed_at", null).gte("created_at", since);
  if (!letters?.length) return new Response("no letters");

  const byUser = new Map<string, typeof letters>();
  for (const L of letters) { if (!byUser.has(L.user_id)) byUser.set(L.user_id, []); byUser.get(L.user_id)!.push(L); }

  let sent = 0;
  for (const [uid, ls] of byUser) {
    const { data: subs } = await admin.from("push_subs").select("endpoint, subscription").eq("user_id", uid);
    if (!subs?.length) continue;
    const { data: save } = await admin.from("saves").select("data").eq("user_id", uid).single();
    let chars: any[] = [];
    try { chars = JSON.parse(save?.data?.x_characters ?? "[]"); } catch (_) {}
    for (const L of ls) {
      const c = chars.find((x: any) => x.id === L.char_id);
      const name = c?.remark || c?.name || "有人";
      const parts = splitBubbles(L.content);
      // 倒序发：通知中心新的在上面，倒着发完后从上往下读正好是第 1、2、3 句
      for (let i = parts.length - 1; i >= 0; i--) {
        const payload = JSON.stringify({
          title: name, body: parts[i],
          tag: "inbox-" + L.char_id + "-" + L.id + "-" + i, // 每句独立 tag，不互相顶掉
          charId: L.char_id, screen: "thread"
        });
        for (const s of subs) {
          try { await webpush.sendNotification(s.subscription as any, payload); sent++; }
          catch (e: any) {
            if (e?.statusCode === 410 || e?.statusCode === 404) {
              await admin.from("push_subs").delete().eq("endpoint", s.endpoint);
            }
          }
        }
        if (i) await new Promise(r => setTimeout(r, 400));
      }
      await admin.from("server_inbox").update({ pushed_at: new Date().toISOString() }).eq("id", L.id);
    }
  }
  return new Response("pushed " + sent);
});