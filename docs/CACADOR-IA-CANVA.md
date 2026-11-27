# Caçador: Z Router, voz e integração Canva

Esta extensão mantém a autenticação, o CRM, o editor e as restantes funcionalidades existentes da Nuvem.

## Cérebro de IA — Z Router

O Caçador usa a API compatível com OpenAI do Z Router através de uma função executada exclusivamente no servidor.

- Secret obrigatória no Lovable: `ZROUTER_API_KEY`.
- Modelo predefinido: `openrouter/baidu/ernie-5.5-flash-preview:free`.
- Modelo alternativo opcional: `ZROUTER_MODEL`, usando o identificador exato do catálogo da conta.
- Endpoint: `https://www.zrouter.com/v1/chat/completions`.

A chave privada deve ficar em **Lovable → Secrets**. Nunca a coloques em ficheiros versionados, em variáveis `VITE_*`, no frontend, em mensagens ou em commits. A chave própria do Lovable pode continuar configurada; o cérebro do Caçador usa Z Router como fornecedor principal.

O teste de ligação e a conversa usam exatamente o mesmo fornecedor e modelo. O estado **Ligado** só aparece depois de uma resposta não vazia. Erros de autenticação, modelo, saldo, quota e comunicação são apresentados sem expor a chave ou detalhes internos. Não há repetição automática nem fallback para Lovable AI.

O catálogo da conta indica este modelo como chat gratuito (preço de entrada e saída a zero). A disponibilidade pode mudar e o identificador deve continuar autorizado na conta. O identificador inicial foi selecionado a partir do catálogo Z Router: `openrouter/baidu/ernie-5.5-flash-preview:free`.

**Saldo zero:** quando o Z Router não tem saldo/crédito suficiente, a API pode devolver HTTP 402. O Caçador mostra que a ligação está configurada mas sem crédito para responder. Não ativa pagamentos, recargas ou upgrades e não tenta outro fornecedor. Não foi feita uma chamada real de teste durante esta alteração para evitar consumo ou uma falha desnecessária com saldo zero.

Documentação: https://www.zrouter.com/docs/ e https://www.zrouter.com/docs/api-reference.php.

## Conversa por voz

A interface usa as APIs de voz do navegador:

- SpeechRecognition / webkitSpeechRecognition para ouvir e transcrever a fala;
- SpeechSynthesis para ler as respostas;
- a fala reconhecida é enviada automaticamente ao modelo, sem um segundo toque em Enviar.

A língua de reconhecimento e da leitura está definida para português (Portugal), uma opção de compatibilidade próxima do português de Angola. O assistente é instruído a responder em português de Angola.

O suporte depende do navegador, do sistema operativo, da ligação à internet e da permissão do microfone. Usa a aplicação num endereço HTTPS e permite o acesso ao microfone. Chrome atualizado é normalmente a opção mais compatível. A implementação é conversa por turnos, não uma chamada de áudio contínua em tempo real. O reconhecimento e a leitura de voz do navegador não usam créditos de síntese de voz do Z Router.

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

- A conversa por IA depende de uma chave válida, modelo autorizado e saldo/crédito Z Router.
- O microfone e a leitura de voz dependem do navegador e das permissões locais.
- A IA ainda não executa prospeção web autónoma.
- A integração Canva MCP ainda aguarda a aplicação OAuth e as respetivas credenciais.
- O Caçador não envia contactos nem publica websites automaticamente.
- Não foi introduzido nenhum serviço pago obrigatório nem compra de domínio.
