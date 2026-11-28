# WhatsApp do Caçador — estado da integração

## Âmbito

Esta entrega limita-se às operações WhatsApp do Caçador. Não altera o número atual, não faz migração automática, não muda o cérebro global da aplicação e não publica o frontend.

## O que está implementado

### Mensagens e inbox
- Webhook Meta com verificação HMAC-SHA256 e verificação inicial por token.
- Inbox persistente no Supabase, deduplicada por proprietário e ID da mensagem.
- RPCs atómicos para reclamar, concluir, repetir e marcar como não suportadas mensagens.
- Recuperação das mensagens pendentes a cada 15 segundos enquanto o painel autenticado está aberto; o webhook persiste as mensagens mesmo quando o painel está fechado.
- Seleção de números de clientes que já enviaram mensagens para o número ligado, diretamente no painel de chamadas.
- Ferramentas MCP para enviar texto, templates aprovados e mensagens de voz geradas por TTS. A interface exige aprovação humana antes de executar ações de envio.
- Templates aprovados podem iniciar conversas fora da janela de 24 horas, sujeitos às regras e ao consentimento da Meta.

### Chamadas e áudio
- Painel WebRTC com microfone, altifalante, chamada de saída, chamada recebida, atender, rejeitar, silenciar e terminar.
- Antes de abrir o microfone, o painel consulta a Meta para confirmar que a ação `start_call` está autorizada para aquele cliente. O servidor repete a validação antes de iniciar a chamada.
- O áudio do microfone e a voz sintetizada são misturados numa única faixa WebRTC de saída.
- A deteção de atividade de voz fecha segmentos quando o cliente faz uma pausa, em vez de cortar a fala em blocos fixos.
- A fala recebida é transcrita, enviada ao cérebro MCP atualmente configurado e a resposta é sintetizada para a chamada.
- A configuração ICE usa STUN e suporta TURN com credenciais temporárias Coturn de uma hora, se as variáveis TURN forem configuradas.
- A MCP inclui `send_audio_message`, que gera voz a partir de texto, carrega o áudio na Meta e envia a mensagem de voz após aprovação humana.

**Limite importante:** o ciclo de conversa por voz usa segmentos STT → cérebro → TTS. O transporte da chamada é WebRTC em tempo real, mas o diálogo ainda não é full-duplex de baixa latência. É necessário testar latência, interrupções e qualidade de áudio com chamadas reais.

### Multimédia recebida
- A Edge Function `whatsapp-media` valida sessão, proprietário, mensagem e media ID antes de descarregar.
- Só aceita hosts Meta autorizados, HTTPS, MIME allowlist e ficheiros até 20 MB.
- O fluxo da inbox descarrega e transcreve automaticamente os formatos de áudio suportados através do serviço STT configurado e extrai documentos `text/plain`. Imagens, PDFs, vídeos e outros formatos ainda não têm interpretador ligado; são guardados e marcados como não suportados, sem serem apresentados como processados.

## Estado no Supabase

Projeto: `O-CAÇADOR` (`emcdkxxmfqgejfmfpxwe`).

| Recurso | Estado |
|---|---|
| `whatsapp-webhook` | ACTIVE, versão 3, JWT desligado para receber webhooks Meta |
| `whatsapp-call-control` | ACTIVE, versão 5, JWT obrigatório |
| `whatsapp-media` | ACTIVE, versão 1, JWT obrigatório |
| Migration `whatsapp_inbox_messages` | Aplicada |
| Migration `whatsapp_inbox_processing` | Aplicada |
| Migration `whatsapp_inbox_unsupported_media` | Aplicada |
| Política Realtime privada | Aplicada |

A migration de estado `unsupported` já está aplicada; o painel pode usar o RPC `skip_whatsapp_inbox_message`.

## Configuração externa ainda necessária

Guardar apenas nos segredos do alojamento/Supabase, nunca no browser ou no Git:

