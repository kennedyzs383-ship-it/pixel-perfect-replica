# Caçador: IA, voz e integração Canva

Esta extensão foi adicionada sem remover as funcionalidades existentes do Caçador.

## Cérebro de IA

O assistente usa a Gemini Developer API através de uma TanStack Start Server Function. A chave fica exclusivamente no servidor.

1. Cria uma chave em https://aistudio.google.com/app/apikey.
2. No ambiente de deploy da Nuvem, adiciona o segredo `GEMINI_API_KEY`.
3. Faz novo deploy para disponibilizar a variável ao servidor.

Não coloques a chave em `.env` versionado, no navegador, em variáveis `VITE_*`, nem em mensagens ou commits.

O modelo configurado é `gemini-2.5-flash`. A disponibilidade e os limites gratuitos dependem da conta, região e quotas do Google. Na camada gratuita, consulta as condições de privacidade do Google antes de enviares dados comerciais confidenciais: https://ai.google.dev/gemini-api/terms.

## Voz

A interface usa as APIs de voz do navegador:
- SpeechRecognition / webkitSpeechRecognition para transcrever a fala;
- SpeechSynthesis para ler as respostas.

O suporte depende do navegador, do sistema operativo, da ligação à internet e das permissões do microfone. A experiência mais compatível é normalmente no Chrome atualizado. A voz não é uma chamada telefónica nem uma sessão de áudio contínua em tempo real.

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

- A IA conversa e ajuda a planear, mas ainda não executa prospeção web autónoma.
- O microfone e a leitura de voz dependem do navegador.
- A integração Canva MCP ainda aguarda a aplicação OAuth e as respetivas credenciais.
- O Caçador não envia contactos nem publica websites automaticamente.
- Não foi introduzido nenhum serviço pago obrigatório nem compra de domínio.
