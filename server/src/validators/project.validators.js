import { z } from 'zod';
import { objectId, pagination } from './common.js';

const key = z
  .string({ required_error: 'Project key is required' })
  .trim()
  .toUpperCase()
  .regex(/^[A-Z][A-Z0-9]{1,9}$/, 'Key must be 2-10 characters (letters/digits), starting with a letter');

export const createProjectSchema = z.object({
  name: z.string({ required_error: 'Project name is required' }).trim().min(2, 'Name must be at least 2 characters').max(100),
  key,
  description: z.string().trim().max(1000).optional().default(''),
  members: z.array(objectId).max(100).optional().default([]),
});

// Key is immutable after creation (issue keys such as BB-12 are derived from it).
export const updateProjectSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().max(1000).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to update' });

export const projectMembersSchema = z.object({
  add: z.array(objectId).max(100).optional().default([]),
  remove: z.array(objectId).max(100).optional().default([]),
}).refine((v) => v.add.length + v.remove.length > 0, { message: 'Provide users to add or remove' });

export const listProjectsQuery = z.object({
  search: z.string().trim().max(100).optional(),
  ...pagination,
});
