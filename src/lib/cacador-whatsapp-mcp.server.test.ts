import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { callWhatsAppMcpTool } from './cacador-whatsapp-mcp.server';

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
