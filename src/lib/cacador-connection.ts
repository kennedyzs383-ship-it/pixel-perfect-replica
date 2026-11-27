export const CACADOR_MODEL = 'openrouter/baidu/ernie-5.5-flash-preview:free' as const;
export type ConnectionCode = 'connected' | 'unverified' | 'auth' | 'configuration' | 'denied' | 'quota' | 'credits' | 'timeout' | 'empty' | 'unavailable';
export type CacadorConnection = { connected: boolean; code: ConnectionCode; message: string; checkedAt: string | null };
export const initialConnection: CacadorConnection = { connected: false, code: 'unverified', message: 'Ligação ainda não verificada.', checkedAt: null };
export function failedConnection(code: Exclude<ConnectionCode, 'connected' | 'unverified'>): CacadorConnection {
  const messages = {
    auth: 'Inicia sessão no Caçador para testar e utilizar a IA.',
    configuration: 'A secret ZROUTER_API_KEY não está configurada ou a chave/modelo foi recusado pelo Z Router.',
    denied: 'O Z Router não autorizou o acesso ao modelo. Verifica as permissões da tua conta.',
    quota: 'O limite de utilização do Z Router foi atingido. Não foi feita nenhuma repetição automática.',
    credits: 'O saldo/crédito do Z Router é zero ou insuficiente. A integração está configurada, mas a IA não pode responder até existir crédito disponível.',
    timeout: 'A verificação demorou demasiado. Não foi repetida automaticamente.',
    empty: 'O Z Router não devolveu uma resposta utilizável.',
    unavailable: 'Não foi possível contactar o Z Router. Tenta novamente mais tarde.',
  };
  return { connected: false, code, message: messages[code], checkedAt: new Date().toISOString() };
}
export function connectedResult(answer: string): CacadorConnection {
  return answer.trim()
    ? { connected: true, code: 'connected', message: 'O Z Router respondeu ao pedido.', checkedAt: new Date().toISOString() }
    : failedConnection('empty');
}
