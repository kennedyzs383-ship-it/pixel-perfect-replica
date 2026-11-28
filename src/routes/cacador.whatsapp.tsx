import { createFileRoute } from "@tanstack/react-router";
import { CacadorWhatsAppCalling } from "../components/cacador-whatsapp-calling";
import { ArrowLeft, ArrowUpRight, CheckCircle2, CircleDashed, LockKeyhole, MessageCircle, Phone, ShieldCheck, Smartphone, Webhook } from "lucide-react";

export const Route = createFileRoute("/cacador/whatsapp")({
  head: () => ({
    meta: [
      { title: "WhatsApp | Caçador — Nuvem" },
      { name: "description", content: "Configuração segura dos canais WhatsApp do Caçador." },
    ],
  }),
  component: CacadorWhatsAppPage,
});

const channels = [
  {
    number: "01",
    title: "WhatsApp Business que já utilizas",
    subtitle: "Manter o número atual",
    tag: "Coexistência — sujeito a elegibilidade",
    description: "A ligação por coexistência permite, quando disponibilizada pela Meta para a tua conta e região, usar o mesmo número na aplicação WhatsApp Business e na plataforma Cloud API.",
    icon: Smartphone,
    steps: [
      "Confirmar que o número está ativo na aplicação WhatsApp Business.",
      "Verificar a elegibilidade da conta no fluxo oficial Embedded Signup.",
      "Aprovar a ligação no próprio telemóvel quando a Meta pedir.",
      "Testar mensagens e sincronização sem desligar a aplicação.",
    ],
  },
  {
    number: "02",
    title: "Número exclusivo do Caçador",
    subtitle: "Canal independente",
    tag: "Cloud API — novo número",
    description: "Um segundo número dedicado ao Caçador. Deve conseguir receber SMS ou chamada de verificação e não pode estar registado numa conta WhatsApp ativa durante o registo na Cloud API.",
    icon: MessageCircle,
    steps: [
      "Obter um número separado que possas controlar.",
      "Confirmar que recebe SMS ou chamada de verificação.",
      "Registar o número numa WhatsApp Business Account através da Meta.",
      "Ligar webhooks e testar mensagens antes de ativar o atendimento.",
    ],
  },
];

