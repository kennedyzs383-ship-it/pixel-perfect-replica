# Nuvem — infraestrutura gratuita

## Regra permanente do projeto

A Nuvem é um painel privado de uso pessoal. A infraestrutura deve permanecer gratuita:
- Não comprar, renovar ou transferir domínios.
- Usar subdomínios gratuitos fornecidos pelo alojamento (por exemplo, `nome.pages.dev`).
- Não adicionar checkout, pagamentos, faturação, subscrições ou compras dentro da Nuvem.
- Não ativar planos pagos, upgrades, serviços com cobrança por utilização ou recursos que exijam pagamento.
- Se um fornecedor pedir cartão, pagamento ou upgrade para continuar, parar e escolher outra opção.
- Respeitar sempre os limites do plano gratuito. Não prometer disponibilidade ilimitada nem gratuidade eterna do fornecedor.

## Estado real em 26-11-2026

- **Base de dados:** Supabase ativo, projeto `O-CAÇADOR`, PostgreSQL 17, região `eu-west-1`. Usar apenas o plano Free e respeitar os seus limites.
- **Esquema Nuvem:** criado no schema privado `nuvem_private`, separado de `public`.
- **Tabelas criadas:** `websites`, `domains`, `domain_dns_records`, `deployments` e `infrastructure_connections`.
- **Endereço web:** nenhum subdomínio de publicação foi criado ou verificado.
- **Alojamento/publicação:** nenhum fornecedor de deploy está ligado; exportar HTML não é publicar.
- **Ficheiros:** as imagens do editor continuam nos rascunhos locais do navegador; armazenamento remoto gratuito ainda não configurado.
- **Email pago/profissional:** fora do âmbito.
- **Autenticação:** não foi alterada.

## Opção de publicação a avaliar

Cloudflare Pages oferece subdomínios `pages.dev` e um plano gratuito sujeito aos limites e termos atuais do fornecedor. A Nuvem só deverá usar a opção gratuita. Não adicionar domínio próprio nem funcionalidades de compra. Confirmar sempre os limites atuais antes de ligar a publicação.

- [Cloudflare Pages](https://pages.cloudflare.com/)
- [Limites e preços Supabase](https://supabase.com/pricing)
- [Projeto Supabase](https://supabase.com/dashboard/project/emcdkxxmfqgejfmfpxwe)
- [Repositório GitHub](https://github.com/kennedyzs383-ship-it/pixel-perfect-replica)
- [Projeto Lovable](https://lovable.dev/projects/339626e4-c2d4-4c0c-b9d2-139178f40948)

## Segurança

O schema `nuvem_private` não concede acesso a `anon` nem a `authenticated`; o acesso SQL está reservado a `service_role`. Nunca colocar a chave `service_role` no navegador ou em variáveis `VITE_*`.

As cinco tabelas do schema privado têm RLS ativado e não têm políticas. Além disso, confirmei que `anon` e `authenticated` não têm USAGE no schema nem SELECT nas tabelas. Portanto, estes papéis não conseguem aceder aos dados; `service_role` mantém acesso privilegiado. Não criar políticas públicas para estas tabelas. O aviso do Advisor sobre "RLS enabled no policy" é informativo neste contexto, pois a intenção é manter o schema fechado.

O Security Advisor também indica que a proteção de palavras-passe comprometidas está desativada. Esta opção depende da configuração Auth do projeto e não está disponível nas ferramentas de gestão conectadas; deve ser ativada manualmente em [Auth → Settings → Password Security](https://supabase.com/dashboard/project/emcdkxxmfqgejfmfpxwe/auth/users).

## Próximos passos técnicos

1. Confirmar que a conta do fornecedor permite publicar sem cartão e sem upgrade.
2. Ligar o repositório GitHub ao plano gratuito.
3. Configurar segredos apenas no painel seguro do fornecedor, nunca no código cliente.
4. Publicar num subdomínio gratuito e verificar HTTPS.
5. Ligar o painel Nuvem às APIs do fornecedor apenas por funções server-side protegidas e sem custos adicionais.
