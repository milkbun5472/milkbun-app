const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

Deno.serve(async (req) => {
  // 敲门声（预检）：回一句"欢迎光临"就好，别拆包裹
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }
  const { name } = await req.json();
  const data = {
    message: `${name}你好，这里是云上。`,
    from: "Lisa 的第一个后端函数",
    serverTime: new Date().toISOString(),
  };
  return new Response(JSON.stringify(data), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});