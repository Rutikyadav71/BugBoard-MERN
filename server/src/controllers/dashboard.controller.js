import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ok } from '../utils/response.js';
import { objectId } from '../validators/common.js';
import * as dashboard from '../services/dashboard.service.js';

const statsQuery = z.object({ project: objectId.optional() });

export const stats = asyncHandler(async (req, res) => {
  const { project } = statsQuery.parse(req.query);
  ok(res, await dashboard.getStats(req.user, { project }));
});

export const assigned = asyncHandler(async (req, res) => ok(res, await dashboard.getAssigned(req.user)));
