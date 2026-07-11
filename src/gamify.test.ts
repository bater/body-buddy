import { describe, it, expect } from "vitest";
import { currentStreak, levelFromXp, replayJourney, xpByDate, type Raw } from "./gamify";

const TARGET = 120;
const MIN = 90;

function raw(foodDays: [string, number][], workoutDates: string[] = [], inbodyDates: string[] = []): Raw {
  return { foodDays: foodDays.map(([date, protein]) => ({ date, protein })), workoutDates, inbodyDates };
}

function total(byDate: Map<string, number>): number {
  let sum = 0;
  for (const v of byDate.values()) sum += v;
  return sum;
}

// The scenario verified by hand against the live app: 6 days, one below-min
// day (07-07 at 50g) splitting the streak, one target day (07-08 at 130g).
const GAP_WEEK = raw([
  ["2026-07-05", 100],
  ["2026-07-06", 95],
  ["2026-07-07", 50],
  ["2026-07-08", 130],
  ["2026-07-09", 100],
  ["2026-07-10", 91],
]);

// Same week with 07-07 at 90g: 7 consecutive qualifying days.
const FULL_WEEK = raw([
  ["2026-07-05", 100],
  ["2026-07-06", 95],
  ["2026-07-07", 90],
  ["2026-07-08", 130],
  ["2026-07-09", 100],
  ["2026-07-10", 91],
  ["2026-07-11", 95],
]);

describe("levelFromXp", () => {
  it("level L→L+1 costs 100×L", () => {
    expect(levelFromXp(0)).toEqual({ level: 1, level_start_xp: 0, next_level_xp: 100 });
    expect(levelFromXp(99).level).toBe(1);
    expect(levelFromXp(100)).toEqual({ level: 2, level_start_xp: 100, next_level_xp: 300 });
    expect(levelFromXp(299).level).toBe(2);
    expect(levelFromXp(300)).toEqual({ level: 3, level_start_xp: 300, next_level_xp: 600 });
    expect(levelFromXp(600).level).toBe(4);
    expect(levelFromXp(1000).level).toBe(5);
  });
});

describe("xpByDate", () => {
  it("scores +10 log, +10 min, +20 target per day", () => {
    const { byDate, qualifying } = xpByDate(GAP_WEEK, TARGET, MIN);
    // 6 logged ×10 + 5 qualifying ×10 + 1 target ×20 = 130
    expect(total(byDate)).toBe(130);
    expect(qualifying).toEqual(["2026-07-05", "2026-07-06", "2026-07-08", "2026-07-09", "2026-07-10"]);
    expect(byDate.get("2026-07-07")).toBe(10); // logged only
    expect(byDate.get("2026-07-08")).toBe(40); // log + min + target
  });

  it("awards the weekly bonus on the day completing 7 consecutive qualifying days", () => {
    const { byDate } = xpByDate(FULL_WEEK, TARGET, MIN);
    // 7×10 log + 7×10 min + 20 target + 50 weekly = 210
    expect(total(byDate)).toBe(210);
    expect(byDate.get("2026-07-11")).toBe(20 + 50);
  });

  it("counts workouts and InBody records as bonus days", () => {
    const { byDate } = xpByDate(raw([], ["2026-06-22"], ["2026-07-06"]), TARGET, MIN);
    expect(byDate.get("2026-06-22")).toBe(15);
    expect(byDate.get("2026-07-06")).toBe(20);
  });

  it("a higher minimum retroactively disqualifies days", () => {
    const { byDate, qualifying } = xpByDate(GAP_WEEK, TARGET, 96);
    expect(qualifying).toEqual(["2026-07-05", "2026-07-08", "2026-07-09"]);
    expect(total(byDate)).toBe(60 + 30 + 20); // 6 log + 3 min + 1 target
  });
});

describe("currentStreak", () => {
  const q = xpByDate(GAP_WEEK, TARGET, MIN).qualifying;

  it("an unfinished today doesn't break the chain", () => {
    expect(currentStreak(q, "2026-07-11")).toBe(3); // run 08–10 ends yesterday
  });

  it("a qualifying today extends the run", () => {
    const q7 = xpByDate(FULL_WEEK, TARGET, MIN).qualifying;
    expect(currentStreak(q7, "2026-07-11")).toBe(7);
  });

  it("a below-min day earlier split the run", () => {
    expect(currentStreak(q, "2026-07-07")).toBe(2); // run 05–06 ends yesterday
  });

  it("two missed days reset to zero", () => {
    expect(currentStreak(q, "2026-07-13")).toBe(0);
  });
});

describe("replayJourney", () => {
  it("dates each level-up at the cumulative crossing", () => {
    const { byDate } = xpByDate(FULL_WEEK, TARGET, MIN);
    const journey = replayJourney(byDate, "2026-07-05");
    expect(journey[0]).toEqual({ date: "2026-07-05", level: 1, xp: 0 });
    // cum: 20,40,60,100 → Lv2 exactly on 07-08
    expect(journey[1]).toEqual({ date: "2026-07-08", level: 2, xp: 100 });
    expect(journey).toHaveLength(2); // 210 < 300, no Lv3
  });

  it("🌱 pins to the first food log even when earlier activity earned XP", () => {
    const { byDate } = xpByDate(raw([["2026-07-08", 100]], ["2026-06-22"]), TARGET, MIN);
    const journey = replayJourney(byDate, "2026-07-08");
    expect(journey[0].date).toBe("2026-07-08");
  });

  it("a single day crossing several thresholds emits every level", () => {
    const byDate = new Map([["2026-07-05", 650]]);
    const levels = replayJourney(byDate, "2026-07-05").map((e) => e.level);
    expect(levels).toEqual([1, 2, 3, 4]); // 650 ≥ 100, 300, 600
  });
});
