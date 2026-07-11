export type Env = {
  DB: D1Database;
  PHOTOS: R2Bucket;
  ASSETS: Fetcher;
  // AI provider: set ONE of these (Mistral wins if both are set)
  MISTRAL_API_KEY?: string;
  MISTRAL_MODEL?: string; // default: mistral-small-latest (text + vision)
  OPENROUTER_API_KEY?: string;
  OPENROUTER_MODEL?: string; // default: google/gemini-2.5-flash
  // Auth (Cloudflare Access in front of the app)
  ACCESS_TEAM_DOMAIN?: string; // e.g. rough-sea-d78c.cloudflareaccess.com
  ACCESS_AUD?: string; // Access application Audience tag; enables JWT verification
  OWNER_EMAILS?: string; // comma-separated; first login among these claims pre-multi-user data
  DEV_USER_EMAIL?: string; // .dev.vars only — local identity without Access
  // Web Push (meal reminders)
  VAPID_PUBLIC_KEY?: string; // vars — public by design
  VAPID_PRIVATE_KEY?: string; // secret
  VAPID_SUBJECT?: string; // mailto: contact for push services
  // Mailgun for invitation emails (sending is a no-op until key + domain are set)
  MAILGUN_API_KEY?: string; // secret
  MAILGUN_DOMAIN?: string; // sending domain, e.g. mg.example.com (var)
  MAILGUN_FROM?: string; // optional From override (default: Body Buddy <postmaster@DOMAIN>)
  MAILGUN_API_BASE?: string; // optional; EU accounts set https://api.eu.mailgun.net
};

export type AppContext = {
  Bindings: Env;
  Variables: { userId: number; userEmail: string; userName: string; isAdmin: boolean };
};
