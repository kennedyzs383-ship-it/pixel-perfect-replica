// Keep the existing CRM on its own account system, never the newly provisioned AI backend.
export function legacyCrmConfig() {
  const originalUrl = 'https://emcdkxxmfqgejfmfpxwe.supabase.co';
  const previousUrl = import.meta.env['VITE_SUPABASE_URL'] as string | undefined;
  const url = ((import.meta.env['VITE_CACADOR_SUPABASE_URL'] as string | undefined) || originalUrl).replace(/\/+$/, '');
  // Publishable keys are designed for browser use; keep this project's public key as a safe default
  // so the original CRM works even when optional build-time env variables are not supplied.
  const defaultPublishableKey = 'sb_publishable_W900yaUD0kzHZdjEUuNpFw_KPT9Qln2';
  const key = (import.meta.env['VITE_CACADOR_SUPABASE_PUBLISHABLE_KEY'] as string | undefined) ||
    (url === originalUrl ? (import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] as string | undefined) ||
      (import.meta.env['VITE_SUPABASE_ANON_KEY'] as string | undefined) || defaultPublishableKey : undefined);
  return { url, key };
}
