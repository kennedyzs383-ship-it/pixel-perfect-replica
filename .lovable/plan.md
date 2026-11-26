# Website premium para restaurante em Luanda

## Objetivo
Construir um website completo em português, com apresentação comercial sofisticada, prioridade ao telemóvel e funcionalidades reais de menu, carrinho e preparação de solicitações pelo WhatsApp.

## Identidade e transparência
- Usar provisoriamente **Restaurante — Demonstração**, sem atribuir um nome oficial não fornecido.
- Centralizar nome, logótipo, fotografias, pratos, preços, disponibilidade, contactos, endereço e horários numa configuração editável.
- Identificar pratos, preços, fotografias de referência e textos institucionais como demonstrativos. Não apresentar imagens de interiores como fotografias do restaurante real.
- Não inventar contactos, localização exata, horários, avaliações, história, prémios ou credenciais.
- Incluir discretamente no rodapé: “Demonstração digital desenvolvida pela Visão Negócios Digitais.”

## Direção visual
- Design editorial gastronómico: preto profundo, creme e dourado discreto, com cores naturais das fotografias.
- Títulos em **Cormorant Garamond** e textos em **Manrope**, legíveis em ecrãs pequenos.
- Fotografia gastronómica de grande impacto a ocupar a abertura, com o nome em destaque e texto sobreposto, navegação transparente e ações **Explorar Menu** e **Fazer Reserva**.
- Secções escuras alternadas com superfícies claras, margens generosas, linhas finas, cartões discretos e animações suaves que respeitem a redução de movimento.
- Fotografias de alta qualidade, otimizadas e identificadas como referências demonstrativas; sem exigir chaves ou serviços pagos para apresentar o site.

## Páginas e navegação
1. **Início — /**: abertura fotográfica, introdução editorial, seleção de pratos e ligações para as restantes páginas.
2. **O restaurante — /restaurante**: proposta de ambiente, filosofia e experiência com textos demonstrativos, sem histórias inventadas.
3. **Menu — /menu**: catálogo completo e interativo.
4. **Galeria — /galeria**: pratos e ambientes de referência, com ampliação de imagens.
5. **Reservas — /reservas**: solicitação de mesa e preparação da mensagem.
6. **Contactos — /contactos**: localização, horários e canais, mostrando claramente os dados ainda por definir.

Cabeçalho e rodapé partilhados, indicação da página ativa, menu móvel funcional e acesso ao carrinho em todas as páginas.

## Funcionalidades

### Menu digital
- Incluir entradas, pratos principais, grelhados, especialidades da casa, sobremesas e bebidas, com exemplos em todas as categorias.
- Cada prato terá fotografia, nome, descrição, categoria e preço demonstrativo em Kz; mostrar disponibilidade quando configurada.
- Pesquisa por nome e descrição, filtros por categoria e estado sem resultados.
- Detalhe ampliado do prato e adição ao carrinho; itens indisponíveis não poderão ser adicionados.

### Carrinho e pedidos
- Adicionar e remover pratos, alterar quantidades, consultar valores por linha e subtotal em Kz.
- Manter o carrinho durante a navegação, sem simular registo permanente de encomendas.
- Recolher nome, telefone e observações do cliente, validar os campos e preparar uma mensagem com produtos, quantidades, valores e subtotal.
- Permitir rever e copiar a mensagem. Abrir o WhatsApp apenas quando existir um número oficial configurado.
- Sem número configurado, informar que o contacto precisa de ser definido; nunca mostrar um pedido como enviado ou confirmado.
- Não incluir pagamentos, autenticação ou painel administrativo fictício.

### Reservas
- Formulário com nome, telefone, data, hora, número de pessoas e observações.
- Validar campos obrigatórios, telefone, número positivo de pessoas e data/hora futura segundo o fuso de Luanda.
- Sem horários oficiais, permitir indicar um horário pretendido, sem o apresentar como disponibilidade confirmada.
- Preparar mensagem para revisão e envio pelo WhatsApp configurado, com alternativa de copiar.
- Explicar que a reserva depende da resposta do restaurante; sem confirmação automática e sem alegar envio quando apenas se preparou a mensagem.

### Galeria, localização e contactos
- Galeria com ampliação, navegação entre imagens, fecho por Escape e utilização por toque e teclado.
- Mostrar Luanda, Angola como localização geral; endereço e horários ficam por confirmar.
- Mapa e direções apenas quando existir localização confirmada.
- Ativar telefone, WhatsApp, email e redes sociais apenas quando os dados forem configurados; não criar links fictícios.

## Qualidade e verificação
- Testar navegação, ligações, filtros, pesquisa, detalhes, galeria, carrinho, quantidades e cálculos.
- Testar validação dos formulários, conteúdo das mensagens, ausência de WhatsApp configurado e geração correta das ligações com número de teste, sem contactar terceiros.
- Acrescentar testes automáticos para subtotais, disponibilidade, validações e regras de preparação/envio das mensagens.
- Verificar visualmente em computador e telemóveis, incluindo **390 × 844** e um Android estreito, corrigindo cortes, sobreposições e deslocamento horizontal.
- Garantir botões acessíveis, foco visível, etiquetas de formulário, contraste, alternativas textuais e carregamento adiado das imagens secundárias.
- Definir título, descrição e metadados sociais próprios em cada página. Não publicar dados estruturados de um restaurante fictício; ativar dados estruturados de restaurante apenas quando houver identidade verificada.
- Rever erros da aplicação e testar o percurso completo: encontrar um prato → adicionar → alterar quantidade → preparar pedido; e preencher reserva → rever mensagem → apresentar corretamente a condição do contacto.

## Organização técnica
- Preservar React, TypeScript, TanStack Start e Tailwind, reutilizando os componentes de interface disponíveis e evitando dependências desnecessárias.
- Separar cabeçalho, abertura, apresentação, menu, galeria, reservas, pedidos, localização, contactos e rodapé em componentes reutilizáveis.
- Usar configuração central tipada, funções testáveis para cálculos/validações/mensagens e estado partilhado do carrinho.
- Definir cores e estilos através de tokens semânticos e servir as imagens pelo fluxo de recursos do projeto.
- Esta versão não requer base de dados nem serviço de envio: prepara solicitações para o cliente enviar pelo WhatsApp e não armazena reservas ou pedidos no restaurante.

## Dados pendentes, sem bloquear a demonstração
Nome e logótipo reais, WhatsApp e restantes contactos, endereço, horários, fotografias próprias e menu/preços aprovados. A demonstração continuará utilizável para explorar, montar pedidos e preparar mensagens, mas não permitirá enviar ao restaurante até existir contacto oficial configurado.