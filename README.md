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
- Área Caçador para registo e gestão manual de empresas e oportunidades.
- Assistente de IA local no navegador (Wllama + Qwen2.5 0.5B Instruct quantizado), sem chave de API e sem custo por mensagem após o download inicial do modelo (cerca de 500 MB).
- Histórico das últimas 100 mensagens do assistente guardado localmente no navegador; o modelo precisa de ser ativado novamente ao reabrir a página.
- Entrada de voz pelo microfone e leitura das respostas pelo navegador, conforme o suporte e as permissões do dispositivo.
- CRM do Caçador com pipeline comercial, conversas internas/notas e tarefas.
- Verificações automáticas de testes e build através do GitHub Actions.

## Limites importantes

- Os dados de projetos e os rascunhos do construtor ficam no navegador/dispositivo onde foram criados. Limpar os dados do navegador pode apagá-los.
- Exportar HTML cria um ficheiro para publicação noutro serviço; não publica o website na internet.
- Supabase está integrado no Caçador para autenticação e sincronização dos registos de empresas, conversas, notas internas e tarefas. A ligação exige as variáveis públicas indicadas em .env.example; sem elas, o Caçador mantém o modo local.
- O restante painel e os projetos de websites continuam em armazenamento local.
- Alojamento e publicação gratuitos ainda não estão ligados.
- O assistente atual do Caçador executa o modelo Qwen2.5 0.5B localmente no navegador. O primeiro carregamento exige internet para descarregar o motor e o modelo; depois, a inferência é local. A velocidade e a qualidade dependem da memória, do processador e do navegador do dispositivo. O modelo pequeno não tem a mesma capacidade de serviços de IA avançados.
- A IA local não faz pesquisa na internet, não consulta automaticamente empresas ou websites, não envia mensagens, não acede ao Canva e não executa ações externas. A prospeção web, análise automática de websites e integração OAuth/Canva MCP ainda não estão implementadas.
- O histórico do chat fica apenas no armazenamento local do navegador e pode desaparecer se os dados do site forem limpos. Não sincroniza entre dispositivos.
- As notas internas do CRM não são mensagens enviadas ao cliente. A abertura do WhatsApp é manual e depende do telefone público registado.
- Não existe compra de domínios dentro da plataforma. A publicação futura deverá respeitar a regra de usar apenas opções gratuitas e não exigir cartão ou subscrição.
- A chave service_role e qualquer secret key nunca devem ser colocadas no frontend.

## Ligar o Caçador ao Supabase

1. Copia as variáveis de .env.example para o ambiente da aplicação.
2. Define VITE_SUPABASE_URL como o URL do projeto.
3. Define VITE_SUPABASE_PUBLISHABLE_KEY como a chave publishable do projeto (ou a antiga chave anon).
4. Nunca uses service_role nem uma secret key no frontend.
5. Abre /cacador, cria uma conta ou inicia sessão. Se a confirmação de email estiver ativa, confirma o email antes de iniciar sessão.

A área Caçador sincroniza empresas com public.leads e utiliza as tabelas public.conversations, public.messages e public.tasks para conversas, notas internas e tarefas. As políticas RLS restringem os registos ao respetivo proprietário. Os registos locais antigos são migrados apenas para a primeira conta que os reclamar neste dispositivo; as cópias locais das outras contas ficam separadas.

**Importante:** conversas e notas são registos internos do CRM. Não enviam mensagens por WhatsApp, email ou voz. A abertura do WhatsApp é manual e depende do telefone público registado.

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
