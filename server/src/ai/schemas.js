import { z } from 'zod';
import { CATEGORIES, SEVERITIES, PRIORITIES } from '../utils/constants.js';

// Two layers per feature: a JSON Schema that STEERS the model, and a zod schema that VALIDATES what comes back.
// The model is never trusted: out-of-range values are dropped, not passed on.

// Lenient field parsers: they coerce or default instead of throwing, so one bad field does not discard a
// whole otherwise-useful answer. (A non-object response still fails.)
const clipText = (max) => z.preprocess((v) => (typeof v === 'string' ? v.trim().slice(0, max) : ''), z.string());
const clipList = (n, max) => z.preprocess(
  (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string').map((x) => x.trim().slice(0, max)).filter(Boolean).slice(0, n) : []),
  z.array(z.string()),
);
// Case-insensitive enum; anything not in the allowed list becomes null.
const looseEnum = (allowed) => z.preprocess(
  (v) => (typeof v === 'string' ? allowed.find((a) => a.toLowerCase() === v.trim().toLowerCase()) ?? v : v),
  z.enum(allowed).nullable(),
).catch(null);

const str = { type: 'string' };
const strList = { type: 'array', items: str };

export const TRIAGE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    category: { type: 'string', enum: CATEGORIES },
    severity: { type: 'string', enum: SEVERITIES },
    priority: { type: 'string', enum: PRIORITIES },
    component: str,
    stepsToReproduce: strList,
    expectedBehavior: str,
    actualBehavior: str,
    missingInformation: strList,
    suggestedAssigneeId: str,
    reasoning: { type: 'object', properties: { severity: str, priority: str, assignee: str }, required: ['severity', 'priority', 'assignee'] },
  },
  required: ['category', 'severity', 'priority', 'component', 'stepsToReproduce', 'expectedBehavior', 'actualBehavior', 'missingInformation', 'suggestedAssigneeId', 'reasoning'],
};

export const triageResultSchema = z.object({
  category: looseEnum(CATEGORIES),
  severity: looseEnum(SEVERITIES),
  priority: looseEnum(PRIORITIES),
  component: clipText(80),
  stepsToReproduce: clipList(10, 300),
  expectedBehavior: clipText(500),
  actualBehavior: clipText(500),
  missingInformation: clipList(8, 200),
  suggestedAssigneeId: clipText(40),
  reasoning: z.preprocess((v) => (v && typeof v === 'object' ? v : {}), z.object({ severity: clipText(200), priority: clipText(200), assignee: clipText(200) })),
});

export const IMPROVE_JSON_SCHEMA = {
  type: 'object',
  properties: {
    summary: str, problemDescription: str, stepsToReproduce: strList, expectedBehavior: str, actualBehavior: str, environment: str, missingDetails: strList,
  },
  required: ['summary', 'problemDescription', 'stepsToReproduce', 'expectedBehavior', 'actualBehavior', 'environment', 'missingDetails'],
};

export const improveResultSchema = z.object({
  summary: clipText(200),
  problemDescription: clipText(2000),
  stepsToReproduce: clipList(10, 300),
  expectedBehavior: clipText(500),
  actualBehavior: clipText(500),
  environment: clipText(300),
  missingDetails: clipList(8, 200),
});
