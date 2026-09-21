import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import * as projects from '../services/project.service.js';

export const create = asyncHandler(async (req, res) => created(res, await projects.createProject(req.user, req.body)));

export const list = asyncHandler(async (req, res) => {
  const { items, ...meta } = await projects.listProjects(req.user, req.validatedQuery);
  ok(res, items, { meta });
});

export const get = asyncHandler(async (req, res) => ok(res, await projects.getAccessibleProject(req.user, req.params.id)));

export const update = asyncHandler(async (req, res) => ok(res, await projects.updateProject(req.user, req.params.id, req.body)));

export const members = asyncHandler(async (req, res) => ok(res, await projects.updateMembers(req.user, req.params.id, req.body)));

export const assignable = asyncHandler(async (req, res) => ok(res, await projects.listAssignableUsers(req.user, req.params.id)));

export const users = asyncHandler(async (req, res) => ok(res, await projects.listUsers({ search: req.query.search?.toString().slice(0, 100) })));
