import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { aiConfig, aiAvailability } from '../ai/config.js';
import { usageSnapshot } from '../ai/usageLimiter.js';
import { triageReport } from '../services/triage.service.js';
import { improveReport } from '../services/improve.service.js';

export const triage = asyncHandler(async (req, res) => ok(res, await triageReport(req.user, req.body)));

export const improve = asyncHandler(async (req, res) => ok(res, await improveReport(req.user, req.body)));

// Non-secret description of the AI setup, so the UI can show/hide AI controls and explain why.
export const status = asyncHandler(async (req, res) => {
  const cfg = aiConfig();
  const { available, reason } = aiAvailability(cfg);
  ok(res, {
    available,
    reason,
    provider: cfg.provider,
    model: available ? cfg.model : null,
    demo: cfg.provider === 'mock',
    limits: usageSnapshot(String(req.user._id), cfg),
    dataNotice:
      cfg.provider === 'gemini'
        ? 'Text you send to AI features is processed by Google Gemini. If this server uses a free-tier key, Google may use it to improve its products, so do not include secrets or personal data.'
        : null,
  });
});
