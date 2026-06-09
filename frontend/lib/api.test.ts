import {describe, it, expect} from 'vitest';
import {API_BASE_URL} from './api';

describe('API_BASE_URL', () => {
  it('falls back to localhost:3001 when env var is not set', () => {
    expect(API_BASE_URL).toBe('http://localhost:3001');
  });
});
