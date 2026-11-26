// Keep the existing CRM on its own account system, never the newly provisioned AI backend.
export function legacyCrmConfig() {
  const originalUrl = 'https://emcdkxxmfqgejfmfpxwe.supabase.co';
  const previousUrl = import.meta.env['VITE_SUPABASE_URL'] as string | undefined;
  const url = ((import.meta.env['VITE_CACADOR_SUPABASE_URL'] as string | undefined) || originalUrl).replace(/\/+$/, '');
  const key = (import.meta.env['VITE_CACADOR_SUPABASE_PUBLISHABLE_KEY'] as string | undefined) ||
    (previousUrl?.replace(/\/+$/, '') === url ? (import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] as string | undefined) || (import.meta.env['VITE_SUPABASE_ANON_KEY'] as string | undefined) : undefined);
  return { url, key };
}
