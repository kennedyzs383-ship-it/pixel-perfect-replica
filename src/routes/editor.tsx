import { createFileRoute } from "@tanstack/react-router";
import { getEditorDraft, getSites, saveEditorDraft, updateSite } from "../lib/nuvem-workspace";
import { useEffect, useState } from "react";
import {
  ArrowLeft, ArrowDown, ArrowUp, Eye, ImagePlus, LayoutTemplate,
  Monitor, Plus, Save, Smartphone, Trash2, Type, Download,
  Settings2, Palette, MousePointer2, Check, ExternalLink
} from "lucide-react";

export const Route = createFileRoute("/editor")({
  head: () => ({
    meta: [
      { title: "Nuvem | Construtor visual" },
      { name: "description", content: "Edita, pré-visualiza e exporta o teu website no construtor visual Nuvem." },
      { property: "og:title", content: "Nuvem | Construtor visual" },
      { property: "og:description", content: "Edita, pré-visualiza e exporta o teu website no construtor visual Nuvem." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: VisualEditor,
});

type Block = { id: string; type: "hero" | "text" | "button" | "image" | "features"; title: string; body: string; label?: string; image?: string; };
const starter: Block[] = [
  { id: "hero", type: "hero", title: "A tua marca merece destaque.", body: "Cria uma presença digital que inspira confiança. Apresenta os teus serviços e liga-te aos teus clientes.", label: "Começar agora" },
  { id: "intro", type: "text", title: "Bem-vindo ao nosso espaço", body: "Conta aqui a história do teu projeto. Explica o que fazes, para quem trabalhas e o que torna a tua marca especial." },
  { id: "features", type: "features", title: "O que oferecemos", body: "Soluções simples, qualidade em cada detalhe e acompanhamento próximo." },
];
const uid = () => Math.random().toString(36).slice(2, 9);

function VisualEditor() {
  const [blocks, setBlocks] = useState<Block[]>(starter);
  const [selected, setSelected] = useState("hero");
  const [siteTitle, setSiteTitle] = useState("O meu website");
  const [accent, setAccent] = useState("#6842dc");
  const [saved, setSaved] = useState(false);
  const [siteId, setSiteId] = useState<string | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [preview, setPreview] = useState(false);
  const active = blocks.find((b) => b.id === selected) ?? blocks[0];

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const currentSiteId = params.get("site");
    setSiteId(currentSiteId);
    const data = getEditorDraft<{ blocks?: Block[]; siteTitle?: string; accent?: string; siteId?: string }>(currentSiteId);
    if (!data && currentSiteId) {
      const site = getSites().find((item) => item.id === currentSiteId);
      if (site?.name) setSiteTitle(site.name);
    }
    if (data && (!currentSiteId || data.siteId === currentSiteId)) {
      if (data.blocks?.length) setBlocks(data.blocks);
      if (data.siteTitle) setSiteTitle(data.siteTitle);
      if (data.accent) setAccent(data.accent);
    }
  }, []);

  const update = (patch: Partial<Block>) => setBlocks((old) => old.map((b) => b.id === selected ? { ...b, ...patch } : b));
  const addBlock = (type: Block["type"]) => {
    const labels: Record<Block["type"], string> = { hero: "Nova capa", text: "Novo texto", button: "Novo botão", image: "Nova imagem", features: "Nova secção" };
    const block: Block = { id: uid(), type, title: labels[type], body: "Escreve aqui o conteúdo da tua secção.", label: "Saber mais", image: "" };
    setBlocks((old) => [...old, block]);
    setSelected(block.id);
    setPreview(false);
  };
  const move = (direction: -1 | 1) => setBlocks((old) => {
    const index = old.findIndex((b) => b.id === selected);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= old.length) return old;
    const currentBlock = old[index];
    const nextBlock = old[next];
    if (!currentBlock || !nextBlock) return old;
    const copy = [...old];
    copy[index] = nextBlock;
    copy[next] = currentBlock;
    return copy;
  });
  const save = () => {
    saveEditorDraft({ blocks, siteTitle, accent, siteId }, siteId);
    if (siteId) updateSite(siteId, { name: siteTitle, status: "Rascunho" });
    setSaved(true); window.setTimeout(() => setSaved(false), 2200);
  };
  const exportHtml = () => {
    const body = blocks.map((b) => {
      if (b.type === "image") return `<section><img src="${escapeHtml(b.image || "")}" alt="${escapeHtml(b.title)}" style="max-width:100%;border-radius:16px"></section>`;
      if (b.type === "button") return `<section><a href="#" style="display:inline-block;background:${accent};color:white;padding:14px 22px;border-radius:9px;text-decoration:none">${escapeHtml(b.label || b.title)}</a></section>`;
      if (b.type === "features") return `<section><h2>${escapeHtml(b.title)}</h2><p>${escapeHtml(b.body)}</p><div class="features"><article>Qualidade</article><article>Confiança</article><article>Suporte</article></div></section>`;
      if (b.type === "hero") return `<header><p>O TEU PRÓXIMO CAPÍTULO COMEÇA AQUI</p><h1>${escapeHtml(b.title)}</h1><p>${escapeHtml(b.body)}</p><a href="#">${escapeHtml(b.label || "Saber mais")}</a></header>`;
      return `<section><h2>${escapeHtml(b.title)}</h2><p>${escapeHtml(b.body)}</p></section>`;
    }).join("\
");
    const html = `<!doctype html><html lang="pt"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(siteTitle)}</title><style>*{box-sizing:border-box}body{margin:0;font:16px Arial,sans-serif;color:#242331}header{padding:100px max(8%,calc((100% - 1100px)/2));background:#f3efff}header h1{font-size:clamp(38px,6vw,68px);max-width:800px}header p,section p{line-height:1.8;color:#696878;max-width:720px}header a{display:inline-block;background:${accent};color:#fff;padding:14px 22px;border-radius:9px;text-decoration:none}section{padding:65px max(8%,calc((100% - 1100px)/2))}section h2{font-size:32px}.features{display:flex;gap:14px;flex-wrap:wrap}.features article{padding:24px;background:#f5f4fa;border-radius:12px;flex:1}</style><body>${body}</body></html>`;
    saveEditorDraft({ blocks, siteTitle, accent, siteId }, siteId);
    if (siteId) updateSite(siteId, { name: siteTitle, status: "Exportado", html });
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = "website-nuvem.html"; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="nuvem-editor" style={{ "--editor-accent": accent } as React.CSSProperties}>
      <style>{css}</style>
      <header className="editor-top">
        <a className="back-link" href="/"><ArrowLeft size={17}/> <span>Painel Nuvem</span></a>
        <div className="editor-brand"><span className="editor-mark">N</span><b>Construtor visual</b><small>·</small><input aria-label="Nome do website" value={siteTitle} onChange={(e) => setSiteTitle(e.target.value)} /></div>
        <div className="editor-actions">
          <button className="tool-button" onClick={() => setPreview(!preview)}><Eye size={16}/><span>{preview ? "Editar" : "Pré-visualizar"}</span></button>
          <button className="tool-button" onClick={exportHtml}><Download size={16}/><span>Exportar HTML</span></button>
          <button className="save-button" onClick={save}><Save size={16}/>{saved ? "Guardado" : "Guardar"}</button>
        </div>
      </header>
      <div className="editor-layout">
        {!preview && <aside className="left-tools">
          <div className="panel-title"><LayoutTemplate size={17}/> <b>Elementos</b></div>
          <p className="panel-hint">Adiciona secções à tua página.</p>
          <div className="add-grid">
            <button onClick={() => addBlock("hero")}><LayoutTemplate/><span>Capa</span></button>
            <button onClick={() => addBlock("text")}><Type/><span>Texto</span></button>
            <button onClick={() => addBlock("button")}><MousePointer2/><span>Botão</span></button>
            <button onClick={() => addBlock("image")}><ImagePlus/><span>Imagem</span></button>
            <button onClick={() => addBlock("features")}><Plus/><span>Serviços</span></button>
          </div>
          <div className="panel-divider"/>
          <div className="panel-title"><Palette size={17}/> <b>Identidade</b></div>
          <label className="field-label">Cor principal</label>
          <div className="swatches">{["#6842dc","#0d9488","#2563eb","#db2777","#ea580c","#172554"].map(c => <button key={c} aria-label={c} onClick={() => setAccent(c)} className={accent === c ? "swatch chosen" : "swatch"} style={{background:c}}>{accent === c && <Check size={13}/>}</button>)}</div>
          <div className="panel-divider"/>
          <div className="panel-title"><Globe2 size={17}/> <b>Estrutura da página</b></div>
          <div className="layer-list">{blocks.map((b,i) => <button key={b.id} className={selected === b.id ? "layer selected-layer" : "layer"} onClick={() => setSelected(b.id)}><span>{i+1}</span>{b.title || b.type}</button>)}</div>
          <div className="editor-note">O teu rascunho fica guardado neste dispositivo quando carregas em Guardar.</div>
        </aside>}
        <main className="canvas-area">
          <div className="canvas-toolbar"><div><span className="live-dot"/> Rascunho local</div><div className="device-switch"><button className={device === "desktop" ? "device-active" : ""} onClick={() => setDevice("desktop")} aria-label="Desktop"><Monitor size={16}/></button><button className={device === "mobile" ? "device-active" : ""} onClick={() => setDevice("mobile")} aria-label="Telemóvel"><Smartphone size={16}/></button></div></div>
          <div className="canvas-scroll"><div className={device === "mobile" ? "site-preview mobile-preview" : "site-preview"}>
            <div className="site-nav"><b>{siteTitle}</b><span>Início</span><span>Sobre</span><span>Serviços</span><button style={{background:accent}}>Contactar</button></div>
            {blocks.map((b) => <section key={b.id} onClick={() => !preview && setSelected(b.id)} className={selected === b.id && !preview ? "preview-block active-block" : "preview-block"}>
              {!preview && selected === b.id && <div className="selected-tag">A editar</div>}
              {b.type === "hero" && <div className="preview-hero"><span className="preview-eyebrow">O TEU PRÓXIMO CAPÍTULO COMEÇA AQUI</span><h1>{b.title}</h1><p>{b.body}</p><button style={{background:accent}}>{b.label || "Saber mais"} <ExternalLink size={14}/></button></div>}
              {b.type === "text" && <div className="preview-text"><h2>{b.title}</h2><p>{b.body}</p></div>}
              {b.type === "button" && <div className="preview-text"><button style={{background:accent}}>{b.label || b.title} <ExternalLink size={14}/></button></div>}
              {b.type === "image" && <div className="preview-image">{b.image ? <img src={b.image} alt={b.title}/> : <div><ImagePlus size={28}/><span>Adiciona o endereço de uma imagem no painel de edição.</span></div>}</div>}
              {b.type === "features" && <div className="preview-features"><h2>{b.title}</h2><p>{b.body}</p><div><article><b>01</b><strong>Qualidade</strong><span>Feito com atenção ao detalhe.</span></article><article><b>02</b><strong>Confiança</strong><span>Uma experiência simples e segura.</span></article><article><b>03</b><strong>Acompanhamento</strong><span>Estamos contigo em cada etapa.</span></article></div></div>}
            </section>)}
            <footer className="site-footer">© {new Date().getFullYear()} {siteTitle}. Criado com Nuvem.</footer>
          </div></div>
        </main>
        {!preview && <aside className="right-inspector">
          <div className="panel-title"><Settings2 size={17}/> <b>Editar elemento</b></div>
          {active ? <>
            <label className="field-label">Título</label><input className="editor-input" value={active.title} onChange={(e) => update({title:e.target.value})}/>
            <label className="field-label">Texto</label><textarea className="editor-textarea" rows={5} value={active.body} onChange={(e) => update({body:e.target.value})}/>
            {(active.type === "hero" || active.type === "button") && <><label className="field-label">Texto do botão</label><input className="editor-input" value={active.label || ""} onChange={(e) => update({label:e.target.value})}/></>}
            {active.type === "image" && <><label className="field-label">URL da imagem</label><input className="editor-input" placeholder="https://..." value={active.image || ""} onChange={(e) => update({image:e.target.value})}/></>}
            <div className="panel-divider"/>
            <div className="inspector-actions"><button onClick={() => move(-1)} title="Mover para cima"><ArrowUp size={16}/> Subir</button><button onClick={() => move(1)} title="Mover para baixo"><ArrowDown size={16}/> Descer</button></div>
            <button className="delete-block" onClick={() => { setBlocks((old) => old.filter((b) => b.id !== selected)); setSelected(blocks.find((b) => b.id !== selected)?.id || ""); }}><Trash2 size={15}/> Remover secção</button>
          </> : <p className="panel-hint">Seleciona uma secção na página para editar o seu conteúdo.</p>}
        </aside>}
      </div>
    </div>
  );
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] || char));
}

