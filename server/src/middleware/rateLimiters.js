import rateLimit from 'express-rate-limit';
import { env } from '../config/env.js';

// Brute-force protection for login/register. Disabled under test so suites stay deterministic;
// a dedicated test re-enables it explicitly via createAuthLimiter().
export function createAuthLimiter({ max = 20, windowMs = 15 * 60 * 1000 } = {}) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: 'Too many attempts. Please try again later.' },
  });
}

// Draft-time similarity search runs while the user types (debounced in the client); cap it per IP.
export const similarLimiter = env.nodeEnv === 'test' ? (_req, _res, next) => next() : createAuthLimiter({ max: 120, windowMs: 60 * 1000 });

export const authLimiter = env.nodeEnv === 'test' ? (_req, _res, next) => next() : createAuthLimiter();
