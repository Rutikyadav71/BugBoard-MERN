import { z } from 'zod';
import { objectId, pagination } from './common.js';
import { SEVERITIES, PRIORITIES, STATUSES } from '../utils/constants.js';

const title = z.string({ required_error: 'Title is required' }).trim().min(3, 'Title must be at least 3 characters').max(200);
const description = z.string({ required_error: 'Description is required' }).trim().min(5, 'Description must be at least 5 characters').max(5000);

// NOTE: `reporter` and `status` are deliberately absent from create: the reporter is always the
// authenticated user and new issues always start as 'Open'. Zod strips any client-sent values.
export const createIssueSchema = z.object({
  title,
  description,
  project: objectId,
  severity: z.enum(SEVERITIES).default('Medium'),
  priority: z.enum(PRIORITIES).default('Medium'),
  assignee: objectId.nullable().optional(),
});

// Editable content fields. Status and assignee have dedicated endpoints with their own rules.
export const updateIssueSchema = z
  .object({
    title: title.optional(),
    description: description.optional(),
    severity: z.enum(SEVERITIES).optional(),
    priority: z.enum(PRIORITIES).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to update' });

export const updateStatusSchema = z.object({ status: z.enum(STATUSES, { errorMap: () => ({ message: `Status must be one of: ${STATUSES.join(', ')}` }) }) });

export const assignIssueSchema = z.object({ assignee: objectId.nullable() });

const csvEnum = (values) =>
  z.string().optional().transform((v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : undefined))
    .refine((arr) => !arr || arr.every((x) => values.includes(x)), { message: `Allowed values: ${values.join(', ')}` });

export const listIssuesQuery = z.object({
  search: z.string().trim().max(100).optional(),
  status: csvEnum(STATUSES),
  priority: csvEnum(PRIORITIES),
  severity: csvEnum(SEVERITIES),
  project: objectId.optional(),
  reporter: objectId.optional(),
  // 'me' is accepted as a shortcut for the logged-in user; 'unassigned' finds issues with no assignee.
  assignee: z.union([objectId, z.literal('me'), z.literal('unassigned')]).optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'priority', 'severity', 'status', 'title']).default('createdAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
  ...pagination,
});

export const createCommentSchema = z.object({
  text: z.string({ required_error: 'Comment text is required' }).trim().min(1, 'Comment cannot be empty').max(2000),
});
