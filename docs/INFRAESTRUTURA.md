# Nuvem — infraestrutura

## Estado real em 26-11-2026

- **Base de dados:** Supabase ativo, projeto `O-CAÇADOR`, PostgreSQL 17, região `eu-west-1`.
- **Esquema Nuvem:** criado no schema privado `nuvem_private`, separado de `public`.
- **Tabelas criadas:** `websites`, `domains`, `domain_dns_records`, `deployments` e `infrastructure_connections`.
- **Domínios:** nenhum domínio foi comprado ou verificado.
- **DNS:** nenhum fornecedor DNS está ligado; não há registos reais para aplicar.
- **Alojamento/publicação:** nenhum fornecedor de deploy está ligado; exportar HTML não é publicar.
- **Email/monitorização/backups externos:** ainda não configurados.
- **Autenticação:** não foi alterada.

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

## Próximos passos de ligação

1. Ligar um fornecedor DNS/domínios (Cloudflare é uma opção) e escolher/registar o domínio pretendido.
2. Ligar um fornecedor de deploy (Railway ou Netlify) ao repositório GitHub.
3. Configurar variáveis secretas no fornecedor de deploy, nunca no código cliente.
4. Criar os registos DNS que o fornecedor de alojamento indicar; os valores dependem do projeto de deploy.
5. Ativar HTTPS/SSL no fornecedor e verificar domínio.
6. Só depois ligar o painel Nuvem às APIs do fornecedor através de funções server-side protegidas.

## Ligações

- [Projeto Supabase](https://supabase.com/dashboard/project/emcdkxxmfqgejfmfpxwe)
- [Repositório GitHub](https://github.com/kennedyzs383-ship-it/pixel-perfect-replica)
- [Projeto Lovable](https://lovable.dev/projects/339626e4-c2d4-4c0c-b9d2-139178f40948)
