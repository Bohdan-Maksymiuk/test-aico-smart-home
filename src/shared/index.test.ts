import { describe, expect, it } from 'vitest';
import { API_BASE_PATH } from './index';

describe('contract', () => {
  it('exposes the versioned API base path', () => {
    expect(API_BASE_PATH).toBe('/api');
  });
});
