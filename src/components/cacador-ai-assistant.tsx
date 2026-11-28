import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { askCacadorLocalAI, loadCacadorLocalAI, type LocalAIProgress } from "@/lib/cacador-local-ai";
import { askCacadorAI } from "@/lib/cacador-ai.functions";
import { askCacadorWithMcpFn } from "@/lib/cacador-mcp-ai.functions";
import { executeCacadorMcpTool } from "@/lib/cacador-mcp.functions";
import { askOllama, type CacadorProvider } from "@/lib/cacador-ai-providers";
import { supabase } from "@/integrations/supabase/client";
import { Bot, Mic, MicOff, Send, Volume2, VolumeX, Sparkles, ExternalLink, WandSparkles, Wrench, ShieldCheck } from "lucide-react";

type ChatLine = { role: "user" | "assistant"; text: string; sender?: string };
type IncomingWhatsAppMessage = { message_id: string; from: string; text: string; contact_name?: string | null; phone_number_id?: string };
type McpProposal = { id: string; serverId: string; serverName: string; toolName: string; description: string; arguments: Record<string, unknown> };
const CHAT_STORAGE_KEY = "nuvem-cacador-chat-v1";
function readStoredMessages(): ChatLine[] {
  if (typeof window === "undefined") return [];
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(CHAT_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is ChatLine => Boolean(item) && typeof item === "object" &&
      ((item as ChatLine).role === "user" || (item as ChatLine).role === "assistant") &&
      typeof (item as ChatLine).text === "string").slice(-100);
  } catch { return []; }
}
type SpeechRecognitionResultLike = { 0?: { transcript?: string }; isFinal?: boolean };
type SpeechRecognitionEventLike = { results: ArrayLike<SpeechRecognitionResultLike> };
type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

