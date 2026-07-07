export type Env = {
  DB: D1Database;
  PHOTOS: R2Bucket;
  ASSETS: Fetcher;
  // AI provider: set ONE of these (Mistral wins if both are set)
  MISTRAL_API_KEY?: string;
  MISTRAL_MODEL?: string; // default: mistral-small-latest (text + vision)
  OPENROUTER_API_KEY?: string;
  OPENROUTER_MODEL?: string; // default: google/gemini-2.5-flash
};

export type AppContext = { Bindings: Env };
