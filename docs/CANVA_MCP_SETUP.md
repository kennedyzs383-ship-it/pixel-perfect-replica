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
