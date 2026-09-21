import { asyncHandler } from '../utils/asyncHandler.js';
import { ok, created } from '../utils/response.js';
import { registerUser, loginUser } from '../services/auth.service.js';

export const register = asyncHandler(async (req, res) => {
  const { user, token } = await registerUser(req.body);
  created(res, { user, token });
});

export const login = asyncHandler(async (req, res) => {
  const { user, token } = await loginUser(req.body);
  ok(res, { user, token });
});

export const me = asyncHandler(async (req, res) => {
  ok(res, { user: req.user });
});
