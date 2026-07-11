import { Hono } from "hono";
import type { AppContext } from "../env";
import { sendPush, type SubRow } from "../push";

const push = new Hono<AppContext>();

push.get("/pubkey", (c) => c.json({ key: c.env.VAPID_PUBLIC_KEY ?? null }));

push.post("/subscribe", async (c) => {
  const body = await c.req.json<{ endpoint?: string; keys?: { p256dh?: string; auth?: string } }>();
  if (!body.endpoint || !body.keys?.p256dh || !body.keys?.auth) {
    return c.json({ error: "訂閱資料不完整" }, 400);
  }
  await c.env.DB.prepare(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?)
     ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth`
  )
    .bind(c.get("userId"), body.endpoint, body.keys.p256dh, body.keys.auth)
    .run();
  return c.json({ ok: true }, 201);
});

push.post("/unsubscribe", async (c) => {
  const { endpoint } = await c.req.json<{ endpoint?: string }>();
  if (!endpoint) return c.json({ error: "缺少 endpoint" }, 400);
  await c.env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?")
    .bind(endpoint, c.get("userId"))
    .run();
  return c.json({ ok: true });
});

// immediate test notification to all of the caller's devices
push.post("/test", async (c) => {
  const { results } = await c.env.DB.prepare("SELECT * FROM push_subscriptions WHERE user_id = ?")
    .bind(c.get("userId"))
    .all<SubRow>();
  if (results.length === 0) return c.json({ error: "此帳號沒有已訂閱的裝置" }, 400);
  let sent = 0;
  for (const sub of results) {
    if (await sendPush(c.env, sub, { title: "測試通知 ✅", body: "推播已就緒，提醒會在用餐時間送達", url: "/#/settings" })) sent++;
  }
  return c.json({ sent, devices: results.length });
});

export default push;
