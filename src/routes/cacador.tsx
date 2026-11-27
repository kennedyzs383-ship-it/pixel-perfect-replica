import { createFileRoute } from "@tanstack/react-router";
import { CacadorAIAssistant } from "../components/cacador-ai-assistant";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeft, Building2, Search, Plus, ExternalLink, MessageCircle, ClipboardList, Target, Sparkles, ShieldCheck, Globe2, Trash2, X, Save, Filter, Download, Upload, Cloud, LogIn, LogOut, RefreshCw } from "lucide-react";
import { createCloudConversation, createCloudMessage, createCloudTask, deleteCloudLead, getSignedInUser, isSupabaseConfigured, loadCloudLeads, loadLeadWorkspace, saveCloudLeads, signIn, signOut, signUp, updateCloudTaskStatus, type CacadorCloudLead, type CloudConversation, type CloudMessage, type CloudTask } from "../lib/nuvem-supabase";

export const Route = createFileRoute("/cacador")({
  head: () => ({ meta: [
    { title: "Nuvem | Caçador" },
    { name: "description", content: "Centro de prospeção e gestão comercial do Caçador." },
    { property: "og:title", content: "Nuvem | Caçador" },
    { property: "og:description", content: "Centro de prospeção e gestão comercial do Caçador." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: CacadorPage,
});

type LeadStatus = "Novo" | "Investigação" | "Qualificado" | "Contactado" | "Em negociação" | "Ganho" | "Perdido";
type WebsiteStatus = "Não verificado" | "Sem website" | "Tem website" | "Website com problemas";
type Lead = {
  id: string; company: string; category: string; city: string; website: string;
  websiteStatus: WebsiteStatus; publicPhone: string; contactName: string;
  status: LeadStatus; notes: string; nextAction: string; createdAt: string;
};
const KEY = "nuvem-cacador-leads-v1";
const statuses: LeadStatus[] = ["Novo", "Investigação", "Qualificado", "Contactado", "Em negociação", "Ganho", "Perdido"];
const emptyLead = (): Omit<Lead, "id" | "createdAt"> => ({
  company: "", category: "", city: "", website: "", websiteStatus: "Não verificado",
  publicPhone: "", contactName: "", status: "Novo", notes: "", nextAction: "",
});
function getResearchLinks(lead: Lead) {
  const terms = [lead.company, lead.category, lead.city].filter(Boolean).join(" ");
  const encoded = encodeURIComponent(terms);
  const quotedCompany = encodeURIComponent('"' + lead.company + '" ' + lead.city);
  const links = [
    { label: "Google", url: "https://www.google.com/search?q=" + encoded + " empresa contacto" },
    { label: "Google Maps", url: "https://www.google.com/maps/search/?api=1&query=" + encoded },
    { label: "LinkedIn", url: "https://www.google.com/search?q=" + encodeURIComponent("site:linkedin.com/company " + lead.company + " " + lead.city) },
    { label: "Facebook", url: "https://www.google.com/search?q=" + encodeURIComponent("site:facebook.com " + lead.company + " " + lead.city) },
    { label: "Instagram", url: "https://www.google.com/search?q=" + encodeURIComponent("site:instagram.com " + lead.company + " " + lead.city) },
    { label: "Contactos", url: "https://www.google.com/search?q=" + quotedCompany + "+telefone+email" },
  ];
  if (lead.website.trim()) {
    try {
      const websiteInput = lead.website.trim();
      const normalizedInput = websiteInput.toLowerCase();
      const address = new URL(normalizedInput.startsWith("http://") || normalizedInput.startsWith("https://") ? websiteInput : "https://" + websiteInput);
      if (address.protocol === "https:" || address.protocol === "http:") {
        links.push(
          { label: "PageSpeed", url: "https://pagespeed.web.dev/analysis?url=" + encodeURIComponent(address.href) },
          { label: "SSL Labs", url: "https://www.ssllabs.com/ssltest/analyze.html?d=" + encodeURIComponent(address.hostname) },
          { label: "Security Headers", url: "https://securityheaders.com/?q=" + encodeURIComponent(address.hostname) + "&followRedirects=on" },
        );
      }
    } catch { /* Invalid website addresses are left for the user to correct. */ }
  }
  return links;
}

function readLeads(ownerId?: string): Lead[] {
  try {
    const storageKey = ownerId ? KEY + ":" + ownerId : KEY;
    const value = localStorage.getItem(storageKey);
    return value ? JSON.parse(value) as Lead[] : [];
  } catch { return []; }
}
function CacadorPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<LeadStatus | "Todos">("Todos");
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState(emptyLead());
  const [selected, setSelected] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [cloudMessage, setCloudMessage] = useState("");
  const [workspaceData, setWorkspaceData] = useState<{ conversations: CloudConversation[]; messages: CloudMessage[]; tasks: CloudTask[] }>({ conversations: [], messages: [], tasks: [] });
  const [selectedConversation, setSelectedConversation] = useState("");
  const [conversationTitle, setConversationTitle] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDetails, setTaskDetails] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const cloudConfigured = isSupabaseConfigured();

  const connectCloud = useCallback(async (account: { id: string; email?: string }) => {
    const scopedKey = KEY + ":" + account.id;
    const claimedOwner = localStorage.getItem(KEY + ":owner");
    const hasScopedCache = localStorage.getItem(scopedKey) !== null;
    let local = hasScopedCache ? readLeads(account.id) : [];
    if (!hasScopedCache && (!claimedOwner || claimedOwner === account.id)) {
      local = readLeads();
      if (local.length) localStorage.setItem(scopedKey, JSON.stringify(local));
      localStorage.setItem(KEY + ":owner", account.id);
      localStorage.removeItem(KEY);
    }
    const remote = await loadCloudLeads();
    const localOnly = local.filter((item) => !remote.some((savedLead) => savedLead.id === item.id));
    if (localOnly.length) await saveCloudLeads(localOnly as CacadorCloudLead[], account.id);
    const merged = [...localOnly, ...remote];
    setUser(account);
    setLeads(merged);
    localStorage.setItem(scopedKey, JSON.stringify(merged));
    setCloudMessage("Ligado à base de dados. Os registos estão sincronizados com a tua conta.");
  }, []);

  useEffect(() => {
    const local = readLeads();
    setLeads(local);
    if (!cloudConfigured) return;
    let active = true;
    void getSignedInUser().then(async (account) => {
      if (!active || !account) return;
      await connectCloud(account);
    }).catch((error: unknown) => {
      if (active) setCloudMessage(error instanceof Error ? error.message : "Não foi possível recuperar a sessão.");
    });
    return () => { active = false; };
  }, [cloudConfigured, connectCloud]);

  const persist = (next: Lead[]) => {
    setLeads(next);
    localStorage.setItem(user ? KEY + ":" + user.id : KEY, JSON.stringify(next));
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1800);
    if (user) {
      void saveCloudLeads(next as CacadorCloudLead[], user.id)
        .then(() => setCloudMessage("Sincronizado com a base de dados."))
        .catch((error: unknown) => setCloudMessage(error instanceof Error ? "Guardado localmente; sincronização pendente: " + error.message : "Guardado localmente; sincronização pendente."));
    }
  };

  const handleAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError("");
    try {
      if (authMode === "signup") {
        const result = await signUp(authEmail.trim(), authPassword);
        if (!result.hasSession || !result.user) {
          setCloudMessage("Conta criada. Confirma o endereço de email e depois inicia sessão.");
          setAuthMode("signin");
          return;
        }
        await connectCloud(result.user);
      } else {
        const account = await signIn(authEmail.trim(), authPassword);
        await connectCloud(account);
      }
      setAuthPassword("");
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Não foi possível autenticar.");
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = async () => {
    if (user) localStorage.setItem(KEY + ":" + user.id, JSON.stringify(leads));
    await signOut();
    setUser(null);
    setLeads([]);
    setSelected(null);
    setCloudMessage("Sessão terminada. Os registos desta conta continuam guardados neste dispositivo.");
  };
  useEffect(() => {
    if (!user || !current) {
      setWorkspaceData({ conversations: [], messages: [], tasks: [] });
      setSelectedConversation("");
      return;
    }
    let active = true;
    setWorkspaceBusy(true);
    void loadLeadWorkspace(current.id).then((data) => {
      if (!active) return;
      setWorkspaceData(data);
      setSelectedConversation(data.conversations[0]?.id ?? "");
    }).catch((error: unknown) => {
      if (active) setCloudMessage(error instanceof Error ? "Erro ao carregar o acompanhamento: " + error.message : "Erro ao carregar o acompanhamento.");
    }).finally(() => { if (active) setWorkspaceBusy(false); });
    return () => { active = false; };
  }, [user?.id, selected]);

  const refreshLeadWorkspace = async (leadId: string) => {
    const data = await loadLeadWorkspace(leadId);
    setWorkspaceData(data);
    setSelectedConversation((previous) => data.conversations.some((item) => item.id === previous) ? previous : (data.conversations[0]?.id ?? ""));
  };
  const addConversation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !current) return;
    setWorkspaceBusy(true);
    try {
      const created = await createCloudConversation(current.id, user.id, conversationTitle.trim());
      setConversationTitle("");
      await refreshLeadWorkspace(current.id);
      setSelectedConversation(created?.id ?? "");
    } catch (error) {
      setCloudMessage(error instanceof Error ? error.message : "Não foi possível criar o registo de conversa.");
    } finally { setWorkspaceBusy(false); }
  };
  const addInternalMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !selectedConversation || !messageBody.trim()) return;
    setWorkspaceBusy(true);
    try {
      await createCloudMessage(selectedConversation, user.id, messageBody.trim(), "internal");
      setMessageBody("");
      if (current) await refreshLeadWorkspace(current.id);
    } catch (error) {
      setCloudMessage(error instanceof Error ? error.message : "Não foi possível guardar a nota.");
    } finally { setWorkspaceBusy(false); }
  };
  const addTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !current || !taskTitle.trim()) return;
    setWorkspaceBusy(true);
    try {
      await createCloudTask(current.id, user.id, taskTitle.trim(), taskDetails.trim(), taskDue ? new Date(taskDue + "T12:00:00").toISOString() : null);
      setTaskTitle(""); setTaskDetails(""); setTaskDue("");
      await refreshLeadWorkspace(current.id);
    } catch (error) {
      setCloudMessage(error instanceof Error ? error.message : "Não foi possível criar a tarefa.");
    } finally { setWorkspaceBusy(false); }
  };
  const toggleTask = async (task: CloudTask) => {
    const status = task.status === "done" ? "todo" : "done";
    try {
      await updateCloudTaskStatus(task.id, status);
      if (current) await refreshLeadWorkspace(current.id);
    } catch (error) {
      setCloudMessage(error instanceof Error ? error.message : "Não foi possível atualizar a tarefa.");
    }
  };

  const visible = useMemo(() => leads.filter((lead) => (filter === "Todos" || lead.status === filter) && [lead.company, lead.category, lead.city, lead.contactName].join(" ").toLowerCase().includes(query.toLowerCase())), [leads, filter, query]);
  const current = leads.find((lead) => lead.id === selected) ?? null;
  const patch = (id: string, changes: Partial<Lead>) => persist(leads.map((lead) => lead.id === id ? { ...lead, ...changes } : lead));
  const add = () => {
    if (!draft.company.trim()) return;
    const lead: Lead = { ...draft, company: draft.company.trim(), id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    persist([lead, ...leads]); setDraft(emptyLead()); setShowForm(false); setSelected(lead.id);
  };
  const remove = (id: string) => { if (!window.confirm("Eliminar esta empresa da lista?")) return; persist(leads.filter((lead) => lead.id !== id)); if (user) void deleteCloudLead(id).catch((error: unknown) => setCloudMessage(error instanceof Error ? "A empresa foi removida localmente, mas não foi possível sincronizar a remoção: " + error.message : "Não foi possível sincronizar a remoção.")); if (selected === id) setSelected(null); };
  const searchWeb = (lead: Lead) => window.open("https://www.google.com/search?q=" + encodeURIComponent(lead.company + " " + lead.city + " website contacto"), "_blank", "noopener,noreferrer");
  const exportBackup = () => {
    const backup = { format: "nuvem-cacador", version: 1, exportedAt: new Date().toISOString(), leads };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "nuvem-cacador-backup-" + new Date().toISOString().slice(0, 10) + ".json";
    link.click();
    URL.revokeObjectURL(url);
  };
  const importBackup = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as { format?: string; version?: number; leads?: unknown };
      if (parsed.format !== "nuvem-cacador" || !Array.isArray(parsed.leads)) {
        window.alert("Este ficheiro não é uma cópia válida do Caçador.");
        return;
      }
      const valid = (parsed.leads as unknown[]).filter((item): item is Lead => {
        if (!item || typeof item !== "object") return false;
        const lead = item as Partial<Lead>;
        return typeof lead.id === "string" && typeof lead.company === "string" &&
          statuses.includes(lead.status as LeadStatus) &&
          ["Não verificado", "Sem website", "Tem website", "Website com problemas"].includes(lead.websiteStatus as string) &&
          typeof lead.createdAt === "string" &&
          ["category", "city", "website", "publicPhone", "contactName", "notes", "nextAction"].every(
            (key) => typeof (lead as Record<string, unknown>)[key] === "string",
          );
      });
      const known = new Set(leads.map((lead) => lead.id));
      const additions = valid.filter((lead) => {
        if (known.has(lead.id)) return false;
        known.add(lead.id);
        return true;
      });
      if (additions.length === 0) {
        window.alert("A cópia não contém empresas novas para importar. Os registos atuais foram mantidos.");
        return;
      }
      persist([...additions, ...leads]);
      window.alert(additions.length + " empresa(s) importada(s). Os registos que já existiam foram preservados.");
    } catch {
      window.alert("Não foi possível ler esta cópia. Confirma se o ficheiro JSON está íntegro.");
    }
  };
  const openWhatsApp = (lead: Lead) => {
    const number = lead.publicPhone.replace(/[^0-9]/g, "");
    if (!number) return;
    window.open("https://wa.me/" + number, "_blank", "noopener,noreferrer");
  };
  return <div className="hunter">
    <style>{css}</style>
    <header className="hunter-top"><a href="/" className="back"><ArrowLeft size={17}/> Painel Nuvem</a><div className="hunter-brand"><span>CA</span><div><b>Caçador</b><small>Inteligência comercial · Nuvem</small></div></div><div className="top-status"><i/> Área de trabalho</div></header>
    <main className="hunter-main">
      <div className="hero"><div><div className="eyebrow"><Sparkles size={14}/> CENTRO DE PROSPEÇÃO</div><h1>Encontra oportunidades.<br/><em>Constrói relações.</em></h1><p>Organiza empresas, investiga a presença digital e acompanha cada oportunidade comercial num só lugar.</p></div><div className="hero-icon"><Target size={52}/><span>CAÇADOR</span></div></div>
      <section className="notice"><ShieldCheck size={18}/><div><b>Modo assistido com IA</b><span>O assistente inteligente já está disponível. A voz depende das permissões e do suporte do navegador. Prospeção externa, contactos e publicação continuam a exigir confirmação e integrações próprias.</span></div></section>
      <CacadorAIAssistant />
       <section className="cloud-panel">
         <div className="cloud-panel-heading"><Cloud size={18}/><div><b>Sincronização segura</b><span>{user ? "Conta ligada: " + (user.email || user.id) : "Liga a tua conta para guardar as empresas no Supabase e aceder noutros dispositivos."}</span></div></div>
         {!cloudConfigured ? <div className="cloud-setup"><p>Falta configurar as variáveis públicas do Supabase na aplicação. Não coloques aqui a chave secreta nem a service_role.</p><code>VITE_SUPABASE_URL</code><code>VITE_SUPABASE_PUBLISHABLE_KEY</code><a href="https://supabase.com/dashboard/project/emcdkxxmfqgejfmfpxwe/settings/api" target="_blank" rel="noreferrer">Abrir definições de API do Supabase</a></div> :
           user ? <div className="cloud-session"><span><i/> Conta autenticada · dados protegidos por RLS</span><button className="secondary" onClick={() => void handleSignOut()}><LogOut size={14}/> Terminar sessão</button></div> :
           <form className="cloud-auth" onSubmit={handleAuth}>
             <label>Email<input type="email" required autoComplete="email" value={authEmail} onChange={e=>setAuthEmail(e.target.value)} placeholder="teu@email.com"/></label>
             <label>Palavra-passe<input type="password" required minLength={6} autoComplete={authMode === "signin" ? "current-password" : "new-password"} value={authPassword} onChange={e=>setAuthPassword(e.target.value)} placeholder="Mínimo de 6 caracteres"/></label>
             <div className="cloud-auth-actions"><button className="primary" type="submit" disabled={authBusy}>{authBusy ? <RefreshCw size={14} className="spin"/> : <LogIn size={14}/>} {authMode === "signin" ? "Entrar e sincronizar" : "Criar conta"}</button><button type="button" className="text-link" onClick={()=>{setAuthMode(authMode === "signin" ? "signup" : "signin");setAuthError("");}}>{authMode === "signin" ? "Criar uma conta" : "Já tenho conta"}</button></div>
             {authError && <p className="auth-error">{authError}</p>}
           </form>}
         {cloudMessage && <p className="cloud-message">{cloudMessage}</p>}
       </section>
      <div className="metrics"><div><span>Empresas registadas</span><b>{leads.length}</b></div><div><span>Sem website</span><b>{leads.filter(x => x.websiteStatus === "Sem website").length}</b></div><div><span>Em negociação</span><b>{leads.filter(x => x.status === "Em negociação").length}</b></div><div><span>Clientes ganhos</span><b>{leads.filter(x => x.status === "Ganho").length}</b></div></div>
      <section className="workspace">
        <div className="section-head"><div><h2>Prospecção empresarial</h2><p>Cria uma ficha para cada empresa que o Caçador vai investigar.</p></div><button className="primary" onClick={() => setShowForm(true)}><Plus size={16}/> Nova empresa</button></div>
        <div className="toolbar"><div className="search"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Pesquisar empresa, setor ou cidade..."/></div><div className="filter"><Filter size={15}/><select value={filter} onChange={e => setFilter(e.target.value as LeadStatus | "Todos")}><option>Todos</option>{statuses.map(s => <option key={s}>{s}</option>)}</select></div><div className="backup-actions"><button className="secondary" onClick={exportBackup} disabled={!leads.length}><Download size={14}/> Cópia</button><label className="secondary import-button"><Upload size={14}/> Importar<input className="backup-input" type="file" accept="application/json,.json" onChange={e => { void importBackup(e.target.files?.[0]); e.currentTarget.value = ""; }}/></label></div></div>
        {visible.length === 0 ? <div className="empty"><Building2 size={30}/><b>{leads.length ? "Nenhum resultado encontrado" : "Ainda não existem empresas"}</b><span>Adiciona a primeira empresa para começar a construir a tua carteira de oportunidades.</span><button className="secondary" onClick={() => setShowForm(true)}><Plus size={15}/> Registar empresa</button></div> :
          <div className="lead-list">{visible.map(lead => <button className={"lead-row " + (selected === lead.id ? "chosen" : "")} key={lead.id} onClick={() => setSelected(lead.id)}><div className="company-mark"><Building2 size={19}/></div><div className="company-info"><b>{lead.company}</b><span>{[lead.category, lead.city].filter(Boolean).join(" · ") || "Setor e localização por preencher"}</span></div><span className={"site-pill " + (lead.websiteStatus === "Sem website" ? "missing" : lead.websiteStatus === "Website com problemas" ? "issue" : "")}>{lead.websiteStatus}</span><span className="status-pill">{lead.status}</span><ExternalLink size={15}/></button>)}</div>}
      </section>
      {current && <section className="detail">
        <div className="section-head"><div><div className="eyebrow">FICHA DA OPORTUNIDADE</div><h2>{current.company}</h2><p>{current.category || "Setor não definido"} · {current.city || "Localização não definida"}</p></div><button className="icon-btn" onClick={() => setSelected(null)} aria-label="Fechar"><X size={18}/></button></div>
        <div className="detail-grid"><label>Estado comercial<select value={current.status} onChange={e => patch(current.id, {status:e.target.value as LeadStatus})}>{statuses.map(s=><option key={s}>{s}</option>)}</select></label><label>Presença digital<select value={current.websiteStatus} onChange={e => patch(current.id, {websiteStatus:e.target.value as WebsiteStatus})}><option>Não verificado</option><option>Sem website</option><option>Tem website</option><option>Website com problemas</option></select></label><label>Website<input value={current.website} placeholder="https://..." onChange={e=>patch(current.id,{website:e.target.value})}/></label><label>Telefone público<input value={current.publicPhone} placeholder="+244..." onChange={e=>patch(current.id,{publicPhone:e.target.value})}/></label><label>Nome do contacto (se conhecido)<input value={current.contactName} onChange={e=>patch(current.id,{contactName:e.target.value})}/></label><label>Próxima ação<input value={current.nextAction} placeholder="Ex.: preparar proposta" onChange={e=>patch(current.id,{nextAction:e.target.value})}/></label></div>
        <label className="notes-label">Notas da investigação<textarea value={current.notes} rows={4} placeholder="Regista informações públicas, necessidades identificadas, problemas observados e contexto da conversa..." onChange={e=>patch(current.id,{notes:e.target.value})}/></label>
        <div className="actions"><button className="secondary" onClick={()=>searchWeb(current)}><Search size={15}/> Pesquisar empresa</button>{current.website && <button className="secondary" onClick={()=>window.open(current.website.startsWith("http")?current.website:"https://"+current.website,"_blank","noopener,noreferrer")}><Globe2 size={15}/> Abrir website</button>}{current.publicPhone && <button className="whatsapp" onClick={()=>openWhatsApp(current)}><MessageCircle size={15}/> Abrir WhatsApp</button>}<button className="danger" onClick={()=>remove(current.id)}><Trash2 size={15}/> Eliminar</button></div>
        <div className="research-links"><b><Search size={14}/> Fontes públicas para investigar</b><p>Abre uma fonte de cada vez, confirma os dados e regista apenas informações públicas na ficha da empresa.</p><div>{getResearchLinks(current).map(link => <a key={link.label} href={link.url} target="_blank" rel="noopener noreferrer">{link.label}<ExternalLink size={11}/></a>)}</div></div>
        <div className="script"><ClipboardList size={17}/><div><b>Orientação comercial</b><p>Apresenta-te com transparência, confirma se estás a falar com a pessoa responsável, pergunta se é um bom momento e se aceita conversar. Se não houver interesse, respeita a decisão e regista-a.</p></div></div>
      </section>}
      {current && user && <section className="detail crm-workspace">
        <div className="section-head"><div><div className="eyebrow">REGISTOS NA NUVEM</div><h2>Conversas e tarefas</h2><p>Histórico interno e próximos passos desta empresa. Nada é enviado automaticamente.</p></div>{workspaceBusy && <RefreshCw size={16} className="spin"/>}</div>
        <div className="crm-columns">
          <div className="crm-column">
            <h3>Conversas</h3>
            <form className="crm-form" onSubmit={addConversation}>
              <input value={conversationTitle} onChange={e=>setConversationTitle(e.target.value)} placeholder="Assunto (ex.: Primeiro contacto)"/>
              <button className="primary" type="submit" disabled={workspaceBusy}><Plus size={14}/> Criar registo</button>
            </form>
            {workspaceData.conversations.length === 0 ? <p className="crm-empty">Ainda não há conversas registadas.</p> :
              <div className="crm-conversations">{workspaceData.conversations.map(item=><button type="button" key={item.id} className={selectedConversation===item.id?"crm-conversation active":"crm-conversation"} onClick={()=>setSelectedConversation(item.id)}><b>{item.subject || "Conversa sem assunto"}</b><span>{new Date(item.created_at).toLocaleString("pt-PT")} · {item.status === "open" ? "Aberta" : item.status === "waiting" ? "A aguardar" : "Fechada"}</span></button>)}</div>}
            {selectedConversation && <div className="crm-messages">
              <b>Notas desta conversa</b>
              {workspaceData.messages.filter(item=>item.conversation_id===selectedConversation).map(item=><div className="crm-note" key={item.id}><span>{new Date(item.sent_at).toLocaleString("pt-PT")}</span><p>{item.body}</p></div>)}
              <form className="crm-form" onSubmit={addInternalMessage}><textarea value={messageBody} onChange={e=>setMessageBody(e.target.value)} placeholder="Registar nota interna sobre o contacto..." rows={3} required/><button className="secondary" type="submit" disabled={workspaceBusy || !messageBody.trim()}><Save size={14}/> Guardar nota interna</button></form>
            </div>}
          </div>
          <div className="crm-column">
            <h3>Tarefas</h3>
            <form className="crm-form" onSubmit={addTask}>
              <input value={taskTitle} onChange={e=>setTaskTitle(e.target.value)} placeholder="O que é preciso fazer?" required/>
              <textarea value={taskDetails} onChange={e=>setTaskDetails(e.target.value)} placeholder="Detalhes (opcional)" rows={2}/>
              <label>Prazo (opcional)<input type="date" value={taskDue} onChange={e=>setTaskDue(e.target.value)}/></label>
              <button className="primary" type="submit" disabled={workspaceBusy}><Plus size={14}/> Adicionar tarefa</button>
            </form>
            {workspaceData.tasks.length === 0 ? <p className="crm-empty">Ainda não há tarefas para esta empresa.</p> :
              <div className="crm-tasks">{workspaceData.tasks.map(task=><label className={task.status==="done"?"crm-task done":"crm-task"} key={task.id}><input type="checkbox" checked={task.status==="done"} onChange={()=>void toggleTask(task)}/><span><b>{task.title}</b>{task.details && <small>{task.details}</small>}{task.due_at && <small>Prazo: {new Date(task.due_at).toLocaleDateString("pt-PT")}</small>}</span></label>)}</div>}
          </div>
        </div>
      </section>}
      <footer>Caçador · Nuvem <span>{saved ? "Alterações guardadas" : user ? "Sincronizado com a tua conta" : "Dados guardados neste dispositivo"}</span></footer>
    </main>
    {showForm && <div className="modal-bg" onClick={()=>setShowForm(false)}><form className="modal" onSubmit={e=>{e.preventDefault();add();}} onClick={e=>e.stopPropagation()}><button type="button" className="close" onClick={()=>setShowForm(false)}><X size={18}/></button><div className="eyebrow">NOVA OPORTUNIDADE</div><h2>Registar empresa</h2><p>Começa com os dados públicos que já conheces. Podes completar a investigação depois.</p><label>Nome da empresa *<input required autoFocus value={draft.company} onChange={e=>setDraft({...draft,company:e.target.value})} placeholder="Ex.: Empresa ABC"/></label><label>Setor de atividade<input value={draft.category} onChange={e=>setDraft({...draft,category:e.target.value})} placeholder="Ex.: Restaurante, clínica..."/></label><label>Cidade / localização<input value={draft.city} onChange={e=>setDraft({...draft,city:e.target.value})} placeholder="Ex.: Luanda"/></label><label>Website (se conhecido)<input value={draft.website} onChange={e=>setDraft({...draft,website:e.target.value})} placeholder="https://..."/></label><label>Telefone público<input value={draft.publicPhone} onChange={e=>setDraft({...draft,publicPhone:e.target.value})} placeholder="+244..."/></label><div className="modal-actions"><button type="button" className="secondary" onClick={()=>setShowForm(false)}>Cancelar</button><button type="submit" className="primary"><Save size={15}/> Guardar empresa</button></div></form></div>}
  </div>;
}
const css = `
.crm-columns{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-top:18px}.crm-column{min-width:0;border:1px solid #ececf2;border-radius:9px;padding:14px}.crm-column h3{font-size:12px;margin:0 0 12px}.crm-form{display:flex;flex-direction:column;gap:8px;margin:10px 0}.crm-form input,.crm-form textarea{width:100%;border:1px solid #e3e4eb;border-radius:7px;padding:9px;font:inherit;font-size:10px;background:white}.crm-form label{display:flex;flex-direction:column;gap:5px;font-size:9px;color:#777}.crm-form button{align-self:flex-start}.crm-empty{font-size:10px;color:#999;line-height:1.5}.crm-conversations{display:flex;flex-direction:column;gap:6px}.crm-conversation{display:flex;flex-direction:column;gap:4px;text-align:left;background:#fafaff;border:1px solid #ececf2;border-radius:7px;padding:9px;cursor:pointer}.crm-conversation.active{border-color:#9b83e8;background:#f5f1ff}.crm-conversation b,.crm-task b{font-size:10px;color:#393944}.crm-conversation span,.crm-note span,.crm-task small{font-size:9px;color:#92939d}.crm-messages{margin-top:14px;border-top:1px solid #eee;padding-top:12px}.crm-messages> b{font-size:10px}.crm-note{padding:8px;background:#f7f6fb;border-radius:6px;margin-top:7px}.crm-note p{font-size:10px;line-height:1.5;margin:5px 0 0;white-space:pre-wrap}.crm-tasks{display:flex;flex-direction:column;gap:8px}.crm-task{display:flex;align-items:flex-start;gap:8px;border:1px solid #ececf2;border-radius:7px;padding:9px}.crm-task input{margin-top:2px}.crm-task span{display:flex;flex-direction:column;gap:4px}.crm-task.done b{text-decoration:line-through;color:#999}.crm-task small{line-height:1.4}
.hunter{min-height:100vh;background:#f5f6fa;color:#20212a;font-family:Inter,system-ui,sans-serif}.hunter-top{height:68px;background:#fff;border-bottom:1px solid #e9eaf0;display:flex;align-items:center;justify-content:space-between;padding:0 max(24px,calc((100vw - 1180px)/2))}.back{display:flex;align-items:center;gap:8px;color:#747684;text-decoration:none;font-size:12px;font-weight:600}.hunter-brand{display:flex;align-items:center;gap:10px}.hunter-brand>span{width:34px;height:34px;border-radius:10px;background:#20164b;color:#fff;display:grid;place-items:center;font-weight:800;font-size:11px}.hunter-brand div{display:flex;flex-direction:column;gap:2px}.hunter-brand b{font-size:14px}.hunter-brand small{font-size:9px;color:#9293a0}.top-status{font-size:10px;color:#777987;display:flex;align-items:center;gap:7px}.top-status i{width:7px;height:7px;background:#22a779;border-radius:50%}.hunter-main{max-width:1120px;margin:auto;padding:35px 24px}.hero{background:linear-gradient(115deg,#1e1645,#46308b);color:white;border-radius:16px;padding:35px 42px;min-height:230px;display:flex;align-items:center;justify-content:space-between;overflow:hidden}.eyebrow{font-size:9px;font-weight:800;letter-spacing:1.2px;color:#8061d6;display:flex;align-items:center;gap:6px}.hero .eyebrow{color:#d1c4ff}.hero h1{font-size:34px;line-height:1.12;letter-spacing:-1.3px;margin:15px 0 9px}.hero h1 em{font-style:normal;color:#c8b7ff}.hero p{font-size:12px;color:#d6d1e7;max-width:490px;line-height:1.7;margin:0}.hero-icon{width:145px;height:145px;border:1px solid #ffffff36;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;color:#d3c4ff;margin-right:35px}.hero-icon span{font-size:8px;letter-spacing:2px;font-weight:800}.notice{margin:18px 0;background:#fff9e9;border:1px solid #f1e4bf;color:#89651b;border-radius:10px;padding:13px 16px;display:flex;gap:11px;align-items:flex-start}.notice svg{flex-shrink:0;margin-top:2px}.notice div{display:flex;flex-direction:column;gap:3px}.notice b{font-size:11px}.notice span{font-size:10px;line-height:1.6;color:#927c50}.cloud-panel{background:#fff;border:1px solid #e9eaf0;border-radius:11px;padding:16px 18px;margin:17px 0;display:flex;flex-direction:column;gap:12px}.cloud-panel-heading{display:flex;align-items:center;gap:10px;color:#6842dc}.cloud-panel-heading div{display:flex;flex-direction:column;gap:3px}.cloud-panel-heading b{font-size:11px;color:#30313a}.cloud-panel-heading span{font-size:10px;color:#858692;overflow-wrap:anywhere}.cloud-setup{display:flex;flex-wrap:wrap;align-items:center;gap:8px}.cloud-setup p{width:100%;font-size:10px;line-height:1.5;color:#777987;margin:0}.cloud-setup code{font-size:9px;background:#f5f3fb;color:#5940a8;padding:6px 8px;border-radius:5px}.cloud-setup a{font-size:10px;color:#6542c8;text-decoration:underline}.cloud-auth{display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:end}.cloud-auth label{display:flex;flex-direction:column;gap:5px;font-size:10px;font-weight:700;color:#626371}.cloud-auth input{height:36px;border:1px solid #e3e4eb;border-radius:7px;padding:8px 10px;font:inherit;font-size:11px}.cloud-auth-actions{grid-column:1/-1;display:flex;align-items:center;gap:12px}.cloud-auth-actions .primary{height:34px}.text-link{border:0;background:none;color:#6842dc;font-size:10px;font-weight:700;cursor:pointer}.auth-error{grid-column:1/-1;color:#bf4655;font-size:10px;margin:0}.cloud-session{display:flex;align-items:center;justify-content:space-between;gap:10px}.cloud-session span{font-size:10px;color:#16804e;display:flex;align-items:center;gap:7px}.cloud-session i{width:7px;height:7px;border-radius:50%;background:#22a779}.cloud-message{margin:0;color:#777987;font-size:10px;line-height:1.5;overflow-wrap:anywhere}.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:18px 0}.metrics>div{background:white;border:1px solid #e9eaf0;border-radius:10px;padding:16px;display:flex;flex-direction:column;gap:8px}.metrics span{font-size:10px;color:#898b98}.metrics b{font-size:24px;letter-spacing:-.5px}.workspace,.detail{background:#fff;border:1px solid #e9eaf0;border-radius:12px;padding:22px;margin-top:18px}.section-head{display:flex;align-items:center;justify-content:space-between;gap:15px}.section-head h2{font-size:16px;margin:0 0 4px}.section-head p{font-size:10px;color:#90919c;margin:0}.primary,.secondary,.whatsapp,.danger,.icon-btn{height:36px;border-radius:7px;padding:0 12px;display:inline-flex;align-items:center;justify-content:center;gap:7px;font-size:10px;font-weight:700;cursor:pointer}.primary{background:#6842dc;border:1px solid #6842dc;color:white}.secondary{background:white;border:1px solid #e1e2e9;color:#5f6070}.whatsapp{background:#eaf8f0;border:1px solid #ccebd9;color:#16804e}.danger{background:white;border:1px solid #f0d9dc;color:#c34d5a}.icon-btn{width:34px;padding:0;background:white;border:1px solid #e5e5ec;color:#666}.toolbar{display:flex;gap:9px;margin:20px 0 12px;align-items:center}.backup-actions{display:flex;gap:7px}.import-button{position:relative;cursor:pointer}.backup-input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}.search,.filter{height:39px;border:1px solid #e5e6ed;border-radius:7px;display:flex;align-items:center;gap:8px;padding:0 11px;color:#8c8e9a}.search{flex:1}.search input{border:0;outline:0;width:100%;font:inherit;font-size:11px}.filter select{border:0;background:transparent;outline:0;color:#656674;font:inherit;font-size:10px}.lead-list{border-top:1px solid #eff0f4}.lead-row{width:100%;min-height:65px;background:white;border:0;border-bottom:1px solid #eff0f4;display:grid;grid-template-columns:36px minmax(150px,1fr) 150px 115px 16px;align-items:center;gap:12px;text-align:left;padding:8px 5px;color:#30313a;cursor:pointer}.lead-row:hover,.lead-row.chosen{background:#faf9ff}.company-mark{width:34px;height:34px;border-radius:8px;background:#f0edfa;color:#7254c7;display:grid;place-items:center}.company-info{display:flex;flex-direction:column;gap:4px;min-width:0}.company-info b{font-size:11px}.company-info span{font-size:9px;color:#92939d;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.site-pill,.status-pill{font-size:9px;color:#777987}.site-pill.missing{color:#bd7b25}.site-pill.issue{color:#c34d5a}.status-pill{background:#f2f1f7;padding:5px 7px;border-radius:5px;justify-self:start}.lead-row>svg{color:#a0a1aa}.empty{min-height:210px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:9px;color:#92939d;text-align:center}.empty b{font-size:12px;color:#3a3b45}.empty span{font-size:10px;max-width:340px;line-height:1.6}.detail{padding:22px}.detail .section-head{margin-bottom:18px}.detail .section-head h2{margin-top:6px}.detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px}.detail label,.modal label,.notes-label{font-size:10px;font-weight:700;color:#626371;display:flex;flex-direction:column;gap:6px}.detail input,.detail select,.detail textarea,.modal input{width:100%;border:1px solid #e3e4eb;border-radius:7px;padding:10px;font:inherit;font-size:11px;color:#343541;outline:0;background:white}.notes-label{margin-top:14px}.detail textarea{resize:vertical;line-height:1.6}.actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:15px}.research-links{margin-top:14px;padding:14px;border:1px solid #eceaf5;background:#fbfaff;border-radius:9px}.research-links>b{display:flex;align-items:center;gap:7px;color:#555366;font-size:11px}.research-links>p{margin:5px 0 10px;color:#858493;font-size:10px;line-height:1.5}.research-links>div{display:flex;flex-wrap:wrap;gap:7px}.research-links a{display:inline-flex;align-items:center;gap:6px;padding:7px 9px;background:#fff;border:1px solid #e4e1ef;border-radius:7px;color:#6544be;text-decoration:none;font-size:10px;font-weight:700}.research-links a:hover{background:#f1edff;border-color:#cfc3f5}.script{margin-top:17px;padding:13px;background:#f7f5ff;border-radius:8px;color:#7358c0;display:flex;gap:10px}.script b{font-size:10px}.script p{font-size:10px;line-height:1.6;color:#747184;margin:4px 0 0}.hunter footer{display:flex;justify-content:space-between;color:#a0a1aa;font-size:9px;padding:22px 2px}.modal-bg{position:fixed;inset:0;background:#15112680;z-index:50;display:grid;place-items:center;padding:16px;overflow:auto}.modal{width:min(100%,470px);background:white;border-radius:14px;padding:25px;position:relative;display:flex;flex-direction:column;gap:12px;max-height:94vh;overflow:auto}.modal h2{font-size:20px;margin:0}.modal>p{font-size:10px;color:#898a95;line-height:1.6;margin:0 0 5px}.modal label{gap:6px}.modal input{height:38px}.close{position:absolute;right:16px;top:16px;border:0;background:none;color:#888;cursor:pointer}.modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:8px}
@media(max-width:700px){.crm-columns{grid-template-columns:1fr}.cloud-auth{grid-template-columns:1fr}.cloud-session{align-items:flex-start;flex-direction:column}.backup-actions{width:100%}.backup-actions>*{flex:1}.hunter-top{padding:0 13px;height:60px}.back{font-size:0}.back svg{width:19px}.top-status{font-size:0}.hunter-main{padding:18px 12px}.hero{padding:25px 20px;min-height:205px}.hero h1{font-size:27px}.hero p{font-size:10px;max-width:270px}.hero-icon{width:85px;height:85px;margin:0 0 0 8px;flex-shrink:0}.hero-icon svg{width:30px}.hero-icon span{font-size:6px}.metrics{grid-template-columns:1fr 1fr;gap:8px}.metrics>div{padding:12px}.workspace,.detail{padding:15px}.section-head h2{font-size:14px}.section-head p{line-height:1.5}.section-head .primary{font-size:0;width:36px;padding:0}.section-head .primary svg{width:17px}.toolbar{flex-direction:column}.lead-row{grid-template-columns:34px minmax(90px,1fr) 16px;gap:8px}.lead-row .site-pill,.lead-row .status-pill{display:none}.detail-grid{grid-template-columns:1fr}.actions>*{flex:1}.hunter footer{font-size:8px}}
`;
