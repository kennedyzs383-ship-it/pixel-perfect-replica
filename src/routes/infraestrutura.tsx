import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight, CircleDashed, Cloud, Database, Globe2, LockKeyhole, Server, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/infraestrutura")({
  head: () => ({ meta: [{ title: "Infraestrutura | Nuvem" }, { name: "description", content: "Domínios, DNS, alojamento e base de dados da Nuvem." }] }),
  component: InfrastructurePage,
});

const services = [
  { title: "Domínios e DNS", status: "A aguardar fornecedor", detail: "Ainda não existe domínio registado nem zona DNS ligada.", icon: Globe2 },
  { title: "Alojamento e publicação", status: "A aguardar fornecedor", detail: "Os websites podem ser exportados em HTML; publicação automática ainda não está ligada.", icon: Cloud },
  { title: "Armazenamento de ficheiros", status: "Não configurado", detail: "As imagens do editor continuam guardadas dentro do rascunho local do navegador.", icon: Server },
  { title: "Email profissional", status: "Não configurado", detail: "Nenhuma caixa de correio ou serviço SMTP foi contratado ou ligado.", icon: ShieldCheck },
];

function InfrastructurePage() {
  return <main style={{minHeight:"100vh",background:"#f5f6fa",color:"#20212a",fontFamily:"Inter,system-ui,sans-serif",padding:"28px 5vw"}}>
    <a href="/" style={{display:"inline-flex",alignItems:"center",gap:8,color:"#6550b5",textDecoration:"none",fontWeight:650,fontSize:13}}><ArrowLeft size={16}/> Voltar ao painel Nuvem</a>
    <header style={{margin:"30px 0 26px"}}>
      <div style={{fontSize:11,fontWeight:800,letterSpacing:1.4,color:"#7658d6"}}>CENTRO DE INFRAESTRUTURA</div>
      <h1 style={{fontSize:34,letterSpacing:-1.3,margin:"8px 0"}}>Domínios, dados e alojamento</h1>
      <p style={{color:"#737583",maxWidth:720,lineHeight:1.7}}>Estado real dos serviços ligados à Nuvem. Os itens por configurar estão identificados como tal — não há compras ou publicações simuladas.</p>
    </header>
    <section style={{background:"#fff",border:"1px solid #e8e9f0",borderRadius:14,padding:22,marginBottom:20}}>
      <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
        <div style={{width:42,height:42,borderRadius:11,display:"grid",placeItems:"center",background:"#e9e4ff",color:"#6546c7"}}><Database size={21}/></div>
        <div style={{flex:1,minWidth:220}}><h2 style={{fontSize:17,margin:"0 0 4px"}}>Base de dados Supabase</h2><p style={{margin:0,color:"#777987",fontSize:12}}>Ligação ativa · PostgreSQL 17 · eu-west-1</p></div>
        <span style={{fontSize:11,fontWeight:750,color:"#16845d",background:"#e8f7f0",padding:"7px 10px",borderRadius:20}}>Projeto ativo</span>
        <a href="https://supabase.com/dashboard/project/emcdkxxmfqgejfmfpxwe" target="_blank" rel="noreferrer" style={{display:"inline-flex",alignItems:"center",gap:5,color:"#6047bc",fontSize:12,textDecoration:"none"}}>Abrir Supabase <ArrowUpRight size={14}/></a>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10,marginTop:20}}>
        {["websites","domains","domain_dns_records","deployments","infrastructure_connections"].map(name => <div key={name} style={{background:"#f7f7fb",padding:13,borderRadius:9}}><div style={{fontWeight:700,fontSize:12}}>{name}</div><div style={{fontSize:11,color:"#777987",marginTop:5}}>Tabela criada · schema privado</div></div>)}
      </div>
      <div style={{display:"flex",gap:8,alignItems:"flex-start",marginTop:16,color:"#737583",fontSize:11,lineHeight:1.6}}><LockKeyhole size={15} style={{flexShrink:0,marginTop:1}}/> O schema de infraestrutura não está exposto à API pública. A ligação do painel à base de dados será feita por funções server-side; nenhuma chave secreta é colocada no browser.</div>
    </section>
    <section style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(245px,1fr))",gap:13}}>
      {services.map(item => { const Icon = item.icon; return <article key={item.title} style={{background:"#fff",border:"1px solid #e8e9f0",borderRadius:13,padding:18}}>
        <div style={{display:"flex",alignItems:"center",gap:9,color:"#6546c7"}}><Icon size={19}/><strong style={{fontSize:14,color:"#282936"}}>{item.title}</strong></div>
        <div style={{display:"flex",alignItems:"center",gap:6,fontSize:11,fontWeight:700,color:"#8a6b2a",marginTop:16}}><CircleDashed size={14}/>{item.status}</div>
        <p style={{fontSize:12,color:"#777987",lineHeight:1.65,marginBottom:0}}>{item.detail}</p>
      </article>; })}
    </section>
    <section style={{background:"#fff",border:"1px solid #e8e9f0",borderRadius:14,padding:22,marginTop:20}}>
      <h2 style={{fontSize:17,margin:"0 0 8px"}}>O que falta para pôr um website online</h2>
      <ol style={{color:"#656775",fontSize:13,lineHeight:2,paddingLeft:20}}>
        <li>Registar ou transferir um domínio e ligar o DNS.</li>
        <li>Escolher o fornecedor de alojamento e ligar este repositório GitHub.</li>
        <li>Configurar os segredos do servidor no fornecedor, nunca no código do navegador.</li>
        <li>Aplicar os registos DNS indicados pelo fornecedor e verificar o domínio.</li>
        <li>Ativar HTTPS/SSL e publicar a versão de produção.</li>
      </ol>
      <div style={{display:"flex",gap:10,flexWrap:"wrap",marginTop:14}}>
        <a href="https://dash.cloudflare.com/" target="_blank" rel="noreferrer" style={{background:"#f0edff",color:"#5e45b4",padding:"10px 13px",borderRadius:8,textDecoration:"none",fontSize:12,fontWeight:700}}>Cloudflare DNS <ArrowUpRight size={13}/></a>
        <a href="https://railway.com/" target="_blank" rel="noreferrer" style={{background:"#f0edff",color:"#5e45b4",padding:"10px 13px",borderRadius:8,textDecoration:"none",fontSize:12,fontWeight:700}}>Railway Hosting <ArrowUpRight size={13}/></a>
        <a href="https://app.netlify.com/" target="_blank" rel="noreferrer" style={{background:"#f0edff",color:"#5e45b4",padding:"10px 13px",borderRadius:8,textDecoration:"none",fontSize:12,fontWeight:700}}>Netlify Hosting <ArrowUpRight size={13}/></a>
      </div>
    </section>
    <p style={{fontSize:11,color:"#9697a2",marginTop:22}}>Autenticação mantida sem alterações. Nenhum domínio, plano pago ou fornecedor foi contratado nesta etapa.</p>
  </main>;
}
