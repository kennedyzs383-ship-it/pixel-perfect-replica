import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callCacadorMcpTool, listCacadorMcpTools } from './cacador-mcp.server';

const fetchMock = vi.fn();
const serverConfig = JSON.stringify([{ id: 'docs', name: 'Documentos', url: 'https://mcp.example.test/mcp', allowedTools: ['search_docs'] }]);

beforeEach(() => { vi.resetAllMocks(); vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('CACADOR_MCP_SERVERS_JSON', serverConfig); vi.stubGlobal('fetch', fetchMock); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('Caçador MCP client', () => {
  it('discovers only explicitly allowed tools', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: { protocolVersion: '2025-03-26', capabilities: {}, serverInfo: { name: 'test', version: '1' } } }), { status: 200, headers: { 'content-type': 'application/json', 'Mcp-Session-Id': 'session-1' } }));
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 202 }));
    fetchMock.mockResolvedValueOnce(Response.json({ jsonrpc: '2.0', id: 2, result: { tools: [{ name: 'search_docs', description: 'Pesquisa documentos' }, { name: 'delete_all', description: 'Not allowed' }] } }));
    const result = await listCacadorMcpTools();
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: 'whatsapp-meta', connected: true, tools: [{ name: 'get_connection_status' }, { name: 'send_text_message' }] });
    expect(result[1]).toMatchObject({ id: 'docs', connected: true, tools: [{ name: 'search_docs' }] });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toMatchObject({ method: 'notifications/initialized' });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).not.toHaveProperty('id');
  });
  it('does not call a tool outside the server allowlist', async () => {
    await expect(callCacadorMcpTool({ serverId: 'docs', toolName: 'delete_all', arguments: {} })).rejects.toThrow('não está autorizada');
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('runs an allowed tool through an initialized MCP session', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ jsonrpc: '2.0', id: 1, result: {} }), { status: 200, headers: { 'content-type': 'application/json', 'Mcp-Session-Id': 'session-2' } }));
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 202 }));
    fetchMock.mockResolvedValueOnce(Response.json({ jsonrpc: '2.0', id: 3, result: { content: [{ type: 'text', text: 'Encontrado.' }] } }));
    const result = await callCacadorMcpTool({ serverId: 'docs', toolName: 'search_docs', arguments: { query: 'fatura' } });
    expect(result).toEqual({ isError: false, content: 'Encontrado.' });
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toMatchObject({ method: 'tools/call', params: { name: 'search_docs', arguments: { query: 'fatura' } } });
    expect(fetchMock.mock.calls[2][1].headers['Mcp-Session-Id']).toBe('session-2');
  });
  it('ignores HTTP MCP endpoints in production', async () => {
    vi.stubEnv('CACADOR_MCP_SERVERS_JSON', JSON.stringify([{ id: 'unsafe', name: 'Unsafe', url: 'http://127.0.0.1:1234', allowedTools: ['x'] }]));
    expect(await listCacadorMcpTools()).toMatchObject([{ id: 'whatsapp-meta', connected: true }]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});