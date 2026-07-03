"use client";

import Link from "next/link";
import Image from "next/image";
import { MessageCircle, ArrowRight, Lock, CreditCard, Smartphone, Building } from "lucide-react";

import { trackWhatsAppClick, trackPhoneCall } from "@/lib/analytics";
import { BUSINESS_PHONE, BUSINESS_EMAIL } from "@/lib/seo-data";

// Estilos para links com hover azul água
const linkStyle = "text-white hover:text-cyan-400 transition-colors";
const linkStyleInline = { color: "#ffffff", fontSize: "14px", textDecoration: "none" };

export default function Footer() {
  const anoAtual = new Date().getFullYear();
  const telHref = `tel:${BUSINESS_PHONE.replace(/\s+/g, "")}`;
  const numeroWhatsapp = BUSINESS_PHONE.replace(/[^\d]/g, "");
  const urlWhatsapp = `https://wa.me/${numeroWhatsapp}?text=${encodeURIComponent("Olá! Gostava de pedir um orçamento à CLYON.")}`;

  return (
    <footer style={{ backgroundColor: "#0f172a", color: "white" }}>
      <style jsx>{`
        footer a:hover {
          color: #22d3ee !important;
        }
        footer button:hover {
          color: #22d3ee !important;
        }
      `}</style>
      <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "64px 24px" }}>
        {/* Desktop Layout */}
        <div className="hidden lg:grid lg:grid-cols-[280px_repeat(4,1fr)] lg:gap-12">
          {/* Brand Column with CTA Box */}
          <div style={{ backgroundColor: "#1e293b", borderRadius: "16px", padding: "28px" }}>
            <Link href="/">
              <Image
                src="/logo-clyon.png"
                alt="CLYON"
                width={120}
                height={40}
                style={{ height: "36px", width: "auto", filter: "brightness(0) invert(1)" }}
              />
            </Link>
            <p style={{ marginTop: "16px", fontSize: "14px", lineHeight: "1.7", color: "#ffffff" }}>
              Recolha e limpeza profissional em Lisboa, Margem Sul e Setúbal com resposta rápida e execução sem stress.
            </p>

            <div style={{ marginTop: "24px", borderTop: "1px solid #334155", paddingTop: "20px" }}>
              <h4 style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.7)", marginBottom: "14px" }}>Pagamentos</h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#ffffff", fontSize: "14px" }}>
                  <CreditCard style={{ width: "16px", height: "16px", color: "#22d3ee" }} />
                  Revolut
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#ffffff", fontSize: "14px" }}>
                  <Smartphone style={{ width: "16px", height: "16px", color: "#22d3ee" }} />
                  MB WAY
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", color: "#ffffff", fontSize: "14px" }}>
                  <Building style={{ width: "16px", height: "16px", color: "#22d3ee" }} />
                  Novo Banco
                </div>
              </div>
            </div>
          </div>

          {/* Serviços Column */}
          <div>
            <h3 style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.7)", marginBottom: "20px" }}>Serviços</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
              <li><Link href="/recolha-de-moveis" style={linkStyleInline}>Recolha de Móveis</Link></li>
              <li><Link href="/recolha-de-entulho" style={linkStyleInline}>Recolha de Entulho</Link></li>
              <li><Link href="/limpeza-pos-obra" style={linkStyleInline}>Limpeza Pós-Obra</Link></li>
              <li><Link href="/esvaziamento-de-casas" style={linkStyleInline}>Esvaziamento de Casas</Link></li>
              <li><Link href="/precos" style={linkStyleInline}>Preços orientativos</Link></li>
            </ul>
          </div>

          {/* Empresa Column */}
          <div>
            <h3 style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.7)", marginBottom: "20px" }}>Empresa</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "12px" }}>
              <li><Link href="/sobre-nos" style={linkStyleInline}>Sobre nós</Link></li>
              <li><Link href="/faq" style={linkStyleInline}>FAQ</Link></li>
              <li><Link href="/blog" style={linkStyleInline}>Blog</Link></li>
              <li><Link href="/contactos" style={linkStyleInline}>Contactos</Link></li>
            </ul>
          </div>

          {/* Cobertura Column */}
          <div>
            <h3 style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.7)", marginBottom: "20px" }}>Cobertura</h3>
            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px" }}>
              <li><Link href="/recolha-moveis-lisboa" style={linkStyleInline}>Lisboa</Link></li>
              <li><Link href="/recolha-moveis-almada" style={linkStyleInline}>Almada</Link></li>
              <li><Link href="/recolha-moveis-amadora" style={linkStyleInline}>Amadora</Link></li>
              <li><Link href="/recolha-moveis-seixal" style={linkStyleInline}>Seixal</Link></li>
              <li><Link href="/recolha-moveis-barreiro" style={linkStyleInline}>Barreiro</Link></li>
              <li><Link href="/recolha-moveis-oeiras" style={linkStyleInline}>Oeiras</Link></li>
              <li><Link href="/recolha-moveis-cascais" style={linkStyleInline}>Cascais</Link></li>
              <li><Link href="/recolha-moveis-setubal" style={linkStyleInline}>Setúbal</Link></li>
              <li><Link href="/recolha-moveis-loures" style={linkStyleInline}>Loures</Link></li>
              <li><Link href="/recolha-moveis-sintra" style={linkStyleInline}>Sintra</Link></li>
              <li><Link href="/recolha-moveis-montijo" style={linkStyleInline}>Montijo</Link></li>
              <li><Link href="/recolha-moveis-odivelas" style={linkStyleInline}>Odivelas</Link></li>
            </ul>
          </div>

          {/* Contacto Rápido Column */}
          <div>
            <h3 style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.7)", marginBottom: "20px" }}>Contacto Rápido</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <a
                href={urlWhatsapp}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackWhatsAppClick("footer-quick")}
                className="site-btn-footer group"
                style={{ display: "flex", alignItems: "center", gap: "12px", backgroundColor: "#1e293b", padding: "12px 14px", borderRadius: "8px", color: "#ffffff", fontSize: "14px", textDecoration: "none", transition: "all 0.2s ease" }}
              >
                <MessageCircle style={{ width: "16px", height: "16px", color: "#22d3ee" }} className="group-hover:text-white" />
                <span style={{ color: "#ffffff" }}>WhatsApp direto</span>
              </a>
              <Link
                href="/simulador"
                className="site-btn-footer group"
                style={{ display: "flex", alignItems: "center", gap: "12px", backgroundColor: "#1e293b", padding: "12px 14px", borderRadius: "8px", color: "#ffffff", fontSize: "14px", textDecoration: "none", transition: "all 0.2s ease" }}
              >
                <ArrowRight style={{ width: "16px", height: "16px", color: "#22d3ee" }} className="group-hover:text-white" />
                <span style={{ color: "#ffffff" }}>Pedir orçamento</span>
              </Link>
              <Link
                href="/colaboradores"
                className="site-btn-footer group"
                style={{ display: "flex", alignItems: "center", gap: "12px", backgroundColor: "#1e293b", padding: "12px 14px", borderRadius: "8px", color: "#ffffff", fontSize: "14px", textDecoration: "none", transition: "all 0.2s ease" }}
              >
                <Lock style={{ width: "16px", height: "16px", color: "#94a3b8" }} className="group-hover:text-white" />
                <span style={{ color: "#ffffff" }}>Área de colaboradores</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Mobile Layout */}
        <div className="lg:hidden">
          {/* Brand */}
          <div style={{ textAlign: "center", marginBottom: "32px" }}>
            <Link href="/">
              <Image
                src="/logo-clyon.png"
                alt="CLYON"
                width={120}
                height={40}
                style={{ height: "36px", width: "auto", margin: "0 auto", filter: "brightness(0) invert(1)" }}
              />
            </Link>
            <p style={{ marginTop: "16px", fontSize: "14px", lineHeight: "1.7", color: "#ffffff" }}>
              Recolha e limpeza profissional em Lisboa, Margem Sul e Setúbal.
            </p>
          </div>

          {/* Pagamentos Mobile */}
          <div style={{ marginBottom: "32px" }}>
            <h4 style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.7)", marginBottom: "14px" }}>Pagamentos</h4>
            <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#ffffff", fontSize: "14px" }}>
                <CreditCard style={{ width: "16px", height: "16px", color: "#22d3ee" }} />
                Revolut
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#ffffff", fontSize: "14px" }}>
                <Smartphone style={{ width: "16px", height: "16px", color: "#22d3ee" }} />
                MB WAY
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#ffffff", fontSize: "14px" }}>
                <Building style={{ width: "16px", height: "16px", color: "#22d3ee" }} />
                Novo Banco
              </div>
            </div>
          </div>

          {/* Links Grid Mobile */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px", marginBottom: "32px" }}>
            <div>
              <h3 style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.7)", marginBottom: "16px" }}>Serviços</h3>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
                <li><Link href="/recolha-de-moveis" style={linkStyleInline}>Recolha de Móveis</Link></li>
                <li><Link href="/recolha-de-entulho" style={linkStyleInline}>Recolha de Entulho</Link></li>
                <li><Link href="/esvaziamento-de-casas" style={linkStyleInline}>Esvaziamento</Link></li>
                <li><Link href="/precos" style={linkStyleInline}>Preços</Link></li>
              </ul>
            </div>
            <div>
              <h3 style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.7)", marginBottom: "16px" }}>Empresa</h3>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "10px" }}>
                <li><Link href="/sobre-nos" style={linkStyleInline}>Sobre nós</Link></li>
                <li><Link href="/faq" style={linkStyleInline}>FAQ</Link></li>
                <li><Link href="/contactos" style={linkStyleInline}>Contactos</Link></li>
                <li><Link href="/avaliacoes" style={linkStyleInline}>Avaliações</Link></li>
              </ul>
            </div>
          </div>

          {/* Cobertura Mobile */}
          <div style={{ marginBottom: "32px" }}>
            <h3 style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.7)", marginBottom: "16px" }}>Cobertura</h3>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              <Link href="/recolha-moveis-lisboa" style={{ color: "#ffffff", fontSize: "13px", textDecoration: "none", padding: "4px 10px", backgroundColor: "#1e293b", borderRadius: "4px" }}>Lisboa</Link>
              <Link href="/recolha-moveis-almada" style={{ color: "#ffffff", fontSize: "13px", textDecoration: "none", padding: "4px 10px", backgroundColor: "#1e293b", borderRadius: "4px" }}>Almada</Link>
              <Link href="/recolha-moveis-amadora" style={{ color: "#ffffff", fontSize: "13px", textDecoration: "none", padding: "4px 10px", backgroundColor: "#1e293b", borderRadius: "4px" }}>Amadora</Link>
              <Link href="/recolha-moveis-seixal" style={{ color: "#ffffff", fontSize: "13px", textDecoration: "none", padding: "4px 10px", backgroundColor: "#1e293b", borderRadius: "4px" }}>Seixal</Link>
              <Link href="/recolha-moveis-setubal" style={{ color: "#ffffff", fontSize: "13px", textDecoration: "none", padding: "4px 10px", backgroundColor: "#1e293b", borderRadius: "4px" }}>Setúbal</Link>
              <Link href="/recolha-moveis-sintra" style={{ color: "#ffffff", fontSize: "13px", textDecoration: "none", padding: "4px 10px", backgroundColor: "#1e293b", borderRadius: "4px" }}>Sintra</Link>
              <Link href="/recolha-moveis-cascais" style={{ color: "#ffffff", fontSize: "13px", textDecoration: "none", padding: "4px 10px", backgroundColor: "#1e293b", borderRadius: "4px" }}>Cascais</Link>
              <Link href="/recolha-moveis-oeiras" style={{ color: "#ffffff", fontSize: "13px", textDecoration: "none", padding: "4px 10px", backgroundColor: "#1e293b", borderRadius: "4px" }}>Oeiras</Link>
            </div>
          </div>

          {/* Contacto Rápido Mobile */}
          <div style={{ marginBottom: "16px" }}>
            <h3 style={{ fontSize: "12px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(255,255,255,0.7)", marginBottom: "16px" }}>Contacto Rápido</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <a
                href={urlWhatsapp}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackWhatsAppClick("footer-mobile")}
                className="site-btn-footer group"
                style={{ display: "flex", alignItems: "center", gap: "12px", backgroundColor: "#1e293b", padding: "12px 14px", borderRadius: "8px", color: "#ffffff", fontSize: "14px", textDecoration: "none", transition: "all 0.2s ease" }}
              >
                <MessageCircle style={{ width: "16px", height: "16px", color: "#22d3ee" }} className="group-hover:text-white" />
                <span style={{ color: "#ffffff" }}>WhatsApp direto</span>
              </a>
              <Link
                href="/simulador"
                className="site-btn-footer group"
                style={{ display: "flex", alignItems: "center", gap: "12px", backgroundColor: "#1e293b", padding: "12px 14px", borderRadius: "8px", color: "#ffffff", fontSize: "14px", textDecoration: "none", transition: "all 0.2s ease" }}
              >
                <ArrowRight style={{ width: "16px", height: "16px", color: "#22d3ee" }} className="group-hover:text-white" />
                <span style={{ color: "#ffffff" }}>Pedir orçamento</span>
              </Link>
              <Link
                href="/colaboradores"
                className="site-btn-footer group"
                style={{ display: "flex", alignItems: "center", gap: "12px", backgroundColor: "#1e293b", padding: "12px 14px", borderRadius: "8px", color: "#ffffff", fontSize: "14px", textDecoration: "none", transition: "all 0.2s ease" }}
              >
                <Lock style={{ width: "16px", height: "16px", color: "#94a3b8" }} className="group-hover:text-white" />
                <span style={{ color: "#ffffff" }}>Área de colaboradores</span>
              </Link>
            </div>
          </div>
        </div>

      </div>

      {/* Bottom Bar */}
      <div style={{ borderTop: "1px solid #1e293b" }}>
        <div style={{ maxWidth: "1280px", margin: "0 auto", padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }} className="flex-col sm:flex-row">
          <p style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)" }}>
            © CLYON {anoAtual} - Todos os direitos reservados
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "24px", alignItems: "center" }}>
            <Link href="/privacidade" style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>
              Política de Privacidade
            </Link>
            <Link href="/cookies" style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)", textDecoration: "none" }}>
              Política de Cookies
            </Link>
            <button
              type="button"
              onClick={() => {
                window.dispatchEvent(new CustomEvent("clyon-open-cookie-preferences"));
              }}
              style={{ fontSize: "14px", color: "rgba(255,255,255,0.5)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              Gerir cookies
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
