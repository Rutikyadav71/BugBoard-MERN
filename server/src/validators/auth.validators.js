import { z } from 'zod';

// NOTE: `role` is deliberately NOT accepted here. .strip() (Zod default) discards it, so a client
// can never self-register as Admin. Public registration always creates a Tester or Developer via
// the explicit, limited `accountType` field below; Admin accounts are created only by seed/Admin tools.
const password = z
  .string({ required_error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters')
  .regex(/[A-Za-z]/, 'Password must contain a letter')
  .regex(/[0-9]/, 'Password must contain a number');

export const registerSchema = z.object({
  name: z.string({ required_error: 'Name is required' }).trim().min(2, 'Name must be at least 2 characters').max(80),
  email: z.string({ required_error: 'Email is required' }).trim().toLowerCase().email('Enter a valid email address'),
  password,
  accountType: z.enum(['Developer', 'Tester']).default('Tester'),
});

export const loginSchema = z.object({
  email: z.string({ required_error: 'Email is required' }).trim().toLowerCase().email('Enter a valid email address'),
  password: z.string({ required_error: 'Password is required' }).min(1, 'Password is required'),
});
