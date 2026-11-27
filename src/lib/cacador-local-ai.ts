export type LocalAIProgress = { percent: number; text: string };
type ChatMessage = { role: "user" | "assistant"; content: string };
type CompletionResult = { choices?: Array<{ message?: { content?: string } }> };
type WllamaEngine = {
  setCompat(mode: string): void;
  loadModelFromHF(model: { repo: string; file: string }, options?: { progressCallback?: (progress: unknown) => void }): Promise<void>;
  createChatCompletion(options: { messages: Array<{ role: string; content: string }>; max_tokens: number; temperature: number; top_p: number }): Promise<CompletionResult>;
};
let engine: WllamaEngine | null = null;
let loading: Promise<void> | null = null;
const BASE = "https://cdn.jsdelivr.net/npm/@wllama/wllama@4.0.0/esm/";
const MODEL = { repo: "Qwen/Qwen2.5-0.5B-Instruct-GGUF", file: "qwen2.5-0.5b-instruct-q4_k_m.gguf" };

export async function loadCacadorLocalAI(onProgress: (progress: LocalAIProgress) => void): Promise<void> {
  if (engine) return;
  if (loading) return loading;
  loading = (async () => {
    onProgress({ percent: 0, text: "A iniciar o motor local…" });
    const moduleUrl = BASE + "index.js";
    const module = await import(/* @vite-ignore */ moduleUrl) as { Wllama: new (paths: { default: string }) => WllamaEngine };
    const instance = new module.Wllama({ default: BASE + "wasm/wllama.wasm" });
    instance.setCompat("default");
    onProgress({ percent: 1, text: "A descarregar o modelo Qwen 0.5B…" });
    await instance.loadModelFromHF(MODEL, { progressCallback: (value: unknown) => {
      const raw = typeof value === "number" ? value : Number((value as { progress?: number } | null)?.progress ?? 0);
      onProgress({ percent: Math.max(1, Math.min(100, Math.round(raw))), text: "A descarregar e preparar o modelo…" });
    } });
    engine = instance;
    onProgress({ percent: 100, text: "Modelo carregado e pronto para conversar." });
  })();
  try { await loading; } finally { loading = null; }
}

export async function askCacadorLocalAI(messages: ChatMessage[]): Promise<string> {
  if (!engine) throw new Error("Ativa primeiro a IA local.");
  const response = await engine.createChatCompletion({
    messages: [
      { role: "system", content: "És o Caçador, assistente da plataforma Nuvem. Responde em português claro de Angola. Ajuda a analisar oportunidades comerciais, preparar propostas, planear websites e explicar tecnologia. Sê prático, honesto e organizado. Não inventes factos, pesquisas ou ações que não realizaste. Não afirmes ter acesso à internet, Canva, ficheiros ou ferramentas externas. Se não souberes, diz claramente." },
      ...messages,
    ],
    max_tokens: 700,
    temperature: 0.55,
    top_p: 0.9,
  });
  const answer = response.choices?.[0]?.message?.content?.trim() ?? "";
  if (!answer) throw new Error("O modelo local não devolveu uma resposta. Tenta novamente.");
  return answer;
}
