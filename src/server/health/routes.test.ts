import { describe, expect, it } from 'vitest';
import {
  useHttpHarness,
  useHttpHarnessWithUnreachableDatabase,
} from '../test/http-harness';

const harness = useHttpHarness();
describe('health', () => {
  it('reports database availability', async () => {
    const res = await harness.http().get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('health when the database is unavailable', () => {
  const unavailable = useHttpHarnessWithUnreachableDatabase();

  it('returns a 503 problem response', async () => {
    const res = await unavailable.http().get('/health');
    expect(res.status).toBe(503);
    expect(res.headers['content-type']).toMatch(/^application\/problem\+json/);
  });
});
