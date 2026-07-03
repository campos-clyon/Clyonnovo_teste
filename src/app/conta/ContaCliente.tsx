"use client";

import { useEffect, useState } from "react";
import ContaSidebar   from "./components/ContaSidebar";
import MobileTabs     from "./components/MobileTabs";
import VisaoGeral     from "./components/VisaoGeral";
import MeusPedidos    from "./components/MeusPedidos";
import DadosPessoais  from "./components/DadosPessoais";
import Faturacao      from "./components/Faturacao";
import Notificacoes   from "./components/Notificacoes";
import Seguranca      from "./components/Seguranca";
import type { UserProfile, Order, OrderSummary, Section } from "./components/types";

interface Props {
  nome:   string;
  email:  string;
  avatar: string | null;
}

export default function ContaCliente({ nome, email, avatar }: Props) {
  const [section, setSection] = useState<Section>("visao-geral");
  const [user,    setUser]    = useState<UserProfile | null>(null);
  const [orders,  setOrders]  = useState<Order[]>([]);
  const [summary, setSummary] = useState<OrderSummary | null>(null);

  // Carregar perfil do utilizador — cache: no-store garante dados frescos após reload
  useEffect(() => {
    fetch("/api/users/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { user?: UserProfile }) => { if (d.user) setUser(d.user); })
      .catch(() => { /* falha silenciosa */ });
  }, []);

  // Carregar últimos pedidos para Visão Geral
  useEffect(() => {
    fetch("/api/users/me/orders?page=1", { credentials: "include" })
      .then((r) => r.json())
      .then((d: { orders?: Order[]; summary?: OrderSummary }) => {
        if (d.orders) setOrders(d.orders.slice(0, 10));
        if (d.summary) setSummary(d.summary);
      })
      .catch(() => { /* falha silenciosa */ });
  }, []);

  const handleUpdate = (updated: Partial<UserProfile>) => {
    setUser((prev) => prev ? { ...prev, ...updated } : prev);
  };

  // Enquanto não há user, usar dados da sessão como fallback
  const effectiveUser: UserProfile = user ?? {
    id: 0, name: nome, email, phone: null,
    addressLine: null, addressNumber: null, postalCode: null, addressCity: null,
    nif: null, billingName: null, billingNif: null, billingAddress: null,
    billingPostalCode: null, billingCity: null, avatarUrl: null,
    notifOrderStatus: 1, notifWeeklyDigest: 0, notifWhatsapp: 0,
    createdAt: new Date().toISOString(),
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa]">
      {/* Layout desktop: sidebar + conteúdo */}
      <div className="hidden h-screen lg:flex">
        <ContaSidebar
          section={section}
          onSection={setSection}
          nome={effectiveUser.name ?? nome}
          email={email}
          avatar={effectiveUser.avatarUrl ?? avatar}
        />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-8 py-10">
            <SectionContent
              section={section}
              user={effectiveUser}
              googleAvatar={avatar}
              orders={orders}
              summary={summary}
              onSection={setSection}
              onUpdate={handleUpdate}
            />
          </div>
        </main>
      </div>

      {/* Layout mobile: tabs horizontais + conteúdo */}
      <div className="lg:hidden">
        <MobileTabs section={section} onSection={setSection} />
        <main className="px-4 py-6">
          <SectionContent
            section={section}
            user={effectiveUser}
            googleAvatar={avatar}
            orders={orders}
            summary={summary}
            onSection={setSection}
            onUpdate={handleUpdate}
          />
        </main>
      </div>
    </div>
  );
}

function SectionContent({
  section, user, googleAvatar, orders, summary, onSection, onUpdate,
}: {
  section: Section;
  user: UserProfile;
  googleAvatar: string | null;
  orders: Order[];
  summary: OrderSummary | null;
  onSection: (s: Section) => void;
  onUpdate: (updated: Partial<UserProfile>) => void;
}) {
  // Fade on section change
  const key = section;

  return (
    <div key={key} className="animate-fade-in">
      {section === "visao-geral"    && <VisaoGeral user={user} googleAvatar={googleAvatar} orders={orders} summary={summary} onSection={onSection} />}
      {section === "pedidos"        && <MeusPedidos />}
      {section === "dados-pessoais" && <DadosPessoais user={user} googleAvatar={googleAvatar} onUpdate={onUpdate} />}
      {section === "faturacao"      && <Faturacao user={user} onUpdate={onUpdate} />}
      {section === "notificacoes"   && <Notificacoes user={user} onUpdate={onUpdate} />}
      {section === "seguranca"      && <Seguranca />}
    </div>
  );
}
