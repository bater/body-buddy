import { h } from "../ui";

const STEPS: { n: string; text: string }[] = [
  { n: "1", text: "用 Safari 開啟 Body Buddy（body-buddy.better-idea.work）。" },
  { n: "2", text: "點下方工具列中間的「分享」按鈕（方框加上向上箭頭的圖示）。" },
  { n: "3", text: "在選單中往下找，選「加入主畫面」。" },
  { n: "4", text: "確認「打開為網頁 App」是開啟的（如下圖），再點右上角「加入」。" },
  { n: "5", text: "回到主畫面點開 Body Buddy，即可享有全螢幕體驗與用餐推播通知。" },
];

export function renderHelp(page: HTMLElement) {
  page.replaceChildren(
    h(
      "div",
      { class: "card" },
      h("div", { class: "eyebrow" }, "加入主畫面"),
      h(
        "p",
        { style: "margin-top:6px" },
        "把 Body Buddy 加到 iPhone 主畫面，就能像一般 App 一樣全螢幕開啟，還能收到用餐提醒推播（iOS 需先加入主畫面才支援通知）。"
      )
    ),
    h(
      "div",
      { class: "card" },
      h("div", { class: "eyebrow" }, "步驟" ),
      ...STEPS.map((s) =>
        h(
          "div",
          { class: "entry", style: "display:flex;gap:10px;align-items:baseline" },
          h(
            "span",
            {
              class: "num",
              style:
                "flex:none;width:22px;height:22px;line-height:22px;text-align:center;border-radius:50%;background:var(--accent);color:#fff;font-weight:600;font-size:13px",
            },
            s.n
          ),
          h("span", { style: "flex:1" }, s.text)
        )
      )
    ),
    h(
      "div",
      { class: "card", style: "text-align:center" },
      h("div", { class: "eyebrow", style: "text-align:left" }, "確認「打開為網頁 App」已開啟"),
      h("img", {
        src: "/add-to-home.png",
        alt: "加入主畫面：打開為網頁 App 已開啟",
        style:
          "max-width:100%;border-radius:12px;margin-top:8px;box-shadow:0 1px 4px rgba(0,0,0,.15)",
      })
    ),
    h(
      "a",
      {
        href: "#/settings",
        class: "muted small",
        style: "color:var(--accent);text-decoration:none;padding:4px;display:block;text-align:center",
      },
      "← 返回設定"
    )
  );
}
