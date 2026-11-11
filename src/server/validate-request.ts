import { z } from 'zod';
import { HttpError } from './http-error';

/** Parse untrusted request input and expose only its validation issues. */
export function validateRequest<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new HttpError(
      422,
      'The request is invalid.',
      result.error.issues.map((issue) => ({
        path: issue.path.map(String).join('.'),
        message: issue.message,
      })),
    );
  }
  return result.data;
}
