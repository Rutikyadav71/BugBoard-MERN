import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import * as issues from '../services/issue.service.js';
import { findSimilarIssues } from '../services/similar.service.js';

export const create = asyncHandler(async (req, res) => {
  const issue = await issues.createIssue(req.user, req.body);
  created(res, await issues.getIssue(req.user, issue._id));
});

export const list = asyncHandler(async (req, res) => {
  const { items, ...meta } = await issues.listIssues(req.user, req.validatedQuery);
  // Per-user capabilities let the UI (e.g. Kanban drag rules) work without one request per issue.
  ok(res, items.map((i) => ({ ...i.toJSON(), capabilities: issues.capabilities(req.user, i) })), { meta });
});

export const similar = asyncHandler(async (req, res) => {
  const { items, meta } = await findSimilarIssues(req.user, req.body);
  ok(res, items, { meta });
});

export const get = asyncHandler(async (req, res) => ok(res, await issues.getIssue(req.user, req.params.id)));

export const update = asyncHandler(async (req, res) => ok(res, await issues.updateIssue(req.user, req.params.id, req.body)));

export const setStatus = asyncHandler(async (req, res) => ok(res, await issues.updateStatus(req.user, req.params.id, req.body.status)));

export const assign = asyncHandler(async (req, res) => ok(res, await issues.assignIssue(req.user, req.params.id, req.body.assignee)));

export const remove = asyncHandler(async (req, res) => {
  await issues.deleteIssue(req.user, req.params.id);
  ok(res, { deleted: true });
});

export const addComment = asyncHandler(async (req, res) => created(res, await issues.addComment(req.user, req.params.id, req.body.text)));

export const listComments = asyncHandler(async (req, res) => ok(res, await issues.listComments(req.user, req.params.id)));

export const listActivity = asyncHandler(async (req, res) => ok(res, await issues.listActivity(req.user, req.params.id)));
