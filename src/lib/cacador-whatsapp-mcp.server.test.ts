import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callWhatsAppMcpTool } from './cacador-whatsapp-mcp.server';
import { synthesizeCacadorSpeech } from './cacador-voice.server';

vi.mock('./cacador-voice.server', () => ({
  synthesizeCacadorSpeech: vi.fn().mockResolvedValue({ audioBase64: 'AQIDBAUGBwgJCgsMDQ4PEA==', mimeType: 'audio/mpeg' }),
}));

const fetchMock = vi.fn();
const callInput = {
  action: 'connect',
  to: '+244923000000',
  sdp: 'v=0\\r\\no=- 123 2 IN IP4 127.0.0.1\\r\\ns=-\\r\\nt=0 0',
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('WHATSAPP_ACCESS_TOKEN', 'test-token');
  vi.stubEnv('WHATSAPP_PHONE_NUMBER_ID', '123456789012345');
  vi.stubEnv('WHATSAPP_GRAPH_API_VERSION', 'v23.0');
  vi.mocked(synthesizeCacadorSpeech).mockResolvedValue({ audioBase64: 'AQIDBAUGBwgJCgsMDQ4PEA==', mimeType: 'audio/mpeg' });
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('WhatsApp Calling permission gate', () => {
  it('blocks connect when permission status says granted but start_call is not explicitly allowed', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({
      permission: { status: 'granted' },
      actions: [{ action_name: 'start_call', can_perform_action: false }],
    }));

    await expect(callWhatsAppMcpTool('manage_voice_call', callInput))
      .rejects.toThrow('não confirmou explicitamente a ação start_call');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/call_permissions?user_wa_id=244923000000');
  });

  it('rejects non-boolean permission values even when they are truthy', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({
      permission: { status: 'granted' },
      actions: [{ action_name: 'start_call', can_perform_action: 'true' }],
    }));

    await expect(callWhatsAppMcpTool('manage_voice_call', callInput))
      .rejects.toThrow('não confirmou explicitamente a ação start_call');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('starts a call only when Meta explicitly allows start_call', async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json({
        permission: { status: 'granted' },
        actions: [{ action_name: 'start_call', can_perform_action: true }],
      }))
      .mockResolvedValueOnce(Response.json({ calls: [{ id: 'call-12345678' }] }));

    const result = await callWhatsAppMcpTool('manage_voice_call', callInput);
    expect(result.isError).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain('/123456789012345/calls');
  });
});


describe('WhatsApp voice messages', () => {
  it('synthesizes and uploads audio before sending it to the customer', async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json({ id: 'media-123' }))
      .mockResolvedValueOnce(Response.json({ messages: [{ id: 'wamid-audio-123' }] }));

    const result = await callWhatsAppMcpTool('send_audio_message', {
      to: '+244923000000',
      text: 'Olá, recebemos o teu pedido.',
    });

    expect(synthesizeCacadorSpeech).toHaveBeenCalledWith({ text: 'Olá, recebemos o teu pedido.' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/123456789012345/media');
    expect(fetchMock.mock.calls[0][1]?.body).toBeInstanceOf(FormData);
    expect(String(fetchMock.mock.calls[1][0])).toContain('/123456789012345/messages');
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toMatchObject({
      messaging_product: 'whatsapp',
      to: '244923000000',
      type: 'audio',
      audio: { id: 'media-123' },
    });
    expect(result.content).toContain('wamid-audio-123');
  });

  it('does not send audio if Meta rejects the media upload', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ error: { message: 'Unsupported media' } }, { status: 400 }));
    await expect(callWhatsAppMcpTool('send_audio_message', {
      to: '+244923000000',
      text: 'Olá.',
    })).rejects.toThrow('Unsupported media');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});


describe('WhatsApp call permission requests', () => {
  it('uses the approved call-permission template when configured', async () => {
    vi.stubEnv('WHATSAPP_CALL_PERMISSION_TEMPLATE_NAME', 'cacador_call_permission');
    vi.stubEnv('WHATSAPP_CALL_PERMISSION_TEMPLATE_LANGUAGE', 'pt_PT');
    fetchMock.mockResolvedValueOnce(Response.json({ messages: [{ id: 'wamid-permission-1' }] }));

    const result = await callWhatsAppMcpTool('request_call_permission', {
      to: '+244923000000',
      message: 'Pedido de autorização.',
    });

    const payload = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(payload).toMatchObject({
      type: 'template',
      template: { name: 'cacador_call_permission', language: { code: 'pt_PT' } },
    });
    expect(result.content).toContain('wamid-permission-1');
  });

  it('uses an interactive request when no approved template is configured', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ messages: [{ id: 'wamid-permission-2' }] }));

    await callWhatsAppMcpTool('request_call_permission', {
      to: '+244923000000',
      message: 'Podemos ligar-te?',
    });

    const payload = JSON.parse(String(fetchMock.mock.calls[0][1]?.body));
    expect(payload).toMatchObject({
      type: 'interactive',
      interactive: { type: 'call_permission_request', action: { name: 'call_permission_request' } },
    });
  });
});
