import { GoogleGenAI } from '@google/genai';
import { ProviderError } from '../errors.js';

// Translates any SDK/network failure into a provider-neutral ProviderError. Duck-typed (no instanceof) so it
// works for plain objects in unit tests. The message never includes request content or the API key.
export function classifyGeminiError(err) {
  if (err instanceof ProviderError) return err;
  const status = Number(err?.status ?? err?.code);
  const msg = String(err?.message || '');
  if (err?.name === 'AbortError' || /aborted|timed? ?out/i.test(msg) || err?.name === 'RequestAbortedError') return new ProviderError('timeout', 'timeout');
  if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(msg)) return new ProviderError('quota', 'quota exhausted', 429);
  if (status === 401 || status === 403 || /API key (not valid|expired)|PERMISSION_DENIED|UNAUTHENTICATED/i.test(msg)) return new ProviderError('auth', 'api key rejected', status || 401);
  if (status === 404) return new ProviderError('not_found', 'model not found', 404);
  if (status === 400) return new ProviderError('bad_request', 'request rejected', 400);
  if (status >= 500 && status <= 599) return new ProviderError('unavailable', 'provider unavailable', status);
  if (/ECONNRESET|ENOTFOUND|ECONNREFUSED|EAI_AGAIN|fetch failed|network/i.test(msg)) return new ProviderError('network', 'network error');
  return new ProviderError('unavailable', 'unexpected provider failure', Number.isFinite(status) ? status : undefined);
}

export function createGeminiProvider({ apiKey }) {
  const client = new GoogleGenAI({ apiKey });

  return {
    name: 'gemini',

    // Asks for JSON that matches `jsonSchema`. The caller still validates the result: the schema steers the
    // model, it is not a guarantee.
    async generateJson({ system, user, jsonSchema, model, timeoutMs, maxOutputTokens, temperature = 0.2 }) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const res = await client.models.generateContent({
          model,
          contents: user,
          config: {
            systemInstruction: system,
            temperature,
            maxOutputTokens,
            responseMimeType: 'application/json',
            responseJsonSchema: jsonSchema,
            abortSignal: controller.signal,
            httpOptions: { timeout: timeoutMs },
          },
        });
        if (res.promptFeedback?.blockReason) throw new ProviderError('blocked', 'prompt blocked');
        const text = res.text;
        if (!text) throw new ProviderError('empty', 'empty response');
        return { text, model, finishReason: res.candidates?.[0]?.finishReason };
      } catch (err) {
        throw classifyGeminiError(err);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
