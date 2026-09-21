import { Router } from 'express';
import * as c from '../controllers/project.controller.js';
import { protect, authorize } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ROLES } from '../utils/constants.js';
import { idParam } from '../validators/common.js';
import { createProjectSchema, updateProjectSchema, projectMembersSchema, listProjectsQuery } from '../validators/project.validators.js';

const router = Router();
router.use(protect);

router.get('/', validate(listProjectsQuery, 'query'), c.list);
router.post('/', authorize(ROLES.ADMIN), validate(createProjectSchema), c.create);
router.get('/:id', validate(idParam, 'params'), c.get);
router.patch('/:id', authorize(ROLES.ADMIN), validate(idParam, 'params'), validate(updateProjectSchema), c.update);
router.patch('/:id/members', authorize(ROLES.ADMIN), validate(idParam, 'params'), validate(projectMembersSchema), c.members);
router.get('/:id/assignable-users', validate(idParam, 'params'), c.assignable);

export default router;
