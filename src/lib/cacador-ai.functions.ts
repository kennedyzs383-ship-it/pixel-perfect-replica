import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const RequestSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  context: z.string().max(4000).optional(),
});

const SYSTEM_PROMPT = "És o Caçador, assistente inteligente da plataforma Nuvem. Responde em português claro, preferencialmente português de Angola. Ajudas a pesquisar oportunidades comerciais, analisar presença digital, preparar propostas e planear websites. Nunca inventes dados de empresas nem afirmes que pesquisaste na internet se não o fizeste. Distingue factos fornecidos pelo utilizador de hipóteses. Não envies mensagens, não contactes empresas, não publiques sites nem gastes dinheiro sem confirmação explícita. Quando pedirem um website, cria um briefing completo com estrutura, secções, conteúdo, estilo visual, chamadas para ação e versão mobile; informa que o Canva só pode ser usado quando a conta e a aplicação OAuth estiverem ligadas.";

type ZRouterChatResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ text?: string }>;
    };
  }>;
};

export const askCacadorAI = createServerFn({ method: "POST" })
  .validator(RequestSchema)
  .handler(async ({ data }) => {
    const apiKey = process.env.ZROUTER_API_KEY;
    if (!apiKey) {
      throw new Error("O cérebro do Caçador ainda não está ligado. Confirma a secret ZROUTER_API_KEY nas variáveis secretas do servidor Lovable.");
    }

    const model = process.env.ZROUTER_MODEL || "openrouter/google/gemini-2.5-flash";
    const response = await fetch("https://www.zrouter.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: (data.context ? "Contexto da conversa:\n" + data.context + "\n\n" : "") + data.message,
          },
        ],
        temperature: 0.55,
        max_tokens: 1200,
      }),
    });

    if (!response.ok) {
      const details = (await response.text()).slice(0, 240);
      if (response.status === 402) {
        throw new Error("O Z Router recusou o pedido porque o saldo/crédito disponível é zero ou insuficiente. A integração está configurada, mas não foi possível testar a resposta sem créditos.");
      }
      if (response.status === 401) {
        throw new Error("O Z Router não aceitou a chave. Confirma se ZROUTER_API_KEY está correta e ativa nas secrets do Lovable.");
      }
      if (response.status === 404) {
        throw new Error("O modelo configurado não foi encontrado no Z Router. Confirma o identificador em ZROUTER_MODEL. " + details);
      }
      if (response.status === 429) {
        throw new Error("O Z Router atingiu o limite de pedidos ou de utilização. Tenta novamente mais tarde.");
      }
      throw new Error("O Z Router respondeu com erro (" + response.status + "). " + details);
    }

    const payload = (await response.json()) as ZRouterChatResponse;
    const content = payload.choices?.[0]?.message?.content;
    const answer = (typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content.map((part) => part.text ?? "").join("\n")
        : "").trim();

    if (!answer) throw new Error("O Caçador não recebeu uma resposta utilizável do Z Router.");
    return { answer, model };
  });