export function CacadorAIAssistant() {
  const [localReady, setLocalReady] = useState(false);
  const [provider, setProvider] = useState<CacadorProvider>("local");
  const [loadingModel, setLoadingModel] = useState(false);
  const [modelProgress, setModelProgress] = useState<LocalAIProgress>({ percent: 0, text: "IA local ainda não carregada" });
  const [messages, setMessages] = useState<ChatLine[]>(() => {
    const stored = readStoredMessages();
    return stored.length ? stored : [
      { role: "assistant", text: "Olá! Sou o Caçador. Posso ajudar-te a analisar oportunidades, preparar abordagens comerciais e planear websites. Escreve ou usa o microfone para falar comigo." }
    ];
  });
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(true);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [aiError, setAiError] = useState("");
  const [mcpProposals, setMcpProposals] = useState<McpProposal[]>([]);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const sendVoicePrompt = useRef<((prompt: string) => void) | null>(null);
  const bottom = useRef<HTMLDivElement | null>(null);
  const seenWhatsAppMessageIds = useRef<Set<string>>(new Set());
  const messagesRef = useRef(messages);
  const speakRef = useRef<(text: string) => void>(() => undefined);
  messagesRef.current = messages;

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

  useEffect(() => {
    try { window.localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages.slice(-100))); } catch { /* Storage may be unavailable or full. */ }
  }, [messages]);


  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let processing = false;

    const processPending = async () => {
      if (!active || processing) return;
      processing = true;
      try {
        const { data: claimed, error: claimError } = await supabase.rpc(
          "claim_whatsapp_inbox_messages",
          { p_limit: 20 },
        );
        if (claimError) throw claimError;

        for (const row of claimed ?? []) {
          if (!active) break;
          const messageId = row.message_id;
          if (seenWhatsAppMessageIds.current.has(messageId)) {
            await supabase.rpc("complete_whatsapp_inbox_message", { p_id: row.id });
            continue;
          }
          seenWhatsAppMessageIds.current.add(messageId);

          const sender = row.contact_name?.trim() || "+" + row.from_phone;
          const customerLine: ChatLine = {
            role: "user",
            sender: "WhatsApp · " + sender,
            text: row.text_body?.slice(0, 4096) || "[Mensagem WhatsApp do tipo " + row.message_type + "; conteúdo multimédia ainda não interpretado.]",
          };
          if (!row.text_body?.trim()) {
            setMessages(previous => [...previous, customerLine].slice(-100));
            const { error: skipError } = await supabase.rpc("skip_whatsapp_inbox_message", {
              p_id: row.id,
              p_reason: "Mensagem " + row.message_type + " guardada; descodificação e interpretação de multimédia ainda não estão disponíveis.",
            });
            if (skipError) throw skipError;
            setAiError("Foi recebida uma mensagem WhatsApp do tipo " + row.message_type + ". Ficou guardada e marcada como não suportada; não foi apresentada como processada nem enviada ao Z Router.");
            continue;
          }

          setBusy(true);
          setAiError("");
          try {
            const context = messagesRef.current.slice(-8).concat(customerLine).map(line =>
              (line.sender || (line.role === "user" ? "Cliente" : "Caçador")) + ": " + line.text
            ).join("\n");
            const result = await askCacadorWithMcpFn({
              data: {
                message: "Recebeste esta mensagem real de um cliente pelo WhatsApp. Número: +" + row.from_phone +
                  ". Nome: " + sender + ". Mensagem: " + row.text_body +
                  ". Responde em português natural de Angola. Se for apropriado, prepara uma resposta WhatsApp usando a ferramenta send_text_message, mas nunca a envies sem aprovação humana.",
                context,
              },
            });
            if (!active) break;
            if (result.proposals.length) {
              setMcpProposals(previous => [...previous, ...(result.proposals as McpProposal[])]);
            }
            setMessages(previous => [...previous, customerLine, ...(result.answer?.trim() ? [{ role: "assistant" as const, text: result.answer }] : [])].slice(-100));
            if (result.answer?.trim()) {
              speakRef.current(result.answer);
            } else if (!result.proposals.length) {
              throw new Error("O Z Router não preparou uma resposta; a mensagem será tentada novamente.");
            }
            const { error: completeError } = await supabase.rpc(
              "complete_whatsapp_inbox_message",
              { p_id: row.id },
            );
            if (completeError) throw completeError;
          } catch (error) {
            seenWhatsAppMessageIds.current.delete(messageId);
            await supabase.rpc("fail_whatsapp_inbox_message", {
              p_id: row.id,
              p_error: error instanceof Error ? error.message : "Falha ao encaminhar a mensagem ao Z Router.",
            });
            if (active) setAiError(error instanceof Error ? error.message : "Não foi possível encaminhar a mensagem WhatsApp ao Z Router.");
          } finally {
            if (active) setBusy(false);
          }
        }
      } catch (error) {
        if (active) setAiError(error instanceof Error ? error.message : "Não foi possível recuperar a caixa de entrada WhatsApp.");
      } finally {
        processing = false;
      }
    };

    void supabase.auth.getUser().then(async ({ data, error }) => {
      if (!active || error || !data.user) return;
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session?.access_token) await supabase.realtime.setAuth(sessionData.session.access_token);
      if (!active) return;

      channel = supabase.channel("whatsapp-calls:" + data.user.id, { config: { private: true } })
        .on("broadcast", { event: "incoming_message" }, () => {
          // Realtime is only a wake-up signal. Durable delivery comes from the inbox claim RPC.
          void processPending();
        })
        .subscribe(async (state) => {
          if (state === "SUBSCRIBED" && active) await processPending();
        });
    }).catch(() => {
      if (active) setAiError("Não foi possível ligar o Caçador à caixa de entrada WhatsApp.");
    });

    const recoveryTimer = window.setInterval(() => { void processPending(); }, 15000);
    return () => {
      active = false;
      window.clearInterval(recoveryTimer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => () => {
    recognition.current?.stop();
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }, []);

  const speak = (text: string) => {
    if (!speaking || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-PT";
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  };

  speakRef.current = speak;

  const toggleListening = () => {
    if (listening) {
      recognition.current?.stop();
      setListening(false);
      return;
    }
    const speechWindow = window as SpeechWindow;
    const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceError("O reconhecimento de voz não está disponível neste navegador. Experimenta o Chrome atualizado.");
      return;
    }
    setVoiceError("");
    const instance = new Recognition();
    instance.lang = "pt-PT";
    instance.continuous = false;
    instance.interimResults = false;
    instance.onresult = (event) => {
      const transcript = Array.from(event.results).map((item) => item[0]?.transcript ?? "").join(" ").trim();
      if (transcript) sendVoicePrompt.current?.(transcript);
    };
    instance.onerror = () => {
      setVoiceError("Não foi possível captar a voz. Verifica a permissão do microfone.");
      setListening(false);
    };
    instance.onend = () => setListening(false);
    recognition.current = instance;
    try {
      instance.start();
      setListening(true);
    } catch {
      setVoiceError("Não foi possível iniciar o microfone.");
    }
  };

  const approveMcpProposal = async (proposal: McpProposal) => {
    if (!window.confirm("Autorizar " + proposal.toolName + " no servidor " + proposal.serverName + "? Revê os argumentos antes de continuar.")) return;
    setBusy(true);
    setAiError("");
    try {
      const result = await executeCacadorMcpTool({ data: { serverId: proposal.serverId, toolName: proposal.toolName, arguments: proposal.arguments } });
      const toolOutput = result.content || (result.isError ? "A ferramenta devolveu um erro." : JSON.stringify(result));
      setMcpProposals(current => current.filter(item => item.id !== proposal.id));
      const summary = await askCacadorAI({ data: {
        message: "A ferramenta " + proposal.toolName + " foi executada com aprovação do utilizador. Analisa o resultado abaixo e responde ao pedido original de forma clara. Se houve erro, explica-o sem afirmar sucesso.",
        context: messages.slice(-8).map(line => line.role.toUpperCase() + ": " + line.text).join("\n") + "\nResultado da ferramenta:\n" + String(toolOutput).slice(0, 12000)
      } });
      if (!summary.connection.connected || !summary.answer) throw new Error(summary.connection.message || "Não foi possível resumir o resultado.");
      setMessages(previous => [...previous, { role: "assistant", text: summary.answer }]);
      speak(summary.answer);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Não foi possível executar ou interpretar o resultado MCP.");
    } finally { setBusy(false); }
  };

  const send = async (event?: FormEvent<HTMLFormElement>, prompt?: string) => {
    event?.preventDefault();
    const message = (prompt ?? input).trim();
    if (!message || busy) return;
    if (provider === "local" && !localReady) {
      setAiError("Carrega primeiro em «Ativar IA local» para descarregar o modelo gratuito para este dispositivo.");
      setInput(message);
      return;
    }
    const next = [...messages, { role: "user" as const, text: message }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setAiError("");
    try {
      const history = next.slice(-10).map((line) => ({ role: line.role, content: line.text }));
      let answer: string;
      if (provider === "local") {
        answer = await askCacadorLocalAI(history);
      } else if (provider === "ollama") {
        answer = await askOllama(history);
      } else {
        const result = await askCacadorWithMcpFn({ data: { message, context: history.slice(0, -1).map(item => item.content).join("\n") } });
        answer = result.answer;
        if (result.proposals.length) {
          setMcpProposals(result.proposals as McpProposal[]);
          if (answer) {
            setMessages((previous) => [...previous, { role: "assistant", text: answer }]);
            speak(answer);
          }
          return;
        }
        if (!answer) throw new Error("O Z Router não devolveu uma resposta. Verifica a configuração e os servidores MCP.");
      }
      setMessages((previous) => [...previous, { role: "assistant", text: answer }]);
      speak(answer);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "A IA local não conseguiu responder.");
      setInput(message);
    } finally {
      setBusy(false);
    }
  };

  sendVoicePrompt.current = (prompt) => { void send(undefined, prompt); };

  return <section className="hunter-ai">
    <div className="hunter-ai-head">
      <div className="hunter-ai-icon"><Bot size={20}/></div>
      <div className="hunter-ai-heading"><b>Cérebro do Caçador</b><span>{provider === "local" ? (localReady ? "Qwen local pronto neste dispositivo" : loadingModel ? "A preparar IA local…" : "Qwen local desligado") : provider === "ollama" ? "Ollama selecionado" : "Z Router selecionado"}</span></div>
      <div className="hunter-ai-controls">\n        <select aria-label="Escolher inteligência artificial" value={provider} onChange={(event) => setProvider(event.target.value as CacadorProvider)} className="ai-provider-select"><option value="local">Qwen local</option><option value="ollama">Ollama</option><option value="zrouter">Z Router</option></select>
        <button type="button" className={speaking ? "ai-icon-btn active" : "ai-icon-btn"} onClick={() => { setSpeaking((value) => !value); if (speaking && "speechSynthesis" in window) window.speechSynthesis.cancel(); }} aria-label={speaking ? "Desativar voz" : "Ativar voz"} title={speaking ? "Desativar voz" : "Ativar voz"}>{speaking ? <Volume2 size={16}/> : <VolumeX size={16}/>}</button>
        <Button variant="outline" size="sm" onClick={() => { setLoadingModel(true); setAiError(""); void loadCacadorLocalAI(setModelProgress).then(() => { setLocalReady(true); setAiError(""); }).catch((error) => setAiError(error instanceof Error ? error.message : "Não foi possível carregar o modelo neste dispositivo.")).finally(() => setLoadingModel(false)); }} disabled={loadingModel || localReady || busy || provider !== "local"}><Sparkles size={14}/>{localReady ? "IA local ativa" : loadingModel ? "A carregar…" : "Ativar IA local"}</Button>
      </div>
    </div>
    <div className="hunter-ai-intro"><Sparkles size={15}/> {provider === "local" ? <>A IA funciona neste dispositivo, sem chave de API nem cobrança por mensagem. O primeiro carregamento descarrega cerca de 500 MB; mantém esta página aberta até terminar. {modelProgress.text} {loadingModel ? `(${modelProgress.percent}%)` : ""}</> : provider === "ollama" ? <>A usar Ollama no endereço configurado em Definições. O computador/servidor executa o modelo e não há cobrança por mensagem do Caçador.</> : <>A usar Z Router no servidor. Esta opção depende da secret e dos limites/créditos do fornecedor.</>}</div>
    <div className="hunter-ai-messages" aria-live="polite">
      {messages.map((line, index) => <div className={"hunter-ai-message " + line.role} key={index}><span>{line.sender || (line.role === "assistant" ? "CAÇADOR" : "TU")}</span><p>{line.text}</p></div>)}
      {busy && <div className="hunter-ai-message assistant"><span>CAÇADOR</span><p className="ai-thinking">A analisar o teu pedido…</p></div>}
      <div ref={bottom}/>
    </div>
    {mcpProposals.length > 0 && <div className="hunter-ai-mcp" role="region" aria-label="Ações MCP pendentes">
      <div className="hunter-ai-mcp-title"><ShieldCheck size={15}/> Ações preparadas — aprovação necessária</div>
      {mcpProposals.map(proposal => <div className="hunter-ai-mcp-item" key={proposal.id}>
        <b><Wrench size={13}/> {proposal.toolName} · {proposal.serverName}</b>
        {proposal.description && <p>{proposal.description}</p>}
        <pre>{JSON.stringify(proposal.arguments, null, 2)}</pre>
        <button type="button" disabled={busy} onClick={() => void approveMcpProposal(proposal)}>Confirmar e executar</button>
      </div>)}
    </div>}
    {aiError && <p className="hunter-ai-error" role="alert">{aiError}</p>}
    {voiceError && <p className="hunter-ai-error">{voiceError}</p>}
    <form className="hunter-ai-compose" onSubmit={(event) => void send(event)}>
      <button type="button" className={listening ? "ai-mic-btn listening" : "ai-mic-btn"} onClick={toggleListening} aria-label={listening ? "Parar microfone" : "Falar com Caçador"} title={listening ? "Parar microfone" : "Falar com Caçador — envio automático"}>{listening ? <MicOff size={17}/> : <Mic size={17}/>}</button>
      <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ex.: prepara um website para uma clínica em Luanda…" maxLength={4000} aria-label="Mensagem para o Caçador"/>
      <button className="ai-send-btn" type="submit" disabled={busy || !input.trim()} aria-label="Enviar mensagem"><Send size={16}/></button>
    </form>
    <div className="hunter-ai-quick">
      <button type="button" onClick={() => void send(undefined, "Ajuda-me a criar um plano de prospeção para vender websites a empresas em Luanda.")}><WandSparkles size={13}/> Plano de prospeção</button>
      <button type="button" onClick={() => void send(undefined, "Cria um briefing completo para um website profissional de uma empresa local.")}><Sparkles size={13}/> Criar briefing de website</button>
    </div>
    <div className="hunter-ai-canva">
      <div><b>Canva MCP</b><span>Preparado para ligar a tua conta Canva e criar designs.</span></div>
      <a href="https://www.canva.com/developers/" target="_blank" rel="noreferrer">Abrir Canva Developers <ExternalLink size={12}/></a>
    </div>
    <style>{`
      .hunter-ai{background:#fff;border:1px solid #e9eaf0;border-radius:12px;padding:18px;margin:18px 0}
      .hunter-ai-head{display:flex;align-items:center;gap:10px}.hunter-ai-icon{width:38px;height:38px;border-radius:11px;background:#f0edfa;color:#6842dc;display:grid;place-items:center}.hunter-ai-heading{display:flex;flex-direction:column;gap:4px;flex:1}.hunter-ai-heading b{font-size:13px}.hunter-ai-heading span{font-size:9px;color:#8b8c98}.hunter-ai-heading i{display:inline-block;width:6px;height:6px;background:#20a779;border-radius:50%;margin-right:5px}.hunter-ai-controls{display:flex;gap:6px;align-items:center}.ai-provider-select{max-width:125px;height:32px;border:1px solid #e5e4ed;border-radius:7px;background:#fff;padding:0 6px;font-size:10px;color:#5c536f}.ai-icon-btn,.ai-mic-btn,.ai-send-btn{width:34px;height:34px;border:1px solid #e5e4ed;border-radius:8px;background:white;color:#6f7080;display:grid;place-items:center;cursor:pointer;text-decoration:none}.ai-icon-btn.active{color:#6842dc;background:#f7f4ff;border-color:#ded5fa}.hunter-ai-intro{display:flex;align-items:center;gap:7px;color:#777184;background:#f8f6ff;border-radius:7px;padding:10px;margin:14px 0;font-size:10px;line-height:1.5}.hunter-ai-messages{max-height:340px;overflow:auto;display:flex;flex-direction:column;gap:10px;padding:3px 2px 12px}.hunter-ai-message{max-width:88%;padding:10px 12px;border-radius:9px;background:#f5f5f8;align-self:flex-start}.hunter-ai-message.user{background:#f0edfa;align-self:flex-end}.hunter-ai-message>span{font-size:8px;letter-spacing:.8px;font-weight:800;color:#8874c2}.hunter-ai-message p{white-space:pre-wrap;font-size:11px;line-height:1.65;color:#454552;margin:5px 0 0}.hunter-ai-message .ai-thinking{color:#89899a;font-style:italic}.hunter-ai-compose{display:flex;align-items:center;gap:8px;border:1px solid #e4e3eb;border-radius:9px;padding:6px}.hunter-ai-compose input{flex:1;min-width:0;border:0;outline:0;padding:8px 2px;font:inherit;font-size:11px}.ai-mic-btn.listening{background:#fff0f0;color:#c44252;border-color:#f0c5ca}.ai-send-btn{background:#6842dc;border-color:#6842dc;color:white}.ai-send-btn:disabled{opacity:.45;cursor:not-allowed}.hunter-ai-quick{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}.hunter-ai-quick button{display:flex;align-items:center;gap:5px;background:#fff;border:1px solid #e7e5ee;border-radius:6px;padding:7px 9px;color:#66568e;font-size:9px;cursor:pointer}.hunter-ai-mcp{border:1px solid #e3d9fb;border-radius:8px;padding:10px;margin:10px 0;background:#fbfaff}.hunter-ai-mcp-title{display:flex;align-items:center;gap:6px;font-size:10px;font-weight:800;color:#6842dc;margin-bottom:8px}.hunter-ai-mcp-item{border:1px solid #e9e5f2;border-radius:7px;padding:9px;margin-top:7px;background:white}.hunter-ai-mcp-item b{display:flex;align-items:center;gap:5px;font-size:10px}.hunter-ai-mcp-item p{font-size:9px;color:#777;margin:6px 0}.hunter-ai-mcp-item pre{max-height:120px;overflow:auto;white-space:pre-wrap;background:#f7f6fa;padding:7px;border-radius:5px;font-size:9px}.hunter-ai-mcp-item button{border:0;border-radius:6px;background:#6842dc;color:white;padding:7px 10px;font-size:9px;cursor:pointer}.hunter-ai-mcp-item button:disabled{opacity:.5}.hunter-ai-error{font-size:10px;line-height:1.5;color:#bd4652;background:#fff3f4;border-radius:7px;padding:9px}.hunter-ai-canva{display:flex;align-items:center;justify-content:space-between;gap:10px;border-top:1px solid #efedf3;margin-top:14px;padding-top:12px}.hunter-ai-canva>div{display:flex;flex-direction:column;gap:4px}.hunter-ai-canva b{font-size:10px;color:#34313d}.hunter-ai-canva span{font-size:9px;color:#92919d}.hunter-ai-canva a{display:flex;align-items:center;gap:5px;font-size:9px;color:#6842dc;text-decoration:none;white-space:nowrap}
      @media(max-width:600px){.hunter-ai{padding:13px}.hunter-ai-canva{align-items:flex-start;flex-direction:column}.hunter-ai-message{max-width:96%}}
    `}</style>
  </section>;
}
