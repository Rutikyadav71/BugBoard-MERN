import { z } from 'zod';
import { objectId } from './common.js';

// Shared by the triage and improve endpoints. Limits keep prompts small (and free-tier usage low).
const report = {
  project: objectId,
  title: z.string({ required_error: 'Title is required' }).trim().min(3, 'Title must be at least 3 characters').max(200),
  description: z.string().trim().max(5000).default(''),
  context: z.string().trim().max(1000).default(''), // optional extra context: environment, what was tried...
};

export const triageSchema = z.object(report);
export const improveSchema = z.object(report);
