# Voz inteligente do Caçador

O Z Router continua a ser o único cérebro conversacional. Este módulo acrescenta apenas adaptadores de áudio compatíveis com a API OpenAI:

- STT: POST /audio/transcriptions
- TTS: POST /audio/speech

## Secrets do servidor

- CACADOR_AUDIO_API_KEY: chave do fornecedor de áudio (obrigatória).
- CACADOR_AUDIO_BASE_URL: base URL HTTPS, por omissão https://api.openai.com/v1.
- CACADOR_STT_MODEL: modelo de transcrição, por omissão whisper-1.
- CACADOR_TTS_MODEL: modelo de voz, por omissão tts-1.
- CACADOR_TTS_VOICE: voz, por omissão alloy.

A chave nunca é enviada ao browser. As funções verificam a sessão autenticada do Caçador e não expõem endpoints de fornecedor ao cliente.

## Fluxo previsto para chamadas

1. A faixa de áudio recebida por WebRTC é capturada no browser.
2. O cliente envia segmentos de áudio para transcrição.
3. O texto transcrito é enviado ao Z Router através do fluxo de conversação existente.
4. A resposta do Z Router é sintetizada em áudio.
5. O áudio sintetizado é injetado na ligação WebRTC.

A disponibilidade real depende de o fornecedor aceitar os modelos e formatos configurados. O processamento por segmentos tem latência e não equivale a áudio full-duplex de baixa latência. Para produção, usar segmentos curtos, controlo de interrupção (barge-in), limites de duração e TURN/STUN adequado.
