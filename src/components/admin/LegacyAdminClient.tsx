"use client";

import type { ComponentType, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { clearColaboradorStorage, getColaboradorItem } from "@/lib/colaborador-storage";
import PedidoDetailModal from "@/components/admin/PedidoDetailModal";
import { origemDoPedido, origemPeloSlug, origemDoLead } from "@/lib/acesso";
import {
  ESTADOS_TICKET, ROTULO_ESTADO, rotuloCategoria, rotuloQuemEscreve, haQuantoTempo,
  type EstadoTicket,
} from "@/lib/suporte";
import ContasPanel from "@/components/admin/ContasPanel";
import AdminProfissionaisPanel from "@/components/admin/AdminProfissionaisPanel";
import AdminNegociacoesPanel from "@/components/admin/AdminNegociacoesPanel";
import AdminLevantamentosPanel from "@/components/admin/AdminLevantamentosPanel";
import AdminTestadoresPanel from "@/components/admin/AdminTestadoresPanel";
import AdminConvitesPanel from "@/components/admin/AdminConvitesPanel";
import AdminAjudaPanel from "@/components/admin/AdminAjudaPanel";
import AppClyonEmbedded, { type AppClyonTab } from "@/components/admin/AppClyonEmbedded";
import { CLYON_TAB_IDS } from "@/components/admin/app-clyon/navigation";
import {
  AlertTriangle,
  Archive,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  Download,
  Euro,
  Eye,
  EyeOff,
  ExternalLink,
  FileText,
  Filter,
  ImagePlus,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  LogOut,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  MousePointerClick,
  Phone,
  ReceiptText,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Smartphone,
  Sparkles,
  TrendingUp,
  UserPlus,
  Users,
  Wrench,
  X,
  BadgeCheck,
  HandCoins,
  Wallet,
  FlaskConical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type SimulatorSetting = {
  key: string;
  label: string;
  category: string;
  unit: string;
  value: string | number;
  description?: string | null;
};

type AdminSection =
  | "overview"
  | "pedidos"
  | "app_clyon"
  | "leads"
  | "site"
  | "configs"
  | "contas"
  | "suporte"
  // Plataforma. São secções e não rotas próprias de propósito: abrem na área
  // da direita, como as outras, e quem está a trabalhar não perde a barra nem
  // o contexto ao mudar de assunto.
  | "profissionais"
  | "negociacoes"
  | "levantamentos"
  | "testadores";

type Lead = {
  id: number;
  nome: string;
  telefone: string;
  email: string;
  localidade: string;
  tipoServico: string;
  preferenciaContacto: string;
  mensagem?: string | null;
  pagePath?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  gclid?: string | null;
  /** Formulário de origem, ex: "formulario_contactos", "quero_contratar_header" */
  origem?: string | null;
  /** Canal usado: "whatsapp" | "email" | "simulador" | "quero_contratar" */
  canal?: string | null;
  status: "novo" | "contactado" | "orcamento_enviado" | "fechado" | "perdido";
  notasInternas?: string | null;
  createdAt: string;
};

type LeadEvent = {
  id: number;
  eventType: string;
  action?: string | null;
  pagePath?: string | null;
  label?: string | null;
  phone?: string | null;
  email?: string | null;
  name?: string | null;
  serviceType?: string | null;
  location?: string | null;
  contactPreference?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  createdAt: string;
};

type LeadTotals = {
  hoje?: number;
  semana?: number;
  novos?: number;
  fechados?: number;
  total?: number;
};

type EventTotals = {
  whatsappHoje?: number;
  ligarHoje?: number;
  ctaHoje?: number;
  formHoje?: number;
  emailHoje?: number;
  simuladorHoje?: number;
  paginasHoje?: number;
  paginasSemana?: number;
  whatsappSemana?: number;
  ligarSemana?: number;
  ctaSemana?: number;
  formSemana?: number;
  emailSemana?: number;
  simuladorSemana?: number;
  total?: number;
};


type TicketSuporte = {
  id: string;
  user_id: string | null;
  user_role: string | null;
  subject: string | null;
  description: string | null;
  category: string | null;
  status: string;
  request_id: string | null;
  created_at: string;
  autorNome: string | null;
  autorEmail: string | null;
  mensagens: number;
};

type MensagemTicket = {
  id: string;
  author_role: string | null;
  author_label: string | null;
  body: string | null;
  created_at: string;
};

type TicketDetalhe = {
  ticket: TicketSuporte & { autorTelefone: string | null; resolved_at: string | null };
  mensagens: MensagemTicket[];
};

const adminNavItems: Array<{
  id: AdminSection;
  icon: ComponentType<{ className?: string }>;
}> = [
  { id: "overview", icon: LayoutDashboard },
  { id: "pedidos",   icon: FileText },
  { id: "app_clyon", icon: Smartphone },
  { id: "leads",     icon: TrendingUp },
  { id: "contas",     icon: UserPlus },
  { id: "suporte",   icon: LifeBuoy },
  { id: "configs",   icon: Settings2 },
  { id: "profissionais", icon: BadgeCheck },
  { id: "negociacoes",   icon: HandCoins },
  { id: "levantamentos", icon: Wallet },
  { id: "testadores",    icon: FlaskConical },
];

/**
 * A barra lateral agrupa as secções pelo trabalho que servem, não pela ordem
 * em que foram construídas.
 *
 * "O que se faz todos os dias" fica em cima e é onde o operador vive: pedidos
 * que entram, a app, e o resumo. "Quem contacta" é o funil comercial. "Gerir"
 * é o que se abre uma vez por semana — e por isso fica no fim, longe do
 * clique acidental.
 */
const NAV_GRUPOS: Array<{ titulo: string; itens: AdminSection[] }> = [
  { titulo: "Operação", itens: ["overview", "pedidos", "app_clyon"] },
  { titulo: "Plataforma", itens: ["profissionais", "negociacoes", "levantamentos", "testadores"] },
  { titulo: "Quem contacta", itens: ["leads", "contas", "suporte"] },
  { titulo: "Gerir", itens: ["configs"] },
];

const sectionLabels: Record<AdminSection, string> = {
  overview:   "Início",
  pedidos:    "Pedidos",
  app_clyon:  "App CLYON",
  leads:      "Leads",
  site:       "Configurações",
  contas:     "Contas",
  suporte:    "Suporte",
  configs:    "Configs",
  profissionais: "Profissionais",
  negociacoes:   "Negociações",
  levantamentos: "Levantamentos",
  testadores:    "Acesso aos testes",
};

const siteModules = [
  {
    title: "Galeria de trabalhos",
    description:
      "Área preparada para gerir fotografias, capas, destaques e ordem visual dos trabalhos reais.",
    status: "Ativo",
    icon: ImagePlus,
  },
  {
    title: "Valores do simulador",
    description:
      "Estrutura pensada para ajustar preços, margens, regras de cálculo e cenários de orçamento.",
    status: "Ativo",
    icon: Euro,
  },
  {
    title: "Textos e campanhas",
    description:
      "Bloco futuro para atualizar mensagens da homepage, CTAs, prova social e campanhas sazonais.",
    status: "Planeado",
    icon: Sparkles,
  },
];

const simulatorDisplayGroups = [
  {
    id: "entulho",
    label: "Entulho",
    description: "Valores específicos para recolha de entulho.",
    keys: ["entulho_saco_chao_extra", "entulho_distancia_km", "entulho_multiplicador"],
  },
  {
    id: "monos",
    label: "Monos",
    description: "Valores partilhados para recolha de monos e volumes semelhantes.",
    keys: ["entulho_distancia_km", "entulho_multiplicador"],
  },
  {
    id: "pos_obra",
    label: "Pós-obra",
    description: "Valores partilhados para limpeza pós-obra e resíduos de obra.",
    keys: ["entulho_distancia_km", "entulho_multiplicador"],
  },
  {
    id: "moveis",
    label: "Móveis",
    description: "Valores ligados à recolha de móveis, volumes e cargas.",
    keys: [
      "moveis_item_pequeno",
      "moveis_item_medio",
      "moveis_item_grande",
      "moveis_distancia_km",
      "moveis_carga_base",
      "moveis_carga_multiplicador",
    ],
  },
  {
    id: "mudancas",
    label: "Mudanças",
    description: "Valores específicos para mudanças e transporte completo.",
    keys: ["mudancas_distancia_km", "mudancas_multiplicador"],
  },
  {
    id: "camiao",
    label: "Camião com motorista",
    description: "Valores partilhados com o serviço de mudanças e transporte simples.",
    keys: ["mudancas_distancia_km", "mudancas_multiplicador"],
  },
  {
    id: "acessos",
    label: "Acessos, andares e elevador",
    description: "Extras de acesso, andares, elevador e dificuldade operacional.",
    keys: [
      "apartamento_com_elevador_por_andar",
      "apartamento_sem_elevador_por_andar",
      "acesso_dificil_extra",
    ],
  },
  {
    id: "geral",
    label: "Base geral",
    description: "Base horária e referências comuns a todos os simuladores.",
    keys: ["hora_base"],
  },
] as const;

const decimal = (value: number) =>
  new Intl.NumberFormat("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const formatDate = (value?: string) => {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
};

const formatDateTime = (value?: string) => {
  if (!value) return "Sem data";
  const date = new Date(value);
  return `${formatDate(value)} | ${date.toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

const formatSimulatorUnit = (unit: SimulatorSetting["unit"]) =>
  unit === "eur" ? "EUR" : "Multiplicador";

const getInitials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");

/** Normaliza serviceType para label legível (mudanca/Mudança/moving → "Mudança") */
function normalizeServiceTypeLabel(value?: string | null): string {
  if (!value) return "—";
  const v = value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (v === "mudanca" || v === "moving") return "Mudança";
  return value.trim();
}

function maskName(name: string | null | undefined): string {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "—";
  return parts.map((p) => p.charAt(0) + "***").join(" ");
}
function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "***";
  return digits.slice(0, 3) + "***" + digits.slice(-2);
}
function maskEmail(email: string | null | undefined): string {
  if (!email) return "";
  const [local, domain] = email.split("@");
  if (!domain) return "***@***";
  return local.charAt(0) + "***@" + domain.charAt(0) + "***";
}

/**
 * Um pedido corresponde ao filtro escolhido no ecrã de pedidos.
 *
 * "Novos" NÃO é o estado `pendente`: é um pedido que ainda ninguém abriu
 * (`viewedAt` por preencher). O cartão sempre contou assim — do lado do
 * servidor, em `countSimulatorOrdersByStatus` — mas a lista filtrava por
 * `status === "pendente"`. Duas definições para a mesma palavra: o cartão
 * dizia 4 e a lista aparecia vazia.
 */
function pedidoNoFiltro(
  p: { status: string; viewedAt?: string | null },
  filtro: string,
): boolean {
  if (p.status === "arquivado") return filtro === "arquivado";
  if (filtro === "todos") return true;
  if (filtro === "pendente") return !p.viewedAt;
  return p.status === filtro;
}

export default function ColaboradorAdminClient() {
  const router = useRouter();

  const [token, setToken] = useState("");
  const [adminNome, setAdminNome] = useState("");
  const [colabId, setColabId] = useState<number | null>(null);
  const [isAdminGeral, setIsAdminGeral] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState<AdminSection>("overview");
  // Só usado abaixo de lg: a partir daí a barra lateral está sempre visível
  const [menuAberto, setMenuAberto] = useState(false);
  const [activeClyonTab, setActiveClyonTab] = useState<AppClyonTab>("visao-geral");
  const [activePedidoId, setActivePedidoId] = useState<string | null>(null);
  const urlSyncReady = useRef(false);

  // Aba ativa da página Configurações
  const [settingsTab, setSettingsTab] = useState<
    "simulador" | "funcoes" | "imagens" | "seguranca" | "empresa"
  >("simulador");

  const [senhaAtualAdmin, setSenhaAtualAdmin] = useState("");
  const [novaSenhaAdmin, setNovaSenhaAdmin] = useState("");
  const [confirmacaoSenhaAdmin, setConfirmacaoSenhaAdmin] = useState("");
  const [mostrarSenhaAtualAdmin, setMostrarSenhaAtualAdmin] = useState(false);
  const [mostrarNovaSenhaAdmin, setMostrarNovaSenhaAdmin] = useState(false);
  const [alterandoSenhaAdmin, setAlterandoSenhaAdmin] = useState(false);
  const [simulatorSettings, setSimulatorSettings] = useState<SimulatorSetting[]>([]);
  const [simulatorDrafts, setSimulatorDrafts] = useState<Record<string, string>>({});
  const [loadingSimulatorSettings, setLoadingSimulatorSettings] = useState(false);
  const [savingSettingKey, setSavingSettingKey] = useState<string | null>(null);

  // Estatísticas do gestor de imagens (para a aba "Imagens do site")
  const [imageStats, setImageStats] = useState<{
    total: number;
    ativas: number;
    inativas: number;
    hero: number;
    showcase: number;
  } | null>(null);
  const [loadingImageStats, setLoadingImageStats] = useState(false);

  // ── Leads state ─────────────��────────────────────────────────────────────
  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadEvents, setLeadEvents] = useState<LeadEvent[]>([]);
  const [leadTotals, setLeadTotals] = useState<LeadTotals>({});
  const [eventTotals, setEventTotals] = useState<EventTotals>({});
  // De que páginas vem o tráfego — a análise que faltava por completo
  const [paginasTop, setPaginasTop] = useState<Array<{ pagePath: string; visitas: number }>>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [leadsError, setLeadsError] = useState<string | null>(null);
  const [leadPeriodo, setLeadPeriodo] = useState("7d");
  const [leadStatusFilter, setLeadStatusFilter] = useState("");
  const [leadEventTypeFilter, setLeadEventTypeFilter] = useState("");
  const [leadSearch, setLeadSearch] = useState("");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [leadNotas, setLeadNotas] = useState("");
  const [savingLeadStatus, setSavingLeadStatus] = useState(false);
  const [leadsLastUpdate, setLeadsLastUpdate] = useState<Date | null>(null);
  const [activeLeadsTab, setActiveLeadsTab] = useState<"leads" | "eventos">("leads");
  // ── Pedidos state ───────────�����───────────────────────���─────���───────────────
  type SimulatorOrder = {
    id: number;
    serviceType?: string | null;
    description?: string | null;
    address?: string | null;
    city?: string | null;
    contactName?: string | null;
    contactPhone?: string | null;
    contactEmail?: string | null;
    urgency?: string | null;
    estimateMin?: string | null;
    estimateMax?: string | null;
    estimateTotal?: string | null;
    estimateJson?: string | null;
    distanceKm?: string | null;
    distanceText?: string | null;
    floor?: string | null;
    hasElevator?: string | null;
    parkingDistance?: string | null;
    filesJson?: string | null;
    chatJson?: string | null;
    historyJson?: string | null;
    status: string;
    priority?: string | null;
    notasInternas?: string | null;
    precoFinal?: string | null;
    precoFinalIva?: string | null;
    mensagemCliente?: string | null;
    assignedToId?: number | null;
    assignedToName?: string | null;
    assignedAt?: string | null;
    /** Quando alguém abriu o pedido pela primeira vez. NULL = novo. */
    viewedAt?: string | null;
    rawOrderJson?: string | null;
    createdAt: string;
    updatedAt: string;
  };
  const [pedidos, setPedidos] = useState<SimulatorOrder[]>([]);
  const [pedidosCounts, setPedidosCounts] = useState<Record<string, number>>({});
  const [pedidosLoading, setPedidosLoading] = useState(false);
  const [pedidosError, setPedidosError] = useState<string | null>(null);
  // Abre nos novos: o que ninguém viu ainda é o que precisa de atenção
  const [pedidoStatusFilter, setPedidoStatusFilter] = useState("pendente");
  const [pedidoSearch, setPedidoSearch] = useState("");
  const [pedidoSearchDebounced, setPedidoSearchDebounced] = useState("");
  const [selectedPedido, setSelectedPedido] = useState<SimulatorOrder | null>(null);
  const [pedidoDetalheOpen, setPedidoDetalheOpen] = useState(false);
  const [confirmAcceptPedido, setConfirmAcceptPedido] = useState<SimulatorOrder | null>(null);
  const [tickets, setTickets] = useState<TicketSuporte[]>([]);
  const [ticketsPorTratar, setTicketsPorTratar] = useState(0);
  const [ticketsFiltro, setTicketsFiltro] = useState<"por_tratar" | "todos" | EstadoTicket>("por_tratar");
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketAberto, setTicketAberto] = useState<TicketDetalhe | null>(null);
  const [ticketResposta, setTicketResposta] = useState("");
  const [ticketAEnviar, setTicketAEnviar] = useState(false);
  const [ticketErro, setTicketErro] = useState<string | null>(null);

  /** Ids marcados na tabela de pedidos, para acções em lote. */
  const [pedidosMarcados, setPedidosMarcados] = useState<Set<number>>(new Set());
  const [aExecutarLote, setAExecutarLote] = useState<string | null>(null);
  const pedidoSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlePedidoSearch = (value: string) => {
    setPedidoSearch(value);
    if (pedidoSearchRef.current) clearTimeout(pedidoSearchRef.current);
    pedidoSearchRef.current = setTimeout(() => setPedidoSearchDebounced(value), 350);
  };
  // ────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const metaRobots = document.createElement("meta");
    metaRobots.name = "robots";
    metaRobots.content = "noindex, nofollow";
    document.head.appendChild(metaRobots);

    const storedToken = getColaboradorItem("token");
    const storedNome = getColaboradorItem("nome");
    const storedIsAdmin = getColaboradorItem("isAdmin");

    if (!storedToken) {
      router.push("/admin/login");
      return;
    }

    // Só administradores. Antes, quem não fosse admin nem assistente era
    // mandado para /colaboradores/dashboard; essa área desapareceu com as
    // funções de motorista e ajudante. Uma sessão antiga guardada no browser
    // é limpa e volta ao ecrã de entrada.
    if (storedIsAdmin !== "1") {
      clearColaboradorStorage();
      router.push("/admin/login");
      return;
    }

    setToken(storedToken);
    setAdminNome(storedNome || "Administração");
    setIsAdminGeral(true);
    const storedId = getColaboradorItem("id");
    if (storedId) setColabId(Number(storedId));

    // Verificar se há section/tab/pedido no URL
    const searchParams = new URLSearchParams(window.location.search);
    const sectionParam = searchParams.get("section") as AdminSection | null;
    if (sectionParam && adminNavItems.some(item => item.id === sectionParam)) {
      setActiveSection(sectionParam);
    }
    const tabParam = searchParams.get("tab") as AppClyonTab | null;
    if (tabParam && CLYON_TAB_IDS.includes(tabParam)) {
      setActiveClyonTab(tabParam);
    }
    const pedidoParam = searchParams.get("pedido");
    if (pedidoParam) setActivePedidoId(pedidoParam);
    urlSyncReady.current = true;

    // Quem chega aqui é administrador — o ramo alternativo era do assistente.
    void carregarSimulatorSettings(storedToken);
    void carregarImageStats(storedToken);
    setLoading(false);

    return () => {
      document.head.removeChild(metaRobots);
    };
  }, [router]);

  // Sincronizar URL com a secção e aba activa
  useEffect(() => {
    if (!token || !urlSyncReady.current) return;
    const p = new URLSearchParams({ section: activeSection });
    if (activeSection === "app_clyon") {
      p.set("tab", activeClyonTab);
      if (activePedidoId) p.set("pedido", activePedidoId);
    }
    router.replace(`/admin?${p.toString()}`, { scroll: false });
  }, [activeSection, activeClyonTab, activePedidoId, token, router]);

  // Repor estado ao navegar com os botões Anterior/Seguinte do browser
  useEffect(() => {
    function handlePop() {
      const sp = new URLSearchParams(window.location.search);
      const sec = sp.get("section") as AdminSection | null;
      if (sec && adminNavItems.some((i) => i.id === sec)) setActiveSection(sec);
      const t = sp.get("tab") as AppClyonTab | null;
      if (t && CLYON_TAB_IDS.includes(t)) setActiveClyonTab(t);
      else setActiveClyonTab("visao-geral");
      setActivePedidoId(sp.get("pedido") ?? null);
    }
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  const carregarSimulatorSettings = async (authToken: string) => {
    try {
      setLoadingSimulatorSettings(true);
      const response = await fetch("/api/colaboradores/admin/settings/simulador", {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (!response.ok) {
        throw new Error("Não foi possível carregar os valores do simulador.");
      }

      const data = await response.json();
      const settings = data.settings || [];
      setSimulatorSettings(settings);
      setSimulatorDrafts(
        Object.fromEntries(
          settings.map((item: SimulatorSetting) => [item.key, String(item.value ?? "")]),
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar os valores do simulador.");
    } finally {
      setLoadingSimulatorSettings(false);
    }
  };

  const carregarImageStats = async (authToken: string) => {
    try {
      setLoadingImageStats(true);
      const response = await fetch(`/api/media/gallery?_=${Date.now()}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (!response.ok) return;

      const data = await response.json();
      const items: Array<{ section?: string; isActive?: boolean }> = data.items || [];
      setImageStats({
        total: items.length,
        ativas: items.filter((item) => item.isActive).length,
        inativas: items.filter((item) => !item.isActive).length,
        hero: items.filter((item) => item.section === "hero").length,
        showcase: items.filter((item) => item.section === "showcase").length,
      });
    } catch {
      // Estatísticas de imagens são informativas; falhas não bloqueiam o painel.
    } finally {
      setLoadingImageStats(false);
    }
  };

  /**
   * Vai buscar os pedidos sem tirar do ecrã os que já lá estão.
   *
   * Antes, qualquer carregamento que não fosse o automático punha
   * pedidosLoading a true, e o ecrã trocava a tabela inteira por
   * "A carregar pedidos...". Isso acontecia ao mudar de filtro, ao escrever
   * na pesquisa e depois de cada arquivar/realizado/rejeitado — ou seja, a
   * tabela desaparecia a cada clique, e com a base a demorar mais de um
   * segundo era tempo suficiente para dar a sensação de que o painel tinha
   * ido abaixo.
   *
   * A lista antiga fica à vista enquanto a nova não chega. Quem decide se
   * mostra o ecrã de espera é o render, e só quando não há nada para mostrar.
   */
  const carregarPedidos = async (authToken: string, status = "todos", search = "", silent = false) => {
    if (!authToken) return;
    try {
      if (!silent) {
        setPedidosLoading(true);
        setPedidosError(null);
      }
      const params = new URLSearchParams();
      if (status && status !== "todos") params.set("status", status);
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/pedidos?${params}&_=${Date.now()}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) throw new Error("Erro ao carregar pedidos");
      const data = await res.json();
      const safeOrders = (data.orders ?? []).map((o: any) => {
        const safe = { ...o };
        for (const k of Object.keys(safe)) {
          if (safe[k] !== null && typeof safe[k] === "object" && !(safe[k] instanceof Date) && !Array.isArray(safe[k])) {
            safe[k] = JSON.stringify(safe[k]);
          }
        }
        return safe;
      });
      setPedidos(safeOrders);
      setPedidosCounts(data.counts ?? {});
    } catch {
      if (!silent) setPedidosError("Não foi possível carregar os pedidos.");
    } finally {
      if (!silent) setPedidosLoading(false);
    }
  };

  const carregarTickets = async (authToken: string, filtro = ticketsFiltro, silencioso = false) => {
    if (!authToken) return;
    if (!silencioso) setTicketsLoading(true);
    try {
      const r = await fetch(`/api/admin/suporte?estado=${filtro}&_=${Date.now()}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      const d = await r.json();
      if (r.ok) {
        setTickets(d.tickets ?? []);
        setTicketsPorTratar(d.porTratar ?? 0);
        setTicketErro(null);
      } else {
        setTicketErro(d.error ?? "Não foi possível carregar o suporte.");
      }
    } catch {
      setTicketErro("Erro de ligação ao carregar o suporte.");
    } finally {
      if (!silencioso) setTicketsLoading(false);
    }
  };

  const abrirTicket = async (id: string) => {
    if (!token) return;
    setTicketResposta("");
    setTicketErro(null);
    try {
      const r = await fetch(`/api/admin/suporte/${id}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      if (r.ok) setTicketAberto(d as TicketDetalhe);
      else setTicketErro(d.error ?? "Não foi possível abrir este pedido.");
    } catch {
      setTicketErro("Erro de ligação.");
    }
  };

  /**
   * Envia a resposta — e desiste ao fim de 25 segundos.
   *
   * Sem isto, um pedido que não volta deixa o botão em "A enviar…" para
   * sempre: o ecrã não diz que falhou, não deixa tentar outra vez, e quem
   * está a operar fica sem saber se a mensagem foi ou não. Um erro visível é
   * sempre melhor do que um botão parado.
   *
   * 25 s é de propósito mais do que o limite da função no Vercel: se for o
   * servidor a desistir primeiro, recebemos o erro dele, que diz mais.
   */
  const responderTicket = async () => {
    if (!token || !ticketAberto || !ticketResposta.trim()) return;
    const idTicket = ticketAberto.ticket.id;
    setTicketAEnviar(true);
    setTicketErro(null);

    const desistir = new AbortController();
    const relogio = setTimeout(() => desistir.abort(), 25000);

    try {
      const r = await fetch(`/api/admin/suporte/${idTicket}/mensagens`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ body: ticketResposta.trim() }),
        signal: desistir.signal,
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setTicketErro(d.error ?? `Não foi possível enviar a resposta (${r.status}).`);
        return;
      }
      setTicketResposta("");
      await abrirTicket(idTicket);
      await carregarTickets(token, ticketsFiltro, true);
    } catch (e) {
      const desistiu = e instanceof DOMException && e.name === "AbortError";
      setTicketErro(
        desistiu
          // A mensagem pode ter sido gravada e só a resposta não ter voltado.
          // Dizer "tente outra vez" sem avisar disto leva a duplicados.
          ? "O envio demorou demasiado e foi cancelado. Feche e volte a abrir o pedido para ver se a resposta ficou gravada antes de a escrever outra vez."
          : "Erro de ligação ao enviar a resposta.",
      );
      // Recarregar mostra o que ficou mesmo gravado, em vez de deixar o ecrã
      // a dizer "ainda sem respostas" quando talvez já haja uma.
      await abrirTicket(idTicket).catch(() => {});
    } finally {
      clearTimeout(relogio);
      setTicketAEnviar(false);
    }
  };

  const mudarEstadoTicket = async (id: string, status: EstadoTicket) => {
    if (!token) return;
    try {
      const r = await fetch(`/api/admin/suporte/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      const d = await r.json();
      if (!r.ok) { setTicketErro(d.error ?? "Não foi possível mudar o estado."); return; }
      if (ticketAberto?.ticket.id === id) await abrirTicket(id);
      await carregarTickets(token, ticketsFiltro, true);
    } catch {
      setTicketErro("Erro de ligação.");
    }
  };

  /**
   * Os pedidos que estão à vista com o filtro e a pesquisa actuais.
   *
   * A selecção em lote trabalha sobre isto, e não sobre a lista toda: marcar
   * "todos" tem de querer dizer os que a pessoa está mesmo a ver.
   */
  const pedidosVisiveis = useMemo(
    () => pedidos.filter((p) => pedidoNoFiltro(p, pedidoStatusFilter)),
    [pedidos, pedidoStatusFilter],
  );

  const marcarPedido = (id: number) => {
    setPedidosMarcados((antes) => {
      const novo = new Set(antes);
      if (novo.has(id)) novo.delete(id); else novo.add(id);
      return novo;
    });
  };

  const todosMarcados = pedidosVisiveis.length > 0
    && pedidosVisiveis.every((p) => pedidosMarcados.has(p.id));

  const alternarTodosPedidos = () => {
    setPedidosMarcados(todosMarcados ? new Set() : new Set(pedidosVisiveis.map((p) => p.id)));
  };

  /**
   * Aplica a mesma acção a todos os pedidos marcados.
   *
   * Uma confirmação para o lote inteiro, com o número à frente — não uma por
   * pedido. Os pedidos são tratados um a um e conta-se o que falhou, porque
   * um erro a meio não deve deixar a pessoa sem saber o que passou e o que
   * não passou. No fim, uma recarga silenciosa: a lista actualiza-se sem o
   * ecrã piscar.
   */
  const acaoEmLote = async (
    acao: "concluido" | "rejeitado" | "arquivar" | "apagar",
  ) => {
    if (!token || pedidosMarcados.size === 0) return;
    const ids = [...pedidosMarcados];
    const n = ids.length;
    const plural = n === 1 ? "1 pedido" : `${n} pedidos`;

    const perguntas: Record<typeof acao, string> = {
      concluido: `Marcar ${plural} como realizados? Saem da lista activa e entram na folha de trabalhos concluídos.`,
      rejeitado: `Marcar ${plural} como rejeitados? Saem da lista activa e não voltam a aparecer na fila.`,
      arquivar:  `Arquivar ${plural}? Deixam de aparecer na lista principal, mas podem ser vistos em "Arquivados".`,
      apagar:    `APAGAR ${plural} definitivamente? Isto não tem desfazer — os dados do cliente e o histórico desaparecem.`,
    };
    if (!confirm(perguntas[acao])) return;

    setAExecutarLote(acao);
    let falhas = 0;
    try {
      for (const id of ids) {
        try {
          let r: Response;
          if (acao === "apagar") {
            r = await fetch(`/api/admin/pedidos?id=${id}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });
          } else if (acao === "arquivar") {
            r = await fetch(`/api/admin/pedidos/${id}/reject`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
            });
          } else {
            r = await fetch(`/api/admin/pedidos`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ id, status: acao }),
            });
          }
          if (!r.ok) falhas += 1;
        } catch {
          falhas += 1;
        }
      }
      setPedidosMarcados(new Set());
      await carregarPedidos(token, pedidoStatusFilter, pedidoSearchDebounced, true);
      if (falhas > 0) {
        alert(`${n - falhas} de ${n} tratados. ${falhas} falharam — verifique a lista.`);
      }
    } finally {
      setAExecutarLote(null);
    }
  };

  /**
   * Fecha um pedido: realizado ou rejeitado.
   *
   * "concluido" não é só uma etiqueta — dispara a exportação para a folha do
   * Google (ver updateSimulatorOrder). Por isso pede confirmação e diz o que
   * vai acontecer, em vez de um "tem a certeza?" vazio.
   */
  const fecharPedido = async (
    p: { id: number; status: string; contactName?: string | null },
    novoEstado: "concluido" | "rejeitado",
  ) => {
    if (!token || !p.id) return;
    const quem = p.contactName ? ` de ${p.contactName}` : "";
    const pergunta = novoEstado === "concluido"
      ? `Marcar o pedido${quem} como realizado? Sai da lista activa e entra na folha de trabalhos concluídos.`
      : `Marcar o pedido${quem} como rejeitado? Sai da lista activa e não volta a aparecer na fila.`;
    if (!confirm(pergunta)) return;
    try {
      const r = await fetch(`/api/admin/pedidos`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id: p.id, status: novoEstado }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        alert(`Erro: ${j?.message ?? j?.error ?? r.statusText}`);
        return;
      }
      await carregarPedidos(token, pedidoStatusFilter, pedidoSearchDebounced, true);
    } catch (err) {
      alert(`Erro: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const carregarLeads = async (authToken: string, periodo = leadPeriodo, status = leadStatusFilter, silent = false) => {
    if (!authToken) return;
    try {
      if (!silent) setLoadingLeads(true);
      setLeadsError(null);
      const [leadsRes, eventsRes] = await Promise.all([
        fetch(`/api/admin/leads?periodo=${periodo}&status=${status}&_=${Date.now()}`, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${authToken}` },
        }),
        fetch(`/api/admin/lead-events?periodo=${periodo}&eventType=${leadEventTypeFilter}&_=${Date.now()}`, {
          cache: "no-store",
          headers: { Authorization: `Bearer ${authToken}` },
        }),
      ]);

      // Leads principais — só estes erros mostram mensagem de erro visível
      if (leadsRes.ok) {
        const data = await leadsRes.json();
        if (data.error) {
          setLeadsError("Não foi possível carregar leads. Verifique a ligação à base de dados ou os endpoints.");
        } else {
          setLeads(data.leads || []);
          setLeadTotals(data.totals || {});
        }
      } else {
        setLeadsError("Não foi possível carregar leads. Verifique a ligação à base de dados ou os endpoints.");
      }

      // Eventos de contacto — falha silenciosa, não bloqueia a tab de leads
      if (eventsRes.ok) {
        try {
          const data = await eventsRes.json();
          if (!data.error) {
            setLeadEvents(data.events || []);
            setEventTotals(data.totals || {});
            setPaginasTop(data.paginas || []);
          }
        } catch { /* silencioso */ }
      }

      setLeadsLastUpdate(new Date());
    } catch (err) {
      console.error("[admin] carregarLeads error:", err);
      if (!silent) setLeadsError("Não foi possível carregar leads. Verifique a ligação à base de dados ou os endpoints.");
    } finally {
      if (!silent) setLoadingLeads(false);
    }
  };

  const atualizarStatusLead = async (id: number, status: Lead["status"], notas?: string) => {
    if (!token) return;
    try {
      setSavingLeadStatus(true);
      await fetch("/api/admin/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, status, notasInternas: notas }),
      });
      setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status, notasInternas: notas ?? l.notasInternas } : l)));
      if (selectedLead?.id === id) setSelectedLead((prev) => (prev ? { ...prev, status, notasInternas: notas ?? prev.notasInternas } : prev));
    } finally {
      setSavingLeadStatus(false);
    }
  };

  // Polling a cada 15 segundos quando a aba Leads está ativa
  useEffect(() => {
    if (activeSection !== "leads" || !token) return;
    carregarLeads(token, leadPeriodo, leadStatusFilter);
    const interval = setInterval(() => carregarLeads(token, leadPeriodo, leadStatusFilter, true), 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, token, leadPeriodo, leadStatusFilter, leadEventTypeFilter]);

  // Carregar pedidos quando a aba Pedidos fica activa
  useEffect(() => {
    if (activeSection !== "pedidos" || !token) return;
    carregarPedidos(token, pedidoStatusFilter, pedidoSearchDebounced);
    // Mudar de filtro ou de pesquisa muda o que está à vista. Manter a
    // marcação seria agir sobre linhas que a pessoa já não vê.
    setPedidosMarcados(new Set());
    const interval = setInterval(() => carregarPedidos(token, pedidoStatusFilter, pedidoSearchDebounced, true), 120000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, token, pedidoStatusFilter, pedidoSearchDebounced]);

  // O contador do menu tem de estar certo mesmo sem se abrir a secção — é
  // essa a razão de ele existir. Sem isto voltávamos ao mesmo: ninguém abre
  // o que não sabe que tem coisas lá dentro.
  useEffect(() => {
    if (!token) return;
    carregarTickets(token, ticketsFiltro, true);
    const intervalo = setInterval(() => carregarTickets(token, ticketsFiltro, true), 120000);
    return () => clearInterval(intervalo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, ticketsFiltro]);

  useEffect(() => {
    if (activeSection === "suporte" && token) carregarTickets(token, ticketsFiltro);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, ticketsFiltro]);

  // Carregar resumo de pedidos para o overview (5 mais recentes)
  useEffect(() => {
    if (!token) return;
    carregarPedidos(token, "todos", "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const simulatorGroups = useMemo(() => {
    const settingsMap = new Map(simulatorSettings.map((setting) => [setting.key, setting]));

    return simulatorDisplayGroups.map((group) => ({
      id: group.id,
      label: group.label,
      description: group.description,
      settings: group.keys
        .map((key) => settingsMap.get(key))
        .filter((setting): setting is SimulatorSetting => Boolean(setting)),
    }));
  }, [simulatorSettings]);

  const hojeLabel = useMemo(
    () =>
      new Intl.DateTimeFormat("pt-PT", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(new Date()),
    [],
  );







  // ---- Página Equipa: dados derivados por colaborador ----
  const handleLogout = () => {
    clearColaboradorStorage();
    router.push("/admin/login");
  };

  const alterarMinhaSenha = async () => {
    setError("");

    if (!senhaAtualAdmin || !novaSenhaAdmin || !confirmacaoSenhaAdmin) {
      setError("Preencha a palavra-passe atual, a nova palavra-passe e a respetiva confirmação.");
      return;
    }
    if (novaSenhaAdmin !== confirmacaoSenhaAdmin) {
      setError("A confirmação não coincide com a nova palavra-passe.");
      return;
    }
    if (novaSenhaAdmin.length < 8) {
      setError("A nova palavra-passe deve ter pelo menos 8 caracteres.");
      return;
    }

    setAlterandoSenhaAdmin(true);
    try {
      const response = await fetch("/api/admin/seguranca/alterar-senha", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ senhaAtual: senhaAtualAdmin, novaSenha: novaSenhaAdmin }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Não foi possível atualizar a palavra-passe.");
      }

      clearColaboradorStorage();
      setToken("");
      router.replace("/admin/login?passwordChanged=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível atualizar a palavra-passe.");
    } finally {
      setAlterandoSenhaAdmin(false);
    }
  };

  const guardarSimulatorSetting = async (setting: SimulatorSetting) => {
    setSavingSettingKey(setting.key);
    try {
      const response = await fetch("/api/colaboradores/admin/settings/simulador", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          key: setting.key,
          value: simulatorDrafts[setting.key],
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Não foi possível guardar este valor.");
      }

      setError("");
      await carregarSimulatorSettings(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível guardar este valor.");
    } finally {
      setSavingSettingKey(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[linear-gradient(180deg,#07111d_0%,#0b1727_52%,#101d31_100%)] px-5 py-16 text-white">
        <div className="w-full animate-pulse space-y-5">
          <div className="h-10 w-72 rounded-full bg-white/10" />
          <div className="grid gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-36 rounded-[28px] bg-white/8" />
            ))}
          </div>
          <div className="h-80 rounded-[32px] bg-white/8" />
        </div>
      </div>
    );
  }

  return (
    /* A casca ocupa o ecrã e não rola. Só o <main> rola.
       Antes o documento inteiro é que rolava, com a barra e o cabeçalho em
       `sticky` — e `sticky` deixa de funcionar se qualquer antepassado tiver
       overflow definido, que é o caso aqui. Em vez de caçar esse
       antepassado, a altura fixa resolve o problema na origem: o que está
       fora do <main> não tem para onde rolar. */
    <div className="flex h-screen overflow-hidden bg-slate-950 text-white">
      {/* Fundo escuro quando o menu abre em ecrã pequeno */}
      {menuAberto && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/70 lg:hidden"
          onClick={() => setMenuAberto(false)}
          aria-hidden
        />
      )}

      {/* ── Barra lateral ──────────────────────────────────────────────
            Fixa a partir de lg; em ecrã pequeno desliza por cima e o fundo
            escurece. Os oito destinos estavam em linha no topo, todos com o
            mesmo peso — agrupados, cada um está onde se procura. */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-slate-900 transition-transform lg:relative lg:translate-x-0 ${
            menuAberto ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {/* Marca.
              A altura é a MESMA do cabeçalho da direita (h-12) e está escrita
              nos dois sítios como número fixo. Com padding, cada lado crescia
              conforme o texto que lá estivesse e os dois desalinhavam-se — que
              era o degrau que se via. Sem linha por baixo e sem linha ao lado:
              a faixa lê-se como uma só, de ponta a ponta. */}
          <div className="flex h-12 flex-shrink-0 items-center gap-2.5 px-4">
            <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-[9px] bg-sky-500 text-white">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="min-w-0 leading-none">
              <p className="text-[9px] font-semibold uppercase leading-none tracking-[0.2em] text-sky-400">
                Backoffice
              </p>
              <p className="mt-0.5 truncate text-[13px] font-semibold leading-none text-white">
                CLYON
              </p>
            </div>
            <button
              type="button"
              onClick={() => setMenuAberto(false)}
              className="ml-auto rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-white lg:hidden"
              aria-label="Fechar menu"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Destinos.
              A borda direita vive aqui e no bloco de baixo, e não no <aside>:
              assim a linha começa por baixo da faixa do cabeçalho em vez de a
              cortar ao meio. */}
          <nav className="flex-1 overflow-y-auto border-r border-slate-800 px-3 py-4">
            {NAV_GRUPOS.map((grupo) => {
              const itens = grupo.itens
                .map((id) => adminNavItems.find((i) => i.id === id))
                .filter((i): i is (typeof adminNavItems)[number] => Boolean(i));
              if (itens.length === 0) return null;

              return (
                <div key={grupo.titulo} className="mb-5 last:mb-0">
                  <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-600">
                    {grupo.titulo}
                  </p>
                  <div className="space-y-0.5">
                    {itens.map((item) => {
                      const Icon = item.icon;
                      const active = activeSection === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setActiveSection(item.id);
                            setMenuAberto(false);
                          }}
                          aria-current={active ? "page" : undefined}
                          className={`flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-sm font-medium transition ${
                            active
                              ? "bg-sky-500 text-white shadow-md"
                              : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                          }`}
                        >
                          <Icon className="h-4 w-4 flex-shrink-0" />
                          <span className="truncate">{sectionLabels[item.id]}</span>
                          {item.id === "suporte" && ticketsPorTratar > 0 && (
                            <span
                              className={`ml-auto flex-shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                                active ? "bg-white/25 text-white" : "bg-rose-500 text-white"
                              }`}
                              title={`${ticketsPorTratar} por tratar`}
                            >
                              {ticketsPorTratar}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}

          </nav>

          {/* Quem está a trabalhar, e a saída */}
          <div className="border-r border-t border-slate-800 px-3 py-3">
            <div className="flex items-center gap-3 rounded-[14px] px-2 py-1.5">
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-sky-500 text-xs font-bold text-white">
                {getInitials(adminNome)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{adminNome}</p>
                <p className="text-[11px] text-slate-500">Administração</p>
              </div>
              <Button
                onClick={handleLogout}
                variant="ghost"
                className="h-8 w-8 flex-shrink-0 rounded-[10px] p-0 text-slate-500 hover:bg-slate-800 hover:text-white"
                title="Sair"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </aside>

        {/* ── Conteúdo ────────────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* A mesma altura da marca, à esquerda — e nenhuma linha entre as
              duas. O título e a data ficam na mesma linha: empilhados, pediam
              mais altura do que a faixa tem para dar. */}
          <header className="z-30 flex h-12 flex-shrink-0 items-center gap-2.5 bg-slate-900 px-4 lg:px-6">
            <button
              type="button"
              onClick={() => setMenuAberto(true)}
              className="-ml-1 rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
              aria-label="Abrir menu"
            >
              <Menu className="h-4 w-4" />
            </button>
            <h2 className="truncate text-[15px] font-semibold leading-none text-white">
              {sectionLabels[activeSection]}
            </h2>
            <p className="hidden truncate text-xs capitalize leading-none text-slate-500 sm:block">
              {hojeLabel}
            </p>
          </header>

          <main className="min-w-0 flex-1 space-y-5 overflow-y-auto px-3 py-5 lg:px-6">
            {error && (
              <div className="rounded-[22px] border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
                {error}
              </div>
            )}

          {activeSection === "overview" && (
            <>
              {/* Barra de ações rápidas */}
              <section className="flex flex-col gap-4 rounded-[24px] border border-cyan-300/16 bg-[linear-gradient(135deg,rgba(9,27,43,0.96)_0%,rgba(12,34,52,0.94)_100%)] p-5 shadow-[0_20px_70px_rgba(3,10,18,0.24)] xl:flex-row xl:items-center xl:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400 text-slate-950">
                    <LayoutDashboard className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
                      Painel de controlo
                    </p>
                    <p className="mt-1 text-lg font-semibold capitalize text-white">{hojeLabel}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                </div>
              </section>


              {/* Bloco de resumo de pedidos do simulador */}
              <section className="rounded-[24px] border border-cyan-300/16 bg-[linear-gradient(135deg,rgba(9,27,43,0.96)_0%,rgba(12,34,52,0.94)_100%)] p-5 shadow-[0_20px_70px_rgba(3,10,18,0.24)]">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-blue-500 text-white">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">Simulador</p>
                      <h3 className="text-base font-semibold text-white">Pedidos do simulador</h3>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveSection("pedidos")}
                    className="flex items-center gap-2 rounded-[14px] border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-medium text-cyan-100 transition hover:bg-white/[0.08]"
                  >
                    Ver todos
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
                {/* Métricas rápidas */}
                <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                  {[
                    { label: "Novos", key: "pendente", color: "text-blue-400", bg: "bg-blue-400/10 border-blue-400/20" },
                    { label: "Atribuídos", key: "atribuido", color: "text-purple-400", bg: "bg-purple-400/10 border-purple-400/20" },
                    { label: "Em análise", key: "em_analise", color: "text-yellow-400", bg: "bg-yellow-400/10 border-yellow-400/20" },
                    { label: "Aprovados", key: "aprovado", color: "text-cyan-300 font-semibold", bg: "bg-cyan-400/15 border-cyan-400/30" },
                    { label: "Confirmados", key: "confirmado", color: "text-green-400", bg: "bg-green-400/10 border-green-400/20" },
                    { label: "Presencial", key: "presencial_recomendado", color: "text-orange-400", bg: "bg-orange-400/10 border-orange-400/20" },
                  ].map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => { setPedidoStatusFilter(m.key); setActiveSection("pedidos"); }}
                      className={`flex flex-col items-center justify-center rounded-[16px] border px-2 py-3 transition hover:scale-105 ${m.bg}`}
                    >
                      <span className={`text-xl font-bold ${m.color}`}>{pedidosCounts[m.key] ?? 0}</span>
                      <span className="mt-0.5 text-xs text-slate-400">{m.label}</span>
                    </button>
                  ))}
                </div>
                {/* Últimos 5 pedidos */}
                {pedidosLoading ? (
                  <div className="py-4 text-center text-sm text-slate-400">A carregar...</div>
                ) : pedidos.length === 0 ? (
                  <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-white/10 py-8 text-center">
                    <FileText className="h-8 w-8 text-slate-600" />
                    <div>
                      <p className="text-sm font-semibold text-slate-300">Nenhum pedido do simulador ainda</p>
                      <p className="mt-1 text-xs text-slate-500">Quando um cliente enviar um pedido pelo simulador, ele aparecerá aqui para análise.</p>
                    </div>
                    <a
                      href="/simulador"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 rounded-[12px] border border-cyan-400/30 bg-cyan-400/10 px-4 py-2 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-400/20"
                    >
                      Ver simulador
                    </a>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {pedidos.slice(0, 5).map((p) => {
                      const statusColors: Record<string, string> = {
                        sem_assistente: "bg-yellow-500/20 text-yellow-300",
                        pendente: "bg-blue-500/20 text-blue-300",
                        atribuido: "bg-purple-500/20 text-purple-300",
                        em_analise: "bg-yellow-500/20 text-yellow-300",
                        aprovado: "bg-cyan-500/20 text-cyan-200 font-semibold",
                        confirmado: "bg-green-500/20 text-green-300",
                        cancelado: "bg-slate-500/20 text-slate-400",
                        presencial_recomendado: "bg-orange-500/20 text-orange-300",
                      };
                      const statusLabel: Record<string, string> = {
                        sem_assistente: "Por atribuir",
                        pendente: "Novo",
                        atribuido: "Atribuído",
                        em_analise: "Em análise",
                        precisa_info: "Info",
                        presencial_recomendado: "Presencial",
                        estimativa_pronta: "Estimativa",
                        aprovado: "Aprovado",
                        enviado_cliente: "Enviado",
                        confirmado: "Confirmado",
                        cancelado: "Cancelado",
                        concluido: "Realizado",
                        rejeitado: "Rejeitado",
                        arquivado: "Arquivado",
                      };
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => { setSelectedPedido(p); setPedidoDetalheOpen(true); setActiveSection("pedidos"); }}
                          className="flex w-full items-center gap-3 rounded-[14px] border border-white/10 bg-white/[0.03] px-3 py-2.5 text-left text-sm transition hover:border-cyan-400/30 hover:bg-white/[0.06]"
                        >
                          <span className="w-8 text-right text-xs font-mono text-slate-500">#{p.id}</span>
                          <span className="flex-1 truncate font-medium text-white">{p.contactName ?? "—"}</span>
                          <span className="hidden truncate text-slate-400 sm:block">{normalizeServiceTypeLabel(p.serviceType)}</span>
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusColors[p.status] ?? "bg-slate-500/20 text-slate-400"}`}>
                            {statusLabel[p.status] ?? p.status}
                          </span>
                          {(p as any).calendarStatus && (p as any).calendarStatus !== "not_scheduled" && (
                            <span className="hidden sm:inline-flex items-center gap-1 rounded-full border border-violet-400/30 bg-violet-400/10 px-2 py-0.5 text-[10px] font-semibold text-violet-300">
                              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              Agendado
                            </span>
                          )}
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-600" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Layout principal: leads + ações */}
              <section className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
                <div className="space-y-4">
                  {/* Leads e contactos do site */}
                  <ActionCard title="Leads e contactos do site" description="Resumo de hoje e últimos contactos.">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {[
                        { label: "Leads hoje", value: leadTotals.hoje ?? "—" },
                        { label: "Esta semana", value: leadTotals.semana ?? "—" },
                        { label: "WhatsApp hoje", value: eventTotals.whatsappHoje ?? "—" },
                        { label: "Ligar hoje", value: eventTotals.ligarHoje ?? "—" },
                      ].map((stat) => (
                        <div key={stat.label} className="rounded-[14px] border border-white/10 bg-white/[0.03] p-3 text-center">
                          <p className="text-xl font-semibold text-white">{stat.value}</p>
                          <p className="mt-0.5 text-[11px] text-slate-400">{stat.label}</p>
                        </div>
                      ))}
                    </div>
                    {leads.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        {leads.slice(0, 5).map((lead) => (
                          <div key={lead.id} className="flex items-center justify-between gap-3 rounded-[12px] border border-white/5 bg-white/[0.02] px-3 py-2">
                            <div>
                              <p className="text-sm font-medium text-white">{lead.nome}</p>
                              <p className="text-[11px] text-slate-400">{lead.tipoServico} · {lead.localidade}</p>
                            </div>
                            <span className="text-[11px] text-slate-500">
                              {new Date(lead.createdAt).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setActiveSection("leads")}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-300/20 bg-cyan-400/[0.07] py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-400/[0.14]"
                    >
                      <TrendingUp className="h-4 w-4" />
                      Ver todos os leads
                    </button>
                  </ActionCard>

                  {/* Ações rápidas */}
                  <ActionCard title="Ações rápidas" description="Atalhos operacionais." compact>
                    <QuickAction icon={TrendingUp} label="Ver leads e contactos" onClick={() => setActiveSection("leads")} />
                    <QuickAction icon={Settings2} label="Configurações" onClick={() => setActiveSection("configs")} />
                  </ActionCard>
                </div>
              </section>
            </>
          )}

          {activeSection === "pedidos" && (
            <section className="space-y-4 rounded-[28px] border border-[#ccccff] bg-[#e8e8ff] p-5 shadow-sm">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-700">
                    Gestão de pedidos
                  </p>
                  <h2 className="mt-2 text-[1.85rem] font-semibold text-slate-900">
                    Pedidos do simulador
                  </h2>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPedidoStatusFilter(pedidoStatusFilter === "arquivado" ? "todos" : "arquivado")}
                    className={`flex h-11 items-center gap-2 rounded-[14px] border px-4 text-sm font-medium transition ${
                      pedidoStatusFilter === "arquivado"
                        ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                    title={pedidoStatusFilter === "arquivado" ? "Voltar aos pedidos activos" : "Ver pedidos arquivados"}
                  >
                    <Archive className="h-4 w-4" />
                    {pedidoStatusFilter === "arquivado"
                      ? "Ver activos"
                      : `Arquivados${(pedidosCounts["arquivado"] ?? 0) > 0 ? ` (${pedidosCounts["arquivado"]})` : ""}`}
                  </button>
                  <button
                    type="button"
                    disabled={pedidosLoading}
                    onClick={() => carregarPedidos(token, pedidoStatusFilter, pedidoSearchDebounced)}
                    className="flex h-11 items-center gap-2 rounded-[14px] border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
                  >
                    <RefreshCw className={`h-4 w-4 ${pedidosLoading ? "animate-spin" : ""}`} />
                    {pedidosLoading ? "A actualizar…" : "Actualizar"}
                  </button>
                </div>
              </div>

              {/* Métricas de pedidos */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                <button
                  type="button"
                  onClick={() => setPedidoStatusFilter("todos")}
                  className={`flex flex-col items-center justify-center rounded-[16px] border px-2 py-3 transition hover:scale-105 border-slate-200 bg-slate-50 ${pedidoStatusFilter === "todos" ? "ring-2 ring-cyan-500" : ""}`}
                >
                  <span className="text-2xl font-bold text-slate-700">{(pedidosCounts["total"] ?? 0) - (pedidosCounts["arquivado"] ?? 0)}</span>
                  <span className="mt-0.5 text-center text-xs text-slate-500">Total activos</span>
                  <span className="mt-0.5 text-[10px] text-slate-400">
                    {(pedidosCounts["arquivado"] ?? 0) > 0
                      ? `+${pedidosCounts["arquivado"]} arquivado${(pedidosCounts["arquivado"] ?? 0) === 1 ? "" : "s"}`
                      : "100% do total"}
                  </span>
                </button>
                {[
                  { label: "Novos", key: "pendente", color: "text-blue-600", bg: "border-blue-200 bg-blue-50", pct: "pendente" },
                  { label: "Aprovados", key: "aprovado", color: "text-emerald-600 font-semibold", bg: "border-emerald-200 bg-emerald-50", pct: "aprovado" },
                  { label: "Confirmados", key: "confirmado", color: "text-green-600", bg: "border-green-200 bg-green-50", pct: "confirmado" },
                ].map((m) => {
                  const total = pedidosCounts["total"] ?? 0;
                  const count = pedidosCounts[m.key] ?? 0;
                  const pct = total > 0 ? ((count / total) * 100).toFixed(1) : "0";
                  return (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setPedidoStatusFilter(m.key === pedidoStatusFilter ? "todos" : m.key)}
                    className={`flex flex-col items-center justify-center rounded-[16px] border px-2 py-3 transition hover:scale-105 ${m.bg} ${pedidoStatusFilter === m.key ? "ring-2 ring-cyan-500" : ""}`}
                  >
                    <span className={`text-2xl font-bold ${m.color}`}>{count}</span>
                    <span className="mt-0.5 text-center text-xs text-slate-600">{m.label}</span>
                    <span className="mt-0.5 text-[10px] text-slate-400">{pct}% do total</span>
                  </button>
                  );
                })}
              </div>

              {/* Filtros e pesquisa */}
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={pedidoSearch}
                    onChange={(e) => handlePedidoSearch(e.target.value)}
                    placeholder="Pesquisar por nome, telefone, morada, serviço..."
                    className="h-11 w-full rounded-[14px] border border-[#ccccff] bg-white/70 pl-9 pr-4 text-sm font-medium text-slate-900 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                  />
                </div>
                <select
                  value={pedidoStatusFilter}
                  onChange={(e) => setPedidoStatusFilter(e.target.value)}
                  className="h-11 rounded-[14px] border border-[#ccccff] bg-white/70 px-3 text-sm font-medium text-slate-700 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20"
                >
                  <option value="todos">Todos os status (activos)</option>
                  <option value="pendente">Novos</option>
                  <option value="atribuido">Atribuídos</option>
                  <option value="em_analise">Em análise</option>
                  <option value="concluido">Realizados</option>
                  <option value="rejeitado">Rejeitados</option>
                  <option value="precisa_info">Precisa informação</option>
                  <option value="presencial_recomendado">Presencial recomendado</option>
                  <option value="estimativa_pronta">Estimativa pronta</option>
                  <option value="aprovado">Aprovados</option>
                  <option value="enviado_cliente">Enviados ao cliente</option>
                  <option value="confirmado">Confirmados</option>
                  <option value="cancelado">Cancelados</option>
                  <option value="arquivado">Arquivados</option>
                </select>
              </div>

              {/* Lista de pedidos */}
              {pedidosError && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                  {pedidosError}
                </div>
              )}
              {pedidosMarcados.size > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-[16px] border border-cyan-200 bg-cyan-50 px-4 py-3">
                  <span className="text-sm font-semibold text-cyan-900">
                    {pedidosMarcados.size} {pedidosMarcados.size === 1 ? "pedido marcado" : "pedidos marcados"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPedidosMarcados(new Set())}
                    className="text-xs font-medium text-cyan-700 underline underline-offset-2 hover:text-cyan-900"
                  >
                    limpar
                  </button>
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={aExecutarLote !== null}
                      onClick={() => acaoEmLote("concluido")}
                      className="rounded-[10px] border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
                    >
                      {aExecutarLote === "concluido" ? "A marcar…" : "Marcar realizados"}
                    </button>
                    <button
                      type="button"
                      disabled={aExecutarLote !== null}
                      onClick={() => acaoEmLote("rejeitado")}
                      className="rounded-[10px] border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                    >
                      {aExecutarLote === "rejeitado" ? "A marcar…" : "Marcar rejeitados"}
                    </button>
                    <button
                      type="button"
                      disabled={aExecutarLote !== null}
                      onClick={() => acaoEmLote("arquivar")}
                      className="rounded-[10px] border border-amber-200 bg-white px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-50 disabled:opacity-50"
                    >
                      {aExecutarLote === "arquivar" ? "A arquivar…" : "Arquivar"}
                    </button>
                    <button
                      type="button"
                      disabled={aExecutarLote !== null}
                      onClick={() => acaoEmLote("apagar")}
                      className="rounded-[10px] border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      {aExecutarLote === "apagar" ? "A apagar…" : "Apagar"}
                    </button>
                  </div>
                </div>
              )}

              {/* O ecrã de espera é só para a primeira vez, quando não há
                  mesmo nada para mostrar. Com dados no ecrã, a lista antiga
                  fica e esmaece enquanto a nova não chega. */}
              {pedidosLoading && pedidos.length === 0 ? (
                <div className="py-10 text-center text-sm text-slate-500">A carregar pedidos...</div>
              ) : pedidosVisiveis.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 py-12 text-center">
                  <FileText className="h-10 w-10 text-slate-300" />
                  <div>
                    <p className="text-base font-semibold text-slate-700">Nenhum pedido do simulador ainda</p>
                    <p className="mt-1 text-sm text-slate-500">Quando um cliente enviar um pedido pelo simulador, ele aparecerá aqui para análise.</p>
                  </div>
                  <a
                    href="/simulador"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 rounded-[14px] border border-cyan-500/30 bg-cyan-50 px-5 py-2.5 text-sm font-semibold text-cyan-700 transition hover:bg-cyan-100"
                  >
                    Ver simulador
                  </a>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-[18px] border border-[#ccccff] bg-white/70">
                  <table className="w-full min-w-[860px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-100 bg-slate-50/70">
                        <th className="pl-4 pr-2 py-3 text-left">
                          <input
                            type="checkbox"
                            aria-label="Marcar todos os pedidos à vista"
                            checked={todosMarcados}
                            onChange={alternarTodosPedidos}
                            className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-cyan-600"
                          />
                        </th>
                        {["Nº", "Cliente", "Serviço", "Localidade", "Urgência", "Status", "Origem", "Data", "Ação"].map((h) => (
                          <th key={h} className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 last:pr-4 last:text-right">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pedidosVisiveis
                        .map((p) => {
                          const statusColors: Record<string, string> = {
                            sem_assistente: "bg-yellow-50 text-yellow-700 border-yellow-200",
                            concluido: "bg-emerald-50 text-emerald-700 border-emerald-200",
                            rejeitado: "bg-slate-100 text-slate-600 border-slate-200",
                            pendente: "bg-blue-50 text-blue-700 border-blue-200",
                            atribuido: "bg-purple-50 text-purple-700 border-purple-200",
                            em_analise: "bg-amber-50 text-amber-700 border-amber-200",
                            precisa_info: "bg-orange-50 text-orange-700 border-orange-200",
                            presencial_recomendado: "bg-red-50 text-red-700 border-red-200",
                            estimativa_pronta: "bg-cyan-50 text-cyan-700 border-cyan-200",
                            aprovado: "bg-emerald-50 text-emerald-700 border-emerald-200",
                            enviado_cliente: "bg-teal-50 text-teal-700 border-teal-200",
                            confirmado: "bg-green-50 text-green-700 border-green-200",
                            cancelado: "bg-slate-100 text-slate-500 border-slate-200",
                          };
                          const statusLabel: Record<string, string> = {
                            sem_assistente: "Por atribuir",
                            pendente: "Novo",
                            atribuido: "Atribuído",
                            em_analise: "Em análise",
                            precisa_info: "Precisa info",
                            presencial_recomendado: "Presencial",
                            estimativa_pronta: "Estimativa pronta",
                            aprovado: "Aprovado",
                            enviado_cliente: "Enviado",
                            confirmado: "Confirmado",
                            cancelado: "Cancelado",
                            concluido: "Realizado",
                            rejeitado: "Rejeitado",
                            arquivado: "Arquivado",
                          };
                          const urgencyDot: Record<string, string> = {
                            urgente: "bg-rose-500",
                            alta: "bg-orange-500",
                            normal: "bg-slate-400",
                            baixa: "bg-slate-300",
                          };
                          const urgencyText: Record<string, string> = {
                            urgente: "text-rose-600",
                            alta: "text-orange-600",
                            normal: "text-slate-500",
                            baixa: "text-slate-400",
                          };

                          // O formulário da homepage marca a origem em
                          // `_source`, não em `origemPedido` — só se lia o
                          // segundo, por isso TODOS apareciam como "Simulador".
                          // A lista recebe o slug já extraído (origemSlug);
                          // o rawOrderJson só vem no detalhe. Antes usava-se
                          // só o segundo, que aqui é sempre vazio — e a
                          // coluna dizia "Simulador" a toda a gente.
                          const origem = (p as { origemSlug?: string | null }).origemSlug
                            ? origemPeloSlug((p as { origemSlug?: string | null }).origemSlug)
                            : origemDoPedido(p.rawOrderJson);
                          const origemLabel = origem.label;
                          const origemStyle =
                            origem.slug === "hero_quote_form" ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                            origem.slug === "formulario_contactos" ? "bg-cyan-50 text-cyan-700 border-cyan-200" :
                            origem.slug.startsWith("quero_contratar") ? "bg-amber-50 text-amber-700 border-amber-200" :
                            origem.slug === "plataforma" ? "bg-red-100 text-red-800 border-red-300" :
                            origem.slug === "simulador" ? "bg-violet-50 text-violet-700 border-violet-200" :
                            "bg-slate-100 text-slate-600 border-slate-200";

                          return (
                            <tr
                              key={p.id}
                              className={`group cursor-pointer transition-colors ${pedidosMarcados.has(p.id) ? "bg-cyan-50/70" : "hover:bg-slate-50"}`}
                              onClick={() => { setSelectedPedido(p); setPedidoDetalheOpen(true); }}
                            >
                              {/* Marcar — o clique não pode abrir o pedido */}
                              <td className="pl-4 pr-2 py-3.5" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  aria-label={`Marcar pedido #${p.id}`}
                                  checked={pedidosMarcados.has(p.id)}
                                  onChange={() => marcarPedido(p.id)}
                                  className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-cyan-600"
                                />
                              </td>
                              {/* # */}
                              <td className="px-2 py-3.5">
                                <span className="font-mono text-[11px] font-semibold text-slate-400">#{p.id}</span>
                              </td>
                              {/* Cliente */}
                              <td className="px-2 py-3.5">
                                {(() => {
                                  const isAssist = !isAdminGeral;
                                  const isOwner = p.assignedToId === colabId;
                                  const shouldMask = isAssist && !isOwner;
                                  return (
                                    <>
                                      <p className="max-w-[130px] truncate font-semibold text-slate-900">{shouldMask ? maskName(p.contactName) : (p.contactName ?? "—")}</p>
                                      {p.contactPhone && (
                                        <p className="mt-0.5 text-[11px] text-slate-400">{shouldMask ? maskPhone(p.contactPhone) : p.contactPhone}</p>
                                      )}
                                    </>
                                  );
                                })()}
                              </td>
                              {/* Serviço */}
                              <td className="px-2 py-3.5">
                                <span className="inline-block max-w-[110px] truncate rounded-[8px] bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700">
                                  {normalizeServiceTypeLabel(p.serviceType)}
                                </span>
                              </td>
                              {/* Localidade */}
                              <td className="px-2 py-3.5 text-xs text-slate-500">
                                <span className="max-w-[100px] truncate block">{p.city ?? "—"}</span>
                              </td>
                              {/* Urgência */}
                              <td className="px-2 py-3.5">
                                {p.urgency ? (
                                  <span className={`flex items-center gap-1.5 text-[11px] font-semibold capitalize ${urgencyText[p.urgency] ?? "text-slate-400"}`}>
                                    <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${urgencyDot[p.urgency] ?? "bg-slate-500"}`} />
                                    {p.urgency}
                                  </span>
                                ) : (
                                  <span className="text-xs text-slate-600">—</span>
                                )}
                              </td>
                              {/* Status */}
                              <td className="px-2 py-3.5">
                                <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusColors[p.status] ?? "bg-slate-500/15 text-slate-400"}`}>
                                  {statusLabel[p.status] ?? p.status}
                                </span>
                              </td>
                              {/* Origem */}
                              <td className="px-2 py-3.5">
                                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${origemStyle}`}>
                                  {origemLabel}
                                </span>
                              </td>
                              {/* Data */}
                              <td className="px-2 py-3.5 text-[11px] text-slate-400">
                                {p.createdAt
                                  ? new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(p.createdAt))
                                  : "—"}
                              </td>
                              {/* Ação */}
                              <td className="py-3.5 pl-2 pr-4">
                                <div className="flex items-center justify-end gap-2">
                                  {!isAdminGeral && !p.assignedToId && (
                                    <button
                                      type="button"
                                      className="rounded-[8px] border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 transition"
                                      onClick={(e) => { e.stopPropagation(); setConfirmAcceptPedido(p); }}
                                    >
                                      Aceitar
                                    </button>
                                  )}
                                  {!isAdminGeral && (
                                    <button
                                      type="button"
                                      className="rounded-[8px] border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-100 transition"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        if (!token || !p.id) return;
                                        if (!confirm("Arquivar este pedido? Ele voltará à fila geral.")) return;
                                        try {
                                          await fetch(`/api/admin/pedidos/${p.id}/reject`, {
                                            method: "POST",
                                            headers: { Authorization: `Bearer ${token}` },
                                          });
                                          await carregarPedidos(token, pedidoStatusFilter, pedidoSearchDebounced, true);
                                        } catch { /* silent */ }
                                      }}
                                    >
                                      Arquivar
                                    </button>
                                  )}
                                  {isAdminGeral && (
                                    <button
                                      type="button"
                                      className="rounded-[8px] border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-100 transition"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        if (!token || !p.id) return;
                                        const isAlreadyArchived = p.status === "arquivado";
                                        const confirmMsg = isAlreadyArchived
                                          ? "Restaurar este pedido para a fila activa?"
                                          : "Arquivar este pedido? Ele deixará de aparecer na lista principal.";
                                        if (!confirm(confirmMsg)) return;
                                        try {
                                          const targetStatus = isAlreadyArchived ? "pendente" : "arquivado";
                                          const r = await fetch(`/api/admin/pedidos/${p.id}`, {
                                            method: "PATCH",
                                            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                            body: JSON.stringify({ status: targetStatus }),
                                          });
                                          if (!r.ok) {
                                            const j = await r.json().catch(() => ({}));
                                            alert(`Erro: ${j?.message ?? j?.error ?? r.statusText}`);
                                            return;
                                          }
                                          await carregarPedidos(token, pedidoStatusFilter, pedidoSearchDebounced, true);
                                        } catch (err) {
                                          alert(`Erro: ${err instanceof Error ? err.message : String(err)}`);
                                        }
                                      }}
                                    >
                                      {p.status === "arquivado" ? "Restaurar" : "Arquivar"}
                                    </button>
                                  )}
                                  {/* Fechar o pedido: realizado ou rejeitado.
                                      Só aparecem enquanto houver o que fechar —
                                      num pedido já fechado seriam ruído. */}
                                  {isAdminGeral && !["concluido", "rejeitado", "arquivado", "cancelado"].includes(p.status) && (
                                    <>
                                      <button
                                        type="button"
                                        className="rounded-[8px] border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 transition"
                                        onClick={(e) => { e.stopPropagation(); fecharPedido(p, "concluido"); }}
                                      >
                                        Realizado
                                      </button>
                                      <button
                                        type="button"
                                        className="rounded-[8px] border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 transition"
                                        onClick={(e) => { e.stopPropagation(); fecharPedido(p, "rejeitado"); }}
                                      >
                                        Rejeitado
                                      </button>
                                    </>
                                  )}
                                  {isAdminGeral && (
                                    <button
                                      type="button"
                                      className="rounded-[8px] border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[11px] font-semibold text-cyan-700 hover:bg-cyan-100 transition"
                                      onClick={(e) => { e.stopPropagation(); setSelectedPedido(p); setPedidoDetalheOpen(true); }}
                                    >
                                      Abrir
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}

          {/* Ticket de suporte aberto — descrição, conversa e resposta */}
          {ticketAberto && (
            <div
              className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
              onClick={() => setTicketAberto(null)}
            >
              <div
                className="my-8 w-full max-w-3xl rounded-[24px] border border-white/10 bg-slate-900 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-400">
                      {rotuloQuemEscreve(ticketAberto.ticket.user_role)} · {rotuloCategoria(ticketAberto.ticket.category)}
                    </p>
                    <h3 className="mt-1 truncate text-xl font-semibold text-white">
                      {ticketAberto.ticket.subject || "(sem assunto)"}
                    </h3>
                    <p className="mt-1 text-sm text-slate-400">
                      {ticketAberto.ticket.autorNome ?? "—"}
                      {ticketAberto.ticket.autorEmail && <> · {ticketAberto.ticket.autorEmail}</>}
                      {ticketAberto.ticket.autorTelefone && <> · {ticketAberto.ticket.autorTelefone}</>}
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Aberto {haQuantoTempo(ticketAberto.ticket.created_at)}
                      {ticketAberto.ticket.resolved_at && <> · fechado em {new Date(ticketAberto.ticket.resolved_at).toLocaleDateString("pt-PT")}</>}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setTicketAberto(null)}
                    className="flex-shrink-0 rounded-[10px] p-2 text-slate-500 transition hover:bg-white/5 hover:text-white"
                    aria-label="Fechar"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-4 p-5">
                  {/* Atalho para o pedido, quando a app o tiver preenchido */}
                  {ticketAberto.ticket.request_id && (
                    <button
                      type="button"
                      onClick={() => {
                        setTicketAberto(null);
                        setActiveClyonTab("pedidos");
                        setActivePedidoId(ticketAberto.ticket.request_id);
                        setActiveSection("app_clyon");
                      }}
                      className="w-full rounded-[14px] border border-violet-400/25 bg-violet-400/[0.07] px-4 py-2.5 text-left text-sm font-semibold text-violet-200 transition hover:bg-violet-400/15"
                    >
                      Ver o pedido relacionado →
                    </button>
                  )}

                  {/* O que a pessoa escreveu */}
                  <div className="rounded-[16px] border border-white/10 bg-white/[0.03] p-4">
                    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">O pedido</p>
                    <p className="whitespace-pre-wrap text-sm text-slate-200">{ticketAberto.ticket.description || "—"}</p>
                  </div>

                  {/* A conversa */}
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                      Conversa {ticketAberto.mensagens.length === 0 && "— ainda sem respostas"}
                    </p>
                    {ticketAberto.mensagens.map((m) => {
                      const daCasa = m.author_role === "admin";
                      return (
                        <div
                          key={m.id}
                          className={`rounded-[14px] border p-3 ${
                            daCasa
                              ? "border-sky-400/25 bg-sky-400/[0.07] ml-8"
                              : "border-white/10 bg-white/[0.03] mr-8"
                          }`}
                        >
                          <p className="mb-1 text-[11px] font-semibold text-slate-400">
                            {daCasa ? (m.author_label ?? "CLYON") : rotuloQuemEscreve(m.author_role)}
                            <span className="ml-2 font-normal text-slate-600">
                              {new Date(m.created_at).toLocaleString("pt-PT")}
                            </span>
                          </p>
                          <p className="whitespace-pre-wrap text-sm text-slate-200">{m.body}</p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Responder */}
                  <div className="space-y-2">
                    <textarea
                      rows={4}
                      value={ticketResposta}
                      onChange={(e) => setTicketResposta(e.target.value)}
                      placeholder="Escreva a resposta…"
                      className="w-full rounded-[14px] border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-sky-400/40"
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        disabled={ticketAEnviar || !ticketResposta.trim()}
                        onClick={responderTicket}
                        className="h-10 rounded-[12px] bg-sky-500 px-5 text-white hover:bg-sky-400 disabled:opacity-50"
                      >
                        {ticketAEnviar ? "A enviar…" : "Responder"}
                      </Button>
                      <div className="ml-auto flex flex-wrap items-center gap-1.5">
                        {ESTADOS_TICKET.filter((e) => e !== ticketAberto.ticket.status).map((e) => (
                          <button
                            key={e}
                            type="button"
                            onClick={() => mudarEstadoTicket(ticketAberto.ticket.id, e)}
                            className={`rounded-[10px] border px-3 py-1.5 text-[11px] font-semibold transition ${
                              e === "closed"
                                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/20"
                                : "border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/10"
                            }`}
                          >
                            {ROTULO_ESTADO[e]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Modal de confirmação de aceitar pedido */}
          {confirmAcceptPedido && token && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
              <div className="w-full max-w-sm rounded-[24px] border border-slate-200 bg-white p-6 shadow-xl">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50">
                  <svg className="h-6 w-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                </div>
                <h3 className="text-lg font-bold text-slate-900">Aceitar este pedido?</h3>
                <p className="mt-2 text-sm text-slate-500">
                  Ao aceitar, os dados do cliente ficam visíveis e será cobrado o valor por pedido aceite.
                  Este pedido ficará atribuído a si.
                </p>
                <div className="mt-2 rounded-xl bg-slate-50 px-3 py-2">
                  <p className="text-xs text-slate-500">Serviço: <span className="font-semibold text-slate-700">{confirmAcceptPedido.serviceType ?? "—"}</span></p>
                  <p className="text-xs text-slate-500">Cidade: <span className="font-semibold text-slate-700">{confirmAcceptPedido.city ?? "—"}</span></p>
                </div>
                <div className="mt-5 flex gap-3">
                  <button
                    onClick={() => setConfirmAcceptPedido(null)}
                    className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={async () => {
                      const p = confirmAcceptPedido;
                      setConfirmAcceptPedido(null);
                      try {
                        const r = await fetch(`/api/admin/pedidos/${p.id}/accept`, {
                          method: "POST",
                          headers: { Authorization: `Bearer ${token}` },
                        });
                        let data: { ok?: boolean; message?: string; order?: SimulatorOrder } = {};
                        try { data = await r.json(); } catch { /* empty */ }
                        if (r.ok && data?.ok) {
                          const updated = data.order ?? { ...p, assignedToId: colabId, assignedToName: adminNome, status: "atribuido" };
                          setPedidos((prev) => prev.map((x) => x.id === p.id ? { ...x, ...updated } : x));
                          await carregarPedidos(token, pedidoStatusFilter, pedidoSearchDebounced, true);
                        } else {
                          alert(`Erro ${r.status}: ${data?.message ?? "Não foi possível aceitar."}`);
                        }
                      } catch (err) {
                        alert(`Erro: ${err instanceof Error ? err.message : String(err)}`);
                      }
                    }}
                    className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-sm font-bold text-white hover:bg-emerald-600 transition"
                  >
                    Sim, aceitar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal de detalhe do pedido — novo PedidoDetailModal */}
          {pedidoDetalheOpen && selectedPedido && token && (
            <PedidoDetailModal
              id={selectedPedido.id}
              token={token}
              isAdmin={isAdminGeral}
              colabId={colabId ?? undefined}
              onClose={() => { setPedidoDetalheOpen(false); setSelectedPedido(null); }}
              onDeleted={(deletedId) => {
                setPedidos((prev) => prev.filter((p) => p.id !== deletedId));
                setPedidoDetalheOpen(false);
                setSelectedPedido(null);
              }}
              onUpdated={(updated) => {
                setPedidos((prev) => prev.map((p) => p.id === updated.id ? { ...p, ...updated } as SimulatorOrder : p));
                setSelectedPedido((prev) => prev ? { ...prev, ...updated } as SimulatorOrder : prev);
              }}
            />
          )}


          {/* ═══════════════════════ APP CLYON ═══════════════════════ */}
          {activeSection === "app_clyon" && (
            <AppClyonEmbedded
              authHeader={token ? { Authorization: `Bearer ${token}` } : {}}
              activeTab={activeClyonTab}
              activePedidoId={activePedidoId}
              onTabChange={(t) => { setActiveClyonTab(t); setActivePedidoId(null); }}
              onPedidoChange={(id) => setActivePedidoId(id)}
            />
          )}

          {/* ═══════════════════════════ LEADS ══��════════════════════════ */}
          {activeSection === "leads" && (
            <section className="space-y-4 rounded-[28px] border border-cyan-300/16 bg-[linear-gradient(180deg,rgba(9,25,40,0.94)_0%,rgba(11,30,47,0.92)_100%)] p-5 shadow-[0_20px_70px_rgba(3,10,18,0.22)]">
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-white">Leads e contactos</h2>
                  <p className="mt-0.5 text-sm text-slate-400">
                    Formulários, cliques e interações captadas no site.
                    {leadsLastUpdate && (
                      <span className="ml-2 text-slate-500">
                        Atualizado: {leadsLastUpdate.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => carregarLeads(token, leadPeriodo, leadStatusFilter)}
                  disabled={loadingLeads}
                  variant="outline"
                  className="h-10 rounded-2xl border-white/10 bg-white/[0.04] text-white hover:bg-white/[0.08]"
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${loadingLeads ? "animate-spin" : ""}`} />
                  Atualizar
                </Button>
              </div>

              {/* Aviso de erro */}
              {leadsError && (
                <div className="flex items-center gap-3 rounded-2xl border border-rose-400/20 bg-rose-400/[0.07] px-4 py-3 text-sm text-rose-300">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                  {leadsError}
                </div>
              )}

              {/* Cards de resumo */}
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {[
                  { label: "Formulários hoje", value: leadTotals.hoje ?? 0, icon: ListChecks, tone: "cyan" },
                  { label: "Leads esta semana", value: leadTotals.semana ?? 0, icon: TrendingUp, tone: "cyan" },
                  { label: "Por responder", value: leadTotals.novos ?? 0, icon: AlertTriangle, tone: "amber" },
                  { label: "Fechados", value: leadTotals.fechados ?? 0, icon: CheckCircle2, tone: "emerald" },
                ].map((stat) => {
                  const Icon = stat.icon;
                  const toneClass =
                    stat.tone === "cyan"
                      ? "border-cyan-300/20 bg-cyan-400/[0.08] text-cyan-100"
                      : stat.tone === "amber"
                        ? "border-amber-300/20 bg-amber-400/[0.08] text-amber-100"
                        : "border-emerald-300/20 bg-emerald-400/[0.08] text-emerald-100";
                  return (
                    <div key={stat.label} className={`rounded-[20px] border px-4 py-3.5 ${toneClass}`}>
                      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide opacity-70">
                        <Icon className="h-3.5 w-3.5" />
                        {stat.label}
                      </div>
                      <p className="mt-2 text-3xl font-semibold text-white">{loadingLeads ? "—" : stat.value}</p>
                    </div>
                  );
                })}
              </div>

              {/* Páginas mais vistas — responde "de onde vem o tráfego",
                  que os cartões sozinhos não dizem */}
              {paginasTop.length > 0 && (
                <div className="rounded-[16px] border border-white/10 bg-white/[0.03] p-4">
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    Páginas mais vistas · últimos 7 dias
                  </p>
                  <div className="space-y-1.5">
                    {paginasTop.map((pg) => {
                      const maximo = paginasTop[0]?.visitas || 1;
                      return (
                        <div key={pg.pagePath} className="flex items-center gap-3">
                          <span className="w-1/2 truncate font-mono text-[11px] text-slate-300" title={pg.pagePath}>
                            {pg.pagePath}
                          </span>
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                            <div
                              className="h-full rounded-full bg-cyan-400/70"
                              style={{ width: `${Math.max(3, (pg.visitas / maximo) * 100)}%` }}
                            />
                          </div>
                          <span className="w-10 text-right text-[11px] font-semibold text-white">{pg.visitas}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Cards de eventos */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  { label: "WhatsApp", hoje: eventTotals.whatsappHoje ?? 0, semana: eventTotals.whatsappSemana ?? 0, icon: MessageCircle },
                  { label: "Ligar", hoje: eventTotals.ligarHoje ?? 0, semana: eventTotals.ligarSemana ?? 0, icon: Phone },
                  { label: "CTA", hoje: eventTotals.ctaHoje ?? 0, semana: eventTotals.ctaSemana ?? 0, icon: MousePointerClick },
                  { label: "Forms", hoje: eventTotals.formHoje ?? 0, semana: eventTotals.formSemana ?? 0, icon: ReceiptText },
                  { label: "Email", hoje: eventTotals.emailHoje ?? 0, semana: eventTotals.emailSemana ?? 0, icon: Mail },
                  { label: "Simulador", hoje: eventTotals.simuladorHoje ?? 0, semana: eventTotals.simuladorSemana ?? 0, icon: Sparkles },
                  { label: "Páginas", hoje: eventTotals.paginasHoje ?? 0, semana: eventTotals.paginasSemana ?? 0, icon: FileText },
                ].map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <div key={stat.label} className="rounded-[16px] border border-white/10 bg-white/[0.03] px-3 py-3">
                      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                        <Icon className="h-3 w-3" />
                        {stat.label}
                      </div>
                      <p className="mt-1.5 text-2xl font-semibold text-white">{loadingLeads ? "—" : stat.hoje}</p>
                      <p className="mt-0.5 text-[10px] text-slate-500">{loadingLeads ? "" : `${stat.semana} esta semana`}</p>
                    </div>
                  );
                })}
              </div>

              {/* Tabs leads / eventos */}
              <div className="flex gap-1 rounded-2xl border border-white/10 bg-white/[0.03] p-1">
                {(["leads", "eventos"] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveLeadsTab(tab)}
                    className={`flex-1 rounded-[14px] py-2 text-sm font-semibold transition ${
                      activeLeadsTab === tab
                        ? "bg-cyan-400 text-slate-950"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {tab === "leads" ? "Últimos leads" : "Eventos de contacto"}
                  </button>
                ))}
              </div>

              {/* Filtros */}
              <div className="flex flex-wrap gap-2">
                <select
                  value={leadPeriodo}
                  onChange={(e) => setLeadPeriodo(e.target.value)}
                  className="h-10 rounded-[14px] border border-cyan-300/20 bg-[#0d1f35] px-3 text-sm text-white outline-none focus:border-cyan-400 [color-scheme:dark]"
                >
                  <option value="hoje">Hoje</option>
                  <option value="semana">Esta semana</option>
                  <option value="7d">Últimos 7 dias</option>
                  <option value="30d">Últimos 30 dias</option>
                </select>
                {activeLeadsTab === "leads" && (
                  <select
                    value={leadStatusFilter}
                    onChange={(e) => setLeadStatusFilter(e.target.value)}
                    className="h-10 rounded-[14px] border border-cyan-300/20 bg-[#0d1f35] px-3 text-sm text-white outline-none focus:border-cyan-400 [color-scheme:dark]"
                  >
                    <option value="">Todos os estados</option>
                    <option value="novo">Novo</option>
                    <option value="contactado">Contactado</option>
                    <option value="orcamento_enviado">Orçamento enviado</option>
                    <option value="fechado">Fechado</option>
                    <option value="perdido">Perdido</option>
                  </select>
                )}
                {activeLeadsTab === "eventos" && (
                  <select
                    value={leadEventTypeFilter}
                    onChange={(e) => setLeadEventTypeFilter(e.target.value)}
                    className="h-10 rounded-[14px] border border-cyan-300/20 bg-[#0d1f35] px-3 text-sm text-white outline-none focus:border-cyan-400 [color-scheme:dark]"
                  >
                    <option value="">Todos os eventos</option>
                    <option value="click_whatsapp">WhatsApp</option>
                    <option value="click_call">Ligar</option>
                    <option value="click_email">Email</option>
                    <option value="click_cta">CTA</option>
                    <option value="form_submit_contacto">Formulário enviado</option>
                    <option value="simulator_start">Simulador iniciado</option>
                    <option value="simulator_contact">Simulador contacto</option>
                    <option value="simulator_estimate">Estimativa gerada</option>
                    <option value="simulator_order_confirmed">Pedido confirmado</option>
                  </select>
                )}
                {activeLeadsTab === "leads" && (
                  <div className="relative flex-1 min-w-[180px]">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={leadSearch}
                      onChange={(e) => setLeadSearch(e.target.value)}
                      placeholder="Pesquisar nome, email, telefone..."
                      className="h-10 w-full rounded-[14px] border border-white/10 bg-white/[0.04] pl-9 pr-3 text-sm text-white outline-none focus:border-cyan-300"
                    />
                  </div>
                )}
              </div>

              {/* Tabela de leads */}
              {activeLeadsTab === "leads" && (
                <div className="overflow-x-auto rounded-[16px] border border-white/10">
                  {leads.length === 0 && !loadingLeads ? (
                    <div className="px-6 py-10 text-center text-sm text-slate-400">
                      Nenhum lead encontrado para o período selecionado.
                    </div>
                  ) : (
                    <table className="w-full min-w-[900px] border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-white/10 bg-white/[0.03] text-left text-[11px] uppercase tracking-wide text-slate-400">
                          <th className="px-4 py-3 font-semibold">Data</th>
                          <th className="px-4 py-3 font-semibold">Nome</th>
                          <th className="px-4 py-3 font-semibold">Contacto</th>
                          <th className="px-4 py-3 font-semibold">Localidade</th>
                          <th className="px-4 py-3 font-semibold">Serviço</th>
                          <th className="px-4 py-3 font-semibold">Origem</th>
                          <th className="px-4 py-3 font-semibold">Estado</th>
                          <th className="px-4 py-3 font-semibold">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leads
                          .filter((l) =>
                            !leadSearch ||
                            l.nome.toLowerCase().includes(leadSearch.toLowerCase()) ||
                            l.email.toLowerCase().includes(leadSearch.toLowerCase()) ||
                            l.telefone.includes(leadSearch)
                          )
                          .map((lead) => {
                            const statusColors: Record<string, string> = {
                              novo: "border-cyan-300/30 bg-cyan-400/[0.12] text-cyan-100",
                              contactado: "border-amber-300/30 bg-amber-400/[0.12] text-amber-100",
                              orcamento_enviado: "border-violet-300/30 bg-violet-400/[0.12] text-violet-100",
                              fechado: "border-emerald-300/30 bg-emerald-400/[0.12] text-emerald-100",
                              perdido: "border-rose-300/30 bg-rose-400/[0.12] text-rose-100",
                            };
                            const statusLabel: Record<string, string> = {
                              novo: "Novo",
                              contactado: "Contactado",
                              orcamento_enviado: "Orçamento",
                              fechado: "Fechado",
                              perdido: "Perdido",
                            };
                            return (
                              <tr key={lead.id} className="border-b border-white/5 transition hover:bg-white/[0.03]">
                                <td className="px-4 py-3 text-slate-400">
                                  {new Date(lead.createdAt).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" })}
                                  <div className="text-[11px] text-slate-500">
                                    {new Date(lead.createdAt).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                                  </div>
                                </td>
                                <td className="px-4 py-3 font-semibold text-white">{lead.nome}</td>
                                <td className="px-4 py-3">
                                  <a href={`tel:${lead.telefone}`} className="block text-cyan-200 hover:text-cyan-100">{lead.telefone}</a>
                                  <a href={`mailto:${lead.email}`} className="block text-xs text-slate-400 hover:text-slate-300">{lead.email}</a>
                                </td>
                                <td className="px-4 py-3 text-slate-300">{lead.localidade}</td>
                                <td className="px-4 py-3 text-slate-300">{lead.tipoServico}</td>
                                <td className="px-4 py-3 text-xs">
                                  {/* Formulário de origem */}
                                  <span className="block text-slate-300">
                                    {origemDoLead(lead)}
                                  </span>
                                  {/* Canal */}
                                  {lead.canal && (
                                    <span className={`mt-0.5 inline-block rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                                      lead.canal === "whatsapp"
                                        ? "border-emerald-300/30 bg-emerald-400/[0.12] text-emerald-300"
                                        : lead.canal === "email"
                                        ? "border-sky-300/30 bg-sky-400/[0.12] text-sky-300"
                                        : lead.canal === "simulador"
                                        ? "border-violet-300/30 bg-violet-400/[0.12] text-violet-300"
                                        : "border-slate-300/20 bg-white/[0.05] text-slate-400"
                                    }`}>
                                      {lead.canal}
                                    </span>
                                  )}
                                  {lead.utmCampaign && (
                                    <div className="mt-0.5 text-slate-500">{lead.utmCampaign}</div>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusColors[lead.status] || ""}`}>
                                    {statusLabel[lead.status] || lead.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => { setSelectedLead(lead); setLeadNotas(lead.notasInternas || ""); }}
                                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-300 hover:bg-white/[0.1] hover:text-white"
                                      title="Ver detalhes"
                                    >
                                      <Eye className="h-3.5 w-3.5" />
                                    </button>
                                    <a
                                      href={`https://wa.me/351${lead.telefone.replace(/\D/g, "")}`}
                                      target="_blank" rel="noreferrer"
                                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-400/[0.08] text-emerald-200 hover:bg-emerald-400/[0.16]"
                                      title="WhatsApp"
                                    >
                                      <MessageCircle className="h-3.5 w-3.5" />
                                    </a>
                                    <a
                                      href={`tel:${lead.telefone}`}
                                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-400/[0.08] text-cyan-200 hover:bg-cyan-400/[0.16]"
                                      title="Ligar"
                                    >
                                      <Phone className="h-3.5 w-3.5" />
                                    </a>
                                    {lead.status === "novo" && (
                                      <button
                                        type="button"
                                        onClick={() => atualizarStatusLead(lead.id, "contactado")}
                                        className="rounded-xl border border-amber-300/20 bg-amber-400/[0.08] px-2.5 py-1 text-xs font-semibold text-amber-100 hover:bg-amber-400/[0.16]"
                                      >
                                        Contactado
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* Tabela de eventos */}
              {activeLeadsTab === "eventos" && (
                <div className="overflow-x-auto rounded-[16px] border border-white/10">
                  {leadEvents.length === 0 && !loadingLeads ? (
                    <div className="px-6 py-10 text-center text-sm text-slate-400">
                      Nenhum evento encontrado para o período selecionado.
                    </div>
                  ) : (
                    <table className="w-full min-w-[800px] border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-white/10 bg-white/[0.03] text-left text-[11px] uppercase tracking-wide text-slate-400">
                          <th className="px-4 py-3 font-semibold">Data/hora</th>
                          <th className="px-4 py-3 font-semibold">Tipo</th>
                          <th className="px-4 py-3 font-semibold">Acção</th>
                          <th className="px-4 py-3 font-semibold">Detalhe</th>
                          <th className="px-4 py-3 font-semibold">Página</th>
                          <th className="px-4 py-3 font-semibold">Serviço</th>
                          <th className="px-4 py-3 font-semibold">Origem UTM</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leadEvents.map((ev) => {
                          const typeLabel: Record<string, string> = {
                            click_whatsapp: "WhatsApp",
                            click_call: "Ligar",
                            click_email: "Email",
                            click_cta: "CTA",
                            form_submit_contacto: "Formulário",
                            form_submit_quero_contratar: "Formulário",
                            simulator_start: "Simulador",
                            simulator_contact: "Simulador",
                            simulator_estimate: "Simulador",
                            simulator_order_confirmed: "Simulador",
                            simulator_order_saved: "Simulador",
                          };
                          const typeBadgeColor: Record<string, string> = {
                            WhatsApp: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
                            Ligar: "border-blue-500/30 bg-blue-500/10 text-blue-300",
                            Email: "border-sky-500/30 bg-sky-500/10 text-sky-300",
                            CTA: "border-amber-500/30 bg-amber-500/10 text-amber-300",
                            Formulário: "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
                            Simulador: "border-violet-500/30 bg-violet-500/10 text-violet-300",
                          };
                          const label = typeLabel[ev.eventType] ?? ev.eventType.replace(/_/g, " ");
                          const badgeClass = typeBadgeColor[label] ?? "border-white/10 bg-white/[0.06] text-slate-200";
                          const detalhe = ev.name ? `${ev.name}${ev.phone ? ` · ${ev.phone}` : ""}` : ev.phone ?? ev.email ?? ev.label ?? "—";
                          return (
                            <tr key={ev.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                              <td className="px-4 py-3 text-slate-400">
                                {new Date(ev.createdAt).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" })}
                                <div className="text-[11px] text-slate-500">
                                  {new Date(ev.createdAt).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${badgeClass}`}>
                                  {label}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-slate-300 text-xs">{ev.action ?? "—"}</td>
                              <td className="px-4 py-3 text-slate-300 text-xs max-w-[160px] truncate">{detalhe}</td>
                              <td className="px-4 py-3 text-slate-400 text-xs max-w-[140px] truncate" title={ev.pagePath ?? ""}>{ev.pagePath ?? "—"}</td>
                              <td className="px-4 py-3 text-slate-300 text-xs">{ev.serviceType ?? "—"}</td>
                              <td className="px-4 py-3 text-slate-400 text-xs">{ev.utmSource ?? ev.utmCampaign ?? "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              <p className="text-xs text-slate-500">
                {activeLeadsTab === "leads"
                  ? `${leads.filter((l) => !leadSearch || l.nome.toLowerCase().includes(leadSearch.toLowerCase()) || l.email.toLowerCase().includes(leadSearch.toLowerCase()) || l.telefone.includes(leadSearch)).length} leads mostrados`
                  : `${leadEvents.length} eventos mostrados`}
              </p>
            </section>
          )}
          {/* ══════════════════════════════════════════════════════════════ */}

          {activeSection === "suporte" && (
            <section className="space-y-4 rounded-[28px] border border-slate-700/60 bg-slate-900/80 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.28)]">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-400">Centro de suporte</p>
                  <h2 className="mt-1 text-2xl font-semibold text-white">Pedidos de ajuda</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    O que os clientes e profissionais escrevem — na app e na plataforma.
                    Mais antigo primeiro: quem espera há mais tempo aparece em cima.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={ticketsFiltro}
                    onChange={(e) => setTicketsFiltro(e.target.value as typeof ticketsFiltro)}
                    className="h-10 rounded-[12px] border border-white/10 bg-white/[0.05] px-3 text-sm text-white outline-none"
                  >
                    <option value="por_tratar" className="bg-slate-900">Por tratar</option>
                    {ESTADOS_TICKET.map((e) => (
                      <option key={e} value={e} className="bg-slate-900">{ROTULO_ESTADO[e]}</option>
                    ))}
                    <option value="todos" className="bg-slate-900">Todos</option>
                  </select>
                  <Button
                    type="button"
                    disabled={ticketsLoading}
                    onClick={() => carregarTickets(token, ticketsFiltro)}
                    className="h-10 rounded-[12px] bg-sky-500 px-4 text-white hover:bg-sky-400 disabled:opacity-60"
                  >
                    <RefreshCw className={`mr-2 h-4 w-4 ${ticketsLoading ? "animate-spin" : ""}`} />
                    {ticketsLoading ? "A actualizar…" : "Actualizar"}
                  </Button>
                </div>
              </div>

              {ticketErro && (
                <div className="rounded-[16px] border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                  {ticketErro}
                </div>
              )}

              {ticketsLoading && tickets.length === 0 ? (
                <p className="py-10 text-center text-sm text-slate-500">A carregar pedidos de suporte…</p>
              ) : tickets.length === 0 ? (
                <div className="rounded-[18px] border border-dashed border-white/10 py-12 text-center">
                  <LifeBuoy className="mx-auto mb-3 h-10 w-10 text-slate-600" />
                  <p className="text-base font-semibold text-slate-300">Nada por tratar</p>
                  <p className="mt-1 text-sm text-slate-500">Quando alguém escrever pelo centro de suporte da app, aparece aqui.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-[18px] border border-white/[0.07]">
                  <table className="w-full min-w-[820px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-left text-[10px] uppercase tracking-[0.18em] text-slate-500">
                        {["Assunto", "Quem escreveu", "Tipo", "Categoria", "Estado", "À espera", "Ação"].map((h) => (
                          <th key={h} className="px-3 py-3 font-semibold first:pl-4 last:pr-4 last:text-right">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tickets.map((t) => (
                        <tr
                          key={t.id}
                          className="cursor-pointer border-b border-white/5 transition hover:bg-white/[0.03]"
                          onClick={() => abrirTicket(t.id)}
                        >
                          <td className="max-w-[260px] py-3 pl-4 pr-3">
                            <p className="truncate font-semibold text-white">{t.subject || "(sem assunto)"}</p>
                            <p className="mt-0.5 truncate text-[11px] text-slate-500">{t.description}</p>
                          </td>
                          <td className="px-3 py-3">
                            <p className="text-white">{t.autorNome ?? "—"}</p>
                            {t.autorEmail && <p className="text-[11px] text-slate-500">{t.autorEmail}</p>}
                          </td>
                          <td className="px-3 py-3 text-slate-300">{rotuloQuemEscreve(t.user_role)}</td>
                          <td className="px-3 py-3 text-slate-300">{rotuloCategoria(t.category)}</td>
                          <td className="px-3 py-3">
                            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                              t.status === "open" ? "border-rose-400/30 bg-rose-500/15 text-rose-200"
                              : t.status === "closed" ? "border-white/10 bg-white/[0.05] text-slate-400"
                              : "border-amber-400/30 bg-amber-400/10 text-amber-200"
                            }`}>
                              {ROTULO_ESTADO[t.status as EstadoTicket] ?? t.status}
                            </span>
                            {t.mensagens > 0 && (
                              <span className="ml-1.5 text-[11px] text-slate-500">{t.mensagens} msg</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-slate-400">{haQuantoTempo(t.created_at)}</td>
                          <td className="py-3 pl-3 pr-4 text-right">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); abrirTicket(t.id); }}
                              className="rounded-[10px] border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-[11px] font-semibold text-sky-200 transition hover:bg-sky-400/20"
                            >
                              Abrir
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* ── Da plataforma ──────────────────────────────────────────
                  Vêm da nossa base e não do Supabase: são os pedidos de ajuda
                  escritos na conta do profissional. Ficam na mesma secção
                  porque quem atende não tem de saber de que base veio o
                  pedido — separados, porque as acções não são as mesmas. */}
              <div className="border-t border-slate-700/60 pt-4">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
                  Da plataforma
                </h3>
                <AdminAjudaPanel />
              </div>
            </section>
          )}

          {activeSection === "contas" && (
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <ContasPanel authToken={token} />
            </section>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}

          {/* ══════════════════════════════════════════════════════════════ */}

          {activeSection === "profissionais" && (
            <section className="space-y-4 rounded-[28px] border border-slate-700/60 bg-slate-900/80 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.28)]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-400">
                  Plataforma
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-white">Profissionais</h2>
                <p className="mt-1 text-sm text-slate-400">
                  A inscrição não está aberta: entra-se por convite. Convide em baixo,
                  e o registo que ele preencher volta aqui para aprovação — aprovar
                  dá-lhe acesso à fila, verificar a guia deixa-o receber os pedidos que
                  exigem transporte de resíduos.
                </p>
              </div>

              <AdminConvitesPanel />

              <div className="border-t border-slate-700/60 pt-4">
                <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
                  Inscritos
                </h3>
                <AdminProfissionaisPanel />
              </div>
            </section>
          )}

          {activeSection === "negociacoes" && (
            <section className="space-y-4 rounded-[28px] border border-slate-700/60 bg-slate-900/80 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.28)]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-400">
                  Plataforma
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-white">
                  Pedidos e negociações
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Os pedidos criados pelo formulário novo e as propostas de cada
                  profissional. Reenviar emite um link novo e invalida o anterior.
                </p>
              </div>
              <AdminNegociacoesPanel />
            </section>
          )}

          {activeSection === "levantamentos" && (
            <section className="space-y-4 rounded-[28px] border border-slate-700/60 bg-slate-900/80 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.28)]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-400">
                  Plataforma
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-white">
                  Levantamentos
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Os profissionais pedem para receber o saldo confirmado. Copie o IBAN,
                  faça a transferência no banco e marque como paga — enquanto não houver
                  ligação directa, é aqui que o dinheiro sai.
                </p>
              </div>
              <AdminLevantamentosPanel />
            </section>
          )}

          {activeSection === "testadores" && (
            <section className="space-y-4 rounded-[28px] border border-slate-700/60 bg-slate-900/80 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.28)]">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-400">
                  Plataforma
                </p>
                <h2 className="mt-1 text-2xl font-semibold text-white">Acesso aos testes</h2>
                <p className="mt-1 text-sm text-slate-400">
                  A plataforma está fechada ao público: só entra quem tiver o link com a
                  chave <em>e</em> credenciais próprias. Aqui criam-se e retiram-se essas
                  credenciais — desactivar uma pessoa não expulsa as outras.
                </p>
              </div>
              <AdminTestadoresPanel />
            </section>
          )}

          {(activeSection === "site" || activeSection === "configs") && (
            <section className="space-y-4 rounded-[28px] border border-cyan-300/16 bg-[linear-gradient(180deg,rgba(9,25,40,0.94)_0%,rgba(11,30,47,0.92)_100%)] p-5 shadow-[0_20px_70px_rgba(3,10,18,0.22)]">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
                    Configurações
                  </p>
                  <h2 className="mt-2 text-[1.85rem] font-semibold text-white">
                    Valores, simulador, permissões e dados da empresa
                  </h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
                    Faça a gestão dos parâmetros do portal organizados por separadores.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => router.push("/admin/imagens")}
                  className="h-11 rounded-2xl bg-cyan-400 px-5 text-slate-950 hover:bg-cyan-300"
                >
                  Abrir gestor de imagens
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>

              {/* Navegação por abas */}
              <div className="flex flex-wrap gap-2 rounded-[20px] border border-white/10 bg-white/[0.02] p-2">
                {(
                  [
                    { id: "simulador", label: "Valores do simulador", icon: Euro },
                    { id: "funcoes", label: "Colaboradores e funções", icon: Users },
                    { id: "imagens", label: "Imagens do site", icon: ImagePlus },
                    { id: "seguranca", label: "Segurança", icon: ShieldCheck },
                    { id: "empresa", label: "Dados da empresa", icon: Building2 },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSettingsTab(tab.id)}
                    className={`flex items-center gap-2 rounded-[14px] px-4 py-2.5 text-sm font-semibold transition ${
                      settingsTab === tab.id
                        ? "bg-cyan-400 text-slate-950"
                        : "text-slate-300 hover:bg-white/[0.06]"
                    }`}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {settingsTab === "simulador" && (
              <ActionCard
                title="Valores do simulador"
                description="Todos os valores do simulador estão visíveis abaixo, separados por categoria operacional para facilitar a gestão."
                headerExtra={
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const res = await fetch("/api/admin/settings/reseed", {
                          method: "POST",
                          headers: { Authorization: `Bearer ${token}` },
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || "Erro desconhecido");
                        await carregarSimulatorSettings(token);
                        setError("");
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Erro ao repor defaults.");
                      }
                    }}
                    className="rounded-[12px] border border-slate-600 bg-slate-800/60 px-4 py-2 text-xs text-slate-300 transition hover:border-cyan-400/40 hover:text-cyan-300"
                  >
                    Repor defaults
                  </button>
                }
              >
                {loadingSimulatorSettings ? (
                  <div className="rounded-2xl border border-dashed border-white/10 px-5 py-10 text-sm text-slate-400">
                    A carregar configurações do simulador...
                  </div>
                ) : (
                  <div className="space-y-4">
                    {simulatorGroups.map((group) => (
                      <div
                        key={group.id}
                        className="rounded-[24px] border border-cyan-300/15 bg-white/[0.03] p-5"
                      >
                        <div className="mb-4 flex items-center justify-between gap-3">
                          <div>
                            <h3 className="text-lg font-semibold text-white">{group.label}</h3>
                            <p className="text-sm text-slate-400">
                              {group.description}
                            </p>
                          </div>
                          <div className="rounded-full border border-white/10 bg-slate-950/40 px-3 py-1 text-xs uppercase tracking-[0.18em] text-cyan-200">
                            {group.settings.length} valor(es)
                          </div>
                        </div>

                        {group.settings.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-white/10 px-4 py-6 text-sm text-slate-400">
                            Sem valores configurados nesta categoria.
                          </div>
                        ) : (
                        <div className="grid gap-4 xl:grid-cols-2">
                          {group.settings.map((setting) => (
                            <div
                              key={setting.key}
                              className="rounded-[20px] border border-white/10 bg-slate-950/40 p-4"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-white">{setting.label}</p>
                                  <p className="mt-1 text-xs leading-6 text-slate-400">
                                    {setting.description || "Sem descrição adicional."}
                                  </p>
                                  <p className="mt-2 text-[11px] uppercase tracking-[0.16em] text-slate-500">
                                    Chave: {setting.key}
                                  </p>
                                </div>
                                <span className="rounded-full border border-cyan-300/20 bg-cyan-400/[0.08] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-cyan-100">
                                  {formatSimulatorUnit(setting.unit)}
                                </span>
                              </div>

                              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
                                <Field label="Valor">
                                  <input
                                    type="number"
                                    step="0.01"
                                    value={simulatorDrafts[setting.key] ?? ""}
                                    onChange={(event) =>
                                      setSimulatorDrafts((state) => ({
                                        ...state,
                                        [setting.key]: event.target.value,
                                      }))
                                    }
                                    className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-white outline-none transition focus:border-cyan-300"
                                  />
                                </Field>
                                <Button
                                  type="button"
                                  disabled={savingSettingKey === setting.key}
                                  onClick={() => guardarSimulatorSetting(setting)}
                                  className="h-11 rounded-2xl bg-cyan-400 px-5 text-slate-950 hover:bg-cyan-300"
                                >
                                  {savingSettingKey === setting.key ? "A guardar..." : "Guardar"}
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ActionCard>
              )}

              {settingsTab === "imagens" && (
                <ActionCard
                  title="Imagens do site"
                  description="Gira o carrossel da homepage e a galeria de trabalhos. Use o painel dedicado para fazer upload, substituir ou apagar imagens."
                >
                  <div className="space-y-4">
                    <div className="rounded-[16px] border border-emerald-300/20 bg-emerald-400/[0.07] px-4 py-3 text-sm text-emerald-100">
                      Imagens guardadas no Vercel Blob — persistentes entre deploys. Use o painel para gerir uploads.
                    </div>
                    {loadingImageStats ? (
                      <div className="rounded-[16px] border border-white/10 bg-white/[0.03] px-4 py-6 text-center text-sm text-slate-400">
                        A carregar estatísticas das imagens…
                      </div>
                    ) : imageStats ? (
                      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <SummaryStat icon={ImagePlus} label="Total" value={String(imageStats.total)} helper="Imagens geridas" tone="cyan" />
                        <SummaryStat icon={CheckCircle2} label="Ativas" value={String(imageStats.ativas)} helper="Visíveis no site" tone="emerald" />
                        <SummaryStat icon={ImagePlus} label="Carrossel" value={String(imageStats.hero)} helper="Secção topo" tone="slate" />
                        <SummaryStat icon={ImagePlus} label="Galeria" value={String(imageStats.showcase)} helper="Trabalhos" tone="slate" />
                      </div>
                    ) : null}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-5">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400/20">
                          <ImagePlus className="h-5 w-5 text-cyan-200" />
                        </div>
                        <h3 className="mt-3 text-base font-semibold text-white">Carrossel topo</h3>
                        <p className="mt-1 text-xs text-slate-400">Imagens em destaque na homepage. Recomendado: 1800px largura máxima.</p>
                      </div>
                      <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-5">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-400/20">
                          <ImagePlus className="h-5 w-5 text-emerald-200" />
                        </div>
                        <h3 className="mt-3 text-base font-semibold text-white">Galeria de trabalhos</h3>
                        <p className="mt-1 text-xs text-slate-400">Casos reais com grupos e fases (antes, durante, depois). Recomendado: 1600px.</p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      onClick={() => router.push("/admin/imagens")}
                      className="h-11 w-full rounded-2xl bg-cyan-400 text-slate-950 hover:bg-cyan-300"
                    >
                      <ImagePlus className="mr-2 h-4 w-4" />
                      Abrir o gestor de imagens completo
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </ActionCard>
              )}

              {/* Aba: Segurança */}
              {settingsTab === "seguranca" && (
                <ActionCard
                  title="Segurança da sua conta"
                  description={`Altere a palavra-passe da conta autenticada (${adminNome || "administrador"}). Para sua proteção, será necessário iniciar sessão novamente.`}
                >
                  <div className="grid gap-4 md:grid-cols-3">
                    <Field label="Palavra-passe atual">
                      <div className="relative">
                        <input
                          type={mostrarSenhaAtualAdmin ? "text" : "password"}
                          value={senhaAtualAdmin}
                          onChange={(event) => setSenhaAtualAdmin(event.target.value)}
                          autoComplete="current-password"
                          placeholder="A sua palavra-passe atual"
                          className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 pr-12 text-white outline-none transition focus:border-cyan-300"
                        />
                        <button
                          type="button"
                          onClick={() => setMostrarSenhaAtualAdmin((value) => !value)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                          aria-label={mostrarSenhaAtualAdmin ? "Ocultar palavra-passe atual" : "Mostrar palavra-passe atual"}
                        >
                          {mostrarSenhaAtualAdmin ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </Field>
                    <Field label="Nova palavra-passe">
                      <div className="relative">
                        <input
                          type={mostrarNovaSenhaAdmin ? "text" : "password"}
                          value={novaSenhaAdmin}
                          onChange={(event) => setNovaSenhaAdmin(event.target.value)}
                          autoComplete="new-password"
                          placeholder="Mínimo 8 caracteres"
                          className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 pr-12 text-white outline-none transition focus:border-cyan-300"
                        />
                        <button
                          type="button"
                          onClick={() => setMostrarNovaSenhaAdmin((value) => !value)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                          aria-label={mostrarNovaSenhaAdmin ? "Ocultar nova palavra-passe" : "Mostrar nova palavra-passe"}
                        >
                          {mostrarNovaSenhaAdmin ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </Field>
                    <Field label="Confirmar nova palavra-passe">
                      <input
                        type="password"
                        value={confirmacaoSenhaAdmin}
                        onChange={(event) => setConfirmacaoSenhaAdmin(event.target.value)}
                        autoComplete="new-password"
                        placeholder="Repita a nova palavra-passe"
                        className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-white outline-none transition focus:border-cyan-300"
                      />
                    </Field>
                  </div>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm text-slate-400">
                      A nova palavra-passe deve conter pelo menos 8 caracteres, incluindo uma letra e um número.
                    </p>
                    <Button
                      type="button"
                      disabled={alterandoSenhaAdmin}
                      onClick={alterarMinhaSenha}
                      className="h-12 shrink-0 rounded-2xl bg-cyan-400 px-6 text-slate-950 hover:bg-cyan-300 disabled:opacity-50"
                    >
                      {alterandoSenhaAdmin ? "A atualizar..." : "Atualizar palavra-passe"}
                    </Button>
                  </div>
                  <div className="mt-5 rounded-[16px] border border-white/10 bg-white/[0.02] px-4 py-4 text-sm text-slate-400">
                    <p className="font-semibold text-slate-300">Como este controlo protege a conta</p>
                    <ul className="mt-2 list-inside list-disc space-y-1">
                      <li>A palavra-passe atual é confirmada antes de qualquer alteração.</li>
                      <li>A alteração é aplicada apenas à conta de administrador autenticada.</li>
                      <li>A sessão é terminada após a confirmação, para que entre novamente com a nova palavra-passe.</li>
                    </ul>
                  </div>
                </ActionCard>
              )}

              {/* Aba: Dados da empresa */}
              {settingsTab === "empresa" && (
                <ActionCard
                  title="Dados da empresa"
                  description="Informações institucionais da CLYON utilizadas no portal e nos documentos gerados."
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-[20px] border border-white/10 bg-white/[0.03] px-5 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Nome</p>
                      <p className="mt-1.5 text-lg font-semibold text-white">CLYON</p>
                    </div>
                    <div className="rounded-[20px] border border-white/10 bg-white/[0.03] px-5 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Setor</p>
                      <p className="mt-1.5 text-base text-white">Recolha de móveis e serviços de transporte</p>
                    </div>
                    <div className="rounded-[20px] border border-white/10 bg-white/[0.03] px-5 py-4">
                      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        <Mail className="h-3.5 w-3.5" />
                        Email
                      </p>
                      <a href="mailto:geral@clyon.pt" className="mt-1.5 block text-base text-cyan-200 hover:text-cyan-100">
                        geral@clyon.pt
                      </a>
                    </div>
                    <div className="rounded-[20px] border border-white/10 bg-white/[0.03] px-5 py-4">
                      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        <Phone className="h-3.5 w-3.5" />
                        Telefone
                      </p>
                      <a href="tel:+351931632622" className="mt-1.5 block text-base text-cyan-200 hover:text-cyan-100">
                        +351 931 632 622
                      </a>
                    </div>
                    <div className="rounded-[20px] border border-white/10 bg-white/[0.03] px-5 py-4">
                      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                        <MessageCircle className="h-3.5 w-3.5" />
                        WhatsApp
                      </p>
                      <a
                        href="https://wa.me/351931632622"
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1.5 block text-base text-cyan-200 hover:text-cyan-100"
                      >
                        +351 931 632 622
                      </a>
                    </div>
                    <div className="rounded-[20px] border border-white/10 bg-white/[0.03] px-5 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Portal</p>
                      <p className="mt-1.5 text-base text-white">clyon.pt</p>
                    </div>
                  </div>
                  <div className="rounded-[16px] border border-cyan-300/20 bg-cyan-400/[0.06] px-4 py-3 text-sm text-cyan-100">
                    Para alterar os dados da empresa (nome legal, NIF, morada), contacte o administrador do sistema ou atualize diretamente no código-fonte.
                  </div>
                </ActionCard>
              )}
            </section>
          )}
        </main>
      </div>

      {/* Drawer lateral: detalhes do lead */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            aria-label="Fechar detalhes do lead"
            onClick={() => setSelectedLead(null)}
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
          />
          <aside className="relative flex h-full w-full max-w-lg flex-col overflow-y-auto border-l border-cyan-300/20 bg-[linear-gradient(180deg,rgba(9,27,43,0.99)_0%,rgba(7,20,33,0.99)_100%)] shadow-[-30px_0_80px_rgba(3,10,18,0.5)]">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-[rgba(9,27,43,0.96)] px-6 py-5 backdrop-blur">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">Lead #{selectedLead.id}</p>
                <h3 className="mt-1 text-xl font-semibold text-white">{selectedLead.nome}</h3>
                <p className="mt-0.5 text-sm text-slate-400">
                  {new Date(selectedLead.createdAt).toLocaleDateString("pt-PT", { day: "2-digit", month: "long", year: "numeric" })}
                  {" às "}
                  {new Date(selectedLead.createdAt).toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLead(null)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 space-y-5 px-6 py-5">
              {/* Contacto */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Contacto</p>
                <div className="grid gap-2 rounded-[16px] border border-white/10 bg-white/[0.03] p-4">
                  {[
                    { label: "Telefone", value: selectedLead.telefone, href: `tel:${selectedLead.telefone}` },
                    { label: "Email", value: selectedLead.email, href: `mailto:${selectedLead.email}` },
                    { label: "Localidade", value: selectedLead.localidade },
                    { label: "Serviço", value: selectedLead.tipoServico },
                    { label: "Preferência", value: selectedLead.preferenciaContacto },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between gap-3">
                      <span className="text-xs text-slate-400">{item.label}</span>
                      {item.href ? (
                        <a href={item.href} className="text-sm font-medium text-cyan-200 hover:text-cyan-100">{item.value}</a>
                      ) : (
                        <span className="text-sm font-medium text-white">{item.value}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Mensagem */}
              {selectedLead.mensagem && (
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Mensagem</p>
                  <div className="rounded-[16px] border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-slate-200">
                    {selectedLead.mensagem}
                  </div>
                </div>
              )}

              {/* Origem / UTM */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Origem</p>
                <div className="grid gap-2 rounded-[16px] border border-white/10 bg-white/[0.03] p-4">
                  {[
                    { label: "Página", value: selectedLead.pagePath },
                    { label: "UTM Source", value: selectedLead.utmSource },
                    { label: "UTM Medium", value: selectedLead.utmMedium },
                    { label: "UTM Campaign", value: selectedLead.utmCampaign },
                    { label: "GCLID", value: selectedLead.gclid },
                  ].filter((item) => item.value).map((item) => (
                    <div key={item.label} className="flex items-center justify-between gap-3">
                      <span className="text-xs text-slate-400">{item.label}</span>
                      <span className="max-w-[220px] truncate text-sm text-slate-200">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Estado */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Estado</p>
                <select
                  value={selectedLead.status}
                  onChange={(e) => atualizarStatusLead(selectedLead.id, e.target.value as Lead["status"], leadNotas)}
                  className="h-11 w-full rounded-[14px] border border-cyan-300/20 bg-[#0d1f35] px-3 text-sm text-white outline-none focus:border-cyan-400 [color-scheme:dark]"
                  disabled={savingLeadStatus}
                >
                  <option value="novo">Novo</option>
                  <option value="contactado">Contactado</option>
                  <option value="orcamento_enviado">Orçamento enviado</option>
                  <option value="fechado">Fechado</option>
                  <option value="perdido">Perdido</option>
                </select>
              </div>

              {/* Notas internas */}
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Notas internas</p>
                <textarea
                  value={leadNotas}
                  onChange={(e) => setLeadNotas(e.target.value)}
                  rows={3}
                  placeholder="Notas visíveis apenas para administradores..."
                  className="w-full rounded-[14px] border border-white/10 bg-white/[0.04] p-3 text-sm text-white outline-none focus:border-cyan-300 resize-none"
                />
                <Button
                  type="button"
                  onClick={() => atualizarStatusLead(selectedLead.id, selectedLead.status, leadNotas)}
                  disabled={savingLeadStatus}
                  className="h-10 w-full rounded-2xl bg-cyan-400 text-slate-950 hover:bg-cyan-300"
                >
                  {savingLeadStatus ? "A guardar..." : "Guardar notas"}
                </Button>
              </div>
            </div>

            {/* Botões de ação */}
            <div className="sticky bottom-0 border-t border-white/10 bg-[rgba(9,27,43,0.96)] p-4">
              <div className="grid grid-cols-3 gap-2">
                <a
                  href={`https://wa.me/351${selectedLead.telefone.replace(/\D/g, "")}`}
                  target="_blank" rel="noreferrer"
                  className="flex items-center justify-center gap-1.5 rounded-2xl border border-emerald-300/20 bg-emerald-400/[0.1] py-2.5 text-sm font-semibold text-emerald-200 hover:bg-emerald-400/[0.2]"
                >
                  <MessageCircle className="h-4 w-4" />
                  WhatsApp
                </a>
                <a
                  href={`tel:${selectedLead.telefone}`}
                  className="flex items-center justify-center gap-1.5 rounded-2xl border border-cyan-300/20 bg-cyan-400/[0.1] py-2.5 text-sm font-semibold text-cyan-200 hover:bg-cyan-400/[0.2]"
                >
                  <Phone className="h-4 w-4" />
                  Ligar
                </a>
                <a
                  href={`mailto:${selectedLead.email}`}
                  className="flex items-center justify-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.06] py-2.5 text-sm font-semibold text-slate-200 hover:bg-white/[0.12]"
                >
                  <Mail className="h-4 w-4" />
                  Email
                </a>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => atualizarStatusLead(selectedLead.id, "fechado", leadNotas)}
                  disabled={savingLeadStatus}
                  className="rounded-2xl border border-emerald-300/20 bg-emerald-400/[0.08] py-2.5 text-sm font-semibold text-emerald-100 hover:bg-emerald-400/[0.16] disabled:opacity-50"
                >
                  <CheckCircle2 className="mr-1.5 inline h-3.5 w-3.5" />
                  Fechado
                </button>
                <button
                  type="button"
                  onClick={() => atualizarStatusLead(selectedLead.id, "perdido", leadNotas)}
                  disabled={savingLeadStatus}
                  className="rounded-2xl border border-rose-300/20 bg-rose-400/[0.08] py-2.5 text-sm font-semibold text-rose-100 hover:bg-rose-400/[0.16] disabled:opacity-50"
                >
                  <X className="mr-1.5 inline h-3.5 w-3.5" />
                  Perdido
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

    </div>
  );
}

function SummaryStat({
  icon: Icon,
  label,
  value,
  helper,
  tone = "slate",
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  helper: string;
  tone?: "slate" | "cyan" | "emerald" | "amber";
}) {
  const toneClass = {
    slate: "border-white/10 text-cyan-100",
    cyan: "border-cyan-300/25 text-cyan-100",
    emerald: "border-emerald-300/25 text-emerald-100",
    amber: "border-amber-300/25 text-amber-100",
  }[tone];

  return (
    <Card className={`rounded-[20px] border bg-[linear-gradient(180deg,rgba(12,34,52,0.96)_0%,rgba(9,27,43,0.94)_100%)] text-white shadow-[0_16px_50px_rgba(15,23,42,0.22)] ${toneClass}`}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em]">{label}</p>
        </div>
        <p className="mt-3 text-2xl font-semibold text-white">{value}</p>
        <p className="mt-1 text-xs text-slate-400">{helper}</p>
      </CardContent>
    </Card>
  );
}



function QuickAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-3 rounded-[16px] border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition hover:border-cyan-400/40 hover:bg-white/[0.06]"
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-cyan-200" />
        <span className="text-sm font-semibold text-white">{label}</span>
      </div>
      <ArrowRight className="h-4 w-4 text-cyan-100" />
    </button>
  );
}

function ActionCard({
  title,
  description,
  children,
  compact = false,
  headerExtra,
}: {
  title: string;
  description: string;
  children: ReactNode;
  compact?: boolean;
  headerExtra?: ReactNode;
}) {
  return (
    <Card className="rounded-[26px] border-cyan-300/14 bg-[linear-gradient(180deg,rgba(12,34,52,0.96)_0%,rgba(9,27,43,0.94)_100%)] text-white shadow-[0_18px_60px_rgba(15,23,42,0.2)]">
      <CardHeader className={compact ? "pb-3" : "pb-4"}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-[1.35rem] text-white">{title}</CardTitle>
            <CardDescription className="text-slate-300">{description}</CardDescription>
          </div>
          {headerExtra && <div className="shrink-0">{headerExtra}</div>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function StatSurface({
  icon: Icon,
  title,
  body,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[22px] border border-cyan-300/14 bg-white/[0.04] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-400 text-slate-950">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-3 text-base font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-slate-200">{body}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-[13px] font-medium text-slate-200">{label}</span>
      {children}
    </label>
  );
}


