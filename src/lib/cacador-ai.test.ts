import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateCacadorAnswer } from './cacador-ai.server';
import { verifyCacadorSession } from './cacador-auth.server';
import { connectedResult } from './cacador-connection';

const mocks = vi.hoisted(() => ({ fetch: vi.fn(), getUser: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ auth: { getUser: mocks.getUser } }) }));
vi.mock('./cacador-legacy-config', () => ({ legacyCrmConfig: () => ({ url: 'https://legacy.example.test', key: 'public-test-key' }) }));

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('ZROUTER_API_KEY', 'test-secret');
  vi.stubGlobal('fetch', mocks.fetch);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('Z Router connection outcomes', () => {
  it('only marks a nonempty model answer connected', async () => {
    mocks.fetch.mockResolvedValue(Response.json({ choices: [{ message: { content: 'Ligação confirmada.' } }] }));
    const result = await generateCacadorAnswer('Confirma a ligação.', '', true);
    expect(result.connection.connected).toBe(true);
    expect(result.answer).toBe('Ligação confirmada.');
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(mocks.fetch.mock.calls[0]?.[0]).toBe('https://www.zrouter.com/v1/chat/completions');
    const request = JSON.parse(mocks.fetch.mock.calls[0]?.[1]?.body as string);
    expect(request.model).toBe('openrouter/google/gemini-2.5-flash');
    expect(request.max_tokens).toBe(80);
    expect(mocks.fetch.mock.calls[0]?.[1]?.headers.Authorization).toBe('Bearer test-secret');
  });
  it('reports missing server secret without making a request', async () => {
    vi.stubEnv('ZROUTER_API_KEY', '');
    const result = await generateCacadorAnswer('Olá');
    expect(result.connection).toMatchObject({ connected: false, code: 'configuration' });
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('uses the same model and 1200-token limit for normal conversation', async () => {
    mocks.fetch.mockResolvedValue(Response.json({ choices: [{ message: { content: 'Olá' } }] }));
    await generateCacadorAnswer('Olá', 'Utilizador: Bom dia');
    const request = JSON.parse(mocks.fetch.mock.calls[0]?.[1]?.body as string);
    expect(request).toMatchObject({ model: 'openrouter/google/gemini-2.5-flash', max_tokens: 1200 });
    expect(request.messages[1].content).toContain('Utilizador: Bom dia');
  });
  it('never treats empty or whitespace output as connected', async () => {
    mocks.fetch.mockResolvedValue(Response.json({ choices: [{ message: { content: '  ' } }] }));
    expect((await generateCacadorAnswer('Olá')).connection).toMatchObject({ connected: false, code: 'empty' });
    expect(connectedResult('').connected).toBe(false);
  });
  it.each([
    [401, 'configuration'],
    [404, 'configuration'],
    [403, 'denied'],
    [402, 'credits'],
    [429, 'quota'],
    [503, 'unavailable'],
  ] as const)('maps Z Router HTTP %i to a safe connection state', async (status, code) => {
    mocks.fetch.mockResolvedValue(new Response('private provider detail', { status }));
    const result = await generateCacadorAnswer('Olá');
    expect(result.connection).toMatchObject({ connected: false, code });
    expect(result.connection.message).not.toContain('private provider detail');
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
  it('reports timeout without replaying the request', async () => {
    mocks.fetch.mockRejectedValue(new DOMException('Timeout', 'TimeoutError'));
    expect((await generateCacadorAnswer('Olá')).connection.code).toBe('timeout');
    expect(mocks.fetch).toHaveBeenCalledTimes(1);
  });
  it('replaces a successful state with failure on the next call', async () => {
    mocks.fetch.mockResolvedValueOnce(Response.json({ choices: [{ message: { content: 'OK' } }] })).mockResolvedValueOnce(new Response(null, { status: 402 }));
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
    vi.stubEnv('SUPABASE_URL', 'https://cloud.example.test');
    vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'public-key');
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: new Error('revoked') });
    expect(await verifyCacadorSession(new Headers({ authorization: 'Bearer test-session' }))).toBe(false);
  });
  it('accepts a server-verified Cloud session', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://cloud.example.test');
    vi.stubEnv('SUPABASE_PUBLISHABLE_KEY', 'public-key');
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'account' } }, error: null });
    expect(await verifyCacadorSession(new Headers({ authorization: 'Bearer test-session' }))).toBe(true);
  });
  it('keeps existing CRM sessions verified against their original issuer', async () => {
    mocks.fetch.mockResolvedValue(Response.json({ id: 'legacy-account' }));
    expect(await verifyCacadorSession(new Headers({ 'x-nuvem-session': 'legacy-session' }))).toBe(true);
    expect(mocks.fetch.mock.calls[0]?.[0]).toBe('https://legacy.example.test/auth/v1/user');
  });
  it('rejects invalid legacy sessions', async () => {
    mocks.fetch.mockResolvedValue(new Response(null, { status: 401 }));
    expect(await verifyCacadorSession(new Headers({ 'x-nuvem-session': 'invalid' }))).toBe(false);
  });
});
