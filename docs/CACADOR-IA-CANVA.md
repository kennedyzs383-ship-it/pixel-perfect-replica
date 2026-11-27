# Caçador: IA, voz e integração Canva

Esta extensão mantém as funcionalidades existentes da Nuvem e do CRM do Caçador.

## Cérebro de IA — Z Router

O Caçador usa a API compatível com OpenAI do Z Router através de uma TanStack Start Server Function. A chave é lida exclusivamente no servidor e nunca é enviada ao navegador.

- Secret obrigatória no ambiente Lovable: `ZROUTER_API_KEY`.
- Modelo predefinido: `openrouter/google/gemini-2.5-flash`.
- Secret opcional para trocar de modelo: `ZROUTER_MODEL`.
- Endpoint: `https://www.zrouter.com/v1/chat/completions`.

A chave Z Router deve permanecer em **Lovable → Secrets**. Não a coloques em ficheiros versionados, em variáveis `VITE_*`, no frontend, em mensagens ou em commits. A chave própria do Lovable pode continuar configurada; o motor do Caçador passa a usar Z Router.

O Z Router disponibiliza modelos através de uma API compatível com OpenAI. O identificador do modelo deve existir e estar autorizado na conta Z Router. Se o identificador predefinido não estiver disponível na conta, define `ZROUTER_MODEL` com o identificador exato apresentado no catálogo da conta.

**Saldo:** quando o saldo estiver a zero, o Z Router pode responder com HTTP 402. A aplicação apresenta uma mensagem clara e não tenta novamente automaticamente. Não foi feito um pedido de teste durante esta alteração para evitar uma chamada paga ou uma falha desnecessária com saldo zero.

Documentação: https://www.zrouter.com/docs/ e https://www.zrouter.com/docs/api-reference.php.

## Conversa por voz

A interface do Caçador usa as APIs de voz do navegador:

- SpeechRecognition / webkitSpeechRecognition para ouvir e transcrever o que dizes;
- SpeechSynthesis para falar a resposta em voz alta;
- o texto reconhecido é enviado automaticamente ao modelo, sem precisares de tocar novamente em Enviar.

A língua de reconhecimento e de resposta falada está definida para português (Portugal), como variante compatível próxima do português de Angola. O texto do assistente pede respostas em português de Angola.

O suporte depende do navegador, do sistema operativo, da ligação à internet e da permissão do microfone. Usa a aplicação num endereço HTTPS e permite o acesso ao microfone. Chrome atualizado é normalmente a opção mais compatível. Esta implementação é conversa por turnos, não uma chamada de áudio contínua em tempo real. A voz do navegador não consome créditos de síntese de voz do Z Router.

## Canva MCP: ativação necessária

A interface já apresenta o ponto de entrada para a ligação, mas a conta Canva ainda não está autenticada e a integração OAuth não pode ser ativada sem credenciais da aplicação.

1. Abre https://www.canva.com/developers/ e cria uma aplicação.
2. Em **Outside Canva**, escolhe **Start integrating**.
3. Em **Integration methods**, ativa **Canva MCP**.
4. Nas credenciais, obtém o Client ID e gera o Client Secret.
5. Configura a Redirect URL da aplicação Nuvem (a rota OAuth tem de ser implementada e registada antes de autorizar utilizadores).
6. O servidor remoto MCP oficial é `https://api.canva.com/connect/v1/mcp`, usando Streamable HTTP.
7. Cada utilizador autentica a sua própria conta Canva.

**Não partilhes o Client Secret em conversas, commits ou no frontend.** Guarda-o como segredo no servidor depois de implementarmos o callback OAuth. A documentação oficial é https://www.canva.dev/docs/apps/mcp/ e https://www.canva.dev/blog/developers/canva-mcp-ga/.

O Canva Free permite várias funções essenciais de geração, edição, pesquisa e exportação; algumas capacidades avançadas exigem Canva Pro. A publicação de um website completo deve ser ligada ao fluxo de exportação/hosting depois da autenticação MCP. Não está a ser declarada como concluída nesta fase.

## Limites desta fase

- O assistente conversa por texto e voz por turnos, mas depende de saldo/créditos e de um modelo disponível na conta Z Router.
- O reconhecimento e a leitura de voz dependem do navegador e das permissões locais.
- A IA ainda não executa prospeção web autónoma.
- A integração Canva MCP ainda aguarda a aplicação OAuth e as respetivas credenciais.
- O Caçador não envia contactos nem publica websites automaticamente.
- Não foi introduzido nenhum serviço pago obrigatório nem compra de domínio.
