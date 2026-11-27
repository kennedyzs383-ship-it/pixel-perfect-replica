# Centro Universal de IA do Caçador

## Fornecedores disponíveis

- **Qwen/Wllama no navegador:** modelo local já existente. O primeiro carregamento descarrega o motor e o modelo; depois, as respostas são geradas no dispositivo.
- **Ollama:** adaptador compatível com a API local do Ollama (`/api/tags` e `/api/chat`). O utilizador configura o endereço e o nome do modelo em Definições gerais. A configuração fica no armazenamento local do navegador; nenhuma chave é pedida ou guardada.
- **Z Router:** usa a integração server-side já existente e a secret `ZROUTER_API_KEY`. Custos, créditos e limites dependem do fornecedor.

## Ligar Ollama

1. Instalar Ollama no computador ou servidor que vai executar o modelo.
2. Descarregar um modelo, por exemplo `ollama pull qwen2.5:0.5b`.
3. Abrir Nuvem → Definições gerais → Centro Universal de IA.
4. Indicar o endereço acessível a partir do navegador e o identificador exato do modelo.
5. Guardar e testar a ligação. No Caçador, escolher **Ollama** no seletor do assistente.

**Importante:** `localhost` significa o próprio dispositivo que está a abrir o navegador. Num telemóvel, `http://localhost:11434` aponta para o telemóvel, não para o computador. Para um servidor remoto, usar o endereço de rede apropriado e configurar CORS e firewall para permitir apenas origens/dispositivos confiáveis. Não expor o Ollama diretamente à Internet.

## Ligar servidores MCP remotos

O Caçador agora tem um cliente MCP HTTP no servidor, com descoberta de ferramentas e execução explícita. Para ativar servidores, define a variável de ambiente `CACADOR_MCP_SERVERS_JSON` no ambiente de deploy (por exemplo, nas secrets/variáveis do Lovable). Exemplo de configuração:

```json
[
  {
    "id": "docs",
    "name": "Servidor de documentos",
    "url": "https://mcp.example.com/mcp",
    "tokenEnv": "MCP_DOCS_TOKEN",
    "allowedTools": ["search_docs", "get_document"]
  }
]
```

Define também `MCP_DOCS_TOKEN` como secret se o servidor exigir Bearer token. O `id` deve ser único; `allowedTools` é uma lista explícita de nomes de ferramentas que o Caçador pode expor. O endereço deve ser HTTPS em produção. O navegador nunca escolhe o URL nem recebe o token. Depois do deploy, inicia sessão no Caçador, abre Centro Universal de IA e atualiza a lista de ferramentas. Cada execução exige confirmação e os argumentos são enviados como JSON.

Esta versão usa MCP Streamable HTTP (initialize, tools/list e tools/call). Servidores MCP por STDIO ou transporte legado SSE não são suportados por este adaptador. A configuração é administrativa e deve conter apenas servidores de confiança. Não coloques tokens no código-fonte nem no JSON de configuração; usa `tokenEnv` para apontar para uma secret.

## Arquitetura e limites

O seletor de modelos é separado da camada de ferramentas. MCP é um protocolo de ferramentas/contexto, não um fornecedor de modelos. Nesta etapa, as ferramentas podem ser descobertas e executadas a partir do painel MCP; ainda não são chamadas automaticamente pelo modelo durante uma conversa.

GPT, Claude, Gemini e outros fornecedores cloud não ficam gratuitos por aparecerem no seletor. Cada integração pode exigir credenciais, autorização, limites ou pagamento. As chaves devem permanecer em secrets server-side, nunca em localStorage ou no código do navegador.

A IA Qwen existente não foi removida nem substituída.
