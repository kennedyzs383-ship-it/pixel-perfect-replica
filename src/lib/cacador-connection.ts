export const CACADOR_MODEL = 'google/gemini-2.5-flash' as const;
export type ConnectionCode = 'connected' | 'unverified' | 'auth' | 'configuration' | 'denied' | 'quota' | 'credits' | 'timeout' | 'empty' | 'unavailable';
export type CacadorConnection = { connected: boolean; code: ConnectionCode; message: string; checkedAt: string | null };
export const initialConnection: CacadorConnection = { connected: false, code: 'unverified', message: 'Ligação ainda não verificada.', checkedAt: null };
export function failedConnection(code: Exclude<ConnectionCode, 'connected' | 'unverified'>): CacadorConnection {
  const messages = {
    auth: 'Inicia sessão no Caçador para testar e utilizar a IA.',
    configuration: 'A ligação ao Lovable AI precisa de ser configurada no projeto.',
    denied: 'O acesso a este modelo Gemini foi recusado pelas permissões ou pela política de dados da conta. Revê os controlos de IA no Lovable.',
    quota: 'O limite de utilização foi atingido. Aguarda antes de voltar a tentar.',
    credits: 'Não existem créditos de IA disponíveis. Não foi ativado qualquer pagamento.',
    timeout: 'A verificação demorou demasiado. Não foi repetida automaticamente.',
    empty: 'O Gemini não devolveu uma resposta utilizável.',
    unavailable: 'Não foi possível contactar o Gemini. Tenta novamente mais tarde.',
  };
  return { connected: false, code, message: messages[code], checkedAt: new Date().toISOString() };
}
export function connectedResult(answer: string): CacadorConnection {
  return answer.trim() ? { connected: true, code: 'connected', message: 'O Gemini respondeu ao pedido.', checkedAt: new Date().toISOString() } : failedConnection('empty');
}
