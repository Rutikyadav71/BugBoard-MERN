// Best-effort masking of obvious secrets and personal data before text leaves the server.
// This reduces risk; it does not guarantee that nothing sensitive is ever sent.
const RULES = [
  [/\beyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]{8,}\b/g, '[REDACTED_TOKEN]'], // JWTs
  [/\bAIza[\w-]{20,}\b/g, '[REDACTED_KEY]'], // Google API keys
  [/\b(?:sk|pk|rk)[-_][A-Za-z0-9_-]{16,}\b/g, '[REDACTED_KEY]'],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}\b/g, '[REDACTED_KEY]'], // GitHub tokens
  [/\bAKIA[0-9A-Z]{16}\b/g, '[REDACTED_KEY]'], // AWS access key ids
  [/\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/gi, 'Bearer [REDACTED_TOKEN]'],
  [/\b(password|passwd|pwd|secret|token|api[_-]?key|authorization)\b(\s*[:=]\s*)(["']?)[^\s"',;]{3,}\3/gi, '$1$2[REDACTED]'],
  [/\b[\w.+-]+@[\w-]+(?:\.[\w-]+)+\b/g, '[REDACTED_EMAIL]'],
  [/\b(?:\d[ -]?){13,19}\b/g, '[REDACTED_NUMBER]'], // card-like digit runs
  [/\b[A-Fa-f0-9]{32,}\b/g, '[REDACTED_HASH]'],
];

export function redact(text) {
  if (typeof text !== 'string' || !text) return text;
  return RULES.reduce((out, [re, sub]) => out.replace(re, sub), text);
}

// Applies redact() to every string inside a plain object/array (used on the data sent to the model).
export function redactDeep(value) {
  if (typeof value === 'string') return redact(value);
  if (Array.isArray(value)) return value.map(redactDeep);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redactDeep(v)]));
  return value;
}
