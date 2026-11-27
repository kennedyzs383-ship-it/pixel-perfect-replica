import { useEffect, useRef, useState, type FormEvent } from "react";
import { askCacadorAI } from "../lib/cacador-ai.functions";
import { Bot, Mic, MicOff, Send, Volume2, VolumeX, Sparkles, ExternalLink, WandSparkles } from "lucide-react";

type ChatLine = { role: "user" | "assistant"; text: string };
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
  const [messages, setMessages] = useState<ChatLine[]>([
    { role: "assistant", text: "Olá! Sou o Caçador. Posso ajudar-te a analisar oportunidades, preparar abordagens comerciais e planear websites. Escreve ou usa o microfone para falar comigo." }
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [speaking, setSpeaking] = useState(true);
  const [listening, setListening] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [aiError, setAiError] = useState("");
  const recognition = useRef<SpeechRecognitionLike | null>(null);\n  const sendVoicePrompt = useRef<((prompt: string) => void) | null>(null);
  const bottom = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, busy]);

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

  const send = async (event?: FormEvent<HTMLFormElement>, prompt?: string) => {
    event?.preventDefault();
    const message = (prompt ?? input).trim();
    if (!message || busy) return;
    const next = [...messages, { role: "user" as const, text: message }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setAiError("");
    try {
      const context = next.slice(-8).map((line) => (line.role === "user" ? "Utilizador: " : "Caçador: ") + line.text).join("\n");
      const result = await askCacadorAI({ data: { message, context } });
      setMessages((previous) => [...previous, { role: "assistant", text: result.answer }]);
      speak(result.answer);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "Não foi possível contactar o cérebro do Caçador.");
    } finally {
      setBusy(false);
    }
  };

  return <section className="hunter-ai">
    <div className="hunter-ai-head">
      <div className="hunter-ai-icon"><Bot size={20}/></div>
      <div className="hunter-ai-heading"><b>Cérebro do Caçador</b><span><i/> Assistente conversacional · Z Router</span></div>
      <div className="hunter-ai-controls">
        <button type="button" className={speaking ? "ai-icon-btn active" : "ai-icon-btn"} onClick={() => { setSpeaking((value) => !value); if (speaking && "speechSynthesis" in window) window.speechSynthesis.cancel(); }} aria-label={speaking ? "Desativar voz" : "Ativar voz"} title={speaking ? "Desativar voz" : "Ativar voz"}>{speaking ? <Volume2 size={16}/> : <VolumeX size={16}/>}</button>
        <a className="ai-icon-btn" href="https://www.zrouter.com/docs/" target="_blank" rel="noreferrer" title="Documentação Z Router"><ExternalLink size={15}/></a>
      </div>
    </div>
    <div className="hunter-ai-intro"><Sparkles size={15}/> Carrega no microfone e fala. O Caçador envia a tua fala automaticamente e responde em voz alta.</div>
    <div className="hunter-ai-messages" aria-live="polite">
      {messages.map((line, index) => <div className={"hunter-ai-message " + line.role} key={index}><span>{line.role === "assistant" ? "CAÇADOR" : "TU"}</span><p>{line.text}</p></div>)}
      {busy && <div className="hunter-ai-message assistant"><span>CAÇADOR</span><p className="ai-thinking">A analisar o teu pedido…</p></div>}
      <div ref={bottom}/>
    </div>
    {aiError && <p className="hunter-ai-error">{aiError}</p>}
    {voiceError && <p className="hunter-ai-error">{voiceError}</p>}
    <form className="hunter-ai-compose" onSubmit={(event) => void send(event)}>
      <button type="button" className={listening ? "ai-mic-btn listening" : "ai-mic-btn"} onClick={toggleListening} aria-label={listening ? "Parar microfone" : "Falar com Caçador"} title={listening ? "Parar microfone" : "Falar com Caçador"}>{listening ? <MicOff size={17}/> : <Mic size={17}/>}</button>
      <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Fala ou escreve aqui para conversar com o Caçador…" aria-label="Mensagem para o Caçador"/>
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
      .hunter-ai-head{display:flex;align-items:center;gap:10px}.hunter-ai-icon{width:38px;height:38px;border-radius:11px;background:#f0edfa;color:#6842dc;display:grid;place-items:center}.hunter-ai-heading{display:flex;flex-direction:column;gap:4px;flex:1}.hunter-ai-heading b{font-size:13px}.hunter-ai-heading span{font-size:9px;color:#8b8c98}.hunter-ai-heading i{display:inline-block;width:6px;height:6px;background:#20a779;border-radius:50%;margin-right:5px}.hunter-ai-controls{display:flex;gap:6px}.ai-icon-btn,.ai-mic-btn,.ai-send-btn{width:34px;height:34px;border:1px solid #e5e4ed;border-radius:8px;background:white;color:#6f7080;display:grid;place-items:center;cursor:pointer;text-decoration:none}.ai-icon-btn.active{color:#6842dc;background:#f7f4ff;border-color:#ded5fa}.hunter-ai-intro{display:flex;align-items:center;gap:7px;color:#777184;background:#f8f6ff;border-radius:7px;padding:10px;margin:14px 0;font-size:10px;line-height:1.5}.hunter-ai-messages{max-height:340px;overflow:auto;display:flex;flex-direction:column;gap:10px;padding:3px 2px 12px}.hunter-ai-message{max-width:88%;padding:10px 12px;border-radius:9px;background:#f5f5f8;align-self:flex-start}.hunter-ai-message.user{background:#f0edfa;align-self:flex-end}.hunter-ai-message>span{font-size:8px;letter-spacing:.8px;font-weight:800;color:#8874c2}.hunter-ai-message p{white-space:pre-wrap;font-size:11px;line-height:1.65;color:#454552;margin:5px 0 0}.hunter-ai-message .ai-thinking{color:#89899a;font-style:italic}.hunter-ai-compose{display:flex;align-items:center;gap:8px;border:1px solid #e4e3eb;border-radius:9px;padding:6px}.hunter-ai-compose input{flex:1;min-width:0;border:0;outline:0;padding:8px 2px;font:inherit;font-size:11px}.ai-mic-btn.listening{background:#fff0f0;color:#c44252;border-color:#f0c5ca}.ai-send-btn{background:#6842dc;border-color:#6842dc;color:white}.ai-send-btn:disabled{opacity:.45;cursor:not-allowed}.hunter-ai-quick{display:flex;flex-wrap:wrap;gap:7px;margin-top:10px}.hunter-ai-quick button{display:flex;align-items:center;gap:5px;background:#fff;border:1px solid #e7e5ee;border-radius:6px;padding:7px 9px;color:#66568e;font-size:9px;cursor:pointer}.hunter-ai-error{font-size:10px;line-height:1.5;color:#bd4652;background:#fff3f4;border-radius:7px;padding:9px}.hunter-ai-canva{display:flex;align-items:center;justify-content:space-between;gap:10px;border-top:1px solid #efedf3;margin-top:14px;padding-top:12px}.hunter-ai-canva>div{display:flex;flex-direction:column;gap:4px}.hunter-ai-canva b{font-size:10px;color:#34313d}.hunter-ai-canva span{font-size:9px;color:#92919d}.hunter-ai-canva a{display:flex;align-items:center;gap:5px;font-size:9px;color:#6842dc;text-decoration:none;white-space:nowrap}
      @media(max-width:600px){.hunter-ai{padding:13px}.hunter-ai-canva{align-items:flex-start;flex-direction:column}.hunter-ai-message{max-width:96%}}
    `}</style>
  </section>;
}
