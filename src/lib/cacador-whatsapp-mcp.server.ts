import { z } from 'zod';

const SendTextSchema = z.object({
  to: z.string().trim().regex(/^\+?[1-9]\d{7,14}$/, 'Indica o número do cliente em formato internacional, com indicativo do país.'),
  message: z.string().trim().min(1).max(4096),
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