- `WHATSAPP_OWNER_ID`
- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_GRAPH_API_VERSION`
- `WHATSAPP_VERIFY_TOKEN`
- `META_APP_SECRET`
- `CACADOR_AUDIO_API_KEY` para STT/TTS
- `WHATSAPP_CALL_PERMISSION_TEMPLATE_NAME` e `WHATSAPP_CALL_PERMISSION_TEMPLATE_LANGUAGE` para pedir autorização através de um template aprovado fora da janela de atendimento
- Opcionalmente, `WHATSAPP_TURN_URLS` e `WHATSAPP_TURN_SHARED_SECRET` para TURN Coturn com credenciais temporárias

A existência destas variáveis não foi confirmada através das ferramentas disponíveis. Os valores nunca devem ser enviados no chat.

Na Meta ainda é necessário:
1. Configurar o callback HTTPS do webhook e validar o verify token.
2. Subscrever os eventos `messages` e `calls`.
3. Ativar Calling no número Cloud API elegível.
4. Criar e obter aprovação de um template `CALL_PERMISSION_REQUEST`, se forem necessárias chamadas iniciadas pela empresa fora da janela de atendimento.
5. Confirmar que o cliente concedeu autorização e que a Meta devolve `start_call: true`.
6. Testar mensagens, envio de áudio, chamada de saída e chamada recebida com números reais.

O número de origem tem de ser elegível para Calling e estar registado na Cloud API. A coexistência com a aplicação WhatsApp Business não é assumida como compatível com chamadas API. O número Business atual não foi alterado.

## Limitações operacionais

- Os números apresentados no painel são números de clientes que já enviaram mensagens para a inbox. A Cloud API não dá acesso automático à lista privada de contactos do telemóvel.
- A inbox persiste mesmo com o painel fechado, mas a geração de respostas conversacionais continua dependente do painel autenticado estar aberto. O contexto enviado ao cérebro é isolado pelo número Cloud API de destino e pelo número do cliente: mensagens de outros clientes, de outro número Business e conversas locais não entram no contexto desta conversa.
- Mensagens iniciadas pela empresa e chamadas estão sujeitas às regras de consentimento, templates, limites e preços da Meta.
- A inbox WhatsApp possui agora seleção de cérebro isolada da IA global. O proprietário escolhe no servidor através de `CACADOR_WHATSAPP_BRAIN_PROVIDER`: `zrouter` (predefinido), `lovable` ou `openai-compatible`. A IA global da aplicação continua independente e não é alterada por esta configuração.
- Para `lovable`, configurar `LOVABLE_API_KEY` e `CACADOR_WHATSAPP_LOVABLE_MODEL`; o endpoint é o Lovable AI Gateway. Para `openai-compatible`, configurar `CACADOR_WHATSAPP_BRAIN_API_KEY`, `CACADOR_WHATSAPP_BRAIN_BASE_URL` (base HTTPS, sem `/chat/completions`) e `CACADOR_WHATSAPP_BRAIN_MODEL`. Para `zrouter`, são usadas `ZROUTER_API_KEY` e `ZROUTER_MODEL` (ou o modelo predefinido). Todas as chaves ficam apenas nas secrets do servidor.
- A seleção é por configuração do proprietário no alojamento, não por um seletor público no painel. Os providers têm de suportar a API Chat Completions e chamadas de ferramentas compatíveis; providers MCP que apenas expõem ferramentas não são, por si só, modelos de linguagem.
- Não foram feitas chamadas reais nem enviados áudios reais durante os testes automatizados.

## Código e validação

- Repositório: `kennedyzs383-ship-it/pixel-perfect-replica`
- PR: [#19 — feat/cacador-whatsapp-dual-channel](https://github.com/kennedyzs383-ship-it/pixel-perfect-replica/pull/19)
- Branch: `feat/cacador-whatsapp-dual-channel`
- A PR permanece em draft, aberta e sem merge.
- CI dos commits mais recentes, incluindo o webhook que acorda a inbox para mensagens só com multimédia: testes e build concluídos com sucesso. O isolamento do contexto por número de telefone foi acrescentado posteriormente e está a ser validado no CI.
- O frontend não foi publicado. As três Edge Functions e as migrations indicadas acima foram aplicadas no projeto Supabase.


### Aprovação e resposta pós-execução
As propostas MCP originadas numa mensagem WhatsApp preservam a origem e o identificador da conversa. Depois da aprovação humana e execução da ferramenta, o resumo do resultado volta a usar o cérebro configurado exclusivamente para WhatsApp (em vez do cérebro global) e recebe apenas o histórico daquele cliente/canal. Propostas adicionais continuam pendentes de aprovação; nenhuma ação subsequente é executada automaticamente.

## Processamento autónomo da inbox (novo, em validação na PR)

- whatsapp-inbox-worker reclama mensagens com RPC atómico e FOR UPDATE SKIP LOCKED; o painel aberto já não é necessário para iniciar o processamento.
- Cada execução percorre canais ativos registados em whatsapp_business_channels e reclama mensagens por proprietário + número Business. O histórico enviado ao cérebro é filtrado também pelo número do cliente.
- O worker usa a mesma seleção isolada do cérebro WhatsApp: CACADOR_WHATSAPP_BRAIN_PROVIDER=zrouter|lovable|openai-compatible. Não altera o cérebro global.
- O worker só prepara texto e propostas. Não executa ferramentas MCP nem chama a Meta para enviar mensagens ou iniciar chamadas.
- As propostas ficam persistidas em assistant_proposals, com o texto em assistant_draft e estado pending_approval. Ao abrir o painel autenticado, as propostas são recuperadas e apresentadas para aprovação.
- A aprovação é registada por RPC que valida auth.uid() contra owner_id. Só depois a interface executa a ferramenta MCP; se a execução falhar antes de concluir, a proposta regressa a pending_approval.
- Mensagens multimédia sem texto continuam guardadas; o worker marca-as unsupported em vez de fingir que foram interpretadas. A transcrição de áudio continua no fluxo já existente do painel.
- Falhas transitórias usam backoff exponencial; mensagens com oito tentativas passam a failed.

### Configuração do worker — ainda não ativada

Secrets adicionais no ambiente das Edge Functions:

- CACADOR_WHATSAPP_WORKER_SECRET: segredo aleatório forte, usado apenas para autenticar o cron.
- Os canais ativos e os respetivos proprietários/números Business são lidos de whatsapp_business_channels.
- A credencial do cérebro de cada canal é resolvida no Vault pelo RPC server-only; não usar uma chave global partilhada entre proprietários.

Para agendar, ativar pg_cron, pg_net e Vault no projeto de validação. Guardar o URL do projeto e o mesmo segredo do worker no Vault (não no Git nem no frontend):

```sql
select vault.create_secret('https://PROJECT_REF.supabase.co', 'cacador_project_url');
select vault.create_secret('SEGREDO_FORTE_DO_WORKER', 'cacador_whatsapp_worker_secret');

