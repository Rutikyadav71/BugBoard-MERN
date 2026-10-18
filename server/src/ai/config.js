// All AI behaviour is controlled by backend environment variables, read at call time.
// Nothing here is sent to the browser; /api/v1/ai/status exposes only non-secret fields.

// Defaults are models that Google's pricing page lists as "Free of charge" on the Free tier at the time of
// writing. Model names and free-tier availability change, so both are overridable (AI_MODEL / AI_FALLBACK_MODEL).
export const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
export const DEFAULT_FALLBACK_MODEL = 'gemini-3.1-flash-lite';

const int = (v, d, min = 1) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) && n >= min ? n : d;
};
const bool = (v, d) => (v === undefined || v === '' ? d : ['1', 'true', 'yes', 'on'].includes(String(v).toLowerCase()));

export function aiConfig() {
  const e = process.env;
  return {
    enabledFlag: bool(e.AI_ENABLED, true),
    provider: (e.AI_PROVIDER || 'gemini').toLowerCase(), // 'gemini' | 'mock'
    apiKey: e.GEMINI_API_KEY || '',
    model: e.AI_MODEL || DEFAULT_MODEL,
    // An explicitly empty AI_FALLBACK_MODEL disables the fallback.
    fallbackModel: e.AI_FALLBACK_MODEL === undefined ? DEFAULT_FALLBACK_MODEL : e.AI_FALLBACK_MODEL.trim(),
    timeoutMs: int(e.AI_TIMEOUT_MS, 20000, 1000),
    maxInputChars: int(e.AI_MAX_INPUT_CHARS, 6000, 200),
    maxOutputTokens: int(e.AI_MAX_OUTPUT_TOKENS, 2048, 64),
    // App-level guards that protect the shared free-tier quota. Tune them to the limits shown in your AI Studio.
    perMinute: int(e.AI_RATE_LIMIT_PER_MINUTE, 6),
    perUserPerDay: int(e.AI_DAILY_LIMIT_PER_USER, 40),
    globalPerDay: int(e.AI_DAILY_LIMIT_GLOBAL, 200),
    // Free-tier prompts may be used by Google to improve its products, so obvious secrets/PII are masked first.
    redact: bool(e.AI_REDACT_SENSITIVE, true),
  };
}

export function aiAvailability(cfg = aiConfig()) {
  if (!cfg.enabledFlag) return { available: false, reason: 'AI features are turned off (AI_ENABLED=false).' };
  if (cfg.provider === 'mock') return { available: true, reason: null };
  if (cfg.provider === 'gemini') {
    return cfg.apiKey
      ? { available: true, reason: null }
      : { available: false, reason: 'AI is not configured: set GEMINI_API_KEY in server/.env.' };
  }
  return { available: false, reason: `Unknown AI_PROVIDER "${cfg.provider}". Use "gemini" or "mock".` };
}
