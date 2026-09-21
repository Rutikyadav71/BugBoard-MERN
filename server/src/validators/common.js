import { z } from 'zod';

export const objectId = z.string({ required_error: 'ID is required' }).regex(/^[a-f\d]{24}$/i, 'Invalid ID format');

export const idParam = z.object({ id: objectId });

// Pagination / sorting shared by list endpoints.
export const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
};
