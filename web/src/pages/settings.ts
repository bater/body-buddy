import { api, ApiError, type Gamify, type InBodyRecord, type JourneyEntry } from "../api";
import { h, toast, fmt, fmtDateShort, todayStr } from "../ui";
import { levelTitle } from "../gamify";

export function renderSettings(page: HTMLElement) {
  page.replaceChildren(h("div", { class: "empty" }, "載入中…"));

  void (async () => {
    const [settings, records, me, growth] = await Promise.all([
      api.get<Record<string, string>>("/api/settings"),
      api.get<InBodyRecord[]>("/api/inbody?limit=1"),
      api.get<{ email: string; name: string; is_admin: boolean; logout_url: string | null }>("/api/me"),
      api.get<{ current: Gamify; journey: JourneyEntry[] }>(`/api/gamify/journey?date=${todayStr()}`),
    ]);

    const targetInput = h("input", {
      type: "number",
      step: "5",
      min: "0",
      value: settings.protein_target_g ?? "120",
    });
    const minInput = h("input", {
      type: "number",
      step: "5",
      min: "0",
      value:
        settings.protein_min_g ??
        String(Math.round(Number(settings.protein_target_g ?? "120") * 0.75)),
    });

    const latest = records[0];
    const suggestion = latest
      ? `依最新體重 ${fmt(latest.weight_kg)} kg：維持約 ${Math.round(latest.weight_kg * 1.2)} g，增肌建議 ${Math.round(latest.weight_kg * 1.6)}–${Math.round(latest.weight_kg * 2.2)} g（1.6–2.2 g/kg）`
      : "記錄一筆 InBody 後，這裡會依體重建議每日目標";

    page.replaceChildren(
      h(
        "div",
        { class: "card" },
        h("div", { class: "eyebrow" }, "登入身分"),
        h(
          "div",
          { class: "row", style: "display:flex;align-items:baseline;gap:8px" },
          h("span", { class: "grow", style: "flex:1" }, me.email),
          me.logout_url
            ? h(
                "a",
                { href: me.logout_url, class: "btn small", style: "text-decoration:none" },
                "登出"
              )
            : null
        )
      ),
      h(
        "div",
        { class: "card" },
        h("div", { class: "eyebrow" }, "每日蛋白質目標"),
        h("label", { class: "field" }, h("span", {}, "目標 (g)"), targetInput),
        h("label", { class: "field" }, h("span", {}, "最低 (g)"), minInput),
        h(
          "p",
          { class: "muted small" },
          "達到「最低」保住 🔥 連勝；達到「目標」拿滿當日 XP。"
        ),
        h("p", { class: "muted small", style: "margin-bottom:10px" }, suggestion),
        h(
          "button",
          {
            class: "btn primary",
            style: "width:100%",
            onclick: async () => {
              const v = Number(targetInput.value);
              const m = Number(minInput.value);
              if (!(v > 0)) return toast("請輸入有效目標");
              if (!(m > 0) || m > v) return toast("最低需大於 0 且不高於目標");
              try {
                await api.put("/api/settings", {
                  protein_target_g: String(v),
                  protein_min_g: String(m),
                });
                toast("已更新目標");
              } catch (e) {
                toast(e instanceof ApiError ? e.message : "儲存失敗");
              }
            },
          },
          "儲存"
        )
      ),
      h(
        "div",
        { class: "card" },
        h("div", { class: "eyebrow" }, "成長日誌 JOURNEY"),
        h(
          "div",
          { style: "display:flex;align-items:center;gap:8px;margin-bottom:8px" },
          h("span", { class: "level-badge num" }, `Lv ${growth.current.level}`),
          h("span", {}, levelTitle(growth.current.level)),
          h(
            "span",
            { class: "muted small num", style: "flex:1;text-align:right" },
            `🔥 ${growth.current.streak_days} 天 ・ 累積 ${growth.current.xp} XP`
          )
        ),
        growth.journey.length === 0
          ? h("div", { class: "empty" }, "開始記錄飲食後，這裡會寫下你的成長軌跡")
          : h(
              "div",
              {},
              ...[...growth.journey].reverse().map((e) =>
                h(
                  "div",
                  { class: "entry", style: "display:flex;gap:10px;align-items:baseline" },
                  h("span", { class: "num muted small", style: "min-width:40px" }, fmtDateShort(e.date)),
                  h(
                    "span",
                    { style: "flex:1" },
                    e.level === 1 ? "🌱 開始記錄，旅程展開" : `⬆️ 升上 Lv ${e.level}・${levelTitle(e.level)}`
                  ),
                  e.level === 1 ? "" : h("span", { class: "muted small num" }, `${e.xp} XP`)
                )
              )
            )
      ),
      ...(me.is_admin
        ? [
            h(
              "a",
              {
                href: "#/admin",
                class: "card",
                style: "display:block;text-decoration:none;color:var(--accent);font-weight:600",
              },
              "🔧 管理後台 →"
            ),
          ]
        : [])
    );
  })().catch((e) => {
    page.replaceChildren(h("div", { class: "empty" }, e instanceof ApiError ? e.message : "載入失敗"));
  });
}
