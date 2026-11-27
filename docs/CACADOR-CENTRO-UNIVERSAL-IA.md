# Centro Universal de IA do Caçador

## Fornecedores disponíveis nesta versão

- **Qwen/Wllama no navegador:** modelo local já existente. O primeiro carregamento descarrega o motor e o modelo; depois, as respostas são geradas no dispositivo.
- **Ollama:** adaptador compatível com a API local do Ollama (/api/tags e /api/chat). O utilizador configura o endereço e o nome do modelo em Definições gerais. A configuração fica no armazenamento local do navegador; nenhuma chave é pedida ou guardada.
- **Z Router:** usa a integração server-side já existente e a secret ZROUTER_API_KEY gerida pelo Lovable. A seleção exige uma sessão Caçador válida. Custos, créditos e limites dependem do fornecedor.

## Ligar Ollama

1. Instalar Ollama no computador ou servidor que vai executar o modelo.
2. Descarregar um modelo, por exemplo `ollama pull qwen2.5:0.5b`.
3. Abrir Nuvem → Definições gerais → Centro Universal de IA.
4. Indicar o endereço acessível a partir do navegador e o identificador exato do modelo.
5. Guardar e testar a ligação. No Caçador, escolher **Ollama** no seletor do assistente.

**Importante:** localhost significa o próprio dispositivo que está a abrir o navegador. Num telemóvel, http://localhost:11434 aponta para o telemóvel, não para o computador. Para um servidor remoto, usar o endereço de rede apropriado e configurar CORS e firewall para permitir apenas origens/dispositivos confiáveis. Não expor o Ollama diretamente à Internet.

## Arquitetura e limites

O seletor de modelos é separado da camada de ferramentas. Esta alteração prepara o centro de modelos e acrescenta Ollama; não instala ainda um cliente MCP nem liga servidores MCP. MCP é um protocolo de ferramentas/contexto, não um fornecedor de modelos. Uma implementação MCP real deve correr no servidor, autenticar cada ligação, validar permissões por ferramenta, limitar destinos de rede e pedir confirmação para ações externas.

GPT, Claude, Gemini e outros fornecedores cloud não ficam gratuitos por aparecerem no seletor. Cada integração pode exigir credenciais, autorização, limites ou pagamento. As chaves devem permanecer em secrets server-side geridas pelo Lovable, nunca em localStorage ou no código do navegador.

A IA Qwen existente não foi removida nem substituída.
