import type { ErrorRequestHandler } from 'express';
import type { Logger } from 'pino';
import { ZodError } from 'zod';
import { HttpError } from './http-error';
import { problem, sendProblem } from './problem';

/**
 * The one place thrown route and validation errors become problem details.
 */
export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (error: unknown, _req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    if (error instanceof HttpError) {
      sendProblem(res, problem(error.status, error.message, error.issues));
      return;
    }
    if (error instanceof ZodError) {
      sendProblem(
        res,
        problem(
          422,
          'The request is invalid.',
          error.issues.map((issue) => ({
            path: issue.path.map(String).join('.'),
            message: issue.message,
          })),
        ),
      );
      return;
    }
    if (isExposedClientError(error)) {
      sendProblem(
        res,
        problem(
          error.status,
          error.type === 'entity.parse.failed'
            ? 'The request body is not valid JSON.'
            : error.message,
        ),
      );
      return;
    }

    logger.error({ err: error }, 'Unhandled error');
    // Never echo the error: messages and stacks can leak internals.
    sendProblem(res, problem(500, 'An unexpected error occurred.'));
  };
}

/** Errors from Express's body parsers (http-errors) that are safe to show. */
interface ExposedClientError {
  status: number;
  expose: true;
  message: string;
  type?: string;
}

function isExposedClientError(error: unknown): error is ExposedClientError {
  if (!(error instanceof Error)) return false;
  const { status, expose } = error as Partial<ExposedClientError>;
  return (
    expose === true &&
    typeof status === 'number' &&
    status >= 400 &&
    status < 500
  );
}
