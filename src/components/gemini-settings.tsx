import { useEffect, useState } from 'react';
import { Bot, CheckCircle2, CircleOff, KeyRound, LoaderCircle, PlugZap, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCacadorConnection } from '@/hooks/use-cacador-connection';
import { UniversalAIHub } from '@/components/universal-ai-hub';

export function GeminiSettings() {
  const [open, setOpen] = useState(false);
  return <section className="space-y-6 py-5 text-foreground" aria-label="Definições gerais">
    <div><h2 className="text-lg font-semibold">Definições gerais</h2><h3 className="mt-5 text-sm font-semibold">Chaves API</h3></div>
    <div className="flex flex-wrap items-center justify-between gap-4 border-y border-border py-5">
      <div className="flex items-center gap-3"><Bot className="size-6 text-primary"/><div><strong className="text-sm">Z Router</strong><p className="mt-1 text-xs text-muted-foreground">Caçador · ERNIE 5.5 Flash Preview (gratuito)</p></div></div>
      <Button variant="outline" onClick={() => setOpen(true)}><KeyRound/> Configurar Z Router</Button>
    </div>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg text-foreground">
      <DialogHeader><DialogTitle>Z Router</DialogTitle><DialogDescription>Ligação do cérebro do Caçador ao modelo ERNIE 5.5 Flash Preview (gratuito) através do Z Router.</DialogDescription></DialogHeader>
      {open && <GeminiConnectionPanel/>}
    </DialogContent></Dialog>
    <UniversalAIHub />
  </section>;
}

function GeminiConnectionPanel() {
  const { connection, checking, check } = useCacadorConnection();
  useEffect(() => { void check(); }, [check]);
  return <div className="space-y-5">
    <div className="flex items-center gap-2 border-y border-border py-4" role="status" aria-live="polite">
      {checking ? <LoaderCircle className="size-5 animate-spin motion-reduce:animate-none"/> : connection.connected ? <CheckCircle2 className="size-5"/> : <CircleOff className="size-5 text-muted-foreground"/>}
      <strong className="text-sm">{checking ? 'A verificar…' : connection.connected ? 'Ligado' : 'Não ligado'}</strong>
    </div>
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 text-xs"><dt className="text-muted-foreground">Fornecedor</dt><dd>Z Router · ERNIE 5.5 Flash Preview (gratuito)</dd><dt className="text-muted-foreground">Credenciais</dt><dd className="flex items-center gap-1"><ShieldCheck className="size-4 shrink-0"/> Secret ZROUTER_API_KEY no servidor Lovable</dd></dl>
    <p className="text-sm leading-relaxed text-muted-foreground">A chave fica guardada em Lovable → Secrets e nunca é exposta no navegador. O Z Router precisa de saldo/crédito disponível para responder. A Nuvem não ativa pagamentos, não faz recargas e não muda automaticamente para outro fornecedor.</p>
    {!checking && <p className="text-sm leading-relaxed" role={connection.connected ? undefined : 'alert'}>{connection.message}</p>}
    {connection.checkedAt && !checking && <p className="text-xs text-muted-foreground">Última verificação: {new Date(connection.checkedAt).toLocaleTimeString('pt-PT')}</p>}
    <div className="flex flex-wrap gap-2"><Button onClick={() => void check()} disabled={checking}><PlugZap/> Testar ligação</Button><Button variant="outline" asChild><a href="/cacador">Abrir Caçador</a></Button></div>
  </div>;
}
