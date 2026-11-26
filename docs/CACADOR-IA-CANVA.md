# Caçador: IA, voz e integração Canva

Esta extensão foi adicionada sem remover as funcionalidades existentes do Caçador.

## Cérebro de IA

O utilizador escolheu **Lovable AI** no formulário seguro, em vez de fornecer uma chave própria. O Caçador utiliza Gemini através do SDK Lovable AI exclusivamente em funções de servidor. Não é necessário configurar `GEMINI_API_KEY` nesta opção.

Em **Definições → Definições gerais → Chaves API → Google Gemini**, abre **Configurar Gemini** e usa **Testar ligação**. O estado **Ligado** exige uma resposta utilizável do modelo; autenticação recusada, falta de créditos, quotas, permissões e falhas de comunicação mantêm **Não ligado**. Cada reabertura verifica novamente e não guarda o resultado no navegador.

As chamadas exigem uma sessão validada no servidor, da conta Cloud ou do CRM original. A ligação original do CRM permanece separada através de `VITE_CACADOR_SUPABASE_URL` e `VITE_CACADOR_SUPABASE_PUBLISHABLE_KEY`; não são migrados dados, contas ou sessões para a infraestrutura de IA. As antigas variáveis públicas continuam compatíveis quando apontam para o mesmo projeto original.

O modelo existente é preservado. A utilização consome os créditos disponíveis no Lovable e depende das políticas de acesso e retenção de dados da conta; não existe garantia de utilização gratuita ilimitada. Não são ativados pagamentos, upgrades ou substituições automáticas de modelo. Se o Gemini for recusado pela política da conta, o teste apresenta essa limitação sem alegar sucesso.

Nunca colocar credenciais em `.env` versionado, no navegador, em variáveis `VITE_*`, em mensagens ou commits. A janela da Nuvem não recebe chaves e não simula a gravação de Secrets. Para uma futura chave própria, usar exclusivamente o formulário seguro do Lovable e publicar para atualizar a versão publicada.

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
