import { z } from "zod";

/** Standard pagination query params for list endpoints. */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** RFC-7807-ish problem detail shape returned by the API exception filter. */
export interface ProblemDetail {
  statusCode: number;
  error: string;
  message: string | string[];
  path?: string;
  timestamp?: string;
}
