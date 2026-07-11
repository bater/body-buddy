import { api, ApiError } from "../api";
import { h, toast, fmtDateShort } from "../ui";

type Invite = {
  id: number;
  created_at: string;
  expires_at: string;
  used_by_email: string | null;
  status: "active" | "used" | "expired";
};

function inviteCard(): HTMLElement {
  const linkBox = h("div");
  const listBox = h("div");

  async function refresh() {
    const invites = await api.get<Invite[]>("/api/invite");
    const label = { active: "未使用", used: "已使用", expired: "已過期" } as const;
    listBox.replaceChildren(
      ...invites.map((inv) =>
        h(
          "div",
          { class: "entry" },
          h(
            "div",
            { class: "row" },
            h(
              "span",
              { class: "grow small" },
              `建立 ${fmtDateShort(inv.created_at.slice(0, 10))} ・ 效期至 ${inv.expires_at.slice(0, 10)}`
            ),
            h(
              "span",
              { class: "small", style: inv.status === "active" ? "color:var(--good)" : "color:var(--ink-3)" },
              label[inv.status],
              inv.used_by_email ? `：${inv.used_by_email}` : ""
            ),
            inv.status === "active"
              ? h(
                  "button",
                  {
                    class: "icon-btn",
                    "aria-label": "撤銷",
                    onclick: async () => {
                      if (!confirm("撤銷這個邀請連結？")) return;
                      await api.del(`/api/invite/${inv.id}`);
                      void refresh();
                    },
                  },
                  "✕"
                )
              : null
          )
        )
      )
    );
  }

  const card = h(
    "div",
    { class: "card" },
    h("div", { class: "eyebrow" }, "邀請管理"),
    h(
      "button",
      {
        class: "btn primary",
        style: "width:100%;margin-bottom:8px",
        onclick: async (e: Event) => {
          const btn = e.currentTarget as HTMLButtonElement;
          btn.disabled = true;
          try {
            const { link } = await api.post<{ link: string }>("/api/invite", {});
            const input = h("input", { type: "text", value: link, readonly: "true" });
            linkBox.replaceChildren(
              h(
                "div",
                { class: "btn-row", style: "margin-bottom:8px" },
                h("span", { class: "grow" }, input),
                h(
                  "button",
                  {
                    class: "btn",
                    onclick: async () => {
                      await navigator.clipboard.writeText(link);
                      toast("已複製邀請連結");
                    },
                  },
                  "複製"
                )
              )
            );
            void refresh();
          } catch (err) {
            toast(err instanceof ApiError ? err.message : "建立失敗");
          } finally {
            btn.disabled = false;
          }
        },
      },
      "建立邀請連結（7 天內有效，限用一次）"
    ),
    linkBox,
    listBox
  );
  void refresh().catch(() => toast("邀請清單載入失敗"));
  return card;
}

export function renderAdmin(page: HTMLElement) {
  page.replaceChildren(h("div", { class: "empty" }, "載入中…"));

  void (async () => {
    const me = await api.get<{ is_admin: boolean }>("/api/me");
    if (!me.is_admin) {
      // hidden area: non-admins get a dead end, no hint of what lives here
      page.replaceChildren(h("div", { class: "empty" }, "找不到頁面"));
      return;
    }
    const health = await api.get<{ ok: boolean; ai: boolean; ai_provider: string | null }>("/api/health");

    page.replaceChildren(
      h(
        "div",
        { class: "card" },
        h("div", { class: "eyebrow" }, "管理後台 ADMIN"),
        h("p", { class: "muted small" }, "此頁僅管理員可見。")
      ),
      inviteCard(),
      h(
        "div",
        { class: "card" },
        h("div", { class: "eyebrow" }, "AI 功能狀態"),
        h(
          "p",
          { class: "small" },
          health.ai
            ? `✓ AI 已連線（${health.ai_provider}）— 飲食解析與 InBody 照片讀取可用`
            : "✗ 尚未設定 AI key — AI 解析停用中，仍可手動輸入。以 wrangler secret put 設定 MISTRAL_API_KEY 或 OPENROUTER_API_KEY 啟用。"
        )
      ),
      h(
        "div",
        { class: "card" },
        h("div", { class: "eyebrow" }, "關於"),
        h("p", { class: "muted small" }, "Body Buddy — 資料存於 Cloudflare D1，照片存於 R2，由 Cloudflare Access 保護。")
      )
    );
  })().catch((e) => {
    page.replaceChildren(h("div", { class: "empty" }, e instanceof ApiError ? e.message : "載入失敗"));
  });
}
