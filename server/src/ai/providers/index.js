import { createGeminiProvider } from './geminiProvider.js';
import { createMockProvider } from './mockProvider.js';

let override = null; // tests can inject a provider
let cached = { key: '', provider: null };

export function setProviderForTests(provider) {
  override = provider;
}

export function getProvider(cfg) {
  if (override) return override;
  const key = `${cfg.provider}:${cfg.apiKey ? 'k' : 'nokey'}`;
  if (cached.key !== key) {
    cached = { key, provider: cfg.provider === 'mock' ? createMockProvider() : createGeminiProvider({ apiKey: cfg.apiKey }) };
  }
  return cached.provider;
}
