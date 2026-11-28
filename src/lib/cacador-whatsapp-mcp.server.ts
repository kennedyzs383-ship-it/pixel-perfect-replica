import { z } from 'zod';
import { synthesizeCacadorSpeech } from './cacador-voice.server';

const CustomerSchema = z.string().trim().regex(/^\+?[1-9]\d{7,14}$/, 'Indica o número WhatsApp do cliente em formato internacional.');
const CallPermissionSchema = z.object({
  to: CustomerSchema,
  message: z.string().trim().min(1).max(1024).default('Gostaríamos de falar contigo por chamada WhatsApp sobre a nossa proposta. Autorizas que te liguemos?'),
});
const CallPermissionStatusSchema = z.object({ to: CustomerSchema });
const ManageCallSchema = z.object({
  action: z.enum(['connect', 'pre_accept', 'accept', 'reject', 'terminate']),
  to: CustomerSchema.optional(),
  call_id: z.string().trim().min(8).max(200).optional(),
  sdp: z.string().trim().min(20).max(20000).optional(),
  biz_opaque_callback_data: z.string().max(512).optional(),
}).superRefine((value, ctx) => {
  if (value.action === 'connect' && (!value.to || !value.sdp)) ctx.addIssue({ code: 'custom', message: 'Para iniciar uma chamada, fornece o número do cliente e a oferta SDP gerada por WebRTC.' });
  if (['accept', 'pre_accept'].includes(value.action) && (!value.call_id || !value.sdp)) ctx.addIssue({ code: 'custom', message: 'Para aceitar uma chamada, fornece call_id e a resposta SDP gerada por WebRTC.' });
  if (['reject', 'terminate'].includes(value.action) && !value.call_id) ctx.addIssue({ code: 'custom', message: 'Esta ação exige call_id.' });
});
const SendTextSchema = z.object({
  to: z.string().trim().regex(/^\+?[1-9]\d{7,14}$/, 'Indica o número do cliente em formato internacional, com indicativo do país.'),
  message: z.string().trim().min(1).max(4096),
});
const SendAudioSchema = z.object({
  to: CustomerSchema,
  text: z.string().trim().min(1).max(4000),
});

function config() {
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const graphVersion = process.env.WHATSAPP_GRAPH_API_VERSION;
  return { accessToken, phoneNumberId, graphVersion };
}

export function listWhatsAppMcpTools() {
  return [
    {
      name: 'get_connection_status',
      description: 'Verifica se a ligação à WhatsApp Cloud API está configurada. Nunca revela tokens ou segredos.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
      name: 'get_call_settings',
      description: 'Consulta as definições de chamadas WhatsApp do número Cloud API. Não ativa chamadas.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    },
    {
      name: 'get_call_permission_status',
      description: 'Consulta se o cliente autorizou chamadas WhatsApp e se é possível pedir autorização ou ligar.',
      inputSchema: { type: 'object', properties: { to: { type: 'string', description: 'Número WhatsApp do cliente em formato internacional.' } }, required: ['to'], additionalProperties: false },
    },
    {
      name: 'request_call_permission',
      description: 'Envia ao cliente um pedido oficial para autorizar uma chamada WhatsApp. Usa o template CALL_PERMISSION_REQUEST aprovado quando configurado; caso contrário, envia a mensagem interativa dentro da janela de atendimento. Não inicia a chamada.',
      inputSchema: { type: 'object', properties: { to: { type: 'string' }, message: { type: 'string', maxLength: 1024 } }, required: ['to'], additionalProperties: false },
    },
    {
      name: 'manage_voice_call',
      description: 'Executa uma ação Calling API. connect exige permissão prévia e SDP offer real gerado por WebRTC; accept/pre_accept exigem SDP answer real. Isto é apenas sinalização, não substitui o motor de áudio WebRTC.',
      inputSchema: {
        type: 'object',
        properties: {
          action: { type: 'string', enum: ['connect', 'pre_accept', 'accept', 'reject', 'terminate'] },
          to: { type: 'string' },
          call_id: { type: 'string' },
          sdp: { type: 'string', description: 'SDP gerado por RTCPeerConnection; nunca inventar ou reutilizar um SDP.' },
          biz_opaque_callback_data: { type: 'string' },
        },
        required: ['action'],
        additionalProperties: false,
      },
    },
    {
      name: 'send_text_message',
      description: 'Envia uma mensagem de texto para um número WhatsApp em formato internacional. Requer autorização humana na interface do Caçador e está sujeito às regras/janela de atendimento da Meta.',
      inputSchema: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Número do destinatário em formato internacional, por exemplo +244923000000.' },
          message: { type: 'string', minLength: 1, maxLength: 4096, description: 'Texto da mensagem.' },
        },
        required: ['to', 'message'],
        additionalProperties: false,
      },
    },
    {
      name: 'send_audio_message',
      description: 'Gera uma mensagem de voz com o serviço TTS configurado e envia-a pelo WhatsApp Cloud API. Requer aprovação humana e pode ter custos do fornecedor de voz e da Meta.',
      inputSchema: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Número do destinatário em formato internacional.' },
          text: { type: 'string', minLength: 1, maxLength: 4000, description: 'Texto que será convertido em voz e enviado como áudio WhatsApp.' },
        },
        required: ['to', 'text'],
        additionalProperties: false,
      },
    },
  ];
}

