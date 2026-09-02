import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createWriteClient } from '@/lib/supabase';

const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
});

afterEach(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRoleKey;
  process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
});

describe('createWriteClient', () => {
  it('throws a clear error when the service-role key is absent', () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    expect(() => createWriteClient()).toThrowError(/SUPABASE_SERVICE_ROLE_KEY/);
  });
});
