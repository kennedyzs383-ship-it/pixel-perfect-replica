import { useCallback, useEffect, useRef, useState } from "react";
import { Phone, PhoneCall, PhoneOff, Mic, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { askCacadorWithMcpFn } from "@/lib/cacador-mcp-ai.functions";
import { transcribeCacadorVoice, synthesizeCacadorVoice } from "@/lib/cacador-voice.functions";

type CallEvent = {
  id?: string;
  from?: string;
  to?: string;
  event?: string;
  direction?: string;
  session?: { sdp_type?: string; sdp?: string };
};

function waitForIceGathering(peer: RTCPeerConnection): Promise<void> {
  if (peer.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      peer.removeEventListener("icegatheringstatechange", check);
      reject(new Error("A recolha de ICE demorou demasiado. Verifica a ligação à internet."));
    }, 12000);
    const check = () => {
      if (peer.iceGatheringState === "complete") {
        window.clearTimeout(timeout);
        peer.removeEventListener("icegatheringstatechange", check);
        resolve();
      }
    };
    peer.addEventListener("icegatheringstatechange", check);
  });
}

export function CacadorWhatsAppCalling() {
  const [userId, setUserId] = useState("");
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState("A verificar sessão…");
  const [busy, setBusy] = useState(false);
  const [activeCallId, setActiveCallId] = useState("");
  const [incoming, setIncoming] = useState<CallEvent | null>(null);
  const [muted, setMuted] = useState(false);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const speechDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const voiceBusyRef = useRef(false);

  const cleanup = useCallback(() => {
    recorderRef.current?.stop();
    recorderRef.current = null;
    peerRef.current?.close();
    peerRef.current = null;
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    speechDestinationRef.current = null;
    voiceBusyRef.current = false;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (audioRef.current) audioRef.current.srcObject = null;
    setActiveCallId("");
    setIncoming(null);
    setMuted(false);
  }, []);

  const callControl = useCallback(async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("whatsapp-call-control", { body });
    if (error) throw new Error(error.message || "Não foi possível executar a ação de chamada.");
    if (!data?.ok) throw new Error(data?.error || "A API WhatsApp não confirmou a ação.");
    return data.result as Record<string, unknown>;
  }, []);

  const speakToCustomer = useCallback(async (text: string) => {
    const result = await synthesizeCacadorVoice({ data: { text } });
    const binary = atob(result.audioBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const context = audioContextRef.current;
    const destination = speechDestinationRef.current;
    if (!context || !destination) throw new Error("O canal de áudio da chamada ainda não está pronto.");
    await context.resume();
    const buffer = await context.decodeAudioData(bytes.buffer);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(destination);
    source.start();
  }, []);

  const processCustomerAudio = useCallback(async (blob: Blob) => {
    if (voiceBusyRef.current || blob.size < 1200 || !peerRef.current) return;
    voiceBusyRef.current = true;
    try {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let binary = "";
      for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      const transcription = await transcribeCacadorVoice({ data: { audioBase64: btoa(binary), mimeType: blob.type || "audio/webm" } });
      if (!transcription.text.trim()) return;
      setStatus("Cliente: " + transcription.text.slice(0, 150) + " — a preparar resposta…");
      const answer = await askCacadorWithMcpFn({ data: { message: transcription.text, context: "Estás numa chamada WhatsApp em direto. Responde em português de Angola, de forma breve, natural e própria para ser dita em voz alta. Não afirmes que executaste ações externas sem autorização. Se o cliente pedir uma pessoa, informa que a chamada será encaminhada." } });
      if (!answer.answer?.trim()) throw new Error("O Z Router não devolveu uma resposta para a chamada.");
      await speakToCustomer(answer.answer);
      setStatus("Caçador respondeu por voz. À escuta do cliente…");
    } catch (error) {
      setStatus(error instanceof Error ? "Voz inteligente: " + error.message : "Não foi possível processar a voz do cliente.");
    } finally { voiceBusyRef.current = false; }
  }, [speakToCustomer]);

  const createPeer = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    streamRef.current = stream;
    const peer = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
    peerRef.current = peer;
    stream.getAudioTracks().forEach((track) => peer.addTrack(track, stream));
    const audioContext = new AudioContext();
    audioContextRef.current = audioContext;
    const speechDestination = audioContext.createMediaStreamDestination();
    speechDestinationRef.current = speechDestination;
    speechDestination.stream.getAudioTracks().forEach((track) => peer.addTrack(track, speechDestination.stream));
    peer.ontrack = (event) => {
      const remoteStream = event.streams[0];
      if (audioRef.current) {
        audioRef.current.srcObject = remoteStream;
        void audioRef.current.play().catch(() => setStatus("Permite a reprodução de áudio no navegador."));
      }
      if (typeof MediaRecorder !== "undefined" && !recorderRef.current) {
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "";
        const recorder = new MediaRecorder(remoteStream, mimeType ? { mimeType } : undefined);
        recorderRef.current = recorder;
        recorder.ondataavailable = (recordingEvent) => { void processCustomerAudio(recordingEvent.data); };
        recorder.start(4000);
        setStatus("Chamada ligada. O Caçador está a ouvir o cliente.");
      }
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "connected") setStatus("Chamada ligada — áudio em tempo real.");
      else if (peer.connectionState === "connecting") setStatus("A estabelecer áudio…");
      else if (peer.connectionState === "failed") setStatus("A ligação de áudio falhou. A rede pode precisar de um servidor TURN.");
      else if (peer.connectionState === "disconnected") setStatus("Ligação interrompida. A tentar recuperar…");
    };
    return peer;
  }, [processCustomerAudio]);

  const receiveSignal = useCallback(async (payload: Record<string, unknown>) => {
    const calls = Array.isArray(payload.calls) ? payload.calls as CallEvent[] : [];
    for (const call of calls) {
      const event = String(call.event ?? "").toLowerCase();
      if (event === "terminate" || event === "terminated") {
        cleanup();
        setStatus("Chamada terminada.");
        continue;
      }
      if (call.session?.sdp && call.session.sdp_type === "answer" && peerRef.current) {
        await peerRef.current.setRemoteDescription({ type: "answer", sdp: call.session.sdp });
        if (call.id) setActiveCallId(call.id);
        setStatus("Resposta recebida. A ligar o áudio…");
      } else if (call.session?.sdp && call.session.sdp_type === "offer" && call.id) {
        setIncoming(call);
        setStatus("Chamada WhatsApp recebida. Podes atender ou rejeitar.");
      }
    }
    const statuses = Array.isArray(payload.statuses) ? payload.statuses as Array<Record<string, unknown>> : [];
    if (statuses.some((item) => ["TERMINATE", "TERMINATED", "COMPLETED", "REJECTED", "FAILED"].includes(String(item.status ?? item.event ?? "").toUpperCase()))) {
      cleanup();
      setStatus("A chamada terminou ou foi recusada.");
    }
  }, [cleanup]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let active = true;
    void supabase.auth.getUser().then(async ({ data, error }) => {
      if (!active) return;
      if (error || !data.user) {
        setStatus("Inicia sessão no Caçador para usar chamadas.");
        return;
      }
      setUserId(data.user.id);
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session?.access_token) await supabase.realtime.setAuth(sessionData.session.access_token);
      channel = supabase.channel(`whatsapp-calls:${data.user.id}`, { config: { private: true } })
        .on("broadcast", { event: "call_signal" }, ({ payload }) => {
          void receiveSignal(payload as Record<string, unknown>).catch((error: unknown) => {
            setStatus(error instanceof Error ? error.message : "Erro ao processar sinalização da chamada.");
          });
        })
        .subscribe((state) => {
          if (state === "SUBSCRIBED") setStatus("Canal de chamadas ligado. À espera de uma chamada.");
          else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") setStatus("Não foi possível ligar o canal de chamadas em tempo real.");
        });
    }).catch(() => setStatus("Não foi possível verificar a sessão do Caçador."));
    return () => {
      active = false;
      if (channel) void supabase.removeChannel(channel);
      cleanup();
    };
  }, [cleanup, receiveSignal]);

  const requestPermission = async () => {
    setBusy(true);
    try {
      await callControl({ action: "request_permission", to: phone, message: "Olá! Somos o assistente de vendas da Nuvem. Gostaríamos de falar contigo por chamada WhatsApp sobre uma proposta de website. Autorizas que te liguemos?" });
      setStatus("Pedido de autorização enviado. Aguarda o cliente aceitar no WhatsApp antes de ligar.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Não foi possível pedir autorização."); }
    finally { setBusy(false); }
  };

  const startCall = async () => {
    setBusy(true);
    try {
      if (!userId) throw new Error("Inicia sessão no Caçador.");
      if (!/^\+?[1-9]\d{7,14}$/.test(phone.trim())) throw new Error("Indica o número do cliente com indicativo internacional.");
      const peer = await createPeer();
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await waitForIceGathering(peer);
      const result = await callControl({ action: "connect", to: phone.trim(), sdp: peer.localDescription?.sdp });
      const calls = Array.isArray(result.calls) ? result.calls as Array<{ id?: string }> : [];
      if (calls[0]?.id) setActiveCallId(calls[0].id);
      setStatus("Pedido de chamada enviado à Meta. À espera da resposta do cliente…");
    } catch (error) {
      cleanup();
      setStatus(error instanceof Error ? error.message : "Não foi possível iniciar a chamada.");
    } finally { setBusy(false); }
  };

  const answerCall = async () => {
    if (!incoming?.id || !incoming.session?.sdp) return;
    setBusy(true);
    try {
      const peer = await createPeer();
      await peer.setRemoteDescription({ type: "offer", sdp: incoming.session.sdp });
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      await waitForIceGathering(peer);
      const sdp = peer.localDescription?.sdp;
      if (!sdp) throw new Error("Não foi possível gerar a resposta WebRTC.");
      await callControl({ action: "pre_accept", call_id: incoming.id, sdp });
      await callControl({ action: "accept", call_id: incoming.id, sdp });
      setActiveCallId(incoming.id);
      setIncoming(null);
      setStatus("Chamada aceite. A estabelecer áudio…");
    } catch (error) {
      cleanup();
      setStatus(error instanceof Error ? error.message : "Não foi possível atender a chamada.");
    } finally { setBusy(false); }
  };

  const rejectCall = async () => {
    if (!incoming?.id) return;
    setBusy(true);
    try {
      await callControl({ action: "reject", call_id: incoming.id });
      setIncoming(null);
      setStatus("Chamada rejeitada.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Não foi possível rejeitar a chamada."); }
    finally { setBusy(false); }
  };

  const hangUp = async () => {
    const callId = activeCallId;
    setBusy(true);
    try {
      if (callId) await callControl({ action: "terminate", call_id: callId });
    } catch (error) { setStatus(error instanceof Error ? error.message : "Não foi possível terminar a chamada na Meta."); }
    finally { cleanup(); setStatus("Chamada terminada."); setBusy(false); }
  };

  const toggleMute = () => {
    const next = !muted;
    streamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !next; });
    setMuted(next);
  };

  return (
    <section style={{ background: "#fff", border: "1px solid #e7e8ef", borderRadius: 14, padding: 19, marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
        <PhoneCall size={19} color="#16845d" />
        <h2 style={{ fontSize: 17, margin: 0 }}>Chamadas WhatsApp em tempo real</h2>
      </div>
      <p style={{ color: "#737583", fontSize: 12, lineHeight: 1.6 }}>{status}</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <input aria-label="Número do cliente" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+244923000000" style={{ flex: "1 1 220px", minWidth: 0, border: "1px solid #d9dae3", borderRadius: 8, padding: "11px 12px", fontSize: 13 }} />
        <button type="button" disabled={busy || !userId || !phone.trim()} onClick={() => void requestPermission()} style={{ border: 0, borderRadius: 8, padding: "10px 13px", background: "#f0edff", color: "#5e45b4", fontWeight: 700, fontSize: 12, cursor: "pointer", opacity: busy || !userId || !phone.trim() ? .5 : 1 }}>Pedir autorização</button>
        <button type="button" disabled={busy || !userId || !phone.trim() || Boolean(activeCallId) || Boolean(incoming)} onClick={() => void startCall()} style={{ border: 0, borderRadius: 8, padding: "10px 13px", background: "#16845d", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", opacity: busy || !userId || !phone.trim() || Boolean(activeCallId) || Boolean(incoming) ? .5 : 1 }}><Phone size={14} style={{ verticalAlign: "middle", marginRight: 5 }} />Ligar</button>
      </div>
      {incoming && <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", background: "#f0faf4", borderRadius: 9, padding: 12, marginTop: 12 }}>
        <strong style={{ flex: "1 1 180px", fontSize: 12 }}>Chamada recebida de {incoming.from ?? "cliente"}</strong>
        <button type="button" disabled={busy} onClick={() => void answerCall()} style={{ border: 0, borderRadius: 8, padding: "9px 12px", background: "#16845d", color: "#fff", fontWeight: 700, cursor: "pointer" }}>Atender</button>
        <button type="button" disabled={busy} onClick={() => void rejectCall()} style={{ border: 0, borderRadius: 8, padding: "9px 12px", background: "#fff0f0", color: "#a33", fontWeight: 700, cursor: "pointer" }}>Rejeitar</button>
      </div>}
      {activeCallId && <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button type="button" disabled={busy} onClick={toggleMute} style={{ border: "1px solid #ddd", borderRadius: 8, padding: "9px 12px", background: "#fff", cursor: "pointer" }}><Mic size={14} style={{ verticalAlign: "middle", marginRight: 5 }} />{muted ? "Ativar microfone" : "Silenciar"}</button>
        <button type="button" disabled={busy} onClick={() => void hangUp()} style={{ border: 0, borderRadius: 8, padding: "9px 12px", background: "#a33", color: "#fff", fontWeight: 700, cursor: "pointer" }}><PhoneOff size={14} style={{ verticalAlign: "middle", marginRight: 5 }} />Terminar chamada</button>
      </div>}
      <audio ref={audioRef} autoPlay playsInline />
      <div style={{ display: "flex", alignItems: "flex-start", gap: 7, color: "#8a6b2a", background: "#fbf3df", borderRadius: 8, padding: 10, marginTop: 13, fontSize: 11, lineHeight: 1.55 }}>
        <ShieldCheck size={15} style={{ flexShrink: 0 }} /> Só liga depois de o cliente autorizar. A Meta pode rejeitar a chamada se o número não tiver Calling ativo, se a permissão tiver expirado ou se a conta não for elegível. Redes restritivas podem exigir TURN.
      </div>
    </section>
  );
}
