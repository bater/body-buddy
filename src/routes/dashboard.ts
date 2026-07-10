import { Hono } from "hono";
import type { AppContext } from "../env";

const dashboard = new Hono<AppContext>();

// Client passes its local date to avoid timezone drift on the server
dashboard.get("/", async (c) => {
  const date = c.req.query("date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? "")) return c.json({ error: "缺少 date 參數" }, 400);
  const uid = c.get("userId");

  const [protein, target, foodDaily, inbodyTrend] = await Promise.all([
    c.env.DB.prepare(
      "SELECT COALESCE(SUM(protein_g),0) AS protein_g, COALESCE(SUM(calories),0) AS calories, COUNT(*) AS entries FROM food_logs WHERE user_id = ? AND date = ?"
    )
      .bind(uid, date)
      .first<{ protein_g: number; calories: number; entries: number }>(),
    c.env.DB.prepare(
      "SELECT value FROM user_settings WHERE user_id = ? AND key = 'protein_target_g'"
    )
      .bind(uid)
      .first<{ value: string }>(),
    c.env.DB.prepare(
      `SELECT date, ROUND(SUM(protein_g), 1) AS protein_g, SUM(calories) AS calories
       FROM food_logs WHERE user_id = ? AND date BETWEEN date(?, '-29 days') AND ?
       GROUP BY date ORDER BY date`
    )
      .bind(uid, date, date)
      .all(),
    c.env.DB.prepare(
      `SELECT date, weight_kg, skeletal_muscle_mass_kg, body_fat_percent
       FROM inbody_records WHERE user_id = ? ORDER BY date DESC, id DESC LIMIT 12`
    )
      .bind(uid)
      .all(),
  ]);

  return c.json({
    date,
    protein_g: protein?.protein_g ?? 0,
    calories: protein?.calories ?? 0,
    food_entries: protein?.entries ?? 0,
    protein_target_g: Number(target?.value ?? 120),
    food_daily: foodDaily.results,
    inbody_trend: (inbodyTrend.results as Record<string, unknown>[]).reverse(),
  });
});

export default dashboard;
