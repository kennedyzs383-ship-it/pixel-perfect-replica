type SupabaseUser = { id: string; email?: string };
type SupabaseSession = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: SupabaseUser;
};
export type CacadorCloudLead = {
  id: string;
  company: string;
  category: string;
  city: string;
  website: string;
  websiteStatus: "Não verificado" | "Sem website" | "Tem website" | "Website com problemas";
  publicPhone: string;
  contactName: string;
  status: "Novo" | "Investigação" | "Qualificado" | "Contactado" | "Em negociação" | "Ganho" | "Perdido";
  notes: string;
  nextAction: string;
  createdAt: string;
};

const SESSION_KEY = "nuvem-supabase-session-v1";
const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/+$/, "");
const publishableKey =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);

export function isSupabaseConfigured() {
  return Boolean(url && publishableKey);
}

export function getSupabaseSetupMessage() {
  return "Falta configurar VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY nas variáveis de ambiente da aplicação.";
}

function getSession(): SupabaseSession | null {
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SupabaseSession) : null;
  } catch {
    return null;
  }
}

function saveSession(session: SupabaseSession | null) {
  if (session) window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else window.localStorage.removeItem(SESSION_KEY);
}

function normalizeSession(value: Record<string, unknown>): SupabaseSession | null {
  if (
    typeof value.access_token !== "string" ||
    typeof value.refresh_token !== "string" ||
    !value.user ||
    typeof value.user !== "object"
  ) return null;
  const user = value.user as SupabaseUser;
  if (typeof user.id !== "string") return null;
  const expiresIn = typeof value.expires_in === "number" ? value.expires_in : 3600;
  const expiresAt = typeof value.expires_at === "number"
    ? value.expires_at
    : Math.floor(Date.now() / 1000) + expiresIn;
  return {
    access_token: value.access_token,
    refresh_token: value.refresh_token,
    expires_at: expiresAt,
    user,
  };
}

