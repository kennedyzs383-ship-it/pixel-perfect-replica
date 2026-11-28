# WhatsApp do Caçador — plano de integração

## Objetivo

Disponibilizar dois canais independentes no Caçador:

1. **Número WhatsApp Business atual** — tentar ligar por coexistência oficial (WhatsApp Business app + Cloud API), mantendo a aplicação e o número, apenas se a Meta oferecer essa opção para a conta e região.
2. **Número exclusivo do Caçador** — registar um segundo número na WhatsApp Business Platform / Cloud API.

Não migrar, eliminar, desregistar nem alterar o número atual sem confirmação explícita do utilizador.

## Estado desta entrega

- Foi criada a página de preparação em `/cacador/whatsapp`.
- Os dois canais aparecem separadamente como **Por ligar**.
- A página não pede tokens, não envia mensagens e não afirma que qualquer número esteja ligado.
- Embedded Signup/OAuth e gestão isolada de credenciais por canal ainda não estão concluídos. O webhook, a inbox persistente e a sinalização de chamadas estão implementados na branch; a ativação Meta e os testes reais continuam pendentes.
- É necessário um URL público HTTPS estável antes de registar o callback e o webhook na Meta.

## Arquitetura pretendida

### Onboarding

Usar o Embedded Signup oficial da Meta para recolher consentimento e selecionar os ativos empresariais. No onboarding do número existente, escolher explicitamente a opção de coexistência se ela aparecer. Se a Meta não apresentar essa opção, parar e manter o número como está; não sugerir apagar a conta do WhatsApp Business como solução automática.

Para o número novo, usar o fluxo Cloud API normal e um número que possa receber SMS ou chamada de verificação. Não reutilizar o número atual nem assumir que um número virtual/VoIP será aceite.

### Backend e segurança

Implementar apenas em servidor:

- Callback/flow de Embedded Signup com validação de state e proteção CSRF.
- Verificação de assinatura dos webhooks Meta (`X-Hub-Signature-256`) usando o App Secret.
- Verificação inicial do webhook com o verify token.
- Tokens de acesso, App Secret, verify token e credenciais guardados apenas em variáveis secretas do alojamento e/ou armazenamento cifrado por utilizador.
- Separar os registos por proprietário Supabase; aplicar RLS e políticas de propriedade antes de expor qualquer informação à UI.
- Nunca colocar access tokens, App Secret, verify token ou service_role em `VITE_*`, código do browser, logs ou Git.
- Validar origem, tipo e tamanho dos eventos recebidos; deduplicar webhooks e limitar frequência.
- Não usar um token global partilhado pelos utilizadores.

### Modelo de dados a desenhar (não criado nesta fase)

Schema privado sugerido: `nuvem_private`.

- `whatsapp_connections`: id, owner_id, channel_kind (existing_coexistence | dedicated_cloud_api), WABA ID, phone_number_id, display_phone, status, capabilities, created_at, updated_at.
- `whatsapp_credentials`: connection_id, encrypted_access_token, token_expires_at, encryption_key_version, updated_at.
- `whatsapp_webhook_events`: event_id/idempotency_key, connection_id, event_type, received_at, processing_status; não guardar payloads sensíveis completos sem necessidade.
- `whatsapp_messages`: connection_id, provider_message_id, customer_wa_id, direction, message_type, status, timestamps, conversation metadata.
- `whatsapp_call_permissions`: connection_id, customer_wa_id, permission_status, permission_source, updated_at.

As tabelas não devem ser criadas até validar o projeto Supabase ligado, a política de retenção e a forma de cifragem das credenciais. Preferir armazenamento cifrado no servidor e acesso mínimo. A UI recebe apenas metadados e estados, nunca tokens.

### Capacidades e regras

