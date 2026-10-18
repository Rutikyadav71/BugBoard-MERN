import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { protect } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { validate } from '../middleware/validate.js';
import * as c from '../controllers/ai.controller.js';
import { triageSchema, improveSchema } from '../validators/ai.validators.js';

const router = Router();
router.use(protect);

// Coarse per-IP guard in front of the per-user AI budget enforced inside the AI service.
const ipLimiter = env.nodeEnv === 'test'
  ? (_req, _res, next) => next()
  : rateLimit({ windowMs: 60_000, max: 60, standardHeaders: true, legacyHeaders: false, message: { success: false, message: 'Too many requests. Please slow down.' } });
router.use(ipLimiter);

router.get('/status', c.status);
// Both endpoints are read-only: they return suggestions and never create or change records.
router.post('/triage', validate(triageSchema), c.triage);
router.post('/improve', validate(improveSchema), c.improve);

export default router;
