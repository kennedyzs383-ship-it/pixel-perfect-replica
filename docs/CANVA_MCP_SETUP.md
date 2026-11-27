# Integração Canva MCP — plano de implementação

## Estado real

- O Caçador já tem uma camada MCP genérica em `src/lib/cacador-mcp.server.ts`.
- Essa camada suporta servidores configurados por `CACADOR_MCP_SERVERS_JSON` e, opcionalmente, um bearer token estático indicado por `tokenEnv`.
- **Essa camada ainda não implementa OAuth remoto por utilizador.** Não se deve adicionar o Canva a essa configuração como se um token estático fosse suficiente.
- A interface não deve mostrar Canva como ligado até a autorização individual e uma chamada real ao servidor terem sido confirmadas.

## Configuração Canva exigida

1. No Canva Developer Portal, manter a aplicação pública **Anyone on Canva**.
2. Em **Outside Canva → Start integrating**, ativar **Canva MCP**.
3. Guardar o **Client ID** e gerar o **Client Secret**. O segredo só pode existir em secrets do servidor.
4. Publicar a Nuvem num subdomínio HTTPS gratuito e estável.
5. Registar no Canva o callback OAuth exato que a implementação usar. Não inventar nem registar um callback antes de a rota estar implementada.
6. Endpoint MCP oficial: `https://api.canva.com/connect/v1/mcp` (Streamable HTTP).

## Implementação necessária no Caçador

- Adicionar um cliente MCP remoto compatível com OAuth (não usar o cliente HTTP simplificado atual para fingir que faz OAuth).
- Implementar início de ligação e callback OAuth no servidor, com `state` aleatório, validação anti-CSRF, validação do callback e tratamento seguro de erros.
- Usar o Client ID/Secret apenas no servidor e seguir o fluxo de autorização exigido pelo cliente MCP/Canva; não criar manualmente endpoints de autorização/token por suposição.
- Guardar credenciais/tokens por utilizador de forma cifrada no servidor, com renovação/rotação tratada pelo cliente OAuth. Nunca guardar tokens Canva em `localStorage`, no bundle do browser, no Git ou em mensagens.
- Associar cada ligação Canva ao utilizador autenticado do Caçador. Cada pessoa deve autorizar a sua própria conta Canva.
- Descobrir as ferramentas dinamicamente com `tools/list`; não assumir nomes fixos.
- Manter a aprovação explícita antes de operações que criem, alterem, exportem ou partilhem designs.
- Definir timeouts adequados para operações longas de geração/exportação e devolver links apenas quando a ferramenta confirmar sucesso.
- Adicionar testes para estado OAuth inválido, utilizador sem ligação, tokens expirados, falhas do servidor e permissões negadas.

## Secrets de servidor esperados

Os nomes finais devem ser confirmados quando a biblioteca MCP/OAuth e o callback forem implementados. Nunca colocar valores reais neste ficheiro ou em `.env.example`.

- Client ID Canva
- Client Secret Canva
- URL/callback público HTTPS da Nuvem
- Chave de cifragem para tokens OAuth, se a solução de armazenamento escolhida exigir uma

## Critério de conclusão

A integração só pode ser marcada como **Ligada** depois de:
1. a aplicação estar publicada;
2. o callback exato estar registado no Canva;
3. o utilizador concluir o consentimento OAuth;
4. o servidor conseguir listar as ferramentas Canva autenticadas desse utilizador;
5. uma operação de teste não destrutiva (por exemplo, pesquisa de designs) devolver uma resposta válida.

Até lá, o estado correto é **A aguardar publicação e configuração OAuth**.

## Fontes oficiais

- Canva Quickstart: https://www.canva.dev/docs/apps/quickstart/
- Access and permissions: https://www.canva.dev/docs/apps/mcp/access/
- Canva MCP overview and integration guidance: https://www.canva.dev/blog/developers/canva-mcp-ga/


## Nota técnica confirmada: cliente MCP com OAuth

A implementação atual em `src/lib/cacador-mcp.server.ts` faz JSON-RPC diretamente e aceita apenas bearer token opcional. Isso não executa descoberta OAuth, PKCE, callback, troca de código ou renovação; portanto, não deve ser usado para autenticar o Canva.

A documentação atual do MCP TypeScript SDK descreve o cliente Streamable HTTP com um `OAuthClientProvider`:

- Criar um provider por utilizador autenticado, nunca partilhar o mesmo estado OAuth entre contas.
- O provider persiste, por utilizador, os dados de cliente, tokens, verifier PKCE e estado de descoberta do issuer.
- Fornecer as credenciais pré-registadas da aplicação Canva através de `clientInformation()` (Client ID e Client Secret do Developer Portal), em vez de assumir que o Canva permite registo dinâmico do cliente.
- Usar `StreamableHTTPClientTransport` para `https://api.canva.com/connect/v1/mcp`, passando o provider em `authProvider`.
- Quando o SDK devolver `UnauthorizedError`, redirecionar o utilizador para o URL de autorização que o provider recebeu.
- No callback, validar o `state` guardado para a mesma sessão/utilizador antes de chamar `finishAuth(URLSearchParams)`. O SDK valida o parâmetro `iss` e efetua a troca do código; não mostrar `error_description` não confiável ao utilizador.
- Reconectar com um transporte novo depois de concluir o callback.
- Guardar tokens e estado temporário de forma durável e cifrada no servidor; nunca usar armazenamento local do browser nem memória de processo como armazenamento de produção.

A biblioteca e a versão devem ser adicionadas ao projeto apenas depois de confirmar compatibilidade com o runtime de produção (Nitro/Cloudflare) e com o lockfile. O provider precisa de um adaptador de armazenamento compatível com esse runtime. Não copiar exemplos de armazenamento em memória para produção.

**Fontes técnicas:** MCP TypeScript SDK — OAuth client flow: https://ts.sdk.modelcontextprotocol.io/v2/clients/oauth ; Canva Quickstart: https://www.canva.dev/docs/apps/quickstart/ ; Canva access and permissions: https://www.canva.dev/docs/apps/mcp/access/

## Decisão de segurança

Não adaptar `CACADOR_MCP_SERVERS_JSON` para guardar um token Canva global. A integração Canva deve ter um caminho OAuth dedicado e tokens separados por utilizador. A camada MCP genérica existente continua disponível para os outros servidores, sem alteração do comportamento atual.
