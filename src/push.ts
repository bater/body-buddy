import { buildPushPayload, type PushSubscription } from "@block65/webcrypto-web-push";
import type { Env } from "./env";
import { computeGamify, proteinSettings } from "./gamify";

export type SubRow = { id: number; user_id: number; endpoint: string; p256dh: string; auth: string };

export type PushData = { title: string; body: string; url?: string; tag?: string };

/** Send one notification; prunes the subscription if the push service says it's gone. */
export async function sendPush(env: Env, sub: SubRow, data: PushData): Promise<boolean> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return false;
  const subscription: PushSubscription = {
    endpoint: sub.endpoint,
    expirationTime: null,
    keys: { auth: sub.auth, p256dh: sub.p256dh },
  };
  const payload = await buildPushPayload(
    { data, options: { ttl: 3 * 3600, urgency: "normal" } },
    subscription,
    {
      subject: env.VAPID_SUBJECT ?? "mailto:admin@example.com",
      publicKey: env.VAPID_PUBLIC_KEY,
      privateKey: env.VAPID_PRIVATE_KEY,
    }
  );
  const res = await fetch(sub.endpoint, payload);
  if (res.status === 404 || res.status === 410) {
    // device unsubscribed / expired — self-clean
    await env.DB.prepare("DELETE FROM push_subscriptions WHERE id = ?").bind(sub.id).run();
    return false;
  }
  return res.ok;
}

// Meal windows in Asia/Taipei (UTC+8), checked by the cron "30 1,5,11 * * *".
// sinceUtcTime bounds the "did they log anything for this meal" lookup on
// food_logs.created_at (stored as UTC datetime('now')); breakfast instead
// asks "any log at all today".
const MEALS: Record<
  number, // UTC hour the cron fires
  { id: string; key: string; sinceUtcTime: string | null; title: string; fallback: string }
> = {
  1: {
    id: "breakfast",
    key: "reminder_breakfast",
    sinceUtcTime: null,
    title: "早餐吃了嗎？",
    fallback: "記下今天第一餐，開啟今天的進度 🌅",
  },
  5: {
    id: "lunch",
    key: "reminder_lunch",
    sinceUtcTime: "02:30:00", // 10:30 Taipei
    title: "午餐記錄時間 🍱",
    fallback: "午餐吃了什麼？順手記一下",
  },
  11: {
    id: "dinner",
    key: "reminder_dinner",
    sinceUtcTime: "08:30:00", // 16:30 Taipei
    title: "晚餐別忘了記 🌙",
    fallback: "今天最後衝刺，記下晚餐",
  },
};

export async function runMealReminders(env: Env, scheduledTime: number): Promise<void> {
  const meal = MEALS[new Date(scheduledTime).getUTCHours()];
  if (!meal) return;
  const taipeiToday = new Date(scheduledTime + 8 * 3600_000).toISOString().slice(0, 10);
  const utcDate = new Date(scheduledTime).toISOString().slice(0, 10);

  const { results: subs } = await env.DB.prepare("SELECT * FROM push_subscriptions").all<SubRow>();
  const byUser = new Map<number, SubRow[]>();
  for (const s of subs) byUser.set(s.user_id, [...(byUser.get(s.user_id) ?? []), s]);

  for (const [userId, userSubs] of byUser) {
    const pref = await env.DB.prepare("SELECT value FROM user_settings WHERE user_id = ? AND key = ?")
      .bind(userId, meal.key)
      .first<{ value: string }>();
    if (pref?.value === "0") continue; // toggled off (default on)

    const { targetG, minG } = await proteinSettings(env.DB, userId);
    const g = await computeGamify(env.DB, userId, taipeiToday, targetG, minG);
    if (g.today.min_met) continue; // quiet rule: today's streak is already safe

    let hasMealLog: boolean;
    if (meal.sinceUtcTime === null) {
      hasMealLog = g.today.logged;
    } else {
      const row = await env.DB.prepare(
        "SELECT COUNT(*) AS n FROM food_logs WHERE user_id = ? AND date = ? AND created_at >= ?"
      )
        .bind(userId, taipeiToday, `${utcDate} ${meal.sinceUtcTime}`)
        .first<{ n: number }>();
      hasMealLog = (row?.n ?? 0) > 0;
    }
    if (hasMealLog) continue;

    const need = Math.max(1, Math.ceil(minG - g.today.protein_g));
    const body =
      g.streak_days > 0
        ? `再 ${need} g 蛋白質保住 🔥 ${g.streak_days} 天連勝`
        : g.today.logged
          ? `今天還差 ${need} g 蛋白質達最低`
          : meal.fallback;

    for (const sub of userSubs) {
      await sendPush(env, sub, { title: meal.title, body, url: "/#/food", tag: `meal-${meal.id}` });
    }
  }
}
