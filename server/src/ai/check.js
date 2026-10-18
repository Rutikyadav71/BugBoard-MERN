// `npm run ai:check` - verifies your AI configuration with ONE small real request.
// Prints non-secret settings and the outcome. It never prints your API key. It does not need MongoDB.
import 'dotenv/config';
import { aiConfig, aiAvailability } from './config.js';
import { generateStructured } from './aiService.js';

const cfg = aiConfig();
const { available, reason } = aiAvailability(cfg);

console.log('BugBoard AI check');
console.log(`  provider:        ${cfg.provider}`);
console.log(`  model:           ${cfg.model}`);
console.log(`  fallback model:  ${cfg.fallbackModel || '(disabled)'}`);
console.log(`  API key set:     ${cfg.apiKey ? 'yes' : 'no'}`);
console.log(`  AI enabled:      ${cfg.enabledFlag}`);
console.log(`  redaction:       ${cfg.redact}`);

if (!available) {
  console.log(`\nNot available: ${reason}`);
  process.exit(1);
}
if (cfg.provider === 'mock') {
  console.log('\nThe mock provider is selected, so no real request was made. Set AI_PROVIDER=gemini and GEMINI_API_KEY to test Gemini.');
  process.exit(0);
}

console.log('\nSending one small request (this uses a tiny amount of free-tier quota)...');
try {
  const { value, meta } = await generateStructured({
    task: 'ping',
    instruction: 'Return {"ok": true, "word": "pong"}.',
    data: { ping: 'ping' },
    jsonSchema: { type: 'object', properties: { ok: { type: 'boolean' }, word: { type: 'string' } }, required: ['ok', 'word'] },
    parse: (o) => { if (typeof o?.ok !== 'boolean') throw new Error('unexpected shape'); return o; },
    userId: 'ai-check',
  });
  console.log(`\nSUCCESS: model "${meta.model}" answered ${JSON.stringify(value)}`);
  if (meta.model !== cfg.model) console.log(`Note: the primary model "${cfg.model}" failed, so the fallback model answered.`);
} catch (err) {
  console.log(`\nFAILED [${err.errorCode || 'ERROR'}] ${err.message}`);
  console.log('See the AI section of the README for what each code means.');
  process.exit(1);
}
