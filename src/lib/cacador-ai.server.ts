import { CACADOR_MODEL, connectedResult, failedConnection } from './cacador-connection';

type ZRouterChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
};

const instructions = 'És o Caçador, assistente inteligente da plataforma Nuvem. Responde em português claro, preferencialmente português de Angola. Ajudas a analisar oportunidades comerciais, preparar propostas e planear websites. Nunca inventes dados de empresas nem afirmes que pesquisaste na internet se não o fizeste. Distingue factos fornecidos de hipóteses. Não envies mensagens, não contactes empresas, não publiques sites nem gastes dinheiro. Quando pedirem um website, prepara um briefing com estrutura, secções, conteúdo, estilo e versão mobile; Canva exige ligação OAuth própria.';

function connectionCodeForStatus(status: number) {
  if (status === 401 || status === 404) return 'configuration' as const;
  if (status === 403) return 'denied' as const;
  if (status === 402) return 'credits' as const;
  if (status === 429) return 'quota' as const;
  return 'unavailable' as const;
}

export async function generateCacadorAnswer(message: string, context = '', test = false) {
  const apiKey = process.env.ZROUTER_API_KEY;
  if (!apiKey) return { answer: '', connection: failedConnection('configuration') };

  const model = process.env.ZROUTER_MODEL || CACADOR_MODEL;
  try {
    const response = await fetch('https://www.zrouter.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: test ? 'Responde apenas: Ligação confirmada.' : instructions },
          { role: 'user', content: context ? `Contexto fornecido pelo utilizador:\\n${context}\n\n${message}` : message },
        ],
        temperature: test ? 0 : 0.55,
        max_tokens: test ? 80 : 1200,
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      return { answer: '', connection: failedConnection(connectionCodeForStatus(response.status)) };
    }

    const payload = await response.json() as ZRouterChatResponse;
    const content = payload.choices?.[0]?.message?.content;
    const answer = (typeof content === 'string'
      ? content
      : Array.isArray(content)
        ? content.map((part) => part.text ?? '').join('\n')
        : '').trim();
    return { answer, connection: connectedResult(answer) };
  } catch (error) {
    const timeout = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    return { answer: '', connection: failedConnection(timeout ? 'timeout' : 'unavailable') };
  }
}
