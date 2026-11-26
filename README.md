# Nuvem

Painel pessoal e privado para organizar projetos de websites e construir páginas com um editor visual. A autenticação existente deve permanecer sem alterações.

## Regra de custos

A Nuvem deve funcionar apenas com serviços gratuitos. Não haverá compra de domínios, checkout, pagamentos, faturação, subscrições ou upgrades. Os websites publicados usarão subdomínios gratuitos do fornecedor de alojamento, sempre dentro dos limites do plano gratuito. Se um fornecedor exigir pagamento ou cartão para continuar, não será utilizado.

## O que está disponível

- Painel de projetos com criação, edição e remoção de websites.
- Construtor visual com secções de capa, texto, botões, imagens e serviços.
- Pré-visualização para computador e telemóvel.
- Edição de títulos, textos e cores.
- Rascunhos independentes por website, guardados no armazenamento local do navegador.
- Exportação de cada website como ficheiro HTML estático.
- Preferências de cor e notificações guardadas localmente.
- Verificações automáticas de testes e build através do GitHub Actions.

## Limites importantes

- Os dados de projetos e os rascunhos ficam no navegador/dispositivo onde foram criados. Limpar os dados do navegador pode apagá-los.
- Exportar HTML cria um ficheiro para publicação noutro serviço; não publica o website na internet.
- Supabase está ativo e a integração do Caçador usa Auth + Data API na tabela pública leads, com RLS por proprietário. A ligação exige as variáveis públicas indicadas em .env.example; sem elas, o Caçador mantém o modo local. O restante painel e os projetos de websites continuam em armazenamento local.
- Alojamento e publicação gratuitos ainda não estão ligados.
- A integração do Caçador utiliza o Supabase Auth existente e não altera as definições globais de autenticação. A chave service_role nunca deve ser colocada no frontend.

## Ligar o Caçador ao Supabase

1. Copia as variáveis de .env.example para o ambiente da aplicação.
2. Define VITE_SUPABASE_URL como o URL do projeto.
3. Define VITE_SUPABASE_PUBLISHABLE_KEY como a chave publishable do projeto (ou a antiga chave anon).
4. Nunca uses service_role nem uma secret key no frontend.
5. Abre /cacador, cria uma conta ou inicia sessão. Se a confirmação de email estiver ativa, confirma o email antes de iniciar sessão.

A área Caçador sincroniza empresas com public.leads. Os dados são filtrados pelas políticas RLS existentes, que verificam auth.uid() = owner_id. Os registos locais antigos são migrados apenas para a primeira conta que os reclamar neste dispositivo; as cópias locais das outras contas ficam separadas.

A integração atual cobre o CRM de empresas. Conversas, mensagens, tarefas, projetos de clientes, IA, pesquisa automática e chamadas ainda não estão ligados.

## Executar localmente

Requer Bun e uma versão recente de Node.js.

```sh
bun install --frozen-lockfile
bun run dev
```

Para validar a aplicação:

```sh
bun run test
bun run build
```

## Infraestrutura

O painel de estado da infraestrutura está disponível em `/infraestrutura`. A política de custos e o estado real estão em [docs/INFRAESTRUTURA.md](docs/INFRAESTRUTURA.md).

## Projeto

O código está sincronizado com o GitHub e pode continuar a ser editado no [Lovable](https://lovable.dev/projects/339626e4-c2d4-4c0c-b9d2-139178f40948).
