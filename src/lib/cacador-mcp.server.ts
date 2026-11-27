import { z } from 'zod';

type McpServerConfig = { id: string; name: string; url: string; tokenEnv?: string; allowedTools: string[] };
type JsonRpcResponse = { result?: { tools?: Array<{ name: string; description?: string; inputSchema?: unknown }>; content?: Array<{ type?: string; text?: string }>; isError?: boolean }; error?: { message?: string } };

function configuredServers(): McpServerConfig[] {
  const raw = process.env.CACADOR_MCP_SERVERS_JSON;
  if (!raw) return [];
  try {
    const entries = JSON.parse(raw) as unknown;
    if (!Array.isArray(entries)) return [];
    return entries.flatMap((entry): McpServerConfig[] => {
      if (!entry || typeof entry !== 'object') return [];
      const item = entry as Record<string, unknown>;
      if (typeof item.id !== 'string' || !/^[a-z0-9_-]{1,40}$/i.test(item.id)) return [];
      if (typeof item.name !== 'string' || typeof item.url !== 'string' || !Array.isArray(item.allowedTools)) return [];
      let url: URL;
      try { url = new URL(item.url); } catch { return []; }
      if (url.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && url.hostname === 'localhost' && url.protocol === 'http:')) return [];
      const allowedTools = item.allowedTools.filter((name): name is string => typeof name === 'string' && /^[a-zA-Z0-9_.-]{1,100}$/.test(name));
      return [{ id: item.id, name: item.name.slice(0, 80), url: url.toString(), tokenEnv: typeof item.tokenEnv === 'string' ? item.tokenEnv : undefined, allowedTools }];
    });
  } catch { return []; }
}

async function rpc(config: McpServerConfig, method: string, params?: unknown, sessionId?: string, id?: number): Promise<{ payload: JsonRpcResponse; sessionId?: string }> {
  const token = config.tokenEnv ? process.env[config.tokenEnv] : undefined;
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (sessionId) headers['Mcp-Session-Id'] = sessionId;
  const response = await fetch(config.url, { method: 'POST', headers, redirect: 'error', body: JSON.stringify({ jsonrpc: '2.0', ...(id === undefined ? {} : { id }), method, ...(params === undefined ? {} : { params }) }), signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Servidor MCP ${config.name}: HTTP ${response.status}.`);
  const nextSession = response.headers.get('Mcp-Session-Id') ?? sessionId;
  const body = await response.text();
  let payload: JsonRpcResponse = {};
  if (body.trim()) {
    if (response.headers.get('content-type')?.includes('text/event-stream')) {
      const data = body.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).filter(Boolean).at(-1);
      if (data) payload = JSON.parse(data) as JsonRpcResponse;
    } else payload = JSON.parse(body) as JsonRpcResponse;
  }
  if (payload.error) throw new Error(payload.error.message || 'Erro de protocolo MCP.');
  return { payload, sessionId: nextSession };
}

async function withMcp<T>(config: McpServerConfig, work: (sessionId?: string) => Promise<T>): Promise<T> {
  const init = await rpc(config, 'initialize', { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'nuvem-cacador', version: '1.0.0' } }, undefined, 1);
  await rpc(config, 'notifications/initialized', undefined, init.sessionId);
  return work(init.sessionId);
}

export async function listCacadorMcpTools() {
  const servers = configuredServers();
  const results = await Promise.all(servers.map(async server => {
    try {
      const tools = await withMcp(server, async sessionId => {
        const result = await rpc(server, 'tools/list', {}, sessionId, 2);
        return (result.payload.result?.tools ?? []).filter(tool => server.allowedTools.includes(tool.name)).map(tool => ({ name: tool.name, description: tool.description ?? '', inputSchema: tool.inputSchema ?? {} }));
      });
      return { id: server.id, name: server.name, connected: true, tools };
    } catch { return { id: server.id, name: server.name, connected: false, tools: [] }; }
  }));
  return results;
}

const ToolCallSchema = z.object({ serverId: z.string().min(1).max(40), toolName: z.string().min(1).max(100), arguments: z.record(z.string(), z.unknown()).default({}) });
export async function callCacadorMcpTool(input: unknown) {
  const data = ToolCallSchema.parse(input);
  const server = configuredServers().find(item => item.id === data.serverId);
  if (!server || !server.allowedTools.includes(data.toolName)) throw new Error('Esta ferramenta não está autorizada na configuração do Caçador.');
  return withMcp(server, async sessionId => {
    const result = await rpc(server, 'tools/call', { name: data.toolName, arguments: data.arguments }, sessionId, 3);
    return { isError: Boolean(result.payload.result?.isError), content: (result.payload.result?.content ?? []).filter(part => part.type === 'text').map(part => part.text ?? '').join('\n').slice(0, 12000) };
  });
}