type Child = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, unknown> = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") {
      el.addEventListener(k.slice(2), v as EventListener);
    } else if (k === "class") {
      el.className = String(v);
    } else if (k === "value" && "value" in el) {
      (el as HTMLInputElement).value = String(v);
    } else {
      el.setAttribute(k, String(v));
    }
  }
  for (const c of children) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

// Standard tappable card row (accent + semibold, emoji lead, arrow pinned
// right). Pass `href` for a nav link (<a>, default trailing "→"); pass
// `onclick` for an in-place action/section toggle (<div>, e.g. trailing "▼").
// The rendered `.card-link-arrow` span can be grabbed to flip a toggle arrow.
export function cardLink(
  label: string,
  opts: { href?: string; onclick?: (e: Event) => void; trailing?: string } = {}
): HTMLElement {
  const attrs: Record<string, unknown> = { class: "card card-link" };
  if (opts.href) attrs.href = opts.href;
  if (opts.onclick) attrs.onclick = opts.onclick;
  return h(
    opts.href ? "a" : "div",
    attrs,
    h("span", {}, label),
    h("span", { class: "card-link-arrow" }, opts.trailing ?? "→")
  );
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(msg: string) {
  let t = document.getElementById("toast");
  if (!t) {
    t = h("div", { id: "toast", role: "status" });
    document.body.append(t);
  }
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t!.classList.remove("show"), 2600);
}

export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function fmtDateShort(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}`;
}

export function fmt(n: number | null | undefined, digits = 1): string {
  if (n == null) return "–";
  return Number(n).toFixed(digits).replace(/\.0+$/, "");
}
