import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { GatewayError } from '@lovable.dev/ai-gateway';
import { generateCacadorAnswer } from './cacador-ai.server';
import { verifyCacadorSession } from './cacador-auth.server';
import { connectedResult } from './cacador-connection';
const mocks = vi.hoisted(() => ({ generate: vi.fn(), getUser: vi.fn() }));
vi.mock('@lovable.dev/ai-gateway', async (importOriginal) => {
  const original = await importOriginal<typeof import('@lovable.dev/ai-gateway')>();
  return { ...original, generateChatCompletion: mocks.generate };
});
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: { getUser: mocks.getUser } }) }));
vi.mock('./cacador-legacy-config', () => ({ legacyCrmConfig: () => ({ url: 'https://legacy.example.test', key: 'public-test-key' }) }));
function gatewayFailure(status: number) {
  const error = Object.create(GatewayError.prototype) as GatewayError;
  Object.defineProperty(error, 'httpStatus', { value: status });
  return error;
}
beforeEach(() => { vi.resetAllMocks(); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
describe('Gemini real connection outcomes', () => {
  it('only marks a nonempty generated answer connected', async () => {
    mocks.generate.mockResolvedValue({ choices: [{ message: { content: 'Ligação confirmada.' } }] });
    const result = await generateCacadorAnswer('Confirma a ligação.', '', true);
    expect(result.connection.connected).toBe(true);
    expect(result.answer).toBe('Ligação confirmada.');
    expect(mocks.generate.mock.calls[0]?.[0].model).toBe('google/gemini-2.5-flash');
    expect(mocks.generate.mock.calls[0]?.[0].max_tokens).toBe(80);
  });
  it('never treats empty or whitespace output as connected', async () => {
    mocks.generate.mockResolvedValue({ choices: [{ message: { content: '  ' } }] });
    expect((await generateCacadorAnswer('Olá')).connection).toMatchObject({ connected: false, code: 'empty' });
    expect(connectedResult('').connected).toBe(false);
  });
  it('uses the same model and preserves the 1200 token conversation limit', async () => {
    mocks.generate.mockResolvedValue({ choices: [{ message: { content: 'Olá' } }] });
    await generateCacadorAnswer('Olá');
    expect(mocks.generate.mock.calls[0]?.[0]).toMatchObject({ model: 'google/gemini-2.5-flash', max_tokens: 1200 });
  });
  it('reports configuration failure without exposing provider data', async () => {
    mocks.generate.mockRejectedValue(gatewayFailure(401));
    expect((await generateCacadorAnswer('Olá')).connection).toMatchObject({ connected: false, code: 'configuration' });
  });
  it('reports denied model access without switching provider', async () => {
    mocks.generate.mockRejectedValue(gatewayFailure(403));
    expect((await generateCacadorAnswer('Olá')).connection.code).toBe('denied');
    expect(mocks.generate).toHaveBeenCalledTimes(1);
  });
  it('reports exhausted quota', async () => {
    mocks.generate.mockRejectedValue(gatewayFailure(429));
    expect((await generateCacadorAnswer('Olá')).connection.code).toBe('quota');
  });
  it('does not enable payments when credits run out', async () => {
    mocks.generate.mockRejectedValue(gatewayFailure(402));
    expect((await generateCacadorAnswer('Olá')).connection.code).toBe('credits');
    expect(mocks.generate).toHaveBeenCalledTimes(1);
  });
  it('reports timeout without application replay', async () => {
    mocks.generate.mockRejectedValue(new DOMException('Timeout', 'TimeoutError'));
    expect((await generateCacadorAnswer('Olá')).connection.code).toBe('timeout');
    expect(mocks.generate).toHaveBeenCalledTimes(1);
  });
  it('replaces a successful state with failure on the next call', async () => {
    mocks.generate.mockResolvedValueOnce({ choices: [{ message: { content: 'OK' } }] }).mockRejectedValueOnce(gatewayFailure(403));
    expect((await generateCacadorAnswer('Teste')).connection.connected).toBe(true);
    expect((await generateCacadorAnswer('Teste')).connection.connected).toBe(false);
  });
});
describe('Session verification', () => {
  it('rejects an unauthenticated caller', async () => {
    expect(await verifyCacadorSession(new Headers())).toBe(false);
    expect(mocks.getUser).not.toHaveBeenCalled();
  });
  it('rejects a revoked Cloud session', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://cloud.example.test'); vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'public-key');
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error('revoked') });
    expect(await verifyCacadorSession(new Headers({ authorization: 'Bearer test-session' }))).toBe(false);
  });
  it('accepts a server-verified Cloud session', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://cloud.example.test'); vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'public-key');
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'account' } }, error: null });
    expect(await verifyCacadorSession(new Headers({ authorization: 'Bearer test-session' }))).toBe(true);
  });
  it('keeps existing CRM sessions verified against their original issuer', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json({ id: 'legacy-account' })); vi.stubGlobal('fetch', fetcher);
    expect(await verifyCacadorSession(new Headers({ 'x-nuvem-session': 'legacy-session' }))).toBe(true);
    expect(fetcher.mock.calls[0]?.[0]).toBe('https://legacy.example.test/auth/v1/user');
  });
  it('rejects invalid legacy sessions', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    expect(await verifyCacadorSession(new Headers({ 'x-nuvem-session': 'invalid' }))).toBe(false);
  });
});
