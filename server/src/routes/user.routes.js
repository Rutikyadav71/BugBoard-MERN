import { Router } from 'express';
import { users } from '../controllers/project.controller.js';
import { protect, authorize } from '../middleware/auth.js';
import { ROLES } from '../utils/constants.js';

const router = Router();
// Only Admins build teams, so only Admins can browse the user directory.
router.get('/', protect, authorize(ROLES.ADMIN), users);

export default router;
