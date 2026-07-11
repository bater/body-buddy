import { api, ApiError, type Exercise } from "../api";
import { h, toast, fmt } from "../ui";
import { lineChart } from "../chart";

type HistoryEntry = {
  id: number;
  date: string;
  weight_kg: number;
  reps: number;
  sets: number;
  note: string | null;
};

function exerciseIdFromHash(): string | null {
  const query = location.hash.split("?")[1] ?? "";
  return new URLSearchParams(query).get("id");
}

export function renderExerciseDetail(page: HTMLElement) {
  const id = exerciseIdFromHash();
  if (!id) {
    location.hash = "#/exercises";
    return;
  }

  page.replaceChildren(h("div", { class: "empty" }, "載入中…"));

  async function load() {
    const { exercise, entries } = await api.get<{ exercise: Exercise; entries: HistoryEntry[] }>(
      `/api/workouts/history/${id}`
    );

    // best (heaviest) set per day, ascending, for the progression chart
    const bestByDate = new Map<string, number>();
    for (const e of entries) {
      const cur = bestByDate.get(e.date);
      if (cur == null || e.weight_kg > cur) bestByDate.set(e.date, e.weight_kg);
    }
    const chartPoints = [...bestByDate.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([x, y]) => ({ x, y }));

    // group entries by date, keeping the date-desc order from the API
    const byDate = new Map<string, HistoryEntry[]>();
    for (const e of entries) {
      if (!byDate.has(e.date)) byDate.set(e.date, []);
      byDate.get(e.date)!.push(e);
    }

    page.replaceChildren(
      h(
        "div",
        { class: "card" },
        h(
          "div",
          { class: "eyebrow" },
          exercise.muscle_group ? `${exercise.muscle_group}｜${exercise.name}` : exercise.name
        ),
        entries.length === 0
          ? h("div", { class: "empty" }, "還沒有訓練紀錄")
          : h(
              "div",
              {},
              h("div", { class: "muted small" }, `共 ${entries.length} 筆，${byDate.size} 個訓練日`),
              chartPoints.length >= 2
                ? h(
                    "div",
                    {},
                    h("div", { class: "eyebrow", style: "margin-top:14px" }, "進步曲線（單日最重 KG）"),
                    lineChart(chartPoints, { unit: "kg", height: 120 })
                  )
                : null
            )
      ),
      ...(entries.length === 0
        ? []
        : [...byDate.entries()].map(([date, dayEntries]) =>
            h(
              "div",
              { class: "card" },
              h("div", { class: "eyebrow" }, date),
              ...dayEntries.map((e) =>
                h(
                  "div",
                  { class: "entry" },
                  h(
                    "div",
                    { class: "row" },
                    h("span", { class: "num", style: "font-weight:600" }, `${fmt(e.weight_kg)}kg × ${e.reps} × ${e.sets}`),
                    e.note ? h("span", { class: "muted small grow" }, e.note) : h("span", { class: "grow" })
                  )
                )
              )
            )
          )),
      h(
        "a",
        { href: "#/exercises", class: "muted small", style: "color:var(--accent);text-decoration:none;padding:4px" },
        "← 返回動作庫"
      )
    );
  }

  void load().catch((e) => {
    if (e instanceof ApiError && e.status === 404) {
      toast("動作不存在");
      location.hash = "#/exercises";
      return;
    }
    toast(e instanceof ApiError ? e.message : "載入失敗");
  });
}
