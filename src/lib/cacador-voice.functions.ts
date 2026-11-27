import { createServerFn } from '@tanstack/react-start';
import { getRequest, setResponseHeader } from '@tanstack/react-start/server';
import { verifyCacadorSession } from './cacador-auth.server';
import { synthesizeCacadorSpeech, transcribeCacadorAudio } from './cacador-voice.server';

async function authorize() {
  setResponseHeader('Cache-Control', 'no-store');
  if (!await verifyCacadorSession(getRequest().headers)) throw new Error('Inicia sessão no Caçador para utilizar voz inteligente.');
}

export const transcribeCacadorVoice = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => input)
  .handler(async ({ data }) => {
    await authorize();
    return transcribeCacadorAudio(data);
  });

export const synthesizeCacadorVoice = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => input)
  .handler(async ({ data }) => {
    await authorize();
    return synthesizeCacadorSpeech(data);
  });
