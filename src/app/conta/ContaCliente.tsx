"use client";

import { useCallback, useEffect, useState } from "react";
import { useAutoRefresh } from "@/components/admin/useAutoRefresh";
import ContaSidebar   from "./components/ContaSidebar";
import MenuMovel      from "./components/MenuMovel";
import { CabecalhoDeEcra } from "@/components/portal/Portal";
import VisaoGeral     from "./components/VisaoGeral";
import MeusPedidos    from "./components/MeusPedidos";
import DadosPessoais  from "./components/DadosPessoais";
import Faturacao      from "./components/Faturacao";
import Notificacoes   from "./components/Notificacoes";
import Seguranca      from "./components/Seguranca";
import {
  propostasAEsperaDoCliente,
  type UserProfile,
  type Order,
  type OrderSummary,
  type Section,
} from "./components/types";

interface Props {
  nome:   string;
  email:  string;
  avatar: string | null;
  initialUser?: UserProfile | null;
  initialOrders?: Order[];
  initialSummary?: OrderSummary | null;
}

/** O título do ecrã aberto, no telemóvel. */
const TITULOS_MOVEIS: Record<Section, string> = {
  "visao-geral": "A minha conta",
  pedidos: "Os meus pedidos",
  "dados-pessoais": "Dados pessoais",
  faturacao: "Faturação",
  notificacoes: "Notificações",
  seguranca: "Segurança",
};

export default function ContaCliente({
  nome, email, avatar,
  initialUser = null, initialOrders = [], initialSummary = null,
}: Props) {
  const [section, setSection] = useState<Section>("visao-geral");
  const [user,    setUser]    = useState<UserProfile | null>(initialUser);
  const [orders,  setOrders]  = useState<Order[]>(initialOrders);
  const [summary, setSummary] = useState<OrderSummary | null>(initialSummary);

  // Se o SSR não conseguiu carregar (falha no DB, sessão sem email), fazer
  // fetch client-side como fallback. Se o SSR trouxe dados, saltar o fetch.
  useEffect(() => {
    if (initialUser) return;
    fetch("/api/users/me", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { user?: UserProfile }) => { if (d.user) setUser(d.user); })
      .catch(() => { /* falha silenciosa */ });
  }, [initialUser]);

  useEffect(() => {
    if (initialOrders.length > 0 || initialSummary) return;
    fetch("/api/users/me/orders?page=1", { credentials: "include" })
      .then((r) => r.json())
      .then((d: { orders?: Order[]; summary?: OrderSummary }) => {
        if (d.orders) setOrders(d.orders.slice(0, 10));
        if (d.summary) setSummary(d.summary);
      })
      .catch(() => { /* falha silenciosa */ });
  }, [initialOrders.length, initialSummary]);

  /*
   * A conta não fica parada no tempo.
   *
   * Os números da visão geral e os últimos pedidos são lidos uma vez, na
   * abertura. Quem deixasse o separador aberto durante a tarde via os mesmos
   * dados da manhã — e a esta altura já há propostas a chegar enquanto ele
   * está a olhar.
   *
   * Só se troca o que mudou de facto: um objecto novo a cada minuto obrigava
   * o React a redesenhar tudo, e os formulários da conta a serem remontados
   * por baixo de quem estivesse a escrever.
   */
  const recarregar = useCallback(async () => {
    try {
      const res = await fetch("/api/users/me/orders?page=1", { credentials: "include" });
      if (!res.ok) return;
      const d = (await res.json()) as { orders?: Order[]; summary?: OrderSummary };
      if (d.orders) {
        const dez = d.orders.slice(0, 10);
        setOrders((antes) =>
          JSON.stringify(antes) === JSON.stringify(dez) ? antes : dez,
        );
      }
      if (d.summary) {
        setSummary((antes) =>
          JSON.stringify(antes) === JSON.stringify(d.summary) ? antes : d.summary!,
        );
      }
    } catch {
      /* uma falha de rede num ciclo automático não é notícia — o próximo resolve */
    }
  }, []);

  useAutoRefresh(recarregar, { intervalMs: 60_000 });

  // Quantas propostas esperam por ele, somadas. É o que o distintivo mostra —
  // e é o mesmo número em qualquer sítio onde apareça.
  const propostasPorResponder = orders.reduce(
    (soma, o) => soma + propostasAEsperaDoCliente(o),
    0,
  );

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
          propostasPorResponder={propostasPorResponder}
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

      {/* Layout mobile: menu de linhas, e cada secção abre por cima com seta
          para trás — o gesto das aplicações que já têm no telemóvel. */}
      <div className="lg:hidden">
        {section === "visao-geral" ? (
          <MenuMovel
            nome={effectiveUser.name ?? nome}
            email={email}
            avatar={effectiveUser.avatarUrl ?? avatar}
            pedidosAbertos={summary?.activeOrders ?? 0}
            propostasPorResponder={propostasPorResponder}
            onSection={setSection}
          />
        ) : (
          <main className="px-4 pb-16">
            <CabecalhoDeEcra
              titulo={TITULOS_MOVEIS[section]}
              onVoltar={() => setSection("visao-geral")}
            />
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
        )}
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