- Receber mensagens através de webhooks e responder pela Cloud API.
- Mensagens iniciadas pela empresa só com consentimento adequado e modelos aprovados quando exigidos pela Meta.
- Respeitar a janela de atendimento, qualidade, limites e políticas da Meta.
- Chamadas: usar a WhatsApp Business Calling API apenas num número Cloud API elegível, com Calling ativado e permissão explícita do cliente. Números em coexistência com a aplicação Business não devem ser assumidos como compatíveis com chamadas API.
- Não assumir que o número ligado por coexistência suporta todas as capacidades disponíveis num número Cloud API dedicado.
- Identificar o Caçador como assistente de IA; permitir transferência para atendimento humano.
- Exigir confirmação humana para campanhas, mensagens em massa, alterações de conta e ações sensíveis.

## Dependências externas e custos

- Meta Business Portfolio e WhatsApp Business Account sob controlo do utilizador.
- Meta Developer App com produtos/permissões WhatsApp e configuração de Embedded Signup.
- URL público HTTPS estável para callback e webhooks.
- App ID, App Secret, configuração Embedded Signup, verify token e credenciais Cloud API — configurados diretamente nos segredos do alojamento, nunca enviados no chat.
- Um número separado e acessível para verificação do canal exclusivo.
- A Meta pode aplicar preços a mensagens/templates e funcionalidades de chamada conforme mercado e modelo de cobrança. A Nuvem deve mostrar custos e pedir autorização antes de ativar qualquer operação paga. Não comprar planos, créditos ou serviços sem aprovação.

## Critérios de aceitação

1. O número Business atual continua utilizável e não é alterado antes do consentimento explícito.
2. A coexistência só é considerada ligada depois de a Meta confirmar o onboarding e um teste real de mensagens.
3. O número dedicado é uma conexão separada, com o seu próprio estado e permissões.
4. Webhooks verificam assinatura, deduplicam eventos e não expõem dados de outros utilizadores.
5. Tokens não aparecem no browser, logs, respostas HTTP ou repositório.
6. Mensagens e chamadas respeitam consentimento, políticas e custos.
7. Chamadas são apresentadas como indisponíveis até o teste real confirmar a capacidade.
8. Testes automatizados cobrem webhook válido/inválido, isolamento por utilizador, eventos repetidos, erros Meta e ausência de credenciais.
9. Build Nitro/Cloudflare real é validado antes de marcar a integração como pronta.

## Referências oficiais

- WhatsApp Business Platform: https://developers.facebook.com/documentation/business-messaging/whatsapp/overview
- Meta Business: https://business.facebook.com/


## Webhook implementado na branch da PR

Foi adicionada a Edge Function `whatsapp-webhook` em `supabase/functions/whatsapp-webhook/index.ts`.

- GET: valida `hub.verify_token` com `WHATSAPP_VERIFY_TOKEN` e devolve `hub.challenge`.
- POST: valida `X-Hub-Signature-256` com HMAC-SHA256 e `META_APP_SECRET`, rejeitando assinaturas inválidas.
- O corpo é lido como texto bruto antes da validação da assinatura.
- Não regista conteúdo de mensagens nem segredos nos logs.
- Para eventos `messages`, o webhook valida a assinatura e o `phone_number_id`, persiste a mensagem na inbox com deduplicação por proprietário/ID e publica eventos de chamada em canal privado. A interpretação conversacional ocorre quando o painel autenticado recupera a inbox.

### Segredos necessários no projeto Supabase O-CAÇADOR

Configurar em Edge Functions → Secrets, sem os colocar no Git ou no frontend:

- `WHATSAPP_VERIFY_TOKEN`: token aleatório criado para a verificação do callback.
- `META_APP_SECRET`: App Secret da aplicação Meta.

A URL pública da função será `https://emcdkxxmfqgejfmfpxwe.supabase.co/functions/v1/whatsapp-webhook`, depois de a função ser publicada. A publicação ainda não foi feita porque os segredos da Meta não foram fornecidos/configurados.

O `supabase/config.toml` foi alinhado com o projeto ativo O-CAÇADOR e define `verify_jwt = false` apenas para esta função pública; a autenticação externa é feita pelo handshake e pela assinatura HMAC da Meta.


