import { Router } from 'express';
import * as c from '../controllers/issue.controller.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { idParam } from '../validators/common.js';
import {
  createIssueSchema, updateIssueSchema, updateStatusSchema, assignIssueSchema, listIssuesQuery, createCommentSchema,
} from '../validators/issue.validators.js';

const router = Router();
router.use(protect);

// Role checks are enforced in the service layer because they depend on the issue itself
// (assignee / reporter / current status), not just on the user's role.
router.get('/', validate(listIssuesQuery, 'query'), c.list);
router.post('/', validate(createIssueSchema), c.create);
router.get('/:id', validate(idParam, 'params'), c.get);
router.patch('/:id', validate(idParam, 'params'), validate(updateIssueSchema), c.update);
router.patch('/:id/status', validate(idParam, 'params'), validate(updateStatusSchema), c.setStatus);
router.patch('/:id/assign', validate(idParam, 'params'), validate(assignIssueSchema), c.assign);
router.delete('/:id', validate(idParam, 'params'), c.remove);

router.get('/:id/comments', validate(idParam, 'params'), c.listComments);
router.post('/:id/comments', validate(idParam, 'params'), validate(createCommentSchema), c.addComment);
router.get('/:id/activity', validate(idParam, 'params'), c.listActivity);

export default router;
