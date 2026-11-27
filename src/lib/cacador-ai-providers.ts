export type CacadorProvider = "local" | "ollama" | "zrouter";
export type OllamaSettings = { baseUrl: string; model: string };
const OLLAMA_KEY = "nuvem-cacador-ollama-v1";
const DEFAULT_OLLAMA: OllamaSettings = { baseUrl: "http://localhost:11434", model: "qwen2.5:0.5b" };

export function getOllamaSettings(): OllamaSettings {
  if (typeof window === "undefined") return DEFAULT_OLLAMA;
  try {
    const saved = JSON.parse(window.localStorage.getItem(OLLAMA_KEY) ?? "{}") as Partial<OllamaSettings>;
    return {
      baseUrl: typeof saved.baseUrl === "string" ? saved.baseUrl.replace(/\\/$/, "") : DEFAULT_OLLAMA.baseUrl,
      model: typeof saved.model === "string" ? saved.model : DEFAULT_OLLAMA.model,
    };
  } catch { return DEFAULT_OLLAMA; }
}

export function saveOllamaSettings(settings: OllamaSettings): void {
  if (typeof window === "undefined") return;
  const baseUrl = settings.baseUrl.trim().replace(/\\/$/, "");
  const model = settings.model.trim();
  if (!/^https?:\\/\\//i.test(baseUrl)) throw new Error("Indica um endereço HTTP ou HTTPS válido para o Ollama.");
  if (!model) throw new Error("Indica o nome do modelo Ollama.");
  window.localStorage.setItem(OLLAMA_KEY, JSON.stringify({ baseUrl, model }));
}

export async function testOllamaConnection(settings = getOllamaSettings()): Promise<string[]> {
  const response = await fetch(settings.baseUrl.replace(/\\/$/, "") + "/api/tags", {
    signal: AbortSignal.timeout(8000),
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error("Ollama respondeu com HTTP " + response.status + ".");
  const data = await response.json() as { models?: Array<{ name?: string }> };
  return (data.models ?? []).map((item) => item.name).filter((name): name is string => Boolean(name));
}

export async function askOllama(messages: Array<{ role: "user" | "assistant"; content: string }>, settings = getOllamaSettings()): Promise<string> {
  const response = await fetch(settings.baseUrl.replace(/\\/$/, "") + "/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      model: settings.model,
      stream: false,
      messages: [
        { role: "system", content: "És o Caçador, assistente da Nuvem. Responde em português claro de Angola. Sê prático e honesto; não inventes pesquisas ou ações que não realizaste." },
        ...messages,
      ],
    }),
    signal: AbortSignal.timeout(90000),
  });
  if (!response.ok) throw new Error("Ollama respondeu com HTTP " + response.status + ". Confirma se o modelo está instalado.");
  const data = await response.json() as { message?: { content?: string }; error?: string };
  const answer = data.message?.content?.trim();
  if (!answer) throw new Error(data.error || "O Ollama não devolveu uma resposta.");
  return answer;
}
