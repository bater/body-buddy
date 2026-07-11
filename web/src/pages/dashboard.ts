import { api, ApiError, type Dashboard } from "../api";
import { h, toast, todayStr, fmt } from "../ui";
import { lineChart } from "../chart";
import { gamifyCard } from "../gamify";

const PLATE_G = 20; // one「槓片」segment of the protein track = 20 g

export function renderDashboard(page: HTMLElement) {
  page.replaceChildren(h("div", { class: "empty" }, "載入中…"));

  void (async () => {
    let d: Dashboard;
    try {
      d = await api.get<Dashboard>(`/api/dashboard?date=${todayStr()}`);
    } catch (e) {
      page.replaceChildren(h("div", { class: "empty" }, e instanceof ApiError ? e.message : "載入失敗"));
      return;
    }

    const met = d.protein_g >= d.protein_target_g;
    const plateCount = Math.max(1, Math.ceil(d.protein_target_g / PLATE_G));
    const track = h("div", { class: `plate-track${met ? " met" : ""}`, role: "img", "aria-label": `蛋白質進度 ${fmt(d.protein_g)} / ${d.protein_target_g} g` });
    for (let i = 0; i < plateCount; i++) {
      const plateStart = i * PLATE_G;
      const filled = Math.max(0, Math.min(1, (d.protein_g - plateStart) / PLATE_G));
      const fill = h("i", { style: `transform: scaleX(${filled.toFixed(3)})` });
      track.append(h("div", { class: "plate" }, fill));
    }

    const quickInput = h("input", { type: "text", placeholder: "剛吃了什麼？例：雞胸肉200g" });
    const goParse = () => {
      if (!quickInput.value.trim()) return toast("請先輸入內容");
      sessionStorage.setItem("quickFoodText", quickInput.value.trim());
      location.hash = "#/food";
    };
    quickInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") goParse();
    });

    const hero = h(
      "div",
      { class: "card protein-hero" },
      h("div", { class: "eyebrow" }, "今日蛋白質 PROTEIN"),
      h(
        "div",
        { class: "readout" },
        h("span", { class: `value num${met ? " met" : ""}` }, fmt(d.protein_g)),
        h("span", { class: "unit num" }, `/ ${d.protein_target_g} g`)
      ),
      track,
      h(
        "div",
        { class: "muted small num" },
        met ? "已達標 ✓" : `還差 ${fmt(d.protein_target_g - d.protein_g)} g`,
        d.calories ? ` ・ ${fmt(d.calories, 0)} kcal` : "",
        ` ・ ${d.food_entries} 筆`
      ),
      h(
        "div",
        { class: "btn-row", style: "margin-top:12px" },
        h("span", { class: "grow" }, quickInput),
        h("button", { class: "btn primary", onclick: goParse }, "記錄")
      )
    );

    const chartCard = (label: string, points: { x: string; y: number }[], unit: string, link?: HTMLElement) =>
      h("div", { class: "card" }, h("div", { class: "eyebrow" }, label), lineChart(points, { unit, height: 120 }), link);

    const proteinCard = chartCard(
      "每日蛋白質 (G)",
      d.food_daily.map((f) => ({ x: f.date, y: f.protein_g })),
      "g"
    );
    const muscleCard = chartCard(
      "肌肉重 (KG)",
      d.inbody_trend
        .filter((r) => r.skeletal_muscle_mass_kg != null)
        .map((r) => ({ x: r.date, y: Number(r.skeletal_muscle_mass_kg) })),
      "kg"
    );
    const fatCard = chartCard(
      "體脂率 (%)",
      d.inbody_trend.filter((r) => r.body_fat_percent != null).map((r) => ({ x: r.date, y: Number(r.body_fat_percent) })),
      "%",
      h("a", { href: "#/inbody", class: "muted small", style: "display:block;margin-top:8px;color:var(--accent);text-decoration:none" }, "InBody 詳細 →")
    );

    page.replaceChildren(gamifyCard(d.gamify), hero, proteinCard, muscleCard, fatCard);
  })();
}
