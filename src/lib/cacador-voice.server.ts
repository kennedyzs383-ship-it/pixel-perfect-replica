import { z } from 'zod';

const AudioSchema = z.object({
  audioBase64: z.string().min(100).max(12_000_000),
  mimeType: z.enum(['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/mpeg', 'audio/wav', 'audio/x-wav']).default('audio/webm'),
});
const SpeechSchema = z.object({ text: z.string().trim().min(1).max(4000) });

function providerConfig() {
  const baseUrl = (process.env.CACADOR_AUDIO_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const apiKey = process.env.CACADOR_AUDIO_API_KEY;
  if (!apiKey) throw new Error('Configura CACADOR_AUDIO_API_KEY nas secrets do servidor para ativar STT/TTS.');
  const parsed = new URL(baseUrl);
  if (parsed.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && parsed.hostname === 'localhost')) {
    throw new Error('O fornecedor de áudio tem de usar HTTPS.');
  }
  return { baseUrl, apiKey };
}

export async function transcribeCacadorAudio(input: unknown) {
  const data = AudioSchema.parse(input);
  const { baseUrl, apiKey } = providerConfig();
  const bytes = Uint8Array.from(atob(data.audioBase64), char => char.charCodeAt(0));
  const form = new FormData();
  const extensionByMime: Record<string, string> = { 'audio/webm': 'webm', 'audio/mp4': 'mp4', 'audio/ogg': 'ogg', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav' };\n  form.set('file', new Blob([bytes], { type: data.mimeType }), `customer-audio.${extensionByMime[data.mimeType]}`);
  form.set('model', process.env.CACADOR_STT_MODEL || 'whisper-1');
  form.set('language', 'pt');
  const response = await fetch(baseUrl + '/audio/transcriptions', {
    method: 'POST', headers: { Authorization: 'Bearer ' + apiKey }, body: form,
    signal: AbortSignal.timeout(45000), redirect: 'error',
  });
  const payload = await response.json().catch(() => ({})) as { text?: string; error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message || 'O serviço de transcrição não conseguiu processar o áudio.');
  return { text: (payload.text || '').trim() };
}

export async function synthesizeCacadorSpeech(input: unknown) {
  const data = SpeechSchema.parse(input);
  const { baseUrl, apiKey } = providerConfig();
  const response = await fetch(baseUrl + '/audio/speech', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: process.env.CACADOR_TTS_MODEL || 'tts-1',
      voice: process.env.CACADOR_TTS_VOICE || 'alloy',
      input: data.text,
      response_format: 'mp3',
    }),
    signal: AbortSignal.timeout(45000), redirect: 'error',
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({})) as { error?: { message?: string } };
    throw new Error(payload.error?.message || 'O serviço de voz não conseguiu gerar o áudio.');
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 8_000_000) throw new Error('O áudio gerado está vazio ou excede o limite permitido.');
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return { audioBase64: btoa(binary), mimeType: 'audio/mpeg' };
}