## Ferramentas WhatsApp disponíveis no cérebro MCP

O cliente MCP do Caçador inclui agora um servidor integrado identificado como `whatsapp-meta`, sem depender de um endpoint MCP externo separado. As ferramentas aparecem no painel MCP e no catálogo que o cérebro consulta:

- `get_connection_status`: verifica a presença das configurações sem expor credenciais.
- `send_text_message`: envia uma mensagem individual pela WhatsApp Cloud API. A interface exige confirmação humana antes da execução.
- `send_audio_message`: converte texto em voz com o fornecedor TTS configurado, carrega o áudio na Meta e envia-o como mensagem de voz; também exige confirmação humana.
- `send_template_message`: envia templates previamente aprovados pela Meta, com variáveis ordenadas, para iniciar conversas fora da janela de 24 horas; também exige confirmação humana.

### Secrets do servidor da aplicação

Configurar no alojamento da aplicação (não no frontend e não no Git):

- `WHATSAPP_ACCESS_TOKEN`: token de acesso da WhatsApp Cloud API.
- `WHATSAPP_PHONE_NUMBER_ID`: identificador do número registado na Cloud API.
- `WHATSAPP_GRAPH_API_VERSION`: versão Graph suportada pela app Meta, no formato `vNN.N`.

A ferramenta de envio só fica funcional quando estas três variáveis estiverem configuradas e a Meta aceitar o token e o número. A ferramenta de estado aparece mesmo antes da configuração para explicar o que falta.

### Limites desta etapa

- A MCP permite consultar a configuração e enviar texto. As mensagens recebidas são persistidas pelo webhook e encaminhadas ao Z Router pelo painel do Caçador quando este está aberto.
- O webhook valida a assinatura e persiste mensagens na inbox. O processamento conversacional não é um worker autónomo: depende do painel autenticado estar aberto para recuperar e encaminhar a mensagem ao Z Router.
- O envio está sujeito à janela de atendimento, consentimento, templates e políticas/preços Meta.
- O token configurado é uma credencial de servidor única nesta primeira etapa; antes de oferecer o Caçador a vários utilizadores, será necessário onboarding por utilizador e armazenamento cifrado isolado.
- O controlo Calling e o painel WebRTC estão na branch, mas a chamada real continua dependente de elegibilidade, configuração Meta, TURN quando necessário e teste ponta a ponta.


## Calling API adicionada ao MCP

O provider `whatsapp-meta` anuncia agora estas ferramentas de sinalização de chamadas:

- `get_call_settings`: consulta as definições Calling do número; não ativa a funcionalidade.
- `get_call_permission_status`: consulta a autorização do cliente (`user_wa_id`).
- `request_call_permission`: envia o pedido interativo oficial de autorização dentro da janela de atendimento ou usa o template `CALL_PERMISSION_REQUEST` aprovado quando `WHATSAPP_CALL_PERMISSION_TEMPLATE_NAME` está configurado; não liga automaticamente.
- `manage_voice_call`: suporta `connect`, `pre_accept`, `accept`, `reject` e `terminate`. A ação `connect` verifica primeiro a permissão na Meta. As ações que negociam áudio exigem SDP real produzido por uma stack WebRTC.

### Limite técnico explícito

O painel inclui agora o motor de áudio WebRTC no browser (microfone, altifalante, ICE e peer connection) e recebe os eventos `calls`/SDP answer pelo webhook. O áudio do cliente é segmentado por deteção de voz, transcrito, enviado ao cérebro MCP configurado e a resposta é sintetizada para a faixa de áudio da chamada. A conversa ainda é por segmentos STT/LLM/TTS, não full-duplex de baixa latência; requer teste real de qualidade, latência e interrupção. A coexistência do número Business atual não é considerada compatível com chamadas API; manter esse número sem alterações.