function CacadorWhatsAppPage() {
  return (
    <main style={{ minHeight: "100vh", background: "#f5f6fa", color: "#20212a", fontFamily: "Inter,system-ui,sans-serif", padding: "26px 5vw 44px" }}>
      <a href="/cacador" style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#6550b5", textDecoration: "none", fontWeight: 650, fontSize: 13 }}>
        <ArrowLeft size={16} /> Voltar ao Caçador
      </a>

      <header style={{ margin: "28px 0 22px", maxWidth: 820 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, color: "#16845d", fontSize: 11, fontWeight: 800, letterSpacing: 1.3 }}>
          <MessageCircle size={17} /> CANAIS DE COMUNICAÇÃO
        </div>
        <h1 style={{ fontSize: 34, letterSpacing: -1.2, margin: "9px 0 8px" }}>WhatsApp do Caçador</h1>
        <p style={{ color: "#737583", lineHeight: 1.7, fontSize: 14, margin: 0 }}>
          Prepara dois canais independentes: o teu número Business atual e um segundo número exclusivo para o Caçador. Nenhum número será ligado, migrado ou alterado sem a tua confirmação no fluxo oficial da Meta.
        </p>
      </header>

      <section style={{ display: "flex", gap: 10, alignItems: "flex-start", background: "#fff8e8", border: "1px solid #f0dfb7", borderRadius: 12, padding: 15, marginBottom: 18 }}>
        <ShieldCheck size={19} color="#9a6b17" style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12, color: "#715a2b", lineHeight: 1.65 }}>
          <strong>Estado atual: ainda não ligado.</strong> Esta página prepara a configuração. A ligação real depende da conta Meta, da aprovação no Embedded Signup, de um endereço HTTPS público para os webhooks e das credenciais guardadas no servidor. Não introduzas tokens ou segredos nesta página.
        </div>
      </section>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(285px,1fr))", gap: 14 }}>
        {channels.map((channel) => {
          const Icon = channel.icon;
          return (
            <article key={channel.number} style={{ background: "#fff", border: "1px solid #e7e8ef", borderRadius: 14, padding: 19 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                <div style={{ width: 42, height: 42, display: "grid", placeItems: "center", borderRadius: 11, background: "#e9f7ef", color: "#16845d" }}><Icon size={21} /></div>
                <div style={{ flex: 1 }}>
                  <div style={{ color: "#16845d", fontSize: 10, fontWeight: 800, letterSpacing: 1 }}>CANAL {channel.number}</div>
                  <div style={{ fontSize: 15, fontWeight: 750, marginTop: 3 }}>{channel.subtitle}</div>
                </div>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "#8a6b2a", background: "#fbf3df", borderRadius: 20, padding: "6px 8px", fontSize: 10, fontWeight: 750 }}><CircleDashed size={12} /> Por ligar</span>
              </div>
              <h2 style={{ fontSize: 19, margin: "18px 0 8px", letterSpacing: -0.3 }}>{channel.title}</h2>
              <div style={{ color: "#7156c5", fontSize: 10, fontWeight: 750, marginBottom: 9 }}>{channel.tag}</div>
              <p style={{ color: "#737583", fontSize: 12, lineHeight: 1.7, minHeight: 82 }}>{channel.description}</p>
              <div style={{ borderTop: "1px solid #eeeef3", paddingTop: 13 }}>
                <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 10 }}>Passos de configuração</div>
                {channel.steps.map((step, index) => (
                  <div key={step} style={{ display: "flex", gap: 8, alignItems: "flex-start", margin: "9px 0", color: "#626472", fontSize: 11, lineHeight: 1.55 }}>
                    <span style={{ width: 19, height: 19, flexShrink: 0, display: "grid", placeItems: "center", borderRadius: 20, background: "#f0edff", color: "#6546c7", fontSize: 10, fontWeight: 800 }}>{index + 1}</span>
                    {step}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16, paddingTop: 13, borderTop: "1px solid #eeeef3", display: "flex", alignItems: "center", gap: 7, color: "#8a6b2a", fontSize: 11, fontWeight: 750 }}>
                <CircleDashed size={14} /> A aguardar configuração na Meta
              </div>
            </article>
          );
        })}
      </section>

      <CacadorWhatsAppCalling />

      <section style={{ background: "#fff", border: "1px solid #e7e8ef", borderRadius: 14, padding: 19, marginTop: 16 }}>
        <h2 style={{ fontSize: 17, margin: "0 0 12px" }}>O que o Caçador vai preparar</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 12 }}>
          {[
            { icon: MessageCircle, title: "Mensagens", detail: "Receber e responder a clientes, respeitando consentimento e modelos aprovados." },
            { icon: Phone, title: "Chamadas de voz", detail: "Calling API, autorização do cliente e motor WebRTC para áudio em tempo real. A coexistência não é assumida como compatível." },
            { icon: Webhook, title: "Webhooks", detail: "Receber eventos da Meta num endpoint HTTPS validado." },
            { icon: LockKeyhole, title: "Proteção", detail: "Guardar tokens no servidor, separados por conta e nunca no navegador." },
          ].map((item) => {
            const Icon = item.icon;
            return <div key={item.title} style={{ background: "#f8f8fb", borderRadius: 10, padding: 13 }}>
              <Icon size={18} color="#6546c7" />
              <div style={{ fontSize: 12, fontWeight: 750, marginTop: 8 }}>{item.title}</div>
              <div style={{ fontSize: 11, color: "#777987", lineHeight: 1.55, marginTop: 5 }}>{item.detail}</div>
            </div>;
          })}
        </div>
      </section>

      <section style={{ background: "#fff", border: "1px solid #e7e8ef", borderRadius: 14, padding: 19, marginTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 8 }}>
          <LockKeyhole size={18} color="#6546c7" />
          <h2 style={{ fontSize: 16, margin: 0 }}>Antes de ativar</h2>
        </div>
        <ul style={{ color: "#737583", fontSize: 12, lineHeight: 1.9, paddingLeft: 19, margin: 0 }}>
          <li>A Meta pode cobrar determinadas conversas ou funcionalidades. Não será ativado nenhum serviço pago sem mostrar primeiro os custos e receber autorização.</li>
          <li>Mensagens iniciadas pela empresa seguem as regras de consentimento, janela de atendimento e modelos da Meta.</li>
          <li>Chamadas exigem número Cloud API elegível, Calling ativado e autorização explícita do cliente. O número em coexistência com a aplicação Business não será usado para chamadas API.</li>
          <li>O Caçador identifica-se como assistente de IA e encaminha para ti situações que precisem de intervenção humana.</li>
        </ul>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 16 }}>
          <a href="https://developers.facebook.com/documentation/business-messaging/whatsapp/overview" target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#e9f7ef", color: "#16734f", padding: "10px 13px", borderRadius: 8, textDecoration: "none", fontSize: 11, fontWeight: 750 }}>Documentação oficial Meta <ArrowUpRight size={13} /></a>
          <a href="https://business.facebook.com/" target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#f0edff", color: "#5e45b4", padding: "10px 13px", borderRadius: 8, textDecoration: "none", fontSize: 11, fontWeight: 750 }}>Abrir Meta Business <ArrowUpRight size={13} /></a>
        </div>
      </section>

      <p style={{ color: "#9697a2", fontSize: 10, lineHeight: 1.6, marginTop: 17 }}>
        A configuração não está ativa e ainda não estabelece chamadas de voz reais. O próximo passo é concluir a publicação HTTPS da Nuvem e configurar a aplicação WhatsApp na Meta. Mantém o teu número atual na aplicação até a elegibilidade e o processo oficial estarem confirmados.
      </p>
    </main>
  );
}
