import { STATUS_CODES } from 'node:http';
import {
  PROBLEM_CONTENT_TYPE,
  type FieldIssue,
  type ProblemDetails,
} from '@shared/index';
import type { Response } from 'express';

/** A problem whose meaning is fully conveyed by its HTTP status (RFC 9457 §4.2.1). */
export function problem(
  status: number,
  detail?: string,
  issues?: FieldIssue[],
): ProblemDetails {
  return {
    type: 'about:blank',
    title: STATUS_CODES[status] ?? 'Error',
    status,
    ...(detail === undefined ? {} : { detail }),
    ...(issues === undefined ? {} : { issues }),
  };
}

export function sendProblem(res: Response, body: ProblemDetails): void {
  res.status(body.status).type(PROBLEM_CONTENT_TYPE).json(body);
}
