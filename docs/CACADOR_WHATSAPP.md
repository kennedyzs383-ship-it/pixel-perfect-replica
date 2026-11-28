# WhatsApp do Caçador — estado da integração

## Âmbito

Esta entrega limita-se às operações WhatsApp do Caçador. Não altera o número atual, não faz migração automática, não muda o cérebro global da aplicação e não publica o frontend.

## O que está implementado

### Mensagens e inbox
- Webhook Meta com verificação HMAC-SHA256 e verificação inicial por token.
- Inbox persistente no Supabase, deduplicada por proprietário e ID da mensagem.
- RPCs atómicos para reclamar, concluir, repetir e marcar como não suportadas mensagens.
- Recuperação das mensagens quando o painel autenticado está aberto.
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
- A recuperação segura está publicada, mas a transcrição automática de áudios recebidos e a análise de imagens/documentos ainda não estão ligadas ao fluxo da inbox.

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
- A inbox persiste mesmo com o painel fechado, mas a geração de respostas conversacionais continua dependente do painel autenticado estar aberto.
- Mensagens iniciadas pela empresa e chamadas estão sujeitas às regras de consentimento, templates, limites e preços da Meta.
- O cérebro chamado pela integração WhatsApp é o provider MCP existente; a seleção global entre diferentes inteligências não foi alterada nesta entrega.
- Não foram feitas chamadas reais nem enviados áudios reais durante os testes automatizados.

## Código e validação

- Repositório: `kennedyzs383-ship-it/pixel-perfect-replica`
- PR: [#19 — feat/cacador-whatsapp-dual-channel](https://github.com/kennedyzs383-ship-it/pixel-perfect-replica/pull/19)
- Branch: `feat/cacador-whatsapp-dual-channel`
- A PR permanece em draft, aberta e sem merge.
- CI do commit `4803d990`: 7/7 ficheiros de testes, 41/41 testes e builds Vite/Nitro/Cloudflare concluídos com sucesso. Os commits posteriores ainda precisam de validação CI.
- O frontend não foi publicado. As três Edge Functions e as migrations indicadas acima foram aplicadas no projeto Supabase.