const css = `
.nuvem-editor{min-height:100vh;background:#f2f3f7;color:#20212a;font-family:Inter,system-ui,sans-serif;--editor-accent:#6842dc}.editor-top{height:64px;background:#fff;border-bottom:1px solid #e8e8ef;display:flex;align-items:center;justify-content:space-between;padding:0 22px;position:sticky;top:0;z-index:5}.back-link{display:flex;align-items:center;gap:8px;color:#666878;text-decoration:none;font-size:12px;font-weight:600;min-width:150px}.editor-brand{display:flex;align-items:center;gap:9px}.editor-mark{display:grid;place-items:center;width:26px;height:26px;background:var(--editor-accent);border-radius:7px;color:white;font-weight:800}.editor-brand b{font-size:13px}.editor-brand small{color:#c4c5cc}.editor-brand input{border:0;outline:0;width:145px;font:600 12px inherit;color:#7d7e89}.editor-actions{display:flex;align-items:center;gap:8px}.tool-button,.save-button{height:34px;padding:0 11px;border:1px solid #e4e4ec;border-radius:7px;background:white;display:flex;align-items:center;gap:7px;font-size:11px;font-weight:600;color:#555765;cursor:pointer}.save-button{background:var(--editor-accent);color:#fff;border-color:var(--editor-accent)}.editor-layout{display:grid;grid-template-columns:245px minmax(0,1fr) 270px;min-height:calc(100vh - 64px)}.left-tools,.right-inspector{background:white;padding:20px 17px;border-right:1px solid #e8e8ef}.right-inspector{border-right:0;border-left:1px solid #e8e8ef}.panel-title{display:flex;align-items:center;gap:9px;font-size:12px;color:#343541}.panel-title svg{color:var(--editor-accent)}.panel-hint{font-size:11px;color:#8c8d98;line-height:1.6;margin:9px 0 17px}.add-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:14px}.add-grid button{height:70px;border:1px solid #ececf2;background:#fff;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;color:#6e6f7b;font-size:10px;cursor:pointer}.add-grid button:hover{border-color:#c8b8fa;color:var(--editor-accent);background:#faf9ff}.add-grid svg{width:19px}.panel-divider{height:1px;background:#ededf2;margin:21px 0}.field-label{display:block;font-size:10px;font-weight:700;color:#666875;margin:16px 0 7px}.swatches{display:flex;gap:9px;flex-wrap:wrap}.swatch{width:25px;height:25px;border:0;border-radius:50%;color:white;display:grid;place-items:center;cursor:pointer}.chosen{outline:2px solid #999;outline-offset:3px}.layer-list{display:flex;flex-direction:column;gap:4px;margin-top:12px}.layer{height:34px;border:0;background:white;border-radius:6px;display:flex;align-items:center;gap:9px;text-align:left;padding:0 8px;font-size:10px;color:#6c6d78;cursor:pointer}.layer span{color:#aaa;font-variant-numeric:tabular-nums}.selected-layer{background:#f2efff;color:var(--editor-accent);font-weight:700}.editor-note{font-size:9px;line-height:1.6;color:#999aa4;background:#f8f7fb;padding:10px;border-radius:7px;margin-top:23px}.canvas-area{min-width:0;display:flex;flex-direction:column}.canvas-toolbar{height:48px;display:flex;align-items:center;justify-content:space-between;padding:0 18px;color:#858692;font-size:10px}.canvas-toolbar>div:first-child{display:flex;align-items:center;gap:7px}.live-dot{width:7px;height:7px;border-radius:50%;background:#20b981}.device-switch{display:flex;gap:3px;background:#e9e9ef;padding:3px;border-radius:7px}.device-switch button{border:0;background:transparent;color:#777986;width:28px;height:24px;border-radius:5px;display:grid;place-items:center;cursor:pointer}.device-switch .device-active{background:white;color:var(--editor-accent);box-shadow:0 1px 3px #00000012}.canvas-scroll{padding:15px 22px 35px;overflow:auto;display:flex;justify-content:center}.site-preview{width:100%;max-width:1040px;min-height:650px;background:white;box-shadow:0 5px 25px #1b1b2b0d;border-radius:5px;overflow:hidden;transition:max-width .2s}.mobile-preview{max-width:390px}.site-nav{height:65px;display:flex;align-items:center;gap:27px;padding:0 6%;border-bottom:1px solid #f1f0f5;font-size:11px;color:#777986}.site-nav b{font-size:15px;color:#292a33;margin-right:auto}.site-nav button,.preview-hero button,.preview-text button{border:0;color:white;padding:10px 15px;border-radius:6px;font-size:10px;font-weight:700;display:flex;align-items:center;gap:7px}.preview-block{position:relative;cursor:pointer;border:2px solid transparent}.active-block{border:2px solid var(--editor-accent)}.selected-tag{position:absolute;right:0;top:0;background:var(--editor-accent);color:white;padding:4px 8px;font-size:9px;z-index:2}.preview-hero{padding:90px 9% 100px;background:linear-gradient(115deg,#f7f4ff,#fff 65%)}.preview-eyebrow{font-size:9px;font-weight:800;letter-spacing:1.5px;color:var(--editor-accent)}.preview-hero h1{font-size:clamp(36px,5vw,61px);letter-spacing:-2.5px;line-height:1.08;max-width:700px;margin:18px 0}.preview-hero p,.preview-text p,.preview-features>p{font-size:13px;line-height:1.8;color:#777987;max-width:670px;margin:0 0 23px}.preview-hero button{font-size:11px;padding:13px 18px}.preview-text{padding:65px 9%}.preview-text h2,.preview-features h2{font-size:30px;letter-spacing:-1px;margin:0 0 13px}.preview-image{padding:35px 9%;min-height:170px}.preview-image img{max-width:100%;max-height:380px;object-fit:cover;border-radius:12px}.preview-image>div{min-height:145px;border:1px dashed #c9c6d4;background:#faf9fc;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:9px;color:#9995a7;font-size:11px}.preview-features{padding:65px 9%;background:#faf9fc}.preview-features>div{display:grid;grid-template-columns:repeat(3,1fr);gap:13px;margin-top:28px}.preview-features article{border:1px solid #efedf4;border-radius:10px;padding:20px;display:flex;flex-direction:column;gap:9px}.preview-features article b{color:var(--editor-accent);font-size:11px}.preview-features article strong{font-size:13px}.preview-features article span{font-size:10px;color:#888;line-height:1.5}.site-footer{padding:24px 8%;border-top:1px solid #eeeef3;color:#999;font-size:10px}.editor-input,.editor-textarea{width:100%;border:1px solid #e4e4eb;border-radius:7px;padding:10px;font:11px inherit;outline:0;color:#343541}.editor-input:focus,.editor-textarea:focus{border-color:var(--editor-accent);box-shadow:0 0 0 3px #6842dc12}.editor-textarea{resize:vertical;line-height:1.6}.inspector-actions{display:flex;gap:6px}.inspector-actions button,.delete-block{height:32px;border:1px solid #e8e8ee;background:white;border-radius:6px;display:flex;align-items:center;justify-content:center;gap:5px;padding:0 8px;color:#666875;font-size:10px;cursor:pointer}.delete-block{width:100%;margin-top:14px;color:#d34d5a;border-color:#f2dadd}.delete-block:hover{background:#fff6f6}@media(max-width:1000px){.editor-layout{grid-template-columns:205px minmax(0,1fr)}.right-inspector{grid-column:1/-1;border-top:1px solid #e8e8ef;border-left:0}.left-tools{padding:16px 12px}.editor-brand{display:none}}@media(max-width:650px){.editor-top{padding:0 10px;height:58px}.back-link{min-width:0}.back-link span{display:none}.editor-actions{gap:4px}.tool-button,.save-button{padding:0 8px;height:32px}.tool-button span{display:none}.editor-layout{display:flex;flex-direction:column}.left-tools{border-right:0;border-bottom:1px solid #e8e8ef}.add-grid{grid-template-columns:repeat(5,1fr)}.add-grid button{height:57px;font-size:9px}.add-grid svg{width:16px}.panel-divider{margin:13px 0}.layer-list{display:grid;grid-template-columns:repeat(2,1fr)}.canvas-scroll{padding:10px 7px}.site-nav{gap:10px;padding:0 4%;font-size:9px}.site-nav b{font-size:12px}.site-nav span:nth-of-type(n+2){display:none}.preview-hero{padding:60px 7%}.preview-hero h1{font-size:36px}.preview-text,.preview-features{padding:45px 7%}.preview-features>div{grid-template-columns:1fr}.right-inspector{padding:18px}.editor-brand input{width:100px}}`;
