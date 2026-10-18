import { generateStructured } from '../ai/aiService.js';
import { IMPROVE_JSON_SCHEMA, improveResultSchema } from '../ai/schemas.js';
import { getAccessibleProject } from './project.service.js';

const INSTRUCTION = `Rewrite the report in DATA (title, description, context) as a clear, structured bug report.
Use ONLY facts stated in DATA. Do not invent steps, versions, browsers, operating systems, error messages, logs or expected behavior; leave a field empty when it is unknown.
"summary" is a concise title (max 120 characters). "environment" only repeats environment details the reporter gave.
List everything the reader still needs to provide in "missingDetails".`;

// Specifics that models like to invent. If one appears in the improved text but not in the original, flag it.
const SPECIFICS = [
  /\b\d+(?:\.\d+){1,3}\b/g, // versions: 120.0, 17.2.1
  /\bhttps?:\/\/[^\s)]+/gi, // URLs
  /\b(?:chrome|firefox|safari|edge|opera|brave|windows|macos|linux|ubuntu|android|ios|iphone|ipad)(?:\s+v?\d+(?:\.\d+)*)?/gi,
  /\b(?:error|status|http|code)\s*[:#]?\s*[45]\d{2}\b/gi, // HTTP error codes
];

export function findUnsupportedSpecifics(original, improved) {
  const haystack = String(original).toLowerCase();
  const found = new Set();
  for (const re of SPECIFICS) {
    for (const m of String(improved).matchAll(re)) {
      const token = m[0].trim();
      if (!haystack.includes(token.toLowerCase())) found.add(token);
    }
  }
  return [...found].slice(0, 6);
}

// Plain text (the issue page shows descriptions as plain text, so no markdown markers).
export function composeDescription(r) {
  const parts = [];
  if (r.problemDescription) parts.push(`Problem:\n${r.problemDescription}`);
  if (r.stepsToReproduce.length) parts.push(`Steps to reproduce:\n${r.stepsToReproduce.map((s, i) => `${i + 1}. ${s.replace(/^\d+[.)]\s*/, '')}`).join('\n')}`);
  if (r.expectedBehavior) parts.push(`Expected behavior:\n${r.expectedBehavior}`);
  if (r.actualBehavior) parts.push(`Actual behavior:\n${r.actualBehavior}`);
  if (r.environment) parts.push(`Environment:\n${r.environment}`);
  return parts.join('\n\n').slice(0, 5000);
}

// Suggestion only: nothing is saved. The client shows original and improved side by side and the user
// decides whether to replace the text.
export async function improveReport(user, input) {
  await getAccessibleProject(user, input.project); // 404 unless the caller is a member

  const { value, meta } = await generateStructured({
    task: 'improve', instruction: INSTRUCTION,
    data: { title: input.title, description: input.description, context: input.context },
    jsonSchema: IMPROVE_JSON_SCHEMA,
    parse: (raw) => {
      const parsed = improveResultSchema.parse(raw);
      if (!parsed.summary && !parsed.problemDescription) throw new Error('nothing usable');
      return parsed;
    },
    userId: String(user._id),
  });

  const original = `${input.title}\n${input.description}\n${input.context}`;
  const improvedText = `${value.summary}\n${composeDescription(value)}`;
  const unsupported = findUnsupportedSpecifics(original, improvedText);

  return {
    original: { title: input.title, description: input.description, context: input.context },
    improved: { ...value, title: value.summary || input.title, description: composeDescription(value) },
    warnings: unsupported.map((t) => `The improved report mentions "${t}", which is not in your original text. Check it or delete it.`),
    meta: { ...meta, advisory: true, notice: 'The improved text is a suggestion. Nothing is saved until you approve it.' },
  };
}
