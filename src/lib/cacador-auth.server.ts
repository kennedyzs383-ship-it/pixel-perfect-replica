import { createClient } from '@supabase/supabase-js';
import { legacyCrmConfig } from './cacador-legacy-config';

// Verification is against trusted configuration, never a URL supplied by the caller.
export async function verifyCacadorSession(headers: Headers) {
  const legacyToken = headers.get('x-nuvem-session');
  const legacy = legacyCrmConfig();
  if (legacyToken) {
    if (!legacy.key) return false;
    try {
      const response = await fetch(`${legacy.url}/auth/v1/user`, {
        headers: { apikey: legacy.key, Authorization: `Bearer ${legacyToken}` },
        signal: AbortSignal.timeout(8000), redirect: 'manual',
      });
      if (!response.ok) return false;
      const user: { id?: unknown } = await response.json();
      return typeof user.id === 'string' && user.id.length > 0;
    } catch { return false; }
  }
  const authorization = headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) return false;
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
  if (!url || !key) return false;
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  try {
    const { data, error } = await client.auth.getUser(authorization.slice(7));
    return !error && Boolean(data.user?.id);
  } catch { return false; }
}
