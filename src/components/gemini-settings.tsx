import { useEffect, useState } from 'react';
import { Bot, CheckCircle2, CircleOff, KeyRound, LoaderCircle, PlugZap, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useCacadorConnection } from '@/hooks/use-cacador-connection';

export function GeminiSettings() {
  const [open, setOpen] = useState(false);
  return <section className="space-y-6 py-5 text-foreground" aria-label="Definições gerais">
    <div><h2 className="text-lg font-semibold">Definições gerais</h2><h3 className="mt-5 text-sm font-semibold">Chaves API</h3></div>
    <div className="flex flex-wrap items-center justify-between gap-4 border-y border-border py-5">
      <div className="flex items-center gap-3"><Bot className="size-6 text-primary"/><div><strong className="text-sm">Google Gemini</strong><p className="mt-1 text-xs text-muted-foreground">Caçador · Lovable AI</p></div></div>
      <Button variant="outline" onClick={() => setOpen(true)}><KeyRound/> Configurar Gemini</Button>
    </div>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg text-foreground">
      <DialogHeader><DialogTitle>Google Gemini</DialogTitle><DialogDescription>Ligação do Caçador através do Lovable AI.</DialogDescription></DialogHeader>
      {open && <GeminiConnectionPanel/>}
    </DialogContent></Dialog>
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
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-3 text-xs"><dt className="text-muted-foreground">Fornecedor</dt><dd>Google Gemini via Lovable AI</dd><dt className="text-muted-foreground">Credenciais</dt><dd className="flex items-center gap-1"><ShieldCheck className="size-4 shrink-0"/> Geridas no servidor</dd></dl>
    <p className="text-sm leading-relaxed text-muted-foreground">Não é necessária uma chave própria nesta opção. A utilização de IA consome os créditos disponíveis no Lovable; não são ativados pagamentos ou upgrades automaticamente.</p>
    {!checking && <p className="text-sm leading-relaxed" role={connection.connected ? undefined : 'alert'}>{connection.message}</p>}
    {connection.checkedAt && !checking && <p className="text-xs text-muted-foreground">Última verificação: {new Date(connection.checkedAt).toLocaleTimeString('pt-PT')}</p>}
    <div className="flex flex-wrap gap-2"><Button onClick={() => void check()} disabled={checking}><PlugZap/> Testar ligação</Button><Button variant="outline" asChild><a href="/cacador">Abrir Caçador</a></Button></div>
  </div>;
}
