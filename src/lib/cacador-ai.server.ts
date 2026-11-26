import { generateChatCompletion, GatewayError } from '@lovable.dev/ai-gateway';
import { CACADOR_MODEL, connectedResult, failedConnection } from './cacador-connection';

const instructions = 'És o Caçador, assistente inteligente da plataforma Nuvem. Responde em português claro, preferencialmente português de Angola. Ajudas a analisar oportunidades comerciais, preparar propostas e planear websites. Nunca inventes dados de empresas nem afirmes que pesquisaste na internet se não o fizeste. Distingue factos fornecidos de hipóteses. Não envies mensagens, não contactes empresas, não publiques sites nem gastes dinheiro. Quando pedirem um website, prepara um briefing com estrutura, secções, conteúdo, estilo e versão mobile; Canva exige ligação OAuth própria.';

export async function generateCacadorAnswer(message: string, context = '', test = false) {
  try {
    const response = await generateChatCompletion({
      model: CACADOR_MODEL,
      messages: [
        { role: 'system', content: test ? 'Responde apenas: Ligação confirmada.' : instructions },
        { role: 'user', content: context ? `Contexto fornecido pelo utilizador:\n${context}\n\n${message}` : message },
      ],
      temperature: test ? 0 : 0.55,
      max_tokens: test ? 80 : 1200,
      ...(test ? { reasoning: { effort: 'none' as const } } : {}),
    }, { signal: AbortSignal.timeout(30000) });
    const answer = response.choices?.[0]?.message?.content?.trim() ?? '';
    return { answer, connection: connectedResult(answer) };
  } catch (error) {
    if (error instanceof GatewayError) {
      const status = error.httpStatus;
      const code = status === 401 ? 'configuration' : status === 403 ? 'denied' : status === 402 ? 'credits' : status === 429 ? 'quota' : error.code === 'timeout' || error.code === 'cancelled' ? 'timeout' : 'unavailable';
      return { answer: '', connection: failedConnection(code) };
    }
    return { answer: '', connection: failedConnection((error instanceof Error || error instanceof DOMException) && (error.name === 'TimeoutError' || error.name === 'AbortError') ? 'timeout' : 'unavailable') };
  }
}
