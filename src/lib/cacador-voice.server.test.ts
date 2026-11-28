import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { transcribeCacadorAudio } from './cacador-voice.server';

const fetchMock = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('CACADOR_AUDIO_API_KEY', 'test-audio-key');
  vi.stubEnv('CACADOR_AUDIO_BASE_URL', 'https://audio.example.test/v1');
  vi.stubEnv('CACADOR_STT_MODEL', 'whisper-test');
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('Caçador audio transcription input', () => {
  it('uses a matching filename and MIME type for MP4 recordings', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ text: 'Olá, preciso de um site.' }));
    const result = await transcribeCacadorAudio({
      audioBase64: btoa('a'.repeat(120)),
      mimeType: 'audio/mp4',
    });

    expect(result.text).toBe('Olá, preciso de um site.');
    const body = fetchMock.mock.calls[0][1].body as FormData;
    const file = body.get('file') as File;
    expect(file.name).toBe('customer-audio.mp4');
    expect(file.type).toBe('audio/mp4');
    expect(body.get('model')).toBe('whisper-test');
  });

  it('rejects unsupported MIME types before contacting the provider', async () => {
    await expect(transcribeCacadorAudio({
      audioBase64: btoa('a'.repeat(120)),
      mimeType: 'video/mp4',
    })).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
