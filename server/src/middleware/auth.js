import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const signToken = (userId) =>
  jwt.sign({ sub: String(userId) }, env.jwtSecret, { expiresIn: env.jwtExpiresIn });

// Verifies the bearer token and always reloads the user from the database, so a
// deactivated user or a changed role takes effect immediately (never trust token claims for role).
export const protect = asyncHandler(async (req, _res, next) => {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) throw AppError.unauthorized('Authentication token missing');

  const payload = jwt.verify(token, env.jwtSecret);
  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) throw AppError.unauthorized('User no longer exists or is deactivated');

  req.user = user;
  next();
});

export const authorize = (...roles) => (req, _res, next) => {
  if (!req.user) return next(AppError.unauthorized());
  if (!roles.includes(req.user.role)) {
    return next(AppError.forbidden(`Role '${req.user.role}' is not allowed to perform this action`));
  }
  next();
};
