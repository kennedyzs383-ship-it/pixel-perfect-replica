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


## Captura de áudio na chamada

A captura fecha cada gravação após aproximadamente 4 segundos e envia o ficheiro completo, não fragmentos isolados do `MediaRecorder`. O gravador reinicia sem esperar pela transcrição, pelo Z Router ou pela síntese, e os segmentos são processados numa fila ordenada. A reprodução TTS também ocupa essa fila até terminar, evitando sobreposição de respostas. Os formatos MIME suportados são validados e recebem a extensão correspondente. Continua a ser um protótipo por segmentos: pode dividir frases a meio, processar silêncio e não permite interrupção imediata da fala sintetizada (barge-in). Antes de produção, implementar deteção de voz/silêncio com buffer contínuo, barge-in, limites de duração e testes reais em Android/iOS e redes móveis.


## Interrupção da resposta (barge-in)

Durante a chamada, o browser analisa a energia do áudio remoto com um `AnalyserNode`. Quando deteta três frames consecutivos acima do limiar RMS configurado, interrompe as fontes TTS ativas e liberta a fila para processar a fala do cliente. Esta é uma deteção simples por energia, não um VAD semântico: ruído, eco ou música podem causar interrupções falsas e voz baixa pode não atingir o limiar. O limiar deve ser calibrado em chamadas reais e com diferentes microfones/ambientes. A deteção corre apenas enquanto a ligação WebRTC está ativa e é cancelada no encerramento da chamada.
