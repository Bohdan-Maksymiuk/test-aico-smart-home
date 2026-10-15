import { z } from 'zod';

/** One invalid input field; `path` is dot-separated (e.g. `state.brightness`). */
export const fieldIssueSchema = z.strictObject({
  path: z.string(),
  message: z.string(),
});
export type FieldIssue = z.infer<typeof fieldIssueSchema>;

/** RFC 9457 problem-details body, the shape of every API error response. */
export const problemDetailsSchema = z.strictObject({
  type: z.string(),
  title: z.string(),
  status: z.number().int().min(400).max(599),
  detail: z.string().optional(),
  issues: z.array(fieldIssueSchema).optional(),
});
export type ProblemDetails = z.infer<typeof problemDetailsSchema>;

export const PROBLEM_CONTENT_TYPE = 'application/problem+json';
