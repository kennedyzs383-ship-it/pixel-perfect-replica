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
- Supabase está ativo, mas deve ser usado apenas no plano Free. O painel ainda não está ligado às tabelas privadas.
- Alojamento e publicação gratuitos ainda não estão ligados.
- A aplicação não configura nem altera a autenticação do Supabase.

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
