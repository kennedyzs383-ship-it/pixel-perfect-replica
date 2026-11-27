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
- OAuth/Embedded Signup, endpoints de webhook, persistência de tokens e chamadas ainda não foram implementados.
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
- Chamadas: implementar apenas depois de verificar a disponibilidade do produto WhatsApp Business Calling para a conta, região e tipo de número; recolher permissão do cliente antes de iniciar chamadas.
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
- Por enquanto, apenas confirma a receção de eventos válidos. A persistência, deduplicação e processamento de mensagens continuam desativados até existir um modelo de dados com isolamento por proprietário e política de retenção aprovada.

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

### Secrets do servidor da aplicação

Configurar no alojamento da aplicação (não no frontend e não no Git):

- `WHATSAPP_ACCESS_TOKEN`: token de acesso da WhatsApp Cloud API.
- `WHATSAPP_PHONE_NUMBER_ID`: identificador do número registado na Cloud API.
- `WHATSAPP_GRAPH_API_VERSION`: versão Graph suportada pela app Meta, no formato `vNN.N`.

A ferramenta de envio só fica funcional quando estas três variáveis estiverem configuradas e a Meta aceitar o token e o número. A ferramenta de estado aparece mesmo antes da configuração para explicar o que falta.

### Limites desta etapa

- Esta integração MCP permite consultar configuração e enviar texto; ainda não processa mensagens recebidas no cérebro.
- O webhook atual apenas valida a assinatura e confirma a receção; não persiste nem encaminha mensagens.
- O envio está sujeito à janela de atendimento, consentimento, templates e políticas/preços Meta.
- O token configurado é uma credencial de servidor única nesta primeira etapa; antes de oferecer o Caçador a vários utilizadores, será necessário onboarding por utilizador e armazenamento cifrado isolado.
- Não há integração de chamadas nesta etapa.
