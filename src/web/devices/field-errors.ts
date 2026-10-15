import type { FieldIssue } from '@shared/index';

export type FieldErrors<F extends string> = Partial<Record<F, string>>;

export function toFieldErrors<F extends string>(
  issues: readonly FieldIssue[],
  fields: readonly F[],
): { fields: FieldErrors<F>; other: FieldIssue[] } {
  const found: FieldErrors<F> = {};
  const other: FieldIssue[] = [];
  for (const issue of issues) {
    const key = issue.path.split('.')[0];
    const field = fields.find((field) => field === key);
    if (field) found[field] ??= issue.message;
    else other.push(issue);
  }
  return { fields: found, other };
}
