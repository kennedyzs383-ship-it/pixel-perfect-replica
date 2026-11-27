import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./cacador-mcp.server', () => ({
  listCacadorMcpTools: vi.fn(async () => [{ id: 'docs', name: 'Documentos', connected: true, tools: [{ name: 'search_docs', description: 'Pesquisa documentos', inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } }] }]),
}));

import { listCacadorMcpTools } from './cacador-mcp.server';
import { askCacadorWithMcp } from './cacador-mcp-ai.server';

const fetchMock = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('ZROUTER_API_KEY', 'test-key');
  vi.stubEnv('ZROUTER_MODEL', 'test-model');
  vi.stubGlobal('fetch', fetchMock);
  vi.mocked(listCacadorMcpTools).mockResolvedValue([{ id: 'docs', name: 'Documentos', connected: true, tools: [{ name: 'search_docs', description: 'Pesquisa documentos', inputSchema: { type: 'object', properties: { query: { type: 'string' } } } }] }]);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('Caçador MCP AI proposals', () => {
  it('returns a proposed tool call but never executes it', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ choices: [{ message: { content: 'Posso pesquisar.', tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'cacador_tool_0', arguments: '{"query":"contrato"}' } }] } }] }));
    const result = await askCacadorWithMcp('Procura o contrato.');
    expect(result.proposals).toEqual([{ id: 'call-1', serverId: 'docs', serverName: 'Documentos', toolName: 'search_docs', description: 'Pesquisa documentos', arguments: { query: 'contrato' } }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).tools[0].function.name).toBe('cacador_tool_0');
  });

  it('ignores unknown tool identifiers and malformed arguments', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ choices: [{ message: { tool_calls: [
      { id: 'call-1', type: 'function', function: { name: 'unknown', arguments: '{}' } },
      { id: 'call-2', type: 'function', function: { name: 'cacador_tool_0', arguments: 'not-json' } },
    ] } }] }));
    const result = await askCacadorWithMcp('Faz algo.');
    expect(result.proposals).toEqual([]);
  });

  it('requires the Z Router secret', async () => {
    vi.stubEnv('ZROUTER_API_KEY', '');
    await expect(askCacadorWithMcp('Olá')).rejects.toThrow('Z Router não está configurado');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