async function authFetch<T>(path: string, body?: unknown, method = "POST"): Promise<T> {
  if (!isSupabaseConfigured()) throw new Error(getSupabaseSetupMessage());
  const response = await fetch(url + "/auth/v1/" + path, {
    method,
    headers: {
      apikey: publishableKey!,
      "Content-Type": "application/json",
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof payload.msg === "string" ? payload.msg :
      typeof payload.message === "string" ? payload.message :
      typeof payload.error_description === "string" ? payload.error_description :
      "Não foi possível concluir a autenticação.";
    throw new Error(message);
  }
  return payload as T;
}

async function freshSession(): Promise<SupabaseSession> {
  const current = getSession();
  if (!current) throw new Error("Inicia sessão para sincronizar os teus dados.");
  if (current.expires_at > Math.floor(Date.now() / 1000) + 45) return current;

  try {
    const refreshed = await authFetch<Record<string, unknown>>("token?grant_type=refresh_token", {
      refresh_token: current.refresh_token,
    });
    const next = normalizeSession(refreshed);
    if (!next) throw new Error("A sessão expirou. Inicia sessão novamente.");
    saveSession(next);
    return next;
  } catch (error) {
    saveSession(null);
    throw error;
  }
}

async function restFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!isSupabaseConfigured()) throw new Error(getSupabaseSetupMessage());
  const session = await freshSession();
  const response = await fetch(url + "/rest/v1/" + path, {
    ...init,
    headers: {
      apikey: publishableKey!,
      Authorization: "Bearer " + session.access_token,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const message = typeof payload.message === "string" ? payload.message :
      typeof payload.details === "string" ? payload.details :
      "Não foi possível sincronizar os dados com a Nuvem.";
    throw new Error(message);
  }
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export async function signIn(email: string, password: string) {
  const result = await authFetch<Record<string, unknown>>("token?grant_type=password", { email, password });
  const session = normalizeSession(result);
  if (!session) throw new Error("O Supabase não devolveu uma sessão válida.");
  saveSession(session);
  return session.user;
}

export async function signUp(email: string, password: string) {
  const result = await authFetch<Record<string, unknown>>("signup", { email, password });
  const session = normalizeSession(result);
  if (session) saveSession(session);
  return { user: (result.user as SupabaseUser | undefined) ?? session?.user ?? null, hasSession: Boolean(session) };
}

export async function getSignedInUser() {
  if (!isSupabaseConfigured() || !getSession()) return null;
  const session = await freshSession();
  const response = await fetch(url + "/auth/v1/user", {
    headers: { apikey: publishableKey!, Authorization: "Bearer " + session.access_token },
  });
  if (!response.ok) {
    saveSession(null);
    return null;
  }
  return (await response.json()) as SupabaseUser;
}

export async function signOut() {
  const current = getSession();
  if (current && isSupabaseConfigured()) {
    await fetch(url + "/auth/v1/logout", {
      method: "POST",
      headers: { apikey: publishableKey!, Authorization: "Bearer " + current.access_token },
    }).catch(() => undefined);
  }
  saveSession(null);
}

const statusToDb: Record<CacadorCloudLead["status"], string> = {
  "Novo": "new",
  "Investigação": "investigating",
  "Qualificado": "qualified",
  "Contactado": "contacted",
  "Em negociação": "proposal",
  "Ganho": "won",
  "Perdido": "lost",
};
const statusFromDb: Record<string, CacadorCloudLead["status"]> = {
  new: "Novo",
  investigating: "Investigação",
  qualified: "Qualificado",
  contacted: "Contactado",
  replied: "Contactado",
  proposal: "Em negociação",
  won: "Ganho",
  lost: "Perdido",
  archived: "Perdido",
};
const websiteToDb: Record<CacadorCloudLead["websiteStatus"], string> = {
  "Não verificado": "not_checked",
  "Sem website": "no_website",
  "Tem website": "has_website",
  "Website com problemas": "website_issue",
};
const websiteFromDb: Record<string, CacadorCloudLead["websiteStatus"]> = {
  not_checked: "Não verificado",
  no_website: "Sem website",
  has_website: "Tem website",
  website_issue: "Website com problemas",
};

type LeadRow = {
  id: string;
  business_name: string;
  niche: string | null;
  city: string | null;
  website_url: string | null;
  website_status: string;
  phone: string | null;
  contact_name: string | null;
  status: string;
  notes: string | null;
  next_action: string | null;
  created_at: string;
};

function fromRow(row: LeadRow): CacadorCloudLead {
  return {
    id: row.id,
    company: row.business_name,
    category: row.niche ?? "",
    city: row.city ?? "",
    website: row.website_url ?? "",
    websiteStatus: websiteFromDb[row.website_status] ?? "Não verificado",
    publicPhone: row.phone ?? "",
    contactName: row.contact_name ?? "",
    status: statusFromDb[row.status] ?? "Novo",
    notes: row.notes ?? "",
    nextAction: row.next_action ?? "",
    createdAt: row.created_at,
  };
}

function toRow(lead: CacadorCloudLead, ownerId: string) {
  return {
    id: lead.id,
    owner_id: ownerId,
    business_name: lead.company,
    niche: lead.category || null,
    city: lead.city || null,
    website_url: lead.website || null,
    website_status: websiteToDb[lead.websiteStatus],
    phone: lead.publicPhone || null,
    contact_name: lead.contactName || null,
    status: statusToDb[lead.status],
    notes: lead.notes || null,
    next_action: lead.nextAction || null,
    source: "cacador",
    created_at: lead.createdAt,
  };
}

export async function loadCloudLeads() {
  const rows = await restFetch<LeadRow[]>(
    "leads?select=id,business_name,niche,city,website_url,website_status,phone,contact_name,status,notes,next_action,created_at&order=created_at.desc",
  );
  return rows.map(fromRow);
}

export async function saveCloudLeads(leads: CacadorCloudLead[], ownerId: string) {
  if (!leads.length) return;
  await restFetch("leads?on_conflict=id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(leads.map((lead) => toRow(lead, ownerId))),
  });
}

export async function deleteCloudLead(id: string) {
  await restFetch("leads?id=eq." + encodeURIComponent(id), { method: "DELETE" });
}
