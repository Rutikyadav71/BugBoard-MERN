import { Router } from 'express';
import { register, login, me } from '../controllers/auth.controller.js';
import { validate } from '../middleware/validate.js';
import { protect } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiters.js';
import { registerSchema, loginSchema } from '../validators/auth.validators.js';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login', authLimiter, validate(loginSchema), login);
router.get('/me', protect, me);

export default router;
