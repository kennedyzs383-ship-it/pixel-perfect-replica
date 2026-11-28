import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./cacador-mcp.server', () => ({
  listCacadorMcpTools: vi.fn(async () => [{ id: 'docs', name: 'Documentos', connected: true, tools: [{ name: 'search_docs', description: 'Pesquisa documentos', inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } }] }, { id: 'whatsapp-meta', name: 'WhatsApp Cloud API · MCP integrado', connected: true, tools: [{ name: 'send_text_message', description: 'Envia mensagem WhatsApp individual com aprovação humana.', inputSchema: { type: 'object', properties: { to: { type: 'string' }, message: { type: 'string' } }, required: ['to', 'message'] } }] }]),
}));

import { listCacadorMcpTools } from './cacador-mcp.server';
import { askCacadorWithMcp } from './cacador-mcp-ai.server';

const fetchMock = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('ZROUTER_API_KEY', 'test-key');
  vi.stubEnv('ZROUTER_MODEL', 'test-model');
  vi.stubGlobal('fetch', fetchMock);
  vi.mocked(listCacadorMcpTools).mockResolvedValue([{ id: 'docs', name: 'Documentos', connected: true, tools: [{ name: 'search_docs', description: 'Pesquisa documentos', inputSchema: { type: 'object', properties: { query: { type: 'string' } } } }] }, { id: 'whatsapp-meta', name: 'WhatsApp Cloud API · MCP integrado', connected: true, tools: [{ name: 'send_text_message', description: 'Envia mensagem WhatsApp individual com aprovação humana.', inputSchema: { type: 'object', properties: { to: { type: 'string' }, message: { type: 'string' } }, required: ['to', 'message'] } }] }]);
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


  it('exposes the native WhatsApp MCP tool to Z Router with its server identity', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ choices: [{ message: { content: 'Posso preparar a mensagem.', tool_calls: [{ id: 'call-wa-1', type: 'function', function: { name: 'cacador_tool_1', arguments: '{"to":"+244923000000","message":"Olá!"}' } }] } }] }));
    const result = await askCacadorWithMcp('Envia uma mensagem WhatsApp ao cliente.');
    expect(result.proposals).toMatchObject([{ serverId: 'whatsapp-meta', serverName: 'WhatsApp Cloud API · MCP integrado', toolName: 'send_text_message', arguments: { to: '+244923000000', message: 'Olá!' } }]);
    const request = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(request.tools).toHaveLength(2);
    expect(request.tools[1].function.description).toContain('WhatsApp Cloud API');
  });

  it('requires the Z Router secret', async () => {
    vi.stubEnv('ZROUTER_API_KEY', '');
    await expect(askCacadorWithMcp('Olá')).rejects.toThrow('Z Router não está configurado');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
