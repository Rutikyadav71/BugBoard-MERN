import Issue from '../models/Issue.js';
import { generateStructured } from '../ai/aiService.js';
import { TRIAGE_JSON_SCHEMA, triageResultSchema } from '../ai/schemas.js';
import { CATEGORIES, SEVERITIES, PRIORITIES, ROLES } from '../utils/constants.js';
import { getAccessibleProject } from './project.service.js';

const INSTRUCTION = `Triage the bug report in DATA (title, description, context).
Choose category, severity and priority using ONLY the values in DATA.allowed. Severity is the technical impact; priority is how urgently it should be handled.
"component" is a short module name taken from the text, or an empty string.
"stepsToReproduce", "expectedBehavior" and "actualBehavior" must contain only what the reporter explicitly wrote; otherwise leave them empty.
"missingInformation" lists up to 5 short clarifying questions.
"suggestedAssigneeId" must be one id from DATA.developers, or an empty string when DATA.developers is absent or the choice is unclear; weigh activeIssues and topComponents.
Briefly justify severity, priority and assignee in "reasoning".`;

// Workload comes from the database (counts), never from the model.
async function developerWorkload(projectId, developers) {
  const stats = new Map(developers.map((d) => [String(d._id), { activeIssues: 0, components: new Map() }]));
  if (!developers.length) return stats;
  const rows = await Issue.find({ project: projectId, assignee: { $in: developers.map((d) => d._id) } })
    .sort({ updatedAt: -1 }).limit(500).select('assignee status component').lean();
  for (const r of rows) {
    const s = stats.get(String(r.assignee));
    if (!s) continue;
    if (!['Resolved', 'Closed'].includes(r.status)) s.activeIssues += 1;
    if (r.component) s.components.set(r.component, (s.components.get(r.component) || 0) + 1);
  }
  return stats;
}

const topComponents = (map) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([name]) => name);

// Suggestions only. Nothing here writes to the database: the user reviews and decides, and the normal
// create-issue endpoint (with its own authorization) does the saving.
export async function triageReport(user, input) {
  const project = await getAccessibleProject(user, input.project); // 404 unless the caller is a member

  // Only Admins can assign issues, so only they get assignee suggestions (and only they cause teammate
  // workload to be included in the prompt).
  const canSuggestAssignee = user.role === ROLES.ADMIN;
  const developers = canSuggestAssignee ? project.members.filter((m) => m.role === ROLES.DEVELOPER) : [];
  const workload = await developerWorkload(project._id, developers);

  const data = {
    title: input.title,
    description: input.description,
    context: input.context,
    project: { name: project.name, key: project.key },
    allowed: { categories: CATEGORIES, severities: SEVERITIES, priorities: PRIORITIES },
    ...(canSuggestAssignee ? {
      developers: developers.map((d) => ({
        id: String(d._id), name: d.name,
        activeIssues: workload.get(String(d._id)).activeIssues,
        topComponents: topComponents(workload.get(String(d._id)).components),
      })),
    } : {}),
  };

  const { value, meta } = await generateStructured({
    task: 'triage', instruction: INSTRUCTION, data, jsonSchema: TRIAGE_JSON_SCHEMA,
    parse: (raw) => {
      const parsed = triageResultSchema.parse(raw);
      const usable = parsed.category || parsed.severity || parsed.priority || parsed.missingInformation.length;
      if (!usable) throw new Error('nothing usable');
      return { parsed, raw };
    },
    userId: String(user._id),
  });

  const { parsed, raw } = value;
  const warnings = [];
  for (const [key, label] of [['category', 'category'], ['severity', 'severity'], ['priority', 'priority']]) {
    if (raw[key] != null && raw[key] !== '' && parsed[key] == null) warnings.push(`Ignored an invalid ${label} suggestion from the AI.`);
  }

  // The assignee must be a real developer in THIS project. An id the model made up (or was tricked into
  // returning) is discarded.
  let suggestedAssignee = null;
  if (parsed.suggestedAssigneeId) {
    const dev = developers.find((d) => String(d._id) === parsed.suggestedAssigneeId);
    if (dev) suggestedAssignee = { id: String(dev._id), name: dev.name, activeIssues: workload.get(String(dev._id)).activeIssues };
    else warnings.push('Ignored an assignee suggestion that is not a developer in this project.');
  }

  const { suggestedAssigneeId, ...rest } = parsed;
  return {
    suggestions: { ...rest, suggestedAssignee },
    warnings,
    meta: { ...meta, advisory: true, notice: 'AI suggestions are a starting point, not a verdict. Review and edit them before saving.' },
  };
}

