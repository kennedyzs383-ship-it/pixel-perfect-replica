import { useCallback, useEffect, useRef, useState } from "react";
import { Phone, PhoneCall, PhoneOff, Mic, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { askCacadorWithMcpFn } from "@/lib/cacador-mcp-ai.functions";
import { transcribeCacadorVoice, synthesizeCacadorVoice } from "@/lib/cacador-voice.functions";
import { getWhatsAppCallId, isTerminalWhatsAppCallStatus, parseWhatsAppCallEvents, parseWhatsAppCallStatuses, statusBelongsToCall, type WhatsAppCallEvent } from "@/lib/cacador-call-events";

type CallEvent = WhatsAppCallEvent;
type RecentWhatsAppCustomer = { from_phone: string; contact_name: string | null; received_at: string };

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
  const [recentCustomers, setRecentCustomers] = useState<RecentWhatsAppCustomer[]>([]);
  const [status, setStatus] = useState("A verificar sessão…");
  const [busy, setBusy] = useState(false);
  const [realtimeReady, setRealtimeReady] = useState(false);
  const [activeCallId, setActiveCallId] = useState("");
  const [incoming, setIncoming] = useState<CallEvent | null>(null);
  // Keep the Realtime listener stable while exposing the latest call state.
  const activeCallIdRef = useRef("");
  const incomingRef = useRef<CallEvent | null>(null);
  // Retain the call ID after local cleanup so Meta can confirm remote termination later.
  const pendingTerminationCallIdRef = useRef("");
  const [muted, setMuted] = useState(false);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const speechDestinationRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const voiceQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingVoiceSegmentsRef = useRef(0);
  const recordingActiveRef = useRef(false);
  const recordingTimerRef = useRef<number | null>(null);
  const activeSpeechSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const vadFrameRef = useRef<number | null>(null);
  const remoteAnalyserRef = useRef<AnalyserNode | null>(null);
  const iceDisconnectTimerRef = useRef<number | null>(null);

  const cleanup = useCallback(() => {
    if (iceDisconnectTimerRef.current !== null) {
      window.clearTimeout(iceDisconnectTimerRef.current);
      iceDisconnectTimerRef.current = null;
    }
    recordingActiveRef.current = false;
    if (recordingTimerRef.current !== null) window.clearTimeout(recordingTimerRef.current);
    recordingTimerRef.current = null;
    if (vadFrameRef.current !== null) window.cancelAnimationFrame(vadFrameRef.current);
    vadFrameRef.current = null;
    activeSpeechSourcesRef.current.forEach((source) => { try { source.stop(); } catch { /* already stopped */ } });
    activeSpeechSourcesRef.current.clear();
    remoteAnalyserRef.current?.disconnect();
    remoteAnalyserRef.current = null;
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    recorderRef.current = null;
    peerRef.current?.close();
    peerRef.current = null;
    void audioContextRef.current?.close();
    audioContextRef.current = null;
    speechDestinationRef.current = null;
    voiceQueueRef.current = Promise.resolve();
    pendingVoiceSegmentsRef.current = 0;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (audioRef.current) audioRef.current.srcObject = null;
    activeCallIdRef.current = "";
    incomingRef.current = null;
    setActiveCallId("");
    setIncoming(null);
    setMuted(false);
  }, []);

  const loadRecentCustomers = useCallback(async () => {
    const { data, error } = await supabase
      .from("whatsapp_inbox_messages")
      .select("from_phone, contact_name, received_at")
      .order("received_at", { ascending: false })
      .limit(100);
    if (error) {
      setStatus("Não foi possível carregar os números recentes da inbox WhatsApp: " + error.message);
      return;
    }
    const unique = new Map<string, RecentWhatsAppCustomer>();
    for (const row of data ?? []) {
      if (!/^\d{8,15}$/.test(row.from_phone) || unique.has(row.from_phone)) continue;
      unique.set(row.from_phone, {
        from_phone: row.from_phone,
        contact_name: row.contact_name,
        received_at: row.received_at,
      });
    }
    setRecentCustomers(Array.from(unique.values()).slice(0, 20));
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
    // Track each utterance so customer speech can interrupt TTS (barge-in).
    activeSpeechSourcesRef.current.add(source);
    await new Promise<void>((resolve) => {
      source.onended = () => {
        activeSpeechSourcesRef.current.delete(source);
        resolve();
      };
      source.start();
    });
  }, []);

  const processCustomerAudio = useCallback((blob: Blob) => {
    if (blob.size < 1200) return;
    const callPeer = peerRef.current;
    if (!callPeer) return;
    // Bound the queue so excess incoming segments are dropped instead of
    // accumulating and being answered long after the customer has moved on.
    if (pendingVoiceSegmentsRef.current >= 2) {
      setStatus("A voz está a demorar. A ignorar este segmento para evitar respostas atrasadas…");
      return;
    }
    pendingVoiceSegmentsRef.current += 1;
    // Keep capture independent from AI latency, while processing utterances in order.
    voiceQueueRef.current = voiceQueueRef.current.then(async () => {
      if (peerRef.current !== callPeer) {
        pendingVoiceSegmentsRef.current = Math.max(0, pendingVoiceSegmentsRef.current - 1);
        return;
      }
      try {
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let binary = "";
        for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        const transcription = await transcribeCacadorVoice({ data: { audioBase64: btoa(binary), mimeType: (blob.type || "audio/webm").split(";")[0].toLowerCase() } });
        if (!transcription.text.trim() || peerRef.current !== callPeer) return;
        setStatus("Cliente: " + transcription.text.slice(0, 150) + " — a preparar resposta…");
        const answer = await askCacadorWithMcpFn({ data: { message: transcription.text, context: "Estás numa chamada WhatsApp em direto. Responde em português de Angola, de forma breve, natural e própria para ser dita em voz alta. Não afirmes que executaste ações externas sem autorização. Se o cliente pedir uma pessoa, informa que a chamada será encaminhada." } });
        if (!answer.answer?.trim()) throw new Error("O Z Router não devolveu uma resposta para a chamada.");
        if (peerRef.current !== callPeer) return;
        await speakToCustomer(answer.answer);
        setStatus("Caçador respondeu por voz. À escuta do cliente…");
      } catch (error) {
        setStatus(error instanceof Error ? "Voz inteligente: " + error.message : "Não foi possível processar a voz do cliente.");
      } finally {
        pendingVoiceSegmentsRef.current = Math.max(0, pendingVoiceSegmentsRef.current - 1);
      }
    }).catch((error) => {
      setStatus(error instanceof Error ? error.message : "Falha na fila de processamento de voz.");
    });
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
      if (audioContextRef.current && !remoteAnalyserRef.current) {
        const analyser = audioContextRef.current.createAnalyser();
        analyser.fftSize = 1024;
        audioContextRef.current.createMediaStreamSource(remoteStream).connect(analyser);
        remoteAnalyserRef.current = analyser;
        const samples = new Uint8Array(analyser.fftSize);
        let speechFrames = 0;
        let silenceFrames = 0;
        let speakingNow = false;
        const startSegmentRecording = () => {
          if (!recordingActiveRef.current || peerRef.current !== peer || recorderRef.current) return;
          const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "";
          const recorder = new MediaRecorder(remoteStream, mimeType ? { mimeType } : undefined);
          const chunks: BlobPart[] = [];
          recorderRef.current = recorder;
          recorder.ondataavailable = (recordingEvent) => {
            if (recordingEvent.data.size > 0) chunks.push(recordingEvent.data);
          };
          recorder.onstop = () => {
            if (recorderRef.current === recorder) recorderRef.current = null;
            // A new speech onset can arrive before the recorder's stop event fires.
            // Reset the VAD state so the next animation frame can start a fresh segment.
            speakingNow = false;
            if (!recordingActiveRef.current || peerRef.current !== peer) return;
            const segment = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
            if (segment.size > 1200) processCustomerAudio(segment);
          };
          recorder.start();
          // Bound a single utterance; if the customer keeps speaking, VAD starts
          // the next segment without waiting for a fixed four-second recording loop.
          recordingTimerRef.current = window.setTimeout(() => {
            recordingTimerRef.current = null;
            if (recorder.state !== "inactive") recorder.stop();
          }, 10000);
        };
        const detectCustomerSpeech = () => {
          if (peerRef.current !== peer || !remoteAnalyserRef.current) return;
          analyser.getByteTimeDomainData(samples);
          let energy = 0;
          for (const sample of samples) {
            const normalized = (sample - 128) / 128;
            energy += normalized * normalized;
          }
          const rms = Math.sqrt(energy / samples.length);
          if (rms > 0.035) {
            speechFrames += 1;
            silenceFrames = 0;
          } else {
            speechFrames = 0;
            if (speakingNow) silenceFrames += 1;
          }
          // Three energetic frames reject clicks; 30 quiet frames mark end of utterance.
          if (speechFrames >= 3) {
            if (activeSpeechSourcesRef.current.size) {
              activeSpeechSourcesRef.current.forEach((source) => { try { source.stop(); } catch { /* already stopped */ } });
              activeSpeechSourcesRef.current.clear();
              setStatus("O cliente interrompeu a resposta. O Caçador está a ouvir…");
            }
            if (!speakingNow) {
              speakingNow = true;
              startSegmentRecording();
            }
          }
          if (speakingNow && silenceFrames >= 30) {
            speakingNow = false;
            silenceFrames = 0;
            const recorder = recorderRef.current;
            if (recordingTimerRef.current !== null) window.clearTimeout(recordingTimerRef.current);
            recordingTimerRef.current = null;
            if (recorder && recorder.state !== "inactive") recorder.stop();
          }
          vadFrameRef.current = window.requestAnimationFrame(detectCustomerSpeech);
        };
        vadFrameRef.current = window.requestAnimationFrame(detectCustomerSpeech);
      }
      if (typeof MediaRecorder !== "undefined" && !recordingActiveRef.current) {
        // Record only while the customer is speaking; VAD closes the utterance
        // after a short silence instead of splitting speech into fixed time slices.
        recordingActiveRef.current = true;
        setStatus("Chamada ligada. O Caçador está à escuta do cliente.");
      }
    };
    peer.oniceconnectionstatechange = () => {
      const iceState = peer.iceConnectionState;
      if (iceState === "connected" || iceState === "completed") {
        if (iceDisconnectTimerRef.current !== null) {
          window.clearTimeout(iceDisconnectTimerRef.current);
          iceDisconnectTimerRef.current = null;
        }
        setStatus("Ligação ICE estabelecida — áudio em tempo real.");
      } else if (iceState === "disconnected") {
        if (iceDisconnectTimerRef.current !== null) window.clearTimeout(iceDisconnectTimerRef.current);
        setStatus("Ligação de rede interrompida. A aguardar recuperação automática…");
        // ICE can briefly disconnect during mobile handovers. Do not tear down
        // the call immediately; report a persistent outage after a short grace.
        iceDisconnectTimerRef.current = window.setTimeout(() => {
          iceDisconnectTimerRef.current = null;
          if (peerRef.current === peer && peer.iceConnectionState === "disconnected") {
            setStatus("A ligação continua interrompida. Verifica a rede; se não recuperar, termina e inicia novamente. Pode ser necessário configurar TURN.");
          }
        }, 8000);
      } else if (iceState === "failed") {
        if (iceDisconnectTimerRef.current !== null) {
          window.clearTimeout(iceDisconnectTimerRef.current);
          iceDisconnectTimerRef.current = null;
        }
        setStatus("A negociação ICE falhou. Esta integração ainda não faz renegociação automática; verifica TURN/rede e tenta uma nova chamada.");
      }
    };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "connected") setStatus("Chamada ligada — áudio em tempo real.");
      else if (peer.connectionState === "connecting") setStatus("A estabelecer áudio…");
      else if (peer.connectionState === "failed") setStatus("A ligação de áudio falhou. A rede pode precisar de um servidor TURN.");
      else if (peer.connectionState === "disconnected" && peer.iceConnectionState !== "disconnected") setStatus("Ligação interrompida. A aguardar recuperação…");
    };
    return peer;
  }, [processCustomerAudio]);

  const receiveSignal = useCallback(async (payload: Record<string, unknown>) => {
    const calls = parseWhatsAppCallEvents(payload.calls);
    for (const call of calls) {
      const event = String(call.event ?? "").toLowerCase();
      const callId = getWhatsAppCallId(call);
      const currentActiveCallId = activeCallIdRef.current;
      const currentIncoming = incomingRef.current;
      const belongsToActive = Boolean(callId && callId === currentActiveCallId);
      const belongsToIncoming = Boolean(callId && callId === currentIncoming?.id);

      // Ignore late events from previous calls; stale termination must not
      // close the peer connection belonging to a newer call.
      const confirmsPendingTermination = Boolean(callId && callId === pendingTerminationCallIdRef.current);
      if ((event === "terminate" || event === "terminated") && (belongsToActive || belongsToIncoming || confirmsPendingTermination)) {
        pendingTerminationCallIdRef.current = "";
        cleanup();
        setStatus("A Meta confirmou o encerramento da chamada.");
        continue;
      }

      if (call.session?.sdp && call.session.sdp_type === "answer" && peerRef.current) {
        if (callId && currentActiveCallId && callId !== currentActiveCallId) continue;
        // Meta may retry webhook deliveries. Applying the same SDP answer twice
        // can fail because the peer connection has already left the offer state.
        const appliedDescription = peerRef.current.remoteDescription;
        if (appliedDescription?.type === "answer" && appliedDescription.sdp === call.session.sdp) continue;
        await peerRef.current.setRemoteDescription({ type: "answer", sdp: call.session.sdp });
        if (callId) {
          activeCallIdRef.current = callId;
          setActiveCallId(callId);
        }
        setStatus("Resposta recebida. A ligar o áudio…");
      } else if (call.session?.sdp && call.session.sdp_type === "offer" && callId) {
        if (currentActiveCallId || (currentIncoming?.id && currentIncoming.id !== callId)) continue;
        // Repeated delivery of the same incoming offer must not reset the
        // pending invitation or replace an offer the operator is already viewing.
        if (currentIncoming?.id === callId && currentIncoming.session?.sdp === call.session.sdp) continue;
        incomingRef.current = call;
        setIncoming(call);
        setStatus("Chamada WhatsApp recebida. Podes atender ou rejeitar.");
      }
    }

    const statuses = parseWhatsAppCallStatuses(payload.statuses);
    const currentCallId = activeCallIdRef.current || incomingRef.current?.id || pendingTerminationCallIdRef.current;
    const terminalStatus = statuses.find((item) =>
      isTerminalWhatsAppCallStatus(item.status ?? item.event) &&
      statusBelongsToCall(item, currentCallId),
    );
    if (terminalStatus) {
      const wasPendingTermination = Boolean(pendingTerminationCallIdRef.current && currentCallId === pendingTerminationCallIdRef.current);
      pendingTerminationCallIdRef.current = "";
      cleanup();
      setStatus(wasPendingTermination ? "A Meta confirmou o encerramento da chamada." : "A Meta confirmou que a chamada terminou ou foi recusada.");
    }
    // ACCEPTED is informational and may arrive after media is connected.
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
      void loadRecentCustomers();
      const { data: sessionData } = await supabase.auth.getSession();
      if (sessionData.session?.access_token) await supabase.realtime.setAuth(sessionData.session.access_token);
      channel = supabase.channel(`whatsapp-calls:${data.user.id}`, { config: { private: true } })
        .on("broadcast", { event: "call_signal" }, ({ payload }) => {
          void receiveSignal(payload as Record<string, unknown>).catch((error: unknown) => {
            setStatus(error instanceof Error ? error.message : "Erro ao processar sinalização da chamada.");
          });
        })
        .on("broadcast", { event: "incoming_message" }, () => {
          void loadRecentCustomers();
        })
        .subscribe((state) => {
          if (state === "SUBSCRIBED") {
            setRealtimeReady(true);
            setStatus("Canal de chamadas ligado. À espera de uma chamada.");
          } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED") {
            setRealtimeReady(false);
            setStatus("Canal de chamadas indisponível. Não inicies chamadas até a ligação recuperar.");
          }
        });
    }).catch(() => setStatus("Não foi possível verificar a sessão do Caçador."));
    return () => {
      active = false;
      if (channel) void supabase.removeChannel(channel);
      cleanup();
    };
  }, [cleanup, loadRecentCustomers, receiveSignal]);

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
      if (!realtimeReady) throw new Error("O canal seguro de sinalização ainda não está ligado. Aguarda antes de iniciar a chamada.");
      if (!/^\+?[1-9]\d{7,14}$/.test(phone.trim())) throw new Error("Indica o número do cliente com indicativo internacional.");
      // Check consent before opening the microphone or creating a WebRTC offer.
      const permission = await callControl({ action: "get_call_permission_status", to: phone.trim() });
      const canStartCall = Array.isArray(permission.actions) &&
        permission.actions.some((item) => item && typeof item === "object" &&
          (item as { action_name?: unknown }).action_name === "start_call" &&
          (item as { can_perform_action?: unknown }).can_perform_action === true);
      if (!canStartCall) {
        throw new Error("A Meta ainda não confirma autorização para ligar a este cliente. Envia primeiro o pedido de autorização e aguarda a aprovação no WhatsApp.");
      }
      const peer = await createPeer();
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      await waitForIceGathering(peer);
      const result = await callControl({ action: "connect", to: phone.trim(), sdp: peer.localDescription?.sdp });
      const calls = Array.isArray(result.calls) ? result.calls as Array<{ id?: string }> : [];
      if (calls[0]?.id) {
        activeCallIdRef.current = calls[0].id;
        setActiveCallId(calls[0].id);
      }
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
      activeCallIdRef.current = incoming.id;
      incomingRef.current = null;
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
      incomingRef.current = null;
      setIncoming(null);
      setStatus("Chamada rejeitada.");
    } catch (error) { setStatus(error instanceof Error ? error.message : "Não foi possível rejeitar a chamada."); }
    finally { setBusy(false); }
  };

  const hangUp = async () => {
    const callId = activeCallIdRef.current || activeCallId;
    setBusy(true);
    let terminationError = "";
    try {
      if (callId) {
        // HTTP success acknowledges the request; only a matching Meta event confirms termination.
        await callControl({ action: "terminate", call_id: callId });
      }
    } catch (error) {
      terminationError = error instanceof Error ? error.message : "Não foi possível confirmar o pedido de encerramento na Meta.";
    } finally {
      if (callId) pendingTerminationCallIdRef.current = callId;
      // Always stop local media, but do not claim the remote call ended until Meta reports it.
      cleanup();
      setStatus(!callId
        ? "Áudio local desligado. Não havia um identificador de chamada para confirmar o encerramento remoto."
        : terminationError
          ? `Áudio local desligado, mas a Meta não confirmou o pedido de encerramento: ${terminationError}. À espera de confirmação de estado.`
          : "Áudio local desligado. Pedido de encerramento enviado à Meta; à espera de confirmação do webhook.");
      setBusy(false);
    }
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
      {recentCustomers.length > 0 && <div style={{ marginTop: 12 }}>
        <div style={{ color: "#737583", fontSize: 11, fontWeight: 750, marginBottom: 7 }}>Clientes identificados nas mensagens WhatsApp</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {recentCustomers.map((customer) => <button
            key={customer.from_phone}
            type="button"
            onClick={() => setPhone("+" + customer.from_phone)}
            style={{ border: phone.replace(/^\+/, "") === customer.from_phone ? "1px solid #16845d" : "1px solid #e0e1e8", borderRadius: 8, background: phone.replace(/^\+/, "") === customer.from_phone ? "#edf8f1" : "#fff", color: "#3e4050", padding: "8px 10px", fontSize: 11, cursor: "pointer", textAlign: "left" }}
          >
            <strong>{customer.contact_name || "Cliente WhatsApp"}</strong><br />
            <span style={{ color: "#737583" }}>+{customer.from_phone}</span>
          </button>)}
        </div>
      </div>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <input aria-label="Número do cliente" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+244923000000" style={{ flex: "1 1 220px", minWidth: 0, border: "1px solid #d9dae3", borderRadius: 8, padding: "11px 12px", fontSize: 13 }} />
        <button type="button" disabled={busy || !userId || !phone.trim()} onClick={() => void requestPermission()} style={{ border: 0, borderRadius: 8, padding: "10px 13px", background: "#f0edff", color: "#5e45b4", fontWeight: 700, fontSize: 12, cursor: "pointer", opacity: busy || !userId || !phone.trim() ? .5 : 1 }}>Pedir autorização</button>
        <button type="button" disabled={busy || !userId || !realtimeReady || !phone.trim() || Boolean(activeCallId) || Boolean(incoming)} onClick={() => void startCall()} style={{ border: 0, borderRadius: 8, padding: "10px 13px", background: "#16845d", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", opacity: busy || !userId || !realtimeReady || !phone.trim() || Boolean(activeCallId) || Boolean(incoming) ? .5 : 1 }}><Phone size={14} style={{ verticalAlign: "middle", marginRight: 5 }} />Ligar</button>
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
