# Google Gemini nas definições da Nuvem

## Objetivo
Adicionar **Definições gerais → Chaves API → Google Gemini**, com teste real de ligação e utilização pelo Caçador, preservando o painel, o editor, os dados e as funcionalidades existentes.

## Configuração segura acordada
- Introduzir a chave exclusivamente no **formulário seguro do Lovable**, guardando-a como `GEMINI_API_KEY`.
- Antes de solicitar a chave, verificar apenas se o segredo já está configurado. Se existir, reutilizá-lo; para substituir, usar o formulário seguro de atualização.
- A janela da Nuvem não terá um campo para receber a chave nem um botão que simule guardá-la. Esta é a alternativa aceite ao pedido inicial: não existe uma interface documentada que permita à própria aplicação gravar Secrets do Lovable.
- Nunca guardar ou devolver a chave no navegador, localStorage, respostas da aplicação, registos, ficheiros ou GitHub.
- Informar que será necessário publicar para disponibilizar alterações ao segredo na versão publicada.

## Janela Google Gemini
- Acrescentar o acesso às chaves API dentro das definições atuais, mantendo a navegação e o aspeto da Nuvem.
- Mostrar **Ligado** ou **Não ligado**, com indicação separada de verificação em curso e da hora do último teste nesta sessão.
- Incluir **Testar ligação**, desativado enquanto o teste estiver a decorrer.
- Só mostrar **Ligado** depois de receber uma resposta utilizável da API oficial; a existência do segredo, por si só, não confirma ligação.
- Ao reabrir a janela, verificar novamente, sem conservar no navegador um estado de sucesso antigo.
- Distinguir ausência de configuração, chave recusada, limite de utilização e indisponibilidade temporária através de mensagens seguras, sem detalhes internos do fornecedor.

## Caçador
- Reutilizar e corrigir a integração existente com a API oficial do Google Gemini, mantendo a chave fornecida pelo utilizador e o modelo atualmente configurado, `gemini-2.5-flash`.
- Usar a mesma configuração no teste de ligação e nas conversas, evitando dois caminhos com resultados contraditórios.
- Substituir o indicador visual fixo do assistente por um estado baseado na verificação real.
- Preservar conversas, voz, microfone, sugestões, Canva, CRM e restantes funções.
- Não ativar faturação, planos pagos ou mudança automática de fornecedor; respeitar as quotas gratuitas aplicáveis à conta Google.

## Segurança e detalhes técnicos
- Ler `process.env['GEMINI_API_KEY']` apenas dentro da função executada no servidor; não criar variáveis `VITE_*` para este segredo.
- Usar funções de servidor TanStack Start para consultar o estado, testar e conversar; o navegador nunca chama o Google com a chave.
- Verificar a configuração real do ambiente de servidor antes de implementar e preparar Lovable Cloud se necessário para alojar a integração e os Secrets, sem substituir a autenticação existente nem migrar dados por este pedido.
- Proteger as operações que utilizam a chave com validação da sessão no servidor, compatível com o acesso existente; não considerar a interface privada ou a proteção contra pedidos entre sites suficientes.
- Validar entradas, limitar o tamanho dos pedidos e definir um tempo máximo de espera. Não devolver erros brutos do Google nem registar cabeçalhos com credenciais.
- Corrigir os erros de compilação já indicados nos diagnósticos, com alterações mínimas e sem refatorações alheias ao pedido.

## Verificação
- Adicionar e executar testes para segredo ausente, sessão inválida, resposta válida, chave recusada, quota esgotada, tempo esgotado e resposta vazia.
- Confirmar que apenas uma resposta válida produz o estado **Ligado** e que uma falha posterior o altera para **Não ligado**.
- Verificar a janela em computador e telemóvel e testar novamente o acesso ao painel, Caçador e editor.
- Depois de a chave ser introduzida no formulário seguro, executar o percurso real: abrir as definições → testar ligação → obter resposta no Caçador.
- Não declarar a ligação concluída enquanto o teste real não tiver sucesso; se faltar a chave ou houver uma limitação do Google, apresentar essa dependência claramente.
