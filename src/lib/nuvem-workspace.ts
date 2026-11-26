export type NuvemSite = {
  id: string;
  name: string;
  status: "Rascunho" | "Exportado";
  updatedAt: string;
  html?: string;
};

const SITES_KEY = "nuvem-sites-v1";
const EDITOR_KEY = "nuvem-editor-drafts-v1";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function getSites(): NuvemSite[] {
  return read<NuvemSite[]>(SITES_KEY, []);
}

export function saveSites(sites: NuvemSite[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(SITES_KEY, JSON.stringify(sites));
  window.dispatchEvent(new CustomEvent("nuvem-sites-updated"));
}

export function createSite(name: string): NuvemSite {
  const site: NuvemSite = {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2),
    name: name.trim(),
    status: "Rascunho",
    updatedAt: new Date().toISOString(),
  };
  saveSites([site, ...getSites()]);
  return site;
}

export function removeSite(id: string) {
  saveSites(getSites().filter((site) => site.id !== id));
  const drafts = read<Record<string, unknown>>(EDITOR_KEY, {});
  delete drafts[id];
  window.localStorage.setItem(EDITOR_KEY, JSON.stringify(drafts));
}

export function updateSite(id: string, patch: Partial<NuvemSite>) {
  saveSites(getSites().map((site) =>
    site.id === id ? { ...site, ...patch, updatedAt: new Date().toISOString() } : site
  ));
}

export function getEditorDraft<T>(siteId: string | null = null): T | null {
  const drafts = read<Record<string, T>>(EDITOR_KEY, {});
  return drafts[siteId ?? "default"] ?? null;
}

export function saveEditorDraft<T>(draft: T, siteId: string | null = null) {
  if (typeof window === "undefined") return;
  const drafts = read<Record<string, T>>(EDITOR_KEY, {});
  drafts[siteId ?? "default"] = draft;
  window.localStorage.setItem(EDITOR_KEY, JSON.stringify(drafts));
}