As chamadas iniciadas pela empresa exigem autorização explícita do cliente, obtida através do pedido de permissão ou outra forma reconhecida pela Meta. O cliente pode recusar e a permissão pode expirar. Não iniciar chamadas sem autorização nem fazer chamadas em massa.


## Sinalização de chamadas em tempo real

A Edge Function `whatsapp-webhook` encaminha eventos Meta com `field=calls` para um canal privado Supabase Realtime `whatsapp-calls:<WHATSAPP_OWNER_ID>`. A política RLS de `realtime.messages` permite receber broadcasts apenas quando o tópico corresponde ao UUID do utilizador autenticado. O SDP é encaminhado em tempo real e não é persistido numa tabela.

A rota `/cacador/whatsapp` inclui o painel de chamadas WebRTC:
- pedir permissão de chamada ao cliente;
- iniciar chamada de saída com uma oferta SDP criada no navegador;
- receber a resposta SDP da Meta pelo webhook;
- atender chamadas recebidas, criando resposta SDP e enviando `pre_accept` e `accept`;
- silenciar microfone e terminar chamada.

Foi adicionada a Edge Function autenticada `whatsapp-call-control`, que valida o JWT do utilizador, compara-o com `WHATSAPP_OWNER_ID` e executa ações Calling API sem expor o token Meta no navegador.

### Configuração adicional obrigatória

Guardar nas Edge Function Secrets, sem as colocar no código ou no chat:
- `WHATSAPP_OWNER_ID`: UUID do utilizador proprietário da conta Caçador;
- `WHATSAPP_ACCESS_TOKEN`;
- `WHATSAPP_PHONE_NUMBER_ID`;
- `WHATSAPP_GRAPH_API_VERSION` (formato `vNN.N`);
- `WHATSAPP_TURN_URLS` (opcional, URLs TURN separadas por vírgula) e `WHATSAPP_TURN_SHARED_SECRET` (opcional, segredo partilhado do Coturn para gerar credenciais temporárias de uma hora);
- `WHATSAPP_VERIFY_TOKEN`;
- `META_APP_SECRET`.

As funções também precisam das variáveis Supabase padrão `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_ANON_KEY`/ `SUPABASE_PUBLISHABLE_KEY`.

### Estado e limites

O painel e o código de sinalização WebRTC foram implementados. As Edge Functions `whatsapp-webhook` e `whatsapp-call-control` já foram implantadas no projeto Supabase e estão ACTIVE; a política RLS do canal privado também foi aplicada e verificada. Ainda não se deve considerar a chamada real ativa: faltam configurar as secrets, subscrever `calls` na app Meta, ativar Calling no número Cloud API e confirmar a elegibilidade da conta. O browser usa STUN público como configuração inicial; redes NAT restritivas podem exigir servidor TURN. O browser precisa de permissão de microfone. A função de mensagens de webhook continua fora desta fase de chamadas.


## Atualização: mensagens recebidas ligadas ao cérebro MCP

Na branch atual da PR #19 foi acrescentado o encaminhamento de mensagens recebidas:

1. A Edge Function verifica a assinatura HMAC da Meta e filtra o phone_number_id configurado.
2. Mensagens de texto e respostas interativas suportadas são encaminhadas para o tópico privado whatsapp-calls:<WHATSAPP_OWNER_ID>, no evento incoming_message.
3. O componente do cérebro em /cacador escuta esse evento e envia o texto e o contexto ao Z Router através de askCacadorWithMcpFn.
4. O Caçador apresenta a mensagem recebida e a resposta preparada. Se o Z Router propuser send_text_message, a interface exige confirmação humana antes de executar o envio pela MCP integrada whatsapp-meta.
5. O conteúdo da mensagem do cliente é tratado como dado não confiável e não pode alterar as regras do cérebro nem dispensar aprovações.

### Limitações ainda abertas

