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

O Supabase Security Advisor reportou RLS desativado nas cinco tabelas do schema privado. Embora os privilégios do schema/tabelas estejam revogados para os papéis públicos, o Advisor exige que se decida sobre RLS. SQL proposto (a executar apenas após aprovação):

```sql
ALTER TABLE nuvem_private.websites ENABLE ROW LEVEL SECURITY;
ALTER TABLE nuvem_private.domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE nuvem_private.domain_dns_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE nuvem_private.deployments ENABLE ROW LEVEL SECURITY;
ALTER TABLE nuvem_private.infrastructure_connections ENABLE ROW LEVEL SECURITY;
```

Com RLS ligado e sem políticas, os papéis `anon` e `authenticated` continuam sem acesso; `service_role` mantém acesso privilegiado. Não criar políticas públicas para estas tabelas.

## Próximos passos técnicos

1. Confirmar que a conta do fornecedor permite publicar sem cartão e sem upgrade.
2. Ligar o repositório GitHub ao plano gratuito.
3. Configurar segredos apenas no painel seguro do fornecedor, nunca no código cliente.
4. Publicar num subdomínio gratuito e verificar HTTPS.
5. Ligar o painel Nuvem às APIs do fornecedor apenas por funções server-side protegidas e sem custos adicionais.
