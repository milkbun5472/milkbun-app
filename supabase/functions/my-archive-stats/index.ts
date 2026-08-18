import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};
const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  // 用来访者自己的门卡连数据库 → RLS 生效，TA 只看得到自己的行
  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
  );

  const { data: auth } = await supa.auth.getUser();
  if (!auth?.user) return json({ error: "请带着登录身份来（401）" }, 401);

  const { data, error } = await supa.from("chat_archive").select("char_id, msgs");
  if (error) return json({ error: error.message }, 500);

  const stats = (data ?? []).map(r => ({
    char_id: r.char_id,
    count: Array.isArray(r.msgs) ? r.msgs.length : 0,
  }));
  return json({ who: auth.user.email, stats, serverTime: new Date().toISOString() });
});