import { useEffect, useState } from "react";
import { CheckCircle2, CircleOff, Cpu, PlugZap, RefreshCw, Server, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getOllamaSettings, saveOllamaSettings, testOllamaConnection, type OllamaSettings } from "@/lib/cacador-ai-providers";
import { CacadorMcpPanel } from "@/components/cacador-mcp-panel";

export function UniversalAIHub() {
  const [settings, setSettings] = useState<OllamaSettings>(() => getOllamaSettings());
  const [models, setModels] = useState<string[]>([]);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState("");
  const [connected, setConnected] = useState(false);

  useEffect(() => { setSettings(getOllamaSettings()); }, []);

  const test = async () => {
    setChecking(true); setStatus(""); setConnected(false);
    try {
      const found = await testOllamaConnection(settings);
      setModels(found); setConnected(true);
      setStatus(found.length ? "Ollama ligado. Modelos encontrados: " + found.join(", ") : "Ollama ligado, mas ainda não há modelos instalados.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Não foi possível contactar o Ollama.");
    } finally { setChecking(false); }
  };

  const save = () => {
    try { saveOllamaSettings(settings); setStatus("Configuração guardada neste navegador."); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Configuração inválida."); }
  };

  return <section className="space-y-5 border-t border-border pt-6" aria-label="Centro universal de inteligência">
    <div><div className="flex items-center gap-2"><Sparkles className="size-5 text-primary"/><h2 className="text-lg font-semibold">Caçador · Centro Universal de IA</h2></div><p className="mt-1 text-sm text-muted-foreground">Escolhe o cérebro, liga modelos locais e prepara fornecedores adicionais sem substituir a IA atual.</p></div>
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-lg border border-border p-4 space-y-2"><div className="flex items-center gap-2"><Cpu className="size-5"/><strong className="text-sm">Qwen local no navegador</strong></div><p className="text-xs text-muted-foreground">Wllama + Qwen 0.5B. Sem chave e sem custo por mensagem depois do download inicial.</p><span className="text-xs text-emerald-700">Já integrado no Caçador</span></div>
      <div className="rounded-lg border border-border p-4 space-y-2"><div className="flex items-center gap-2"><Server className="size-5"/><strong className="text-sm">Ollama · modelos locais</strong></div><p className="text-xs text-muted-foreground">Liga modelos instalados no teu computador ou servidor. Não exige API paga; o equipamento executa o modelo.</p><span className="text-xs text-primary">Configuração disponível abaixo</span></div>
      <div className="rounded-lg border border-border p-4 space-y-2"><div className="flex items-center gap-2"><PlugZap className="size-5"/><strong className="text-sm">Z Router · modelos cloud</strong></div><p className="text-xs text-muted-foreground">Mantém a ligação atual no servidor, usando a secret já configurada. Pode ter limites, créditos ou custos do fornecedor.</p><span className="text-xs text-emerald-700">Integração existente preservada</span></div>
      <div className="rounded-lg border border-border p-4 space-y-2"><div className="flex items-center gap-2"><ShieldCheck className="size-5"/><strong className="text-sm">MCP · ferramentas externas</strong></div><p className="text-xs text-muted-foreground">Camada de ferramentas planeada separadamente dos modelos. Cada servidor MCP exigirá ligação e permissões próprias.</p><span className="text-xs text-muted-foreground">Cliente MCP HTTP implementado</span></div>
    </div>
    <div className="space-y-3 rounded-lg border border-border p-4">
      <div><h3 className="text-sm font-semibold">Ligar Ollama</h3><p className="text-xs text-muted-foreground">Instala o Ollama no computador/servidor e permite acesso de rede/CORS a partir deste endereço do Caçador.</p></div>
      <label className="block space-y-1 text-xs font-medium">Endereço do Ollama<input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={settings.baseUrl} onChange={event => setSettings(value => ({ ...value, baseUrl: event.target.value }))} placeholder="http://localhost:11434"/></label>
      <label className="block space-y-1 text-xs font-medium">Nome do modelo<input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={settings.model} onChange={event => setSettings(value => ({ ...value, model: event.target.value }))} placeholder="qwen2.5:0.5b"/></label>
      <div className="flex flex-wrap gap-2"><Button onClick={save} variant="outline">Guardar configuração</Button><Button onClick={() => void test()} disabled={checking}><RefreshCw className={checking ? "animate-spin" : ""}/>{checking ? "A testar…" : "Testar ligação"}</Button></div>
      {status && <p className="flex items-start gap-2 text-xs" role="status">{connected ? <CheckCircle2 className="size-4 shrink-0 text-emerald-600"/> : <CircleOff className="size-4 shrink-0"/>}{status}</p>}
      {models.length > 0 && <p className="text-xs text-muted-foreground">Modelos detetados: {models.join(" · ")}</p>}
      <p className="text-xs text-muted-foreground">A configuração fica guardada apenas neste navegador. Não introduzas aqui chaves API. Para acesso a partir de outro dispositivo, usa o endereço de rede do servidor e configura o CORS/firewall do Ollama com cuidado.</p>
    </div>
    <CacadorMcpPanel />
    <p className="text-xs text-muted-foreground">Nota: GPT, Claude e Gemini não ficam automaticamente gratuitos por serem adicionados ao centro. Cada serviço cloud pode exigir conta, chave, autorização ou pagamento. O MCP também não fornece modelos nem elimina esses requisitos.</p>
  </section>;
}
