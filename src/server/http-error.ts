import type { FieldIssue } from '@shared/index';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly issues?: FieldIssue[],
  ) {
    super(message);
  }
}
