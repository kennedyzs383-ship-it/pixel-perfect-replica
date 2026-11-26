import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Building2, Search, Plus, ExternalLink, MessageCircle, ClipboardList, Target, Sparkles, ShieldCheck, Globe2, Trash2, X, Save, Filter, Download, Upload } from "lucide-react";

export const Route = createFileRoute("/cacador")({
  head: () => ({ meta: [
    { title: "Nuvem | Caçador" },
    { name: "description", content: "Centro de prospeção e gestão comercial do Caçador." },
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
function readLeads(): Lead[] {
  try { const value = localStorage.getItem(KEY); return value ? JSON.parse(value) as Lead[] : []; }
  catch { return []; }
}
function CacadorPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<LeadStatus | "Todos">("Todos");
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState(emptyLead());
  const [selected, setSelected] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => { setLeads(readLeads()); }, []);
  const persist = (next: Lead[]) => { setLeads(next); localStorage.setItem(KEY, JSON.stringify(next)); setSaved(true); window.setTimeout(() => setSaved(false), 1800); };
  const visible = useMemo(() => leads.filter((lead) => (filter === "Todos" || lead.status === filter) && [lead.company, lead.category, lead.city, lead.contactName].join(" ").toLowerCase().includes(query.toLowerCase())), [leads, filter, query]);
  const current = leads.find((lead) => lead.id === selected) ?? null;
  const patch = (id: string, changes: Partial<Lead>) => persist(leads.map((lead) => lead.id === id ? { ...lead, ...changes } : lead));
  const add = () => {
    if (!draft.company.trim()) return;
    const lead: Lead = { ...draft, company: draft.company.trim(), id: crypto.randomUUID(), createdAt: new Date().toISOString() };
    persist([lead, ...leads]); setDraft(emptyLead()); setShowForm(false); setSelected(lead.id);
  };
  const remove = (id: string) => { if (!window.confirm("Eliminar esta empresa da lista?")) return; persist(leads.filter((lead) => lead.id !== id)); if (selected === id) setSelected(null); };
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
      <section className="notice"><ShieldCheck size={18}/><div><b>Modo assistido ativo</b><span>O Caçador ainda não tem motor de IA, pesquisa automática nem chamadas ligadas. Nesta fase, os registos são guardados neste dispositivo e as pesquisas/contactos são iniciados manualmente. Não enviamos mensagens nem fazemos chamadas sem ação tua.</span></div></section>
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
        <div className="script"><ClipboardList size={17}/><div><b>Orientação comercial</b><p>Apresenta-te com transparência, confirma se estás a falar com a pessoa responsável, pergunta se é um bom momento e se aceita conversar. Se não houver interesse, respeita a decisão e regista-a.</p></div></div>
      </section>}
      <footer>Caçador · Nuvem <span>{saved ? "Alterações guardadas" : "Dados guardados neste dispositivo"}</span></footer>
    </main>
    {showForm && <div className="modal-bg" onClick={()=>setShowForm(false)}><form className="modal" onSubmit={e=>{e.preventDefault();add();}} onClick={e=>e.stopPropagation()}><button type="button" className="close" onClick={()=>setShowForm(false)}><X size={18}/></button><div className="eyebrow">NOVA OPORTUNIDADE</div><h2>Registar empresa</h2><p>Começa com os dados públicos que já conheces. Podes completar a investigação depois.</p><label>Nome da empresa *<input required autoFocus value={draft.company} onChange={e=>setDraft({...draft,company:e.target.value})} placeholder="Ex.: Empresa ABC"/></label><label>Setor de atividade<input value={draft.category} onChange={e=>setDraft({...draft,category:e.target.value})} placeholder="Ex.: Restaurante, clínica..."/></label><label>Cidade / localização<input value={draft.city} onChange={e=>setDraft({...draft,city:e.target.value})} placeholder="Ex.: Luanda"/></label><label>Website (se conhecido)<input value={draft.website} onChange={e=>setDraft({...draft,website:e.target.value})} placeholder="https://..."/></label><label>Telefone público<input value={draft.publicPhone} onChange={e=>setDraft({...draft,publicPhone:e.target.value})} placeholder="+244..."/></label><div className="modal-actions"><button type="button" className="secondary" onClick={()=>setShowForm(false)}>Cancelar</button><button type="submit" className="primary"><Save size={15}/> Guardar empresa</button></div></form></div>}
  </div>;
}
const css = `
.hunter{min-height:100vh;background:#f5f6fa;color:#20212a;font-family:Inter,system-ui,sans-serif}.hunter-top{height:68px;background:#fff;border-bottom:1px solid #e9eaf0;display:flex;align-items:center;justify-content:space-between;padding:0 max(24px,calc((100vw - 1180px)/2))}.back{display:flex;align-items:center;gap:8px;color:#747684;text-decoration:none;font-size:12px;font-weight:600}.hunter-brand{display:flex;align-items:center;gap:10px}.hunter-brand>span{width:34px;height:34px;border-radius:10px;background:#20164b;color:#fff;display:grid;place-items:center;font-weight:800;font-size:11px}.hunter-brand div{display:flex;flex-direction:column;gap:2px}.hunter-brand b{font-size:14px}.hunter-brand small{font-size:9px;color:#9293a0}.top-status{font-size:10px;color:#777987;display:flex;align-items:center;gap:7px}.top-status i{width:7px;height:7px;background:#22a779;border-radius:50%}.hunter-main{max-width:1120px;margin:auto;padding:35px 24px}.hero{background:linear-gradient(115deg,#1e1645,#46308b);color:white;border-radius:16px;padding:35px 42px;min-height:230px;display:flex;align-items:center;justify-content:space-between;overflow:hidden}.eyebrow{font-size:9px;font-weight:800;letter-spacing:1.2px;color:#8061d6;display:flex;align-items:center;gap:6px}.hero .eyebrow{color:#d1c4ff}.hero h1{font-size:34px;line-height:1.12;letter-spacing:-1.3px;margin:15px 0 9px}.hero h1 em{font-style:normal;color:#c8b7ff}.hero p{font-size:12px;color:#d6d1e7;max-width:490px;line-height:1.7;margin:0}.hero-icon{width:145px;height:145px;border:1px solid #ffffff36;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:8px;color:#d3c4ff;margin-right:35px}.hero-icon span{font-size:8px;letter-spacing:2px;font-weight:800}.notice{margin:18px 0;background:#fff9e9;border:1px solid #f1e4bf;color:#89651b;border-radius:10px;padding:13px 16px;display:flex;gap:11px;align-items:flex-start}.notice svg{flex-shrink:0;margin-top:2px}.notice div{display:flex;flex-direction:column;gap:3px}.notice b{font-size:11px}.notice span{font-size:10px;line-height:1.6;color:#927c50}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:18px 0}.metrics>div{background:white;border:1px solid #e9eaf0;border-radius:10px;padding:16px;display:flex;flex-direction:column;gap:8px}.metrics span{font-size:10px;color:#898b98}.metrics b{font-size:24px;letter-spacing:-.5px}.workspace,.detail{background:#fff;border:1px solid #e9eaf0;border-radius:12px;padding:22px;margin-top:18px}.section-head{display:flex;align-items:center;justify-content:space-between;gap:15px}.section-head h2{font-size:16px;margin:0 0 4px}.section-head p{font-size:10px;color:#90919c;margin:0}.primary,.secondary,.whatsapp,.danger,.icon-btn{height:36px;border-radius:7px;padding:0 12px;display:inline-flex;align-items:center;justify-content:center;gap:7px;font-size:10px;font-weight:700;cursor:pointer}.primary{background:#6842dc;border:1px solid #6842dc;color:white}.secondary{background:white;border:1px solid #e1e2e9;color:#5f6070}.whatsapp{background:#eaf8f0;border:1px solid #ccebd9;color:#16804e}.danger{background:white;border:1px solid #f0d9dc;color:#c34d5a}.icon-btn{width:34px;padding:0;background:white;border:1px solid #e5e5ec;color:#666}.toolbar{display:flex;gap:9px;margin:20px 0 12px;align-items:center}.backup-actions{display:flex;gap:7px}.import-button{position:relative;cursor:pointer}.backup-input{position:absolute;width:1px;height:1px;opacity:0;pointer-events:none}.search,.filter{height:39px;border:1px solid #e5e6ed;border-radius:7px;display:flex;align-items:center;gap:8px;padding:0 11px;color:#8c8e9a}.search{flex:1}.search input{border:0;outline:0;width:100%;font:inherit;font-size:11px}.filter select{border:0;background:transparent;outline:0;color:#656674;font:inherit;font-size:10px}.lead-list{border-top:1px solid #eff0f4}.lead-row{width:100%;min-height:65px;background:white;border:0;border-bottom:1px solid #eff0f4;display:grid;grid-template-columns:36px minmax(150px,1fr) 150px 115px 16px;align-items:center;gap:12px;text-align:left;padding:8px 5px;color:#30313a;cursor:pointer}.lead-row:hover,.lead-row.chosen{background:#faf9ff}.company-mark{width:34px;height:34px;border-radius:8px;background:#f0edfa;color:#7254c7;display:grid;place-items:center}.company-info{display:flex;flex-direction:column;gap:4px;min-width:0}.company-info b{font-size:11px}.company-info span{font-size:9px;color:#92939d;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.site-pill,.status-pill{font-size:9px;color:#777987}.site-pill.missing{color:#bd7b25}.site-pill.issue{color:#c34d5a}.status-pill{background:#f2f1f7;padding:5px 7px;border-radius:5px;justify-self:start}.lead-row>svg{color:#a0a1aa}.empty{min-height:210px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:9px;color:#92939d;text-align:center}.empty b{font-size:12px;color:#3a3b45}.empty span{font-size:10px;max-width:340px;line-height:1.6}.detail{padding:22px}.detail .section-head{margin-bottom:18px}.detail .section-head h2{margin-top:6px}.detail-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px}.detail label,.modal label,.notes-label{font-size:10px;font-weight:700;color:#626371;display:flex;flex-direction:column;gap:6px}.detail input,.detail select,.detail textarea,.modal input{width:100%;border:1px solid #e3e4eb;border-radius:7px;padding:10px;font:inherit;font-size:11px;color:#343541;outline:0;background:white}.notes-label{margin-top:14px}.detail textarea{resize:vertical;line-height:1.6}.actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:15px}.script{margin-top:17px;padding:13px;background:#f7f5ff;border-radius:8px;color:#7358c0;display:flex;gap:10px}.script b{font-size:10px}.script p{font-size:10px;line-height:1.6;color:#747184;margin:4px 0 0}.hunter footer{display:flex;justify-content:space-between;color:#a0a1aa;font-size:9px;padding:22px 2px}.modal-bg{position:fixed;inset:0;background:#15112680;z-index:50;display:grid;place-items:center;padding:16px;overflow:auto}.modal{width:min(100%,470px);background:white;border-radius:14px;padding:25px;position:relative;display:flex;flex-direction:column;gap:12px;max-height:94vh;overflow:auto}.modal h2{font-size:20px;margin:0}.modal>p{font-size:10px;color:#898a95;line-height:1.6;margin:0 0 5px}.modal label{gap:6px}.modal input{height:38px}.close{position:absolute;right:16px;top:16px;border:0;background:none;color:#888;cursor:pointer}.modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:8px}
@media(max-width:700px){.backup-actions{width:100%}.backup-actions>*{flex:1}.hunter-top{padding:0 13px;height:60px}.back{font-size:0}.back svg{width:19px}.top-status{font-size:0}.hunter-main{padding:18px 12px}.hero{padding:25px 20px;min-height:205px}.hero h1{font-size:27px}.hero p{font-size:10px;max-width:270px}.hero-icon{width:85px;height:85px;margin:0 0 0 8px;flex-shrink:0}.hero-icon svg{width:30px}.hero-icon span{font-size:6px}.metrics{grid-template-columns:1fr 1fr;gap:8px}.metrics>div{padding:12px}.workspace,.detail{padding:15px}.section-head h2{font-size:14px}.section-head p{line-height:1.5}.section-head .primary{font-size:0;width:36px;padding:0}.section-head .primary svg{width:17px}.toolbar{flex-direction:column}.lead-row{grid-template-columns:34px minmax(90px,1fr) 16px;gap:8px}.lead-row .site-pill,.lead-row .status-pill{display:none}.detail-grid{grid-template-columns:1fr}.actions>*{flex:1}.hunter footer{font-size:8px}}
`;