async function graphRequest(path: string, init: RequestInit = {}) {
  const { accessToken, graphVersion } = config();
  if (!accessToken || !graphVersion || !/^v\d+\.\d+$/.test(graphVersion)) {
    throw new Error('WhatsApp MCP não configurado: define WHATSAPP_ACCESS_TOKEN e WHATSAPP_GRAPH_API_VERSION nas secrets do servidor.');
  }
  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', ...init.headers },
    signal: AbortSignal.timeout(20000),
    redirect: 'error',
  });
  const payload = await response.json().catch(() => ({})) as {
    error?: { message?: string; type?: string; code?: number; error_subcode?: number };
    messages?: Array<{ id?: string }>;
  };
  if (!response.ok) {
    const message = payload.error?.message || `Meta Graph API respondeu com HTTP ${response.status}.`;
    throw new Error(`WhatsApp/Meta: ${message}`);
  }
  return payload;
}

export async function callWhatsAppMcpTool(toolName: string, args: Record<string, unknown>) {
  if (toolName === 'get_connection_status') {
    const { accessToken, phoneNumberId, graphVersion } = config();
    const missing = [
      !accessToken && 'WHATSAPP_ACCESS_TOKEN',
      !phoneNumberId && 'WHATSAPP_PHONE_NUMBER_ID',
      !graphVersion && 'WHATSAPP_GRAPH_API_VERSION',
    ].filter(Boolean);
    return {
      isError: false,
      content: missing.length
        ? `WhatsApp Cloud API ainda não configurada. Secrets em falta: ${missing.join(', ')}. Nenhum número está ligado.`
        : 'Credenciais e identificador do número estão configurados no servidor. Isto não confirma ainda a validade do token, a inscrição do número nem a subscrição do webhook.',
    };
  }

  if (toolName === 'get_call_settings') {
    const { phoneNumberId } = config();
    if (!phoneNumberId || !/^\d{5,30}$/.test(phoneNumberId)) throw new Error('Define WHATSAPP_PHONE_NUMBER_ID nas secrets do servidor.');
    const result = await graphRequest(`${phoneNumberId}/call_settings`, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
    return { isError: false, content: JSON.stringify(result).slice(0, 6000) };
  }

  if (toolName === 'get_call_permission_status') {
    const parsed = CallPermissionStatusSchema.safeParse(args);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || 'Número inválido.');
    const { phoneNumberId } = config();
    if (!phoneNumberId || !/^\d{5,30}$/.test(phoneNumberId)) throw new Error('Define WHATSAPP_PHONE_NUMBER_ID nas secrets do servidor.');
    const userWaId = parsed.data.to.replace(/^\+/, '');
    const result = await graphRequest(`${phoneNumberId}/call_permissions?user_wa_id=${encodeURIComponent(userWaId)}`, { method: 'GET' });
    return { isError: false, content: JSON.stringify(result).slice(0, 6000) };
  }

  if (toolName === 'request_call_permission') {
    const parsed = CallPermissionSchema.safeParse(args);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || 'Argumentos inválidos.');
    const { phoneNumberId } = config();
    if (!phoneNumberId || !/^\d{5,30}$/.test(phoneNumberId)) throw new Error('Define WHATSAPP_PHONE_NUMBER_ID nas secrets do servidor.');
    const to = parsed.data.to.replace(/^\+/, '');
    const approvedTemplate = process.env.WHATSAPP_CALL_PERMISSION_TEMPLATE_NAME?.trim();
    const templateLanguage = process.env.WHATSAPP_CALL_PERMISSION_TEMPLATE_LANGUAGE?.trim() || 'pt_PT';
    const permissionMessage = approvedTemplate
      ? { messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'template', template: { name: approvedTemplate, language: { code: templateLanguage } } }
      : { messaging_product: 'whatsapp', recipient_type: 'individual', to, type: 'interactive', interactive: { type: 'call_permission_request', body: { text: parsed.data.message }, action: { name: 'call_permission_request' } } };
    if (approvedTemplate && (!/^[a-z0-9_]{1,512}$/.test(approvedTemplate) || !/^[a-z]{2}_[A-Z]{2}$/.test(templateLanguage))) {
      throw new Error('O nome ou idioma do template de autorização de chamada está inválido nas secrets do servidor.');
    }
    const result = await graphRequest(phoneNumberId + '/messages', { method: 'POST', body: JSON.stringify(permissionMessage) });
    return { isError: false, content: `Pedido de autorização de chamada enviado à Meta para ${to}. A chamada não foi iniciada. Aguarda a resposta explícita do cliente. ${result.messages?.[0]?.id ? `ID: ${result.messages[0].id}` : ''}` };
  }

  if (toolName === 'manage_voice_call') {
    const parsed = ManageCallSchema.safeParse(args);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || 'Ação de chamada inválida.');
    const { phoneNumberId } = config();
    if (!phoneNumberId || !/^\d{5,30}$/.test(phoneNumberId)) throw new Error('Define WHATSAPP_PHONE_NUMBER_ID nas secrets do servidor.');
    if (parsed.data.action === 'connect') {
      const to = parsed.data.to!.replace(/^\+/, '');
      const permission = await graphRequest(`${phoneNumberId}/call_permissions?user_wa_id=${encodeURIComponent(to)}`, { method: 'GET' }) as { permission?: { status?: string }; actions?: Array<{ action_name?: string; can_perform_action?: boolean }> };
      const canStart = permission.actions?.some(item => item.action_name === 'start_call' && item.can_perform_action === true);
      if (!canStart) {
        throw new Error('A Meta não confirmou explicitamente a ação start_call para este cliente. Envia primeiro request_call_permission e aguarda a autorização reconhecida pela API.');
      }
    }
    const payload: Record<string, unknown> = { messaging_product: 'whatsapp', action: parsed.data.action };
    if (parsed.data.to) payload.to = parsed.data.to.replace(/^\+/, '');
    if (parsed.data.call_id) payload.call_id = parsed.data.call_id;
    if (parsed.data.sdp) payload.session = { sdp_type: parsed.data.action === 'connect' ? 'offer' : 'answer', sdp: parsed.data.sdp };
    if (parsed.data.biz_opaque_callback_data) payload.biz_opaque_callback_data = parsed.data.biz_opaque_callback_data;
    const result = await graphRequest(`${phoneNumberId}/calls`, { method: 'POST', body: JSON.stringify(payload) });
    return { isError: false, content: JSON.stringify(result).slice(0, 6000) };
  }

  if (toolName === 'send_audio_message') {
    const parsed = SendAudioSchema.safeParse(args);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || 'Argumentos de áudio inválidos.');
    const { accessToken, phoneNumberId, graphVersion } = config();
    if (!accessToken || !phoneNumberId || !/^\d{5,30}$/.test(phoneNumberId) || !graphVersion || !/^v\d+\.\d+$/.test(graphVersion)) {
      throw new Error('WhatsApp Cloud API não configurada para enviar áudio.');
    }
    const speech = await synthesizeCacadorSpeech({ text: parsed.data.text });
    const audioBytes = Uint8Array.from(atob(speech.audioBase64), character => character.charCodeAt(0));
    if (!audioBytes.length || audioBytes.byteLength > 8_000_000) throw new Error('O áudio gerado está vazio ou excede 8 MB.');
    const form = new FormData();
    form.set('messaging_product', 'whatsapp');
    form.set('file', new Blob([audioBytes], { type: 'audio/mpeg' }), 'cacador-audio.mp3');
    const uploadResponse = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/media`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + accessToken },
      body: form,
      signal: AbortSignal.timeout(45000),
      redirect: 'error',
    });
    const upload = await uploadResponse.json().catch(() => ({})) as { id?: string; error?: { message?: string } };
    if (!uploadResponse.ok || typeof upload.id !== 'string') {
      throw new Error(upload.error?.message || 'A Meta não aceitou o ficheiro de áudio.');
    }
    const to = parsed.data.to.replace(/^\+/, '');
    const sent = await graphRequest(`${phoneNumberId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'audio',
        audio: { id: upload.id },
      }),
    });
    const messageId = sent.messages?.[0]?.id;
    return { isError: false, content: messageId ? `Áudio aceite pela Meta para ${to}. ID: ${messageId}` : 'Áudio enviado à API da Meta; não foi devolvido um identificador de mensagem.' };
  }

  if (toolName === 'send_text_message') {
    const parsed = SendTextSchema.safeParse(args);
    if (!parsed.success) throw new Error(parsed.error.issues[0]?.message || 'Argumentos inválidos.');
    const { phoneNumberId } = config();
    if (!phoneNumberId || !/^\d{5,30}$/.test(phoneNumberId)) {
      throw new Error('Define WHATSAPP_PHONE_NUMBER_ID com o identificador do número Cloud API.');
    }
    const to = parsed.data.to.replace(/^\+/, '');
    const result = await graphRequest(`${phoneNumberId}/messages`, {
      method: 'POST',
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { preview_url: false, body: parsed.data.message },
      }),
    });
    const messageId = result.messages?.[0]?.id;
    return { isError: false, content: messageId ? `Mensagem aceite pela Meta. ID: ${messageId}` : 'Pedido aceite pela Meta; não foi devolvido um identificador de mensagem.' };
  }

  throw new Error('Ferramenta WhatsApp MCP não autorizada.');
}
