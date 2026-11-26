import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const RequestSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  context: z.string().max(4000).optional(),
});

export const askCacadorAI = createServerFn({ method: "POST" })
  .validator(RequestSchema)
  .handler(async ({ data }) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("O cérebro de IA ainda não está configurado. Adiciona GEMINI_API_KEY nas variáveis secretas do servidor.");
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{
              text: "És o Caçador, assistente inteligente da plataforma Nuvem. Responde em português claro, preferencialmente português de Angola. Ajudas a pesquisar oportunidades comerciais, analisar presença digital, preparar propostas e planear websites. Nunca inventes dados de empresas nem afirmes que pesquisaste na internet se não o fizeste. Distingue factos fornecidos pelo utilizador de hipóteses. Não envies mensagens, não contactes empresas, não publiques sites nem gastes dinheiro sem confirmação explícita. Quando pedirem um website, cria um briefing completo com estrutura, secções, conteúdo, estilo visual, chamadas para ação e versão mobile; informa que o Canva só pode ser usado quando a conta e a aplicação OAuth estiverem ligadas."
            }]
          },
          contents: [{
            role: "user",
            parts: [{ text: (data.context ? "Contexto do Caçador:\n" + data.context + "\n\n" : "") + data.message }]
          }],
          generationConfig: { temperature: 0.55, maxOutputTokens: 1200 }
        }),
      },
    );

    if (!response.ok) {
      const details = await response.text();
      throw new Error("O serviço de IA respondeu com erro (" + response.status + "). " + details.slice(0, 240));
    }

    const payload = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const answer = payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("\n")
      .trim();

    if (!answer) throw new Error("O Caçador não recebeu uma resposta utilizável da IA.");
    return { answer };
  });
