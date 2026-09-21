import { Router } from 'express';
import { stats, assigned } from '../controllers/dashboard.controller.js';
import { protect } from '../middleware/auth.js';

const router = Router();
router.use(protect);
router.get('/stats', stats);
router.get('/assigned', assigned);

export default router;
