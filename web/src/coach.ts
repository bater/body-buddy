import { api, type CoachFeedback } from "./api";
import { h, todayStr } from "./ui";

/** Render coach feedback after a save: the tier-0 rule message immediately;
 * when the event is notable, fetch the tier-1 LLM message and swap it in.
 * The coach is decorative — any failure silently keeps the tier-0 text. */
export function showCoach(box: HTMLElement, coach: CoachFeedback, kind: string, recordId: number) {
  if (!coach) {
    box.replaceChildren();
    return;
  }
  const msg = h("div", {}, coach.message);
  const card = h("div", { class: "card coach" }, h("div", { class: "eyebrow" }, "💬 教練"), msg);
  box.replaceChildren(card);
  if (!coach.notable) return;

  const thinking = h(
    "div",
    { class: "muted small", style: "margin-top:6px" },
    h("span", { class: "spin" }),
    " 教練思考中…"
  );
  card.append(thinking);
  void api
    .post<{ message: string | null }>("/api/coach", { kind, record_id: recordId, today: todayStr() })
    .then((res) => {
      if (res.message) msg.textContent = res.message;
    })
    .catch(() => undefined)
    .finally(() => thinking.remove());
}
