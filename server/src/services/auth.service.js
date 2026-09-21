import User from '../models/User.js';
import { signToken } from '../middleware/auth.js';
import { AppError } from '../utils/AppError.js';

export async function registerUser({ name, email, password, accountType }) {
  const existing = await User.findOne({ email });
  if (existing) throw AppError.conflict('An account with this email already exists');

  // Role comes from the constrained accountType (Developer/Tester only), never from raw client input.
  const user = await User.create({ name, email, password, role: accountType });
  return { user, token: signToken(user._id) };
}

export async function loginUser({ email, password }) {
  const user = await User.findOne({ email }).select('+password');
  // Same message for unknown email and wrong password: do not reveal which accounts exist.
  const invalid = AppError.unauthorized('Invalid email or password');
  if (!user) throw invalid;
  if (!user.isActive) throw AppError.unauthorized('This account has been deactivated');
  if (!(await user.comparePassword(password))) throw invalid;

  return { user, token: signToken(user._id) };
}