- Existe uma inbox persistente com deduplicação no servidor e recuperação quando o painel autenticado volta a abrir. Ainda não existe um worker autónomo que gere respostas enquanto o painel está fechado.
- A deduplicação persistente usa a chave `(owner_id, message_id)`; o conjunto em memória no navegador serve apenas para evitar duplicação visual durante a sessão.
- Texto e respostas interativas com texto são encaminhados ao Z Router. Áudio, imagem, vídeo e documentos são guardados com metadados, mas ainda não são descarregados nem interpretados. Agora ficam marcados como `unsupported`, não como processados.
- A Edge Function `whatsapp-media` está publicada (ACTIVE). A versão de `whatsapp-webhook` mantém a persistência e o broadcast da inbox.
- As respostas são preparadas pelo Z Router, mas não são enviadas automaticamente. A confirmação humana continua obrigatória.
- O commit anterior da branch passou 36 testes e o build Vite/Nitro/Cloudflare. As alterações mais recentes estão a aguardar a conclusão do CI da PR.


## Estado técnico atualizado — 28-11-2026

- A inbox persistente e os RPCs de claim/complete/retry estão presentes na branch e a migration base foi aplicada anteriormente no projeto Supabase.
- A migration `20261128000200_whatsapp_inbox_unsupported_media.sql` acrescenta o estado terminal `unsupported` e o RPC `skip_whatsapp_inbox_message`. Esta migration está apenas na branch; não foi aplicada ao Supabase.
- O painel já não marca multimédia não interpretada como concluída com sucesso. A mensagem fica identificada como não suportada, com motivo explícito.
- Não existe ainda worker autónomo de backend para gerar respostas com o painel fechado.
- O fluxo de áudio de chamadas usa deteção de atividade de voz e segmentos STT/TTS; não deve ser descrito como full-duplex de baixa latência.
- O envio de mensagens de voz está implementado no provider MCP, mas depende de `CACADOR_AUDIO_API_KEY`, do serviço TTS e da aceitação do formato `audio/mpeg` pela Meta.
- O envio de templates aprovados está disponível para prospeção e para iniciar conversas; os templates têm de ser previamente criados/aprovados no WhatsApp Manager e respeitar consentimento e regras de marketing.
- A chamada de permissão pode usar template aprovado fora da janela de atendimento, desde que sejam configuradas `WHATSAPP_CALL_PERMISSION_TEMPLATE_NAME` e `WHATSAPP_CALL_PERMISSION_TEMPLATE_LANGUAGE` no servidor.
- O WebRTC usa STUN público; TURN e teste real entre dois números elegíveis continuam pendentes.
- A validação CI do commit `b2008d3` passou 7/7 ficheiros de testes e builds Vite/Nitro/Cloudflare; os commits posteriores de áudio, seleção de clientes, templates e VAD ainda precisam de CI verde.
- A migration `whatsapp_inbox_unsupported_media` foi aplicada e a Edge Function `whatsapp-media` foi publicada; `whatsapp-call-control` foi atualizada para versão 3 com suporte a template de permissão.
- Não foi feito merge da PR #19 nem deploy do frontend.


## Recuperação segura de multimédia — 28-11-2026

Foi adicionada a Edge Function `whatsapp-media` na branch da PR:

- Exige sessão Supabase autenticada e valida que o utilizador corresponde ao proprietário configurado.
- Confirma que o par `message_id` / `media_id` existe na inbox desse proprietário e pertence ao número Cloud API configurado.
- Obtém o URL temporário da Meta apenas no servidor; o token nunca é enviado ao browser.
- Aceita apenas URLs HTTPS de hosts de media Meta conhecidos e bloqueia redirecionamentos.
- Limita o download a 20 MB, aplica uma lista restrita de MIME types e devolve o ficheiro sem cache, com `nosniff`.
- Não guarda cópias permanentes nem interpreta o conteúdo. A transcrição de áudio, OCR de imagens e análise de documentos continuam por implementar.
- A função foi publicada no Supabase como `whatsapp-media` versão 1 (ACTIVE). O fluxo de interpretação no painel ainda não está ligado.
