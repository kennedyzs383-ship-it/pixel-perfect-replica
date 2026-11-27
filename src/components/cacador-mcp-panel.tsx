import { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, PlugZap, RefreshCw, ShieldCheck, Wrench, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { executeCacadorMcpTool, getCacadorMcpTools } from '@/lib/cacador-mcp.functions';

type McpTool = { name: string; description: string; inputSchema: unknown };
type McpServer = { id: string; name: string; connected: boolean; tools: McpTool[] };

export function CacadorMcpPanel() {
  const [servers, setServers] = useState<McpServer[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [argumentsByTool, setArgumentsByTool] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, string>>({});
  const refresh = async () => {
    setBusy(true); setMessage('');
    try { setServers(await getCacadorMcpTools() as McpServer[]); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível consultar os servidores MCP.'); }
    finally { setBusy(false); }
  };
  useEffect(() => { void refresh(); }, []);
  const runTool = async (server: McpServer, tool: McpTool) => {
    const key = server.id + ':' + tool.name;
    let args: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(argumentsByTool[key] || '{}');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Os argumentos têm de ser um objeto JSON.');
      args = parsed as Record<string, unknown>;
    } catch (error) { setResults(value => ({ ...value, [key]: error instanceof Error ? error.message : 'JSON inválido.' })); return; }
    if (!window.confirm('Autorizar a execução da ferramenta MCP ' + tool.name + ' no servidor ' + server.name + '? Esta ação pode alterar dados ou executar operações externas.')) return;
    setBusy(true);
    try {
      const result = await executeCacadorMcpTool({ data: { serverId: server.id, toolName: tool.name, arguments: args } });
      setResults(value => ({ ...value, [key]: result.content || (result.isError ? 'A ferramenta devolveu um erro.' : 'Executada sem texto de resposta.') }));
    } catch (error) { setResults(value => ({ ...value, [key]: error instanceof Error ? error.message : 'Falha ao executar ferramenta MCP.' })); }
    finally { setBusy(false); }
  };
  return <section className='space-y-4 rounded-lg border border-border p-4' aria-label='Ferramentas MCP'>
    <div className='flex items-center justify-between gap-3'><div><div className='flex items-center gap-2'><PlugZap className='size-5'/><h3 className='text-sm font-semibold'>Ferramentas externas · MCP</h3></div><p className='mt-1 text-xs text-muted-foreground'>Descobre ferramentas de servidores MCP configurados no servidor da Nuvem. Cada execução pede confirmação.</p></div><Button size='sm' variant='outline' onClick={() => void refresh()} disabled={busy}><RefreshCw className={busy ? 'animate-spin' : ''}/>Atualizar</Button></div>
    <div className='flex items-start gap-2 rounded-md bg-muted/50 p-3 text-xs'><ShieldCheck className='size-4 shrink-0'/><span>Por segurança, os endereços e tokens MCP só são aceites pela configuração do servidor, nunca enviados pelo navegador. Apenas ferramentas explicitamente autorizadas ficam disponíveis.</span></div>
    {message && <p className='text-xs text-destructive' role='alert'>{message}</p>}
    {servers.length === 0 && !message && <p className='text-xs text-muted-foreground'>Ainda não há servidores MCP configurados. Define CACADOR_MCP_SERVERS_JSON no ambiente do servidor para registar os teus servidores.</p>}
    {servers.map(server => <div key={server.id} className='space-y-3 rounded-md border border-border p-3'>
      <div className='flex items-center gap-2 text-sm font-medium'>{server.connected ? <CheckCircle2 className='size-4 text-emerald-600'/> : <XCircle className='size-4 text-destructive'/>}{server.name}<span className='ml-auto text-xs text-muted-foreground'>{server.connected ? server.tools.length + ' ferramenta(s)' : 'Desligado'}</span></div>
      {!server.connected && <p className='text-xs text-muted-foreground'>Não foi possível estabelecer sessão com este servidor MCP. Verifica URL, token e compatibilidade HTTP.</p>}
      {server.tools.map(tool => { const key = server.id + ':' + tool.name; return <div key={key} className='space-y-2 rounded-md bg-muted/30 p-3'>
        <div className='flex items-center gap-2'><Wrench className='size-3.5'/><strong className='text-xs'>{tool.name}</strong></div>
        {tool.description && <p className='text-xs text-muted-foreground'>{tool.description}</p>}
        <label className='block space-y-1 text-xs'>Argumentos JSON<textarea className='min-h-20 w-full rounded-md border border-input bg-background p-2 font-mono text-xs' value={argumentsByTool[key] ?? '{}'} onChange={event => setArgumentsByTool(value => ({ ...value, [key]: event.target.value }))}/></label>
        <Button size='sm' variant='outline' disabled={busy} onClick={() => void runTool(server, tool)}><Wrench/>Executar com confirmação</Button>
        {results[key] && <pre className='max-h-48 overflow-auto whitespace-pre-wrap rounded bg-background p-2 text-xs' role='status'>{results[key]}</pre>}
      </div>; })}
      {server.connected && server.tools.length === 0 && <p className='text-xs text-muted-foreground'>Ligado, mas sem ferramentas autorizadas na lista permitida.</p>}
    </div>)}
    <p className='flex items-start gap-2 text-xs text-muted-foreground'><AlertTriangle className='size-4 shrink-0'/>Não configures servidores MCP desconhecidos. Uma ferramenta pode modificar ou apagar dados nos serviços ligados.</p>
  </section>;
}