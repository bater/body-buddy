import type { Env } from "./env";

// Invite emails via the Mailgun HTTP API (free tier: 100 mails/day). A plain
// fetch with HTTP Basic auth — no SMTP sockets, no third-party deps.

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
};

function mailgunBase(env: Env): string {
  // EU accounts must set MAILGUN_API_BASE=https://api.eu.mailgun.net
  return (env.MAILGUN_API_BASE || "https://api.mailgun.net").replace(/\/+$/, "");
}

/** Send one email through Mailgun. Throws on any non-2xx response. */
export async function sendMail(env: Env, msg: EmailMessage): Promise<void> {
  const key = env.MAILGUN_API_KEY;
  const domain = env.MAILGUN_DOMAIN;
  if (!key || !domain) throw new Error("Mailgun 未設定");

  const from = env.MAILGUN_FROM || `Body Buddy <postmaster@${domain}>`;
  const form = new URLSearchParams({
    from,
    to: msg.to,
    subject: msg.subject,
    text: msg.text,
  });

  const res = await fetch(`${mailgunBase(env)}/v3/${domain}/messages`, {
    method: "POST",
    headers: { Authorization: "Basic " + btoa(`api:${key}`) },
    body: form,
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 200);
    throw new Error(`Mailgun ${res.status}：${detail || res.statusText}`);
  }
}

/** Compose + send the invitation email. Returns false when Mailgun isn't configured. */
export async function sendInviteEmail(env: Env, to: string, link: string): Promise<boolean> {
  if (!env.MAILGUN_API_KEY || !env.MAILGUN_DOMAIN) return false;
  const text = [
    "你好，",
    "",
    "你在等候名單上的 Body Buddy 邀請通過了！",
    "點下面的連結，用你的 Google 帳號登入即可開始使用：",
    "",
    link,
    "",
    "這個連結 7 天內有效，且僅限使用一次。",
    "",
    "— Body Buddy",
  ].join("\n");
  await sendMail(env, { to, subject: "你的 Body Buddy 邀請", text });
  return true;
}