select cron.schedule(
  'cacador-whatsapp-inbox-worker',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'cacador_project_url')
      || '/functions/v1/whatsapp-inbox-worker',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cacador-worker-secret',
      (select decrypted_secret from vault.decrypted_secrets where name = 'cacador_whatsapp_worker_secret')
    ),
    body := '{"source":"pg_cron"}'::jsonb,
    timeout_milliseconds := 120000
  );
  $$
);
```

O segredo também tem de ser configurado nas secrets das Edge Functions com o nome CACADOR_WHATSAPP_WORKER_SECRET. Não usar a chave service_role como segredo do cron. Para suspender o agendamento: `select cron.unschedule('cacador-whatsapp-inbox-worker');`.

**Limite atual:** o worker já percorre canais ativos de vários proprietários, mas a gestão/onboarding de canais, executor MCP, chamadas/controlo de chamadas e seleção de canal na interface ainda não estão integralmente multi-tenant. O cron só deve ser ativado depois de migrations e Edge Functions serem instaladas num ambiente de validação e as credenciais de cada canal serem configuradas.

A migration 20261128000300_whatsapp_autonomous_worker.sql, a Edge Function whatsapp-inbox-worker e a recuperação de propostas na interface fazem parte apenas desta branch/PR. Não foram aplicadas ao projeto Supabase ativo nem publicadas.


Para o worker propor ferramentas dos outros servidores MCP configurados no Caçador, disponibilizar também CACADOR_MCP_SERVERS_JSON e cada secret referenciada por tokenEnv no ambiente das Edge Functions. A lista respeita allowedTools e só aceita endpoints HTTPS. As ferramentas continuam sem execução automática: o worker persiste a proposta e o painel autenticado exige aprovação antes de chamar o servidor MCP.


O painel também permite rejeitar explicitamente uma proposta recuperada da inbox. A rejeição é persistida com a RPC autenticada e remove a proposta da fila de aprovação; não executa qualquer ferramenta nem envia mensagem.


### Concorrência e fencing de workers

Cada reclamação autónoma recebe `processing_claim_token` (UUID) novo, gerado atomicamente pela RPC `claim_whatsapp_inbox_messages_for_worker`. Todas as gravações de conclusão, estado não suportado e retry do worker incluem simultaneamente `id`, `owner_id`, `phone_number_id`, `processing_status='processing'` e o token da reclamação. Se uma execução antiga ultrapassar o lease de cinco minutos e outra execução reclamar a mensagem, o token antigo deixa de corresponder e a execução atrasada não pode sobrescrever o estado novo. O token não é credencial de utilizador e nunca é exposto no frontend.


## Fundação multi-tenant de canais (nova etapa na PR)

A migration `20261128000400_whatsapp_multi_tenant_channels.sql` introduz `public.whatsapp_business_channels`:
- Cada canal pertence a um `owner_id`, tem um `phone_number_id` globalmente único e o respetivo `waba_id`.
- A deduplicação da inbox passa a usar `owner_id + phone_number_id + message_id`, para que a mesma conta possa receber eventos de vários números sem colidir.
- A tabela tem RLS e políticas de gestão limitadas ao proprietário autenticado.
- Identificadores Meta e proprietário ficam imutáveis depois do registo. Um canal revogado é terminal.
- Um proprietário pode registar, editar, pausar ou revogar canais, mas não pode ativá-los. A ativação exige fluxo confiável de verificação Meta, data de verificação e credenciais de canal.
- As chaves do cérebro e o token de acesso Meta são guardados no Supabase Vault. A tabela contém apenas referências opacas. O RPC de gravação valida `auth.uid()`; o RPC de leitura do segredo só permite `service_role`.
- O webhook de mensagens recebidas resolve o canal ativo pelo `metadata.phone_number_id` e confirma também que o `entry.id` corresponde ao `waba_id` registado antes de gravar a mensagem para o proprietário.
- Se a inbox contiver mais de um número Business, o painel de chamadas oculta a seleção automática de clientes recentes, evitando iniciar uma chamada pelo número legado para um contacto que entrou por outro canal.
- O CI verifica o tipo da Edge Function do webhook e executa migrations + testes pgTAP numa base Supabase local descartável, sem ligar a qualquer projeto remoto.

**Limites desta etapa:** o worker autónomo e o executor MCP ainda usam a configuração antiga de um proprietário/número por projeto. O encaminhamento de eventos de chamadas e o endpoint de controlo de chamadas também continuam ligados ao canal legado. Portanto, esta migration é a fundação de registo e encaminhamento da inbox, não declara multi-tenant completo nem ativa um segundo canal para atendimento automático. A próxima etapa deve migrar worker, envio MCP, chamadas e seleção do canal na interface para usar `channel_id` e os segredos isolados do Vault, com testes de isolamento entre dois proprietários.

A migration e o novo encaminhamento do webhook estão apenas na branch/PR. Não foram aplicados ao projeto Supabase nem publicados. Antes de aplicar, executar `supabase test db` no ambiente de validação e verificar os privilégios do Vault e os triggers. Supabase recomenda RLS em todas as tabelas expostas e testes pgTAP para confirmar as regras de acesso. 


A migration 20261128000500_whatsapp_inbox_channel_identity.sql associa cada mensagem persistida ao canal validado, com chave estrangeira composta (owner_id, channel_id). Os registos históricos são associados quando existe correspondência inequívoca de proprietário e phone_number_id; os restantes permanecem legados com channel_id nulo.
