"use client";

import type { ComponentType, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { clearColaboradorStorage, getColaboradorItem } from "@/lib/colaborador-storage";
import PedidoDetailModal from "@/components/admin/PedidoDetailModal";
import PagamentosPanel from "@/components/admin/PagamentosPanel";
import ContasPanel from "@/components/admin/ContasPanel";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  Building2,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  Euro,
  Eye,
  EyeOff,
  ExternalLink,
  FileText,
  Filter,
  History,
  ImagePlus,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  MousePointerClick,
  Pencil,
  Phone,
  ReceiptText,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  TimerReset,
  Trash2,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
  Wrench,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Registro = {
  id: number;
  data: string;
  horaEntrada: string;
  horaPausa?: string | null;
  horaSaida?: string | null;
  numeroTrabalhos: number;
  horasTrabalhadas?: string;
  valorTotal?: string;
};

type PeriodoStats = {
  horas: string;
  valor: string;
  trabalhos: number;
  periodo?: string;
};

type Colaborador = {
  id: number;
  nome: string;
  funcao: "motorista" | "ajudante" | "admin" | "assistente";
  valorHora: string;
  isAdmin: number;
  createdAt?: string;
  registros: Registro[];
  estatisticas: {
    semana: PeriodoStats;
    ultimos15Dias: PeriodoStats;
    mes: PeriodoStats;
  };
};

type RegistroComColaborador = Registro & {
  colaboradorId: number;
  colaboradorNome: string;
  colaboradorValorHora: string;
};

type SimulatorSetting = {
  key: string;
  label: string;
  category: string;
  unit: string;
  value: string | number;
  description?: string | null;
};

type AdminSection = "overview" | "pedidos" | "operacao" | "leads" | "site" | "equipa" | "pagamentos" | "configs" | "contas";
type OperacaoTab = "equipa" | "horarios" | "pagamentos" | "funcoes";

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
  whatsappSemana?: number;
  ligarSemana?: number;
  ctaSemana?: number;
  formSemana?: number;
  emailSemana?: number;
  simuladorSemana?: number;
  total?: number;
};

const functionOptions: Array<Colaborador["funcao"]> = ["admin", "assistente", "motorista", "ajudante"];

const adminNavItems: Array<{
  id: AdminSection;
  icon: ComponentType<{ className?: string }>;
}> = [
  { id: "overview", icon: LayoutDashboard },
  { id: "pedidos",   icon: FileText },
  { id: "leads",     icon: TrendingUp },
  { id: "equipa",    icon: Users },
  { id: "pagamentos", icon: Wallet },
  { id: "contas",     icon: UserPlus },
  { id: "configs",   icon: Settings2 },
];

const sectionLabels: Record<AdminSection, string> = {
  overview:   "Início",
  pedidos:    "Pedidos",
  operacao:   "Operação",   // mantido internamente (aliases apontam para ele)
  leads:      "Leads",
  site:       "Configurações",
  equipa:     "Equipa",
  pagamentos: "Pagamentos",
  contas:     "Contas",
  configs:    "Configs",
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

const money = (value: number) =>
  new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(value);

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

const formatDayName = (value?: string) => {
  if (!value) return "Sem dia";
  return new Intl.DateTimeFormat("pt-PT", { weekday: "long" }).format(new Date(value));
};

const getCurrentWeekRange = () => {
  const today = new Date();
  const start = new Date(today);
  const day = start.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

// Semana operacional CLYON: começa sempre segunda 00:00 e termina domingo 23:59.
// O offset permite navegar entre semanas (0 = atual, -1 = anterior).
const getWeekRange = (offset = 0) => {
  const today = new Date();
  const start = new Date(today);
  const day = start.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diffToMonday + offset * 7);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

const WEEK_DAY_LABELS = [
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado",
  "Domingo",
];

const getCurrentMonthRange = () => {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  end.setHours(23, 59, 59, 999);

  return { start, end };
};

const isBetweenDates = (value: string, start: Date, end: Date) => {
  const date = new Date(value);
  return date >= start && date <= end;
};

const isSameDay = (value: string, reference: Date) => {
  const date = new Date(value);
  return (
    date.getFullYear() === reference.getFullYear() &&
    date.getMonth() === reference.getMonth() &&
    date.getDate() === reference.getDate()
  );
};

// Estado derivado do registo (não há campo dedicado na BD, por isso é calculado).
// incompleto: falta hora de saída | alerta: horas anómalas | validado: registo fechado normal.
const HIGH_HOURS_THRESHOLD = 16;

type RecordStatus = "incompleto" | "alerta" | "validado";

const getRecordStatus = (registro: Registro): RecordStatus => {
  if (!registro.horaSaida) return "incompleto";
  if (parseFloat(registro.horasTrabalhadas || "0") > HIGH_HOURS_THRESHOLD) return "alerta";
  return "validado";
};

const formatShortDate = (value?: string) => {
  if (!value) return "—";
  return new Intl.DateTimeFormat("pt-PT", { day: "2-digit", month: "2-digit" }).format(new Date(value));
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

const formatRoleLabel = (role: Colaborador["funcao"]) => {
  if (role === "admin") return "Administrador";
  if (role === "assistente") return "Assistente";
  if (role === "motorista") return "Motorista";
  return "Ajudante";
};

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

export default function ColaboradorAdminClient() {
  const router = useRouter();

  const [token, setToken] = useState("");
  const [adminNome, setAdminNome] = useState("");
  const [colabId, setColabId] = useState<number | null>(null);
  const [colabFuncao, setColabFuncao] = useState<string>("");
  const [isAdminGeral, setIsAdminGeral] = useState(false);
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeSection, setActiveSection] = useState<AdminSection>("overview");
  const [filtroColaborador, setFiltroColaborador] = useState("todos");
  const [weekOffset, setWeekOffset] = useState(0);
  const [funcaoFilter, setFuncaoFilter] = useState<"todas" | Colaborador["funcao"]>("todas");
  const [colaboradorDrawerId, setColaboradorDrawerId] = useState<number | null>(null);

  // Aba ativa da página Configurações
  const [settingsTab, setSettingsTab] = useState<
    "simulador" | "funcoes" | "imagens" | "seguranca" | "empresa"
  >("simulador");

  // Filtros da página Equipa
  const [teamSearch, setTeamSearch] = useState("");
  const [teamFuncao, setTeamFuncao] = useState<"todas" | Colaborador["funcao"]>("todas");
  const [teamStatus, setTeamStatus] = useState<"todos" | "ativo" | "inativo">("todos");

  // Filtros da página Horários
  const [hoursFuncao, setHoursFuncao] = useState<"todas" | Colaborador["funcao"]>("todas");
  const [hoursStatus, setHoursStatus] = useState<"todos" | "validado" | "pendente" | "incompleto">("todos");
  const [hoursPeriodo, setHoursPeriodo] = useState<"semana" | "anterior" | "personalizado">("semana");
  const [hoursDe, setHoursDe] = useState("");
  const [hoursAte, setHoursAte] = useState("");

  const [operacaoTab, setOperacaoTab] = useState<OperacaoTab>("equipa");
  const [criarNovoVisivel, setCriarNovoVisivel] = useState(false);
  const [loadingCriar, setLoadingCriar] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoValorHora, setNovoValorHora] = useState("");
  const [novoValorDiaria, setNovoValorDiaria] = useState("");
  const [novoFuncao, setNovoFuncao] = useState<Colaborador["funcao"]>("ajudante");
  const [novoSenha, setNovoSenha] = useState("");
  const [novoIsAdmin, setNovoIsAdmin] = useState(false);
  const [mostrarSenhaNovoUsuario, setMostrarSenhaNovoUsuario] = useState(false);
  // Campos de comissão (assistente)
  const [novoCommissionType, setNovoCommissionType] = useState<"profit_percent"|"gross_percent"|"fixed_per_closed_request"|"none">("gross_percent");
  const [novoCommissionPercent, setNovoCommissionPercent] = useState("");
  const [novoCommissionFixed, setNovoCommissionFixed] = useState("");
  const [novoCommissionNotes, setNovoCommissionNotes] = useState("");

  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [editNome, setEditNome] = useState("");
  const [editValorHora, setEditValorHora] = useState("");
  const [editFuncao, setEditFuncao] = useState<Colaborador["funcao"]>("ajudante");
  const [editSenha, setEditSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [loadingEdicao, setLoadingEdicao] = useState(false);
  const [editandoRegistroId, setEditandoRegistroId] = useState<number | null>(null);
  const [registroForm, setRegistroForm] = useState({
    data: "",
    horaEntrada: "",
    horaPausa: "",
    horaSaida: "",
    numeroTrabalhos: "0",
    valorHora: "",
    valorTotal: "",
  });
  const [savingRegistro, setSavingRegistro] = useState(false);
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
    rawOrderJson?: string | null;
    createdAt: string;
    updatedAt: string;
  };
  const [pedidos, setPedidos] = useState<SimulatorOrder[]>([]);
  const [pedidosCounts, setPedidosCounts] = useState<Record<string, number>>({});
  const [pedidosLoading, setPedidosLoading] = useState(false);
  const [pedidosError, setPedidosError] = useState<string | null>(null);
  const [pedidoStatusFilter, setPedidoStatusFilter] = useState("todos");
  const [pedidoSearch, setPedidoSearch] = useState("");
  const [pedidoSearchDebounced, setPedidoSearchDebounced] = useState("");
  const [selectedPedido, setSelectedPedido] = useState<SimulatorOrder | null>(null);
  const [pedidoDetalheOpen, setPedidoDetalheOpen] = useState(false);
  const [assistentes, setAssistentes] = useState<Array<{ id: number; nome: string; funcao: string }>>([]);
  const [confirmAcceptPedido, setConfirmAcceptPedido] = useState<SimulatorOrder | null>(null);
  const [billing, setBilling] = useState<{ acceptedCount: number; costPerOrder: number; totalOwed: number; totalPaid: number; balance: number } | null>(null);
  const [adminBilling, setAdminBilling] = useState<Array<{ id: number; nome: string; costPerAcceptedOrder: string; totalPaid: string; acceptedCount: number }>>([]);
  const [billingPaymentAmounts, setBillingPaymentAmounts] = useState<Record<number, string>>({});
  const [billingCostEdits, setBillingCostEdits] = useState<Record<number, string>>({});
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
    const storedFuncao = getColaboradorItem("funcao") ?? "";

    if (!storedToken) {
      router.push("/colaboradores");
      return;
    }

    // Motorista e ajudante não têm acesso a esta área — redirecionar para o dashboard
    const isAdminGeral = storedIsAdmin === "1";
    const isAssistente = storedFuncao === "assistente";
    if (!isAdminGeral && !isAssistente) {
      router.push("/colaboradores/dashboard");
      return;
    }

    setToken(storedToken);
    setAdminNome(storedNome || "Administração");
    setIsAdminGeral(isAdminGeral);
    const storedId = getColaboradorItem("id");
    if (storedId) setColabId(Number(storedId));
    setColabFuncao(storedFuncao);

    // Verificar se há section no URL (ex: ?section=pedidos)
    const searchParams = new URLSearchParams(window.location.search);
    const sectionParam = searchParams.get("section") as AdminSection | null;
    if (sectionParam && adminNavItems.some(item => item.id === sectionParam)) {
      setActiveSection(sectionParam);
      // Sincronizar a sub-tab de operação com o item de nav escolhido
      if (sectionParam === "equipa") setOperacaoTab("equipa");
      if (sectionParam === "pagamentos") setOperacaoTab("pagamentos");
    }

    // Admin geral carrega dados da equipa e configurações; assistente começa directamente nos pedidos
    if (isAdminGeral) {
      void carregarDados(storedToken);
      void carregarSimulatorSettings(storedToken);
      void carregarImageStats(storedToken);
    } else {
      // Assistente: só tem acesso à aba pedidos (definir se ainda não foi definido via URL)
      if (!sectionParam) {
        setActiveSection("pedidos");
      }
      setLoading(false);
    }

    return () => {
      document.head.removeChild(metaRobots);
    };
  }, [router]);

  const carregarDados = async (authToken: string) => {
    try {
      setLoading(true);
      setError(""); // Limpar erro anterior
      const response = await fetch("/api/colaboradores/admin/todos", {
        headers: { Authorization: `Bearer ${authToken}` },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("[v0] carregarDados erro:", response.status, errorData);
        throw new Error(errorData?.error || `Erro ao carregar dados: ${response.status}`);
      }

      const data = await response.json();
      setColaboradores(Array.isArray(data) ? data : data.colaboradores || []);
      setError("");
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Não foi possível carregar os dados do painel.";
      console.error("[v0] carregarDados catch:", errorMsg);
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

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

  const carregarPedidos = async (authToken: string, status = "todos", search = "") => {
    if (!authToken) return;
    try {
      setPedidosLoading(true);
      setPedidosError(null);
      const params = new URLSearchParams();
      if (status && status !== "todos") params.set("status", status);
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/pedidos?${params}&_=${Date.now()}`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) throw new Error("Erro ao carregar pedidos");
      const data = await res.json();
      setPedidos(data.orders ?? []);
      setPedidosCounts(data.counts ?? {});
    } catch {
      setPedidosError("Não foi possível carregar os pedidos.");
    } finally {
      setPedidosLoading(false);
    }
  };

  const carregarAssistentes = async (authToken: string) => {
    try {
      const res = await fetch("/api/admin/assistentes", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAssistentes(data.assistentes ?? []);
      }
    } catch {}
  };

  const carregarBilling = async (authToken: string) => {
    try {
      const res = await fetch("/api/admin/billing", {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.balance !== undefined) setBilling(data);
        if (data.assistants) setAdminBilling(data.assistants);
      }
    } catch {}
  };

  const carregarLeads = async (authToken: string, periodo = leadPeriodo, status = leadStatusFilter) => {
    if (!authToken) return;
    try {
      setLoadingLeads(true);
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
          }
        } catch { /* silencioso */ }
      }

      setLeadsLastUpdate(new Date());
    } catch (err) {
      console.error("[admin] carregarLeads error:", err);
      setLeadsError("Não foi possível carregar leads. Verifique a ligação à base de dados ou os endpoints.");
    } finally {
      setLoadingLeads(false);
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
    const interval = setInterval(() => carregarLeads(token, leadPeriodo, leadStatusFilter), 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, token, leadPeriodo, leadStatusFilter, leadEventTypeFilter]);

  // Carregar pedidos quando a aba Pedidos fica activa
  useEffect(() => {
    if (activeSection !== "pedidos" || !token) return;
    carregarPedidos(token, pedidoStatusFilter, pedidoSearchDebounced);
    carregarAssistentes(token);
    if (!isAdminGeral) carregarBilling(token);
    const interval = setInterval(() => carregarPedidos(token, pedidoStatusFilter, pedidoSearchDebounced), 120000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, token, pedidoStatusFilter, pedidoSearchDebounced]);

  // Carregar resumo de pedidos para o overview (5 mais recentes)
  useEffect(() => {
    if (!token) return;
    carregarPedidos(token, "todos", "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Carregar billing admin quando entra em Settings > Funções
  useEffect(() => {
    if (!token || !isAdminGeral) return;
    if ((activeSection === "site" || activeSection === "configs") && settingsTab === "funcoes") {
      carregarBilling(token);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection, settingsTab, token, isAdminGeral]);

  const colaboradoresFiltrados = useMemo(() => {
    if (filtroColaborador === "todos") return colaboradores;
    return colaboradores.filter((colaborador) => colaborador.id === Number(filtroColaborador));
  }, [colaboradores, filtroColaborador]);

  const todosRegistros = useMemo<RegistroComColaborador[]>(
    () =>
      colaboradoresFiltrados
        .flatMap((colaborador) =>
          (colaborador.registros || []).map((registro) => ({
            ...registro,
            colaboradorId: colaborador.id,
            colaboradorNome: colaborador.nome,
            colaboradorValorHora: colaborador.valorHora,
          })),
        )
        .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime()),
    [colaboradoresFiltrados],
  );

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

  // ---- Núcleo operacional: semana selecionada (segunda -> domingo) ----
  const weekRange = useMemo(() => getWeekRange(weekOffset), [weekOffset]);

  const weekLabel = useMemo(() => {
    const fmt = (date: Date) =>
      new Intl.DateTimeFormat("pt-PT", { weekday: "long", day: "2-digit", month: "2-digit" }).format(date);
    return `${fmt(weekRange.start)} até ${fmt(weekRange.end)}`;
  }, [weekRange]);

  const today = useMemo(() => new Date(), []);

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

  // Colaboradores com registos na semana selecionada (respeitando filtro de função).
  const weekCollaborators = useMemo(() => {
    const base =
      funcaoFilter === "todas"
        ? colaboradores
        : colaboradores.filter((c) => c.funcao === funcaoFilter);

    return base
      .map((colaborador) => {
        const registrosSemana = (colaborador.registros || [])
          .filter((registro) => isBetweenDates(registro.data, weekRange.start, weekRange.end))
          .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

        const horas = registrosSemana.reduce((sum, r) => sum + parseFloat(r.horasTrabalhadas || "0"), 0);
        const valor = registrosSemana.reduce((sum, r) => sum + parseFloat(r.valorTotal || "0"), 0);
        const trabalhos = registrosSemana.reduce((sum, r) => sum + (r.numeroTrabalhos || 0), 0);
        const diasTrabalhados = new Set(
          registrosSemana.map((r) => new Date(r.data).toISOString().split("T")[0]),
        ).size;
        const ultimoDia = registrosSemana[0]?.data || "";
        const ativoHoje = registrosSemana.some((r) => isSameDay(r.data, today));
        const temPendencia = registrosSemana.some((r) => getRecordStatus(r) !== "validado");

        return {
          ...colaborador,
          registrosSemana,
          horas,
          valor,
          trabalhos,
          diasTrabalhados,
          ultimoDia,
          ativoHoje,
          temPendencia,
        };
      })
      .filter((c) => c.registrosSemana.length > 0)
      .sort((a, b) => b.horas - a.horas);
  }, [colaboradores, funcaoFilter, weekRange, today]);

  // Cards de topo da semana.
  const weekSummary = useMemo(() => {
    const totalHoras = weekCollaborators.reduce((sum, c) => sum + c.horas, 0);
    const totalValor = weekCollaborators.reduce((sum, c) => sum + c.valor, 0);
    const totalRegistos = weekCollaborators.reduce((sum, c) => sum + c.registrosSemana.length, 0);
    const pendentes = weekCollaborators.reduce(
      (sum, c) => sum + c.registrosSemana.filter((r) => getRecordStatus(r) !== "validado").length,
      0,
    );
    const ativosHoje = weekCollaborators.filter((c) => c.ativoHoje).length;

    return {
      colaboradores: weekCollaborators.length,
      totalHoras,
      totalValor,
      totalRegistos,
      pendentes,
      ativosHoje,
    };
  }, [weekCollaborators]);

  // Registos da semana com colaborador, ordenados (pendentes primeiro, depois recentes).
  const weekRecords = useMemo(() => {
    const rows = weekCollaborators.flatMap((colaborador) =>
      colaborador.registrosSemana.map((registro) => ({
        ...registro,
        colaboradorId: colaborador.id,
        colaboradorNome: colaborador.nome,
        colaboradorValorHora: colaborador.valorHora,
        status: getRecordStatus(registro),
      })),
    );

    return rows.sort((a, b) => {
      const aPend = a.status !== "validado" ? 0 : 1;
      const bPend = b.status !== "validado" ? 0 : 1;
      if (aPend !== bPend) return aPend - bPend;
      return new Date(b.data).getTime() - new Date(a.data).getTime();
    });
  }, [weekCollaborators]);

  // ---- Página Horários: registos filtrados por período/status/função ----
  const hoursRange = useMemo(() => {
    if (hoursPeriodo === "anterior") {
      const start = new Date(weekRange.start);
      start.setDate(start.getDate() - 7);
      const end = new Date(weekRange.end);
      end.setDate(end.getDate() - 7);
      return { start, end };
    }
    if (hoursPeriodo === "personalizado" && hoursDe && hoursAte) {
      const start = new Date(`${hoursDe}T00:00:00`);
      const end = new Date(`${hoursAte}T23:59:59`);
      return { start, end };
    }
    return weekRange;
  }, [hoursPeriodo, hoursDe, hoursAte, weekRange]);

  const hoursRecords = useMemo(() => {
    const funcaoById = new Map(colaboradores.map((c) => [c.id, c.funcao]));
    return colaboradores
      .flatMap((colaborador) =>
        (colaborador.registros || []).map((registro) => {
          const status = getRecordStatus(registro);
          return {
            ...registro,
            colaboradorId: colaborador.id,
            colaboradorNome: colaborador.nome,
            colaboradorValorHora: colaborador.valorHora,
            funcao: colaborador.funcao,
            status,
            statusLabel: (status === "incompleto"
              ? "incompleto"
              : status === "alerta"
                ? "pendente"
                : "validado") as "incompleto" | "pendente" | "validado",
          };
        }),
      )
      .filter((r) => isBetweenDates(r.data, hoursRange.start, hoursRange.end))
      .filter((r) => (filtroColaborador === "todos" ? true : r.colaboradorId === Number(filtroColaborador)))
      .filter((r) => (hoursFuncao === "todas" ? true : funcaoById.get(r.colaboradorId) === hoursFuncao))
      .filter((r) => {
        if (hoursStatus === "todos") return true;
        if (hoursStatus === "validado") return r.status === "validado";
        if (hoursStatus === "incompleto") return r.status === "incompleto";
        return r.status === "alerta"; // pendente
      })
      .sort((a, b) => {
        const aPend = a.status !== "validado" ? 0 : 1;
        const bPend = b.status !== "validado" ? 0 : 1;
        if (aPend !== bPend) return aPend - bPend;
        return new Date(b.data).getTime() - new Date(a.data).getTime();
      });
  }, [colaboradores, hoursRange, filtroColaborador, hoursFuncao, hoursStatus]);

  const hoursSummary = useMemo(() => {
    const colaboradoresComRegisto = new Set(hoursRecords.map((r) => r.colaboradorId)).size;
    const totalHoras = hoursRecords.reduce((s, r) => s + parseFloat(r.horasTrabalhadas || "0"), 0);
    const totalValor = hoursRecords.reduce((s, r) => s + parseFloat(r.valorTotal || "0"), 0);
    const pendentes = hoursRecords.filter((r) => r.status === "alerta").length;
    const incompletos = hoursRecords.filter((r) => r.status === "incompleto").length;
    return {
      colaboradoresComRegisto,
      totalHoras,
      totalValor,
      pendentes,
      incompletos,
      mediaHoras: colaboradoresComRegisto > 0 ? totalHoras / colaboradoresComRegisto : 0,
    };
  }, [hoursRecords]);

  const hoursPeriodLabel = useMemo(() => {
    const fmt = (d: Date) =>
      d.toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" });
    return `${fmt(hoursRange.start)} a ${fmt(hoursRange.end)}`;
  }, [hoursRange]);

  // Pendências operacionais derivadas dos registos da semana.
  const pendencias = useMemo(() => {
    const semSaida: Array<{ id: number; nome: string; data: string }> = [];
    const horasAltas: Array<{ id: number; nome: string; data: string; horas: number }> = [];
    const naoValidados: number[] = [];

    weekCollaborators.forEach((colaborador) => {
      colaborador.registrosSemana.forEach((registro) => {
        if (!registro.horaSaida) {
          semSaida.push({ id: registro.id, nome: colaborador.nome, data: registro.data });
        } else if (parseFloat(registro.horasTrabalhadas || "0") > HIGH_HOURS_THRESHOLD) {
          horasAltas.push({
            id: registro.id,
            nome: colaborador.nome,
            data: registro.data,
            horas: parseFloat(registro.horasTrabalhadas || "0"),
          });
        }
        if (getRecordStatus(registro) !== "validado") naoValidados.push(registro.id);
      });
    });

    return { semSaida, horasAltas, totalNaoValidados: naoValidados.length };
  }, [weekCollaborators]);

  // Dados do colaborador aberto no drawer de histórico semanal.
  const drawerColaborador = useMemo(() => {
    if (colaboradorDrawerId === null) return null;
    return weekCollaborators.find((c) => c.id === colaboradorDrawerId) || null;
  }, [colaboradorDrawerId, weekCollaborators]);

  // Histórico dia-a-dia (segunda -> domingo) para o drawer.
  const drawerDias = useMemo(() => {
    if (!drawerColaborador) return [];
    return WEEK_DAY_LABELS.map((label, index) => {
      const dia = new Date(weekRange.start);
      dia.setDate(dia.getDate() + index);
      const registros = drawerColaborador.registrosSemana.filter((r) => isSameDay(r.data, dia));
      return { label, dia, registros };
    });
  }, [drawerColaborador, weekRange]);

  // ---- Página Equipa: dados derivados por colaborador (estado = atividade real) ----
  const teamRows = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return colaboradores.map((colaborador) => {
      const registros = colaborador.registros || [];
      const ultimoRegistro = [...registros].sort(
        (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime(),
      )[0];

      const horasSemana = registros
        .filter((r) => isBetweenDates(r.data, weekRange.start, weekRange.end))
        .reduce((sum, r) => sum + parseFloat(r.horasTrabalhadas || "0"), 0);

      const horas30 = registros
        .filter((r) => new Date(r.data) >= thirtyDaysAgo)
        .reduce((sum, r) => sum + parseFloat(r.horasTrabalhadas || "0"), 0);

      const trabalhouSemana = horasSemana > 0;
      const ativoHoje = registros.some((r) => isSameDay(r.data, today));

      return {
        ...colaborador,
        ultimoRegistro,
        horasSemana,
        horas30,
        valorMes: parseFloat(colaborador.estatisticas?.mes?.valor || "0"),
        trabalhouSemana,
        ativoHoje,
        // "ativo" = trabalhou esta semana (estado derivado, sem campo na BD)
        estadoAtividade: (trabalhouSemana ? "ativo" : "inativo") as "ativo" | "inativo",
      };
    });
  }, [colaboradores, weekRange, today]);

  const teamRowsFiltered = useMemo(() => {
    const term = teamSearch.trim().toLowerCase();
    return teamRows
      .filter((row) => (term ? row.nome.toLowerCase().includes(term) : true))
      .filter((row) => (teamFuncao === "todas" ? true : row.funcao === teamFuncao))
      .filter((row) => (teamStatus === "todos" ? true : row.estadoAtividade === teamStatus))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [teamRows, teamSearch, teamFuncao, teamStatus]);

  const teamStats = useMemo(() => {
    return {
      total: colaboradores.length,
      ativos: teamRows.filter((r) => r.estadoAtividade === "ativo").length,
      inativos: teamRows.filter((r) => r.estadoAtividade === "inativo").length,
      motoristas: colaboradores.filter((c) => c.funcao === "motorista").length,
      ajudantes: colaboradores.filter((c) => c.funcao === "ajudante").length,
      admins: colaboradores.filter((c) => c.isAdmin === 1 || c.funcao === "admin").length,
    };
  }, [colaboradores, teamRows]);

  const sortCollaboratorsByHoursReport = <
    T extends {
      nome: string;
      relatorio: {
        semana: { horas: number; valor: number; trabalhos: number };
        mes: { horas: number; valor: number; trabalhos: number };
      };
    },
  >(
    reports: T[],
  ) =>
    [...reports].sort((a, b) => {
      const aWorked =
        a.relatorio.mes.trabalhos > 0 ||
        a.relatorio.mes.horas > 0 ||
        a.relatorio.semana.trabalhos > 0 ||
        a.relatorio.semana.horas > 0;
      const bWorked =
        b.relatorio.mes.trabalhos > 0 ||
        b.relatorio.mes.horas > 0 ||
        b.relatorio.semana.trabalhos > 0 ||
        b.relatorio.semana.horas > 0;

      if (aWorked !== bWorked) {
        return Number(bWorked) - Number(aWorked);
      }

      if (b.relatorio.mes.valor !== a.relatorio.mes.valor) {
        return b.relatorio.mes.valor - a.relatorio.mes.valor;
      }

      if (b.relatorio.semana.valor !== a.relatorio.semana.valor) {
        return b.relatorio.semana.valor - a.relatorio.semana.valor;
      }

      if (b.relatorio.mes.horas !== a.relatorio.mes.horas) {
        return b.relatorio.mes.horas - a.relatorio.mes.horas;
      }

      if (b.relatorio.semana.horas !== a.relatorio.semana.horas) {
        return b.relatorio.semana.horas - a.relatorio.semana.horas;
      }

      return a.nome.localeCompare(b.nome, "pt-PT");
    });

  const collaboratorHourReports = useMemo(() => {
    const { start: weekStart, end: weekEnd } = getCurrentWeekRange();
    const { start: monthStart, end: monthEnd } = getCurrentMonthRange();

    const buildPeriod = (records: Registro[]) => {
      const horas = records.reduce((sum, item) => sum + parseFloat(item.horasTrabalhadas || "0"), 0);
      const valor = records.reduce((sum, item) => sum + parseFloat(item.valorTotal || "0"), 0);
      const trabalhos = records.reduce((sum, item) => sum + (item.numeroTrabalhos || 0), 0);

      return {
        horas,
        valor,
        trabalhos,
      };
    };

    const reports = colaboradoresFiltrados.map((colaborador) => {
      const registros = [...(colaborador.registros || [])].sort(
        (a, b) => new Date(b.data).getTime() - new Date(a.data).getTime(),
      );
      const semanaRegistros = registros.filter((registro) => isBetweenDates(registro.data, weekStart, weekEnd));
      const mesRegistros = registros.filter((registro) => isBetweenDates(registro.data, monthStart, monthEnd));

      return {
        ...colaborador,
        relatorio: {
          semana: {
            ...buildPeriod(semanaRegistros),
            periodo: `${formatDate(weekStart.toISOString())} - ${formatDate(weekEnd.toISOString())}`,
            historico: semanaRegistros,
          },
          mes: {
            ...buildPeriod(mesRegistros),
            periodo: new Intl.DateTimeFormat("pt-PT", {
              month: "long",
              year: "numeric",
            }).format(monthStart),
            historico: mesRegistros,
          },
        },
      };
    });

    return sortCollaboratorsByHoursReport(reports);
  }, [colaboradoresFiltrados]);

  const collaboratorHoursFilters = useMemo(() => {
    const { start: weekStart, end: weekEnd } = getCurrentWeekRange();
    const { start: monthStart, end: monthEnd } = getCurrentMonthRange();

    const reports = colaboradores.map((colaborador) => {
      const registros = colaborador.registros || [];
      const semanaRegistros = registros.filter((registro) => isBetweenDates(registro.data, weekStart, weekEnd));
      const mesRegistros = registros.filter((registro) => isBetweenDates(registro.data, monthStart, monthEnd));

      const semanaHoras = semanaRegistros.reduce(
        (sum, item) => sum + parseFloat(item.horasTrabalhadas || "0"),
        0,
      );
      const semanaValor = semanaRegistros.reduce((sum, item) => sum + parseFloat(item.valorTotal || "0"), 0);
      const semanaTrabalhos = semanaRegistros.reduce((sum, item) => sum + (item.numeroTrabalhos || 0), 0);
      const mesHoras = mesRegistros.reduce((sum, item) => sum + parseFloat(item.horasTrabalhadas || "0"), 0);
      const mesValor = mesRegistros.reduce((sum, item) => sum + parseFloat(item.valorTotal || "0"), 0);
      const mesTrabalhos = mesRegistros.reduce((sum, item) => sum + (item.numeroTrabalhos || 0), 0);

      return {
        ...colaborador,
        relatorio: {
          semana: { horas: semanaHoras, valor: semanaValor, trabalhos: semanaTrabalhos },
          mes: { horas: mesHoras, valor: mesValor, trabalhos: mesTrabalhos },
        },
      };
    });

    return sortCollaboratorsByHoursReport(reports);
  }, [colaboradores]);

  const handleLogout = () => {
    clearColaboradorStorage();
    router.push("/colaboradores");
  };

  const abrirEdicao = (colaborador: Colaborador) => {
    setEditandoId(colaborador.id);
    setEditNome(colaborador.nome);
    setEditValorHora(String(colaborador.valorHora));
    setEditFuncao(colaborador.funcao);
    setEditSenha("");
    setMostrarSenha(false);
  };

  const editarUsuario = async (id: number) => {
    if (!editNome || !editValorHora) {
      setError("Preencha nome e valor/hora antes de guardar.");
      return;
    }

    setLoadingEdicao(true);
    try {
      const body: Record<string, unknown> = {
        nome: editNome.toUpperCase(),
        valorHora: parseFloat(editValorHora),
        funcao: editFuncao,
      };

      if (editSenha) body.senha = editSenha;

      const response = await fetch(`/api/colaboradores/${id}/editar`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Não foi possível atualizar o colaborador.");
      }

      setEditandoId(null);
      setEditSenha("");
      setError("");
      await carregarDados(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível atualizar o colaborador.");
    } finally {
      setLoadingEdicao(false);
    }
  };

  const deletarUsuario = async (id: number, nome: string) => {
    if (!confirm(`Tem a certeza de que deseja remover ${nome}?`)) return;

    try {
      const response = await fetch(`/api/colaboradores/${id}/deletar`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Não foi possível remover o colaborador.");
      }

      setError("");
      await carregarDados(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível remover o colaborador.");
    }
  };

  const criarNovoColaborador = async () => {
    if (!novoNome.trim()) { setError("Preencha o nome do colaborador."); return; }
    if (!novoSenha.trim()) { setError("Preencha a palavra-passe inicial."); return; }
    if (["motorista", "ajudante"].includes(novoFuncao) && !novoValorHora && !novoValorDiaria) {
      setError("Preencha o valor por hora ou diária para motoristas e ajudantes.");
      return;
    }

    setLoadingCriar(true);
    setError("");
    try {
      const isAssistente = novoFuncao === "assistente";
      const isAdminFuncao = novoFuncao === "admin";
      const payload: Record<string, unknown> = {
        nome: novoNome.toUpperCase().trim(),
        senha: novoSenha,
        funcao: novoFuncao,
        isAdmin: novoIsAdmin ? 1 : 0,
      };

      if (isAssistente) {
        payload.paymentModel = "commission";
        payload.valorHora = null;
        payload.canReceiveSimulatorRequests = 1;
        payload.participatesInTimeTracking = 0;
      } else if (isAdminFuncao) {
        payload.paymentModel = "none";
        payload.valorHora = null;
      } else {
        payload.paymentModel = novoValorDiaria && !novoValorHora ? "daily" : "hourly";
        payload.valorHora = novoValorHora ? parseFloat(novoValorHora) : null;
        payload.valorDiaria = novoValorDiaria ? parseFloat(novoValorDiaria) : null;
        payload.canReceiveSimulatorRequests = 0;
        payload.participatesInTimeTracking = 1;
      }

      const response = await fetch("/api/colaboradores/criar", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Não foi possível criar o colaborador.");
      }

      setCriarNovoVisivel(false);
      setNovoNome(""); setNovoValorHora(""); setNovoValorDiaria("");
      setNovoFuncao("ajudante"); setNovoSenha(""); setNovoIsAdmin(false);
      setNovoCommissionType("gross_percent"); setNovoCommissionPercent("");
      setNovoCommissionFixed(""); setNovoCommissionNotes("");
      await carregarDados(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar o colaborador.");
    } finally {
      setLoadingCriar(false);
    }
  };

  const abrirEdicaoRegistro = (registro: RegistroComColaborador) => {
    setEditandoRegistroId(registro.id);
    setRegistroForm({
      data: registro.data ? new Date(registro.data).toISOString().split("T")[0] || "" : "",
      horaEntrada: registro.horaEntrada || "",
      horaPausa: registro.horaPausa || "",
      horaSaida: registro.horaSaida || "",
      numeroTrabalhos: String(registro.numeroTrabalhos || 0),
      valorHora: String(registro.colaboradorValorHora || ""),
      valorTotal: String(registro.valorTotal || ""),
    });
  };

  const guardarRegistro = async (id: number) => {
    setSavingRegistro(true);
    try {
      const response = await fetch(`/api/colaboradores/registros/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...registroForm,
          valorHora: registroForm.valorHora || null,
          horaPausa: registroForm.horaPausa || null,
          horaSaida: registroForm.horaSaida || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Não foi possível atualizar o registo.");
      }

      setEditandoRegistroId(null);
      setError("");
      await carregarDados(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível atualizar o registo.");
    } finally {
      setSavingRegistro(false);
    }
  };

  const apagarRegistro = async (id: number) => {
    if (!confirm("Tem a certeza de que deseja apagar este registo?")) return;

    try {
      const response = await fetch(`/api/colaboradores/registros/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Não foi possível apagar o registo.");
      }

      setError("");
      await carregarDados(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível apagar o registo.");
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
        <div className="mx-auto max-w-6xl animate-pulse space-y-5 [zoom:0.8]">
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
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-[1500px] px-3 py-5 [zoom:0.8] lg:px-6">
        <header className="rounded-[24px] border border-slate-800 bg-slate-900 px-5 py-4 shadow-lg">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-sky-500 text-white">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-400">
                  Backoffice CLYON
                </p>
                <h2 className="mt-0.5 text-xl font-semibold text-white">Painel administrativo</h2>
                <p className="mt-0.5 text-xs capitalize text-slate-500">{hojeLabel}</p>
              </div>
            </div>

            <nav className="flex flex-wrap gap-1.5">
              {adminNavItems
                .filter((item) => isAdminGeral || item.id === "pedidos")
                .map((item) => {
                  const Icon = item.icon;
                  const active = activeSection === item.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setActiveSection(item.id);
                        // Sincronizar a sub-tab de operação com o item de nav escolhido
                        if (item.id === "equipa") setOperacaoTab("equipa");
                        if (item.id === "pagamentos") setOperacaoTab("pagamentos");
                      }}
                      className={`flex items-center gap-2 rounded-[14px] px-4 py-2.5 text-sm font-medium transition ${
                        active
                          ? "bg-sky-500 text-white shadow-md"
                          : "border border-slate-800 bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {sectionLabels[item.id]}
                    </button>
                  );
                })}
            </nav>

            <div className="flex items-center gap-3 rounded-[18px] border border-slate-800 bg-slate-800/60 px-4 py-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-sky-500 text-xs font-bold text-white">
                {getInitials(adminNome)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white">{adminNome}</p>
                <p className="text-xs text-slate-500">
                  {isAdminGeral ? "Admin geral" : "Assistente"}
                </p>
              </div>
              <Button
                onClick={handleLogout}
                variant="ghost"
                className="h-9 rounded-[10px] px-3 text-slate-400 hover:bg-slate-700 hover:text-white"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </header>

        <main className="mt-4 min-w-0 space-y-5">
          {error && (
            <div className="rounded-[22px] border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          )}

          {activeSection === "overview" && (
            <>
              {/* Barra de semana + filtros operacionais */}
              <section className="flex flex-col gap-4 rounded-[24px] border border-cyan-300/16 bg-[linear-gradient(135deg,rgba(9,27,43,0.96)_0%,rgba(12,34,52,0.94)_100%)] p-5 shadow-[0_20px_70px_rgba(3,10,18,0.24)] xl:flex-row xl:items-center xl:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400 text-slate-950">
                    <CalendarDays className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-200">
                      {weekOffset === 0 ? "Semana atual" : weekOffset === -1 ? "Semana anterior" : "Semana selecionada"}
                    </p>
                    <p className="mt-1 text-lg font-semibold capitalize text-white">{weekLabel}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex rounded-[16px] border border-white/10 bg-white/[0.03] p-1">
                    <button
                      type="button"
                      onClick={() => setWeekOffset(0)}
                      className={`rounded-[12px] px-3 py-2 text-sm font-semibold transition ${weekOffset === 0 ? "bg-cyan-400 text-slate-950" : "text-slate-200 hover:bg-white/[0.06]"}`}
                    >
                      Atual
                    </button>
                    <button
                      type="button"
                      onClick={() => setWeekOffset(-1)}
                      className={`rounded-[12px] px-3 py-2 text-sm font-semibold transition ${weekOffset === -1 ? "bg-cyan-400 text-slate-950" : "text-slate-200 hover:bg-white/[0.06]"}`}
                    >
                      Anterior
                    </button>
                  </div>

                  <select
                    value={funcaoFilter}
                    onChange={(e) => setFuncaoFilter(e.target.value as typeof funcaoFilter)}
                    className="h-11 rounded-[14px] border border-cyan-300/20 bg-[#0d1f35] px-3 text-sm font-medium text-white outline-none focus:border-cyan-400 [color-scheme:dark]"
                  >
                    <option value="todas">Todas as funções</option>
                    <option value="admin">Administradores</option>
                    <option value="motorista">Motoristas</option>
                    <option value="ajudante">Ajudantes</option>
                  </select>

                  <Button
                    type="button"
                    onClick={() => {
                      setCriarNovoVisivel(true);
                      setOperacaoTab("equipa");
                      setActiveSection("operacao");
                    }}
                    className="h-11 rounded-[14px] bg-sky-500 px-4 text-white hover:bg-sky-400"
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Adicionar registo
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => { setOperacaoTab("horarios"); setActiveSection("operacao"); }}
                    className="h-11 rounded-[14px] border-slate-700 bg-slate-800/60 px-4 text-slate-200 hover:bg-slate-700"
                  >
                    <ListChecks className="mr-2 h-4 w-4" />
                    Validar pendências
                  </Button>
                </div>
              </section>

              {/* Cards de resumo da semana */}
              <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
                <SummaryStat icon={Users} label="Colaboradores" value={String(weekSummary.colaboradores)} helper="ativos na semana" />
                <SummaryStat icon={Clock3} label="Horas da semana" value={`${decimal(weekSummary.totalHoras)}h`} helper="total da equipa" />
                <SummaryStat icon={Euro} label="A pagar (estimado)" value={money(weekSummary.totalValor)} helper="valor da semana" tone="emerald" />
                <SummaryStat icon={Briefcase} label="Registos" value={String(weekSummary.totalRegistos)} helper="turnos da semana" />
                <SummaryStat icon={AlertTriangle} label="Pendentes" value={String(weekSummary.pendentes)} helper="por validar" tone="amber" />
                <SummaryStat icon={CheckCircle2} label="Ativos hoje" value={String(weekSummary.ativosHoje)} helper="com registo hoje" tone="cyan" />
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
                        sem_assistente: "Sem assistente",
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

              {/* Layout principal: colaboradores + lateral de pendências */}
              <section className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
                <ActionCard
                  title="Colaboradores que trabalharam esta semana"
                  description="Clique num colaborador para abrir o histórico semanal detalhado."
                >
                  {weekCollaborators.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-slate-400">
                      Sem registos de colaboradores nesta semana.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {weekCollaborators.map((colaborador) => (
                        <button
                          key={colaborador.id}
                          type="button"
                          onClick={() => setColaboradorDrawerId(colaborador.id)}
                          className="grid w-full items-center gap-3 rounded-[18px] border border-white/10 bg-white/[0.03] px-4 py-3 text-left transition hover:border-cyan-400/40 hover:bg-white/[0.06] md:grid-cols-[1.6fr_repeat(4,minmax(0,1fr))_auto]"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-cyan-400 text-sm font-semibold text-slate-950">
                              {getInitials(colaborador.nome)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-white">{colaborador.nome}</p>
                              <p className="text-xs capitalize text-slate-400">{formatRoleLabel(colaborador.funcao)}</p>
                            </div>
                          </div>
                          <CellStat label="Dias" value={String(colaborador.diasTrabalhados)} />
                          <CellStat label="Horas" value={`${decimal(colaborador.horas)}h`} />
                          <CellStat label="A receber" value={money(colaborador.valor)} accent />
                          <CellStat label="Último dia" value={formatShortDate(colaborador.ultimoDia)} />
                          <div className="flex items-center justify-between gap-2 md:justify-end">
                            <StatusBadge
                              status={
                                colaborador.temPendencia
                                  ? "pendente"
                                  : colaborador.ativoHoje
                                    ? "ativo"
                                    : "inativo"
                              }
                            />
                            <ChevronRight className="hidden h-4 w-4 text-slate-500 md:block" />
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </ActionCard>

                <div className="space-y-4">
                  {/* Pendências */}
                  <ActionCard title="Pendências" description="Alertas operacionais desta semana." compact>
                    <div className="space-y-3">
                      <PendingRow
                        icon={TimerReset}
                        tone="rose"
                        label="Sem hora de saída"
                        count={pendencias.semSaida.length}
                        detail={pendencias.semSaida.slice(0, 3).map((p) => `${p.nome} · ${formatShortDate(p.data)}`)}
                      />
                      <PendingRow
                        icon={AlertTriangle}
                        tone="amber"
                        label="Horas muito altas"
                        count={pendencias.horasAltas.length}
                        detail={pendencias.horasAltas
                          .slice(0, 3)
                          .map((p) => `${p.nome} · ${decimal(p.horas)}h`)}
                      />
                      <PendingRow
                        icon={ListChecks}
                        tone="cyan"
                        label="Registos por validar"
                        count={pendencias.totalNaoValidados}
                        detail={[]}
                      />
                      {pendencias.semSaida.length === 0 &&
                        pendencias.horasAltas.length === 0 &&
                        pendencias.totalNaoValidados === 0 && (
                          <div className="flex items-center gap-2 rounded-[16px] border border-emerald-300/20 bg-emerald-400/[0.08] px-4 py-3 text-sm text-emerald-100">
                            <CheckCircle2 className="h-4 w-4" />
                            Tudo em dia esta semana.
                          </div>
                        )}
                    </div>
                  </ActionCard>

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
                    <QuickAction icon={CalendarClock} label="Abrir histórico e horários" onClick={() => { setOperacaoTab("horarios"); setActiveSection("operacao"); }} />
                    <QuickAction icon={Users} label="Ver colaboradores" onClick={() => { setOperacaoTab("equipa"); setActiveSection("equipa"); }} />
                    <QuickAction icon={TrendingUp} label="Ver leads e contactos" onClick={() => setActiveSection("leads")} />
                    <QuickAction icon={Settings2} label="Configurações" onClick={() => setActiveSection("configs")} />
                  </ActionCard>
                </div>
              </section>

              {/* Registos recentes da semana */}
              <ActionCard
                title="Registos recentes"
                description="Pendentes primeiro, depois os mais recentes da semana."
              >
                {weekRecords.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-slate-400">
                    Sem registos nesta semana.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-left text-slate-400">
                          <th className="px-3 py-2 font-medium">Colaborador</th>
                          <th className="px-3 py-2 font-medium">Data</th>
                          <th className="px-3 py-2 font-medium">Entrada</th>
                          <th className="px-3 py-2 font-medium">Saída</th>
                          <th className="px-3 py-2 font-medium">Horas</th>
                          <th className="px-3 py-2 font-medium">Valor</th>
                          <th className="px-3 py-2 font-medium">Estado</th>
                          <th className="px-3 py-2 font-medium text-right">Ação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {weekRecords.slice(0, 12).map((registro) => (
                          <tr key={registro.id} className="border-t border-white/10 text-slate-200">
                            <td className="px-3 py-3 font-medium text-white">{registro.colaboradorNome}</td>
                            <td className="px-3 py-3">{formatShortDate(registro.data)}</td>
                            <td className="px-3 py-3">{registro.horaEntrada || "—"}</td>
                            <td className="px-3 py-3">{registro.horaSaida || "—"}</td>
                            <td className="px-3 py-3 font-medium text-white">
                              {decimal(parseFloat(registro.horasTrabalhadas || "0"))}h
                            </td>
                            <td className="px-3 py-3 font-medium text-cyan-200">
                              {money(parseFloat(registro.valorTotal || "0"))}
                            </td>
                            <td className="px-3 py-3">
                              <StatusBadge
                                status={
                                  registro.status === "incompleto"
                                    ? "incompleto"
                                    : registro.status === "alerta"
                                      ? "pendente"
                                      : "validado"
                                }
                              />
                            </td>
                            <td className="px-3 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => setColaboradorDrawerId(registro.colaboradorId)}
                                className="rounded-[10px] border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-cyan-100 transition hover:bg-white/[0.08]"
                              >
                                Ver
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </ActionCard>
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
                <button
                  type="button"
                  onClick={() => carregarPedidos(token, pedidoStatusFilter, pedidoSearchDebounced)}
                  className="flex h-11 items-center gap-2 rounded-[14px] border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  <RefreshCw className="h-4 w-4" />
                  Actualizar
                </button>
              </div>

              {/* Métricas de pedidos */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                <button
                  type="button"
                  onClick={() => setPedidoStatusFilter("todos")}
                  className={`flex flex-col items-center justify-center rounded-[16px] border px-2 py-3 transition hover:scale-105 border-slate-200 bg-slate-50 ${pedidoStatusFilter === "todos" ? "ring-2 ring-cyan-500" : ""}`}
                >
                  <span className="text-2xl font-bold text-slate-700">{pedidosCounts["total"] ?? 0}</span>
                  <span className="mt-0.5 text-center text-xs text-slate-500">Total</span>
                  <span className="mt-0.5 text-[10px] text-slate-400">100% do total</span>
                </button>
                {[
                  { label: "Novos", key: "pendente", color: "text-blue-600", bg: "border-blue-200 bg-blue-50", pct: "pendente" },
                  { label: "Sem assistente", key: "sem_assistente", color: "text-rose-600", bg: "border-rose-200 bg-rose-50", pct: "sem_assistente" },
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

              {/* Billing card — assistente only */}
              {!isAdminGeral && billing && (
                <div className="flex items-center gap-4 rounded-[16px] border border-amber-200 bg-amber-50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Euro className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-semibold text-slate-700">Pedidos aceites: <span className="text-amber-700">{billing.acceptedCount}</span></span>
                  </div>
                  <span className="text-xs text-slate-500">×</span>
                  <span className="text-sm text-slate-600">{billing.costPerOrder.toFixed(2)} €/pedido</span>
                  <span className="text-xs text-slate-500">=</span>
                  <span className="text-sm font-bold text-slate-800">{billing.totalOwed.toFixed(2)} €</span>
                  {billing.totalPaid > 0 && (
                    <>
                      <span className="text-xs text-slate-400">−</span>
                      <span className="text-sm text-emerald-700">{billing.totalPaid.toFixed(2)} € pago</span>
                    </>
                  )}
                  <span className="ml-auto rounded-full border border-amber-300 bg-amber-100 px-3 py-0.5 text-xs font-bold text-amber-800">
                    Saldo: {billing.balance.toFixed(2)} €
                  </span>
                </div>
              )}

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
                  <option value="todos">Todos os status</option>
                  <option value="pendente">Novos</option>
                  <option value="atribuido">Atribuídos</option>
                  <option value="em_analise">Em análise</option>
                  <option value="sem_assistente">Sem assistente</option>
                  <option value="precisa_info">Precisa informação</option>
                  <option value="presencial_recomendado">Presencial recomendado</option>
                  <option value="estimativa_pronta">Estimativa pronta</option>
                  <option value="aprovado">Aprovados</option>
                  <option value="enviado_cliente">Enviados ao cliente</option>
                  <option value="confirmado">Confirmados</option>
                  <option value="cancelado">Cancelados</option>
                </select>
              </div>

              {/* Lista de pedidos */}
              {pedidosError && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                  {pedidosError}
                </div>
              )}
              {pedidosLoading ? (
                <div className="py-10 text-center text-sm text-slate-500">A carregar pedidos...</div>
              ) : pedidos.filter((p) => {
                if (pedidoStatusFilter === "todos") return true;
                if (pedidoStatusFilter === "sem_assistente") return !p.assignedToId;
                return p.status === pedidoStatusFilter;
              }).length === 0 ? (
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
                        {["Nº", "Cliente", "Serviço", "Localidade", "Urgência", "Status", "Origem", "Assistente", "Data", "Ação"].map((h) => (
                          <th key={h} className="px-3 py-3 text-left text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500 first:pl-4 last:pr-4 last:text-right">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pedidos
                        .filter((p) => {
                          if (pedidoStatusFilter === "sem_assistente") return !p.assignedToId;
                          if (pedidoStatusFilter !== "todos") return p.status === pedidoStatusFilter;
                          return true;
                        })
                        .map((p) => {
                          const statusColors: Record<string, string> = {
                            sem_assistente: "bg-yellow-50 text-yellow-700 border-yellow-200",
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
                            sem_assistente: "Sem assistente",
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

                          let origemLabel = "Simulador";
                          let origemStyle = "bg-violet-50 text-violet-700 border-violet-200";
                          try {
                            const raw = p.rawOrderJson ? JSON.parse(p.rawOrderJson) : null;
                            const orig = raw?.origemPedido ?? null;
                            if (orig === "formulario_contactos") {
                              origemLabel = "Contactos";
                              origemStyle = "bg-cyan-50 text-cyan-700 border-cyan-200";
                            } else if (orig === "quero_contratar_header" || orig === "quero_contratar") {
                              origemLabel = "Contratar";
                              origemStyle = "bg-amber-50 text-amber-700 border-amber-200";
                            }
                          } catch { /* rawOrderJson inválido */ }

                          return (
                            <tr
                              key={p.id}
                              className="group cursor-pointer transition-colors hover:bg-slate-50"
                              onClick={() => { setSelectedPedido(p); setPedidoDetalheOpen(true); }}
                            >
                              {/* # */}
                              <td className="pl-4 pr-2 py-3.5">
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
                              {/* Assistente */}
                              <td className="px-2 py-3.5">
                                {p.assignedToName ? (
                                  <span className="text-xs font-medium text-slate-700">{p.assignedToName}</span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600">
                                    <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                                    Fila geral
                                  </span>
                                )}
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
                                          await carregarPedidos(token, pedidoStatusFilter, pedidoSearchDebounced);
                                        } catch { /* silent */ }
                                      }}
                                    >
                                      Arquivar
                                    </button>
                                  )}
                                  {isAdminGeral && (
                                    <button
                                      type="button"
                                      className="rounded-[8px] border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-100 transition"
                                      onClick={(e) => { e.stopPropagation(); setSelectedPedido(p); setPedidoDetalheOpen(true); }}
                                    >
                                      Cancelar
                                    </button>
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

          {/* Modal de confirmação de aceitar pedido (assistente) */}
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
                          await carregarPedidos(token, pedidoStatusFilter, pedidoSearchDebounced);
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
              colabFuncao={colabFuncao}
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


          {(activeSection === "operacao" || activeSection === "equipa" || activeSection === "pagamentos") && (
            <section className="space-y-4 rounded-[28px] border border-slate-700/60 bg-slate-900/80 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.28)]">
              {/* Header e sub-navegação da Operação */}
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-400">
                    {operacaoTab === "equipa" || operacaoTab === "pagamentos" ? sectionLabels[activeSection] || "Operação" : "Operação"}
                  </p>
                  <h2 className="mt-1 text-2xl font-semibold text-white">
                    {operacaoTab === "equipa" ? "Equipa" : operacaoTab === "horarios" ? "Horários e registos" : operacaoTab === "pagamentos" ? "Pagamentos" : "Funções"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    {operacaoTab === "equipa" ? "Gestão de colaboradores: assistentes, motoristas e ajudantes." : operacaoTab === "horarios" ? "Valide entradas, saídas, pausas e valores da equipa." : operacaoTab === "pagamentos" ? "Ganhos fixos por trabalho atribuído no período seleccionado." : "Funções e valores padrão por tipo de colaborador."}
                  </p>
                </div>
                {/* Sub-tabs */}
                <div className="flex flex-wrap gap-2 border-b border-slate-700/50 pb-3">
                  {(["equipa", "horarios", "pagamentos", "funcoes"] as OperacaoTab[]).map((tab) => {
                    const labels: Record<OperacaoTab, string> = { equipa: "Equipa", horarios: "Horários", pagamentos: "Pagamentos", funcoes: "Funções" };
                    return (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => {
                          setOperacaoTab(tab);
                          // Reflectir na nav de topo: equipa e pagamentos têm item próprio
                          if (tab === "equipa") setActiveSection("equipa");
                          else if (tab === "pagamentos") setActiveSection("pagamentos");
                          else setActiveSection("operacao");
                        }}
                        className={`rounded-[10px] px-4 py-2 text-sm font-medium transition ${
                          operacaoTab === tab
                            ? "bg-sky-500 text-white shadow-sm"
                            : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                        }`}
                      >
                        {labels[tab]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sub-aba Horários */}
              {operacaoTab === "horarios" && (
              <div>
              <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-400 hidden">
                    Gestão operacional
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setWeekOffset((v) => v - 1)}
                    className="h-11 rounded-2xl border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.08]"
                  >
                    Semana anterior
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setWeekOffset(0)}
                    className={`h-11 rounded-2xl px-5 ${
                      weekOffset === 0
                        ? "bg-cyan-400 text-slate-950 hover:bg-cyan-300"
                        : "border border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.08]"
                    }`}
                  >
                    Semana atual
                  </Button>
                </div>
              </div>

              {/* Filtros */}
              <div className="flex flex-col gap-3 rounded-[20px] border border-white/10 bg-white/[0.02] p-4 lg:flex-row lg:flex-wrap lg:items-center">
                <div className="flex flex-wrap gap-2">
                  <FilterPill
                    active={filtroColaborador === "todos"}
                    onClick={() => setFiltroColaborador("todos")}
                    label="Toda a equipa"
                  />
                  {collaboratorHoursFilters.map((colaborador) => (
                    <FilterPill
                      key={colaborador.id}
                      active={filtroColaborador === String(colaborador.id)}
                      onClick={() => setFiltroColaborador(String(colaborador.id))}
                      label={colaborador.nome}
                    />
                  ))}
                </div>
                <span className="hidden h-6 w-px bg-white/10 lg:block" />
                <div className="flex flex-wrap gap-2">
                  {(["todas", "motorista", "ajudante", "admin"] as const).map((funcao) => (
                    <button
                      key={funcao}
                      type="button"
                      onClick={() => setHoursFuncao(funcao)}
                      className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold capitalize transition ${
                        hoursFuncao === funcao
                          ? "border-cyan-300 bg-cyan-400 text-slate-950"
                          : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.07]"
                      }`}
                    >
                      {funcao === "todas" ? "Todas" : formatRoleLabel(funcao)}
                    </button>
                  ))}
                </div>
                <span className="hidden h-6 w-px bg-white/10 lg:block" />
                <div className="flex flex-wrap gap-2">
                  {(["todos", "validado", "pendente", "incompleto"] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setHoursStatus(status)}
                      className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold capitalize transition ${
                        hoursStatus === status
                          ? "border-cyan-300 bg-cyan-400 text-slate-950"
                          : "border-white/10 bg-white/[0.03] text-slate-300 hover:bg-white/[0.07]"
                      }`}
                    >
                      {status === "todos" ? "Todos" : status}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cards de resumo */}
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
                <SummaryStat icon={Users} label="Com registo" value={String(hoursSummary.colaboradoresComRegisto)} helper="Colaboradores" tone="cyan" />
                <SummaryStat icon={TimerReset} label="Horas" value={`${decimal(hoursSummary.totalHoras)}h`} helper="No filtro atual" tone="slate" />
                <SummaryStat icon={Wallet} label="A pagar" value={money(hoursSummary.totalValor)} helper="Estimado" tone="emerald" />
                <SummaryStat icon={AlertTriangle} label="Pendentes" value={String(hoursSummary.pendentes)} helper="Por validar" tone="amber" />
                <SummaryStat icon={Clock3} label="Incompletos" value={String(hoursSummary.incompletos)} helper="Sem saída" tone="amber" />
                <SummaryStat icon={CalendarDays} label="Média" value={`${decimal(hoursSummary.mediaHoras)}h`} helper="Por colaborador" tone="slate" />
              </div>

              {/* Painel de edição de registo */}
              {editandoRegistroId !== null && (
                <Card className="rounded-[24px] border-cyan-300/20 bg-[linear-gradient(180deg,rgba(12,34,52,0.96)_0%,rgba(9,27,43,0.94)_100%)] text-white">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xl text-white">Corrigir registo</CardTitle>
                    <CardDescription className="text-slate-400">
                      As horas e valores são recalculados pelo sistema com base nos horários introduzidos.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <Field label="Data">
                      <input
                        type="date"
                        value={registroForm.data}
                        onChange={(event) => setRegistroForm((state) => ({ ...state, data: event.target.value }))}
                        className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-white outline-none transition focus:border-cyan-300"
                      />
                    </Field>
                    <Field label="Hora entrada">
                      <input
                        type="time"
                        value={registroForm.horaEntrada}
                        onChange={(event) => setRegistroForm((state) => ({ ...state, horaEntrada: event.target.value }))}
                        className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-white outline-none transition focus:border-cyan-300"
                      />
                    </Field>
                    <Field label="Pausa">
                      <input
                        type="time"
                        value={registroForm.horaPausa}
                        onChange={(event) => setRegistroForm((state) => ({ ...state, horaPausa: event.target.value }))}
                        className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-white outline-none transition focus:border-cyan-300"
                      />
                    </Field>
                    <Field label="Hora saída">
                      <input
                        type="time"
                        value={registroForm.horaSaida}
                        onChange={(event) => setRegistroForm((state) => ({ ...state, horaSaida: event.target.value }))}
                        className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-white outline-none transition focus:border-cyan-300"
                      />
                    </Field>
                    <Field label="Número de trabalhos">
                      <input
                        type="number"
                        min="0"
                        value={registroForm.numeroTrabalhos}
                        onChange={(event) => setRegistroForm((state) => ({ ...state, numeroTrabalhos: event.target.value }))}
                        className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-white outline-none transition focus:border-cyan-300"
                      />
                    </Field>
                    <Field label="Valor/hora">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={registroForm.valorHora}
                        onChange={(event) => setRegistroForm((state) => ({ ...state, valorHora: event.target.value }))}
                        className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-white outline-none transition focus:border-cyan-300"
                      />
                    </Field>
                    <Field label="Valor final">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={registroForm.valorTotal}
                        onChange={(event) => setRegistroForm((state) => ({ ...state, valorTotal: event.target.value }))}
                        className="h-11 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-white outline-none transition focus:border-cyan-300"
                      />
                    </Field>
                    <div className="flex flex-wrap items-end justify-end gap-3 md:col-span-2 xl:col-span-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setEditandoRegistroId(null)}
                        className="h-11 rounded-2xl border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.08]"
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        disabled={savingRegistro}
                        onClick={() => editandoRegistroId !== null && guardarRegistro(editandoRegistroId)}
                        className="h-11 rounded-2xl bg-cyan-400 px-5 text-slate-950 hover:bg-cyan-300"
                      >
                        {savingRegistro ? "A guardar..." : "Guardar registo"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Tabela de registos */}
              <div className="overflow-x-auto rounded-[20px] border border-white/10">
                <table className="w-full min-w-[880px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.03] text-left text-[11px] uppercase tracking-wide text-slate-400">
                      <th className="px-4 py-3 font-semibold">Data</th>
                      <th className="px-4 py-3 font-semibold">Colaborador</th>
                      <th className="px-4 py-3 font-semibold">Função</th>
                      <th className="px-4 py-3 font-semibold">Entrada</th>
                      <th className="px-4 py-3 font-semibold">Pausa</th>
                      <th className="px-4 py-3 font-semibold">Saída</th>
                      <th className="px-4 py-3 font-semibold">Horas</th>
                      <th className="px-4 py-3 font-semibold">Valor</th>
                      <th className="px-4 py-3 font-semibold">Estado</th>
                      <th className="px-4 py-3 text-right font-semibold">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hoursRecords.length === 0 && (
                      <tr>
                        <td colSpan={10} className="px-4 py-10 text-center text-slate-400">
                          Ainda não existem registos para os filtros escolhidos.
                        </td>
                      </tr>
                    )}
                    {hoursRecords.map((registro) => (
                      <tr key={registro.id} className="border-b border-white/5 transition hover:bg-white/[0.03]">
                        <td className="px-4 py-3 text-slate-300">{formatShortDate(registro.data)}</td>
                        <td className="px-4 py-3 font-semibold text-white">{registro.colaboradorNome}</td>
                        <td className="px-4 py-3 capitalize text-slate-400">{formatRoleLabel(registro.funcao)}</td>
                        <td className="px-4 py-3 text-slate-300">{registro.horaEntrada || "—"}</td>
                        <td className="px-4 py-3 text-slate-300">{registro.horaPausa || "—"}</td>
                        <td className="px-4 py-3 text-slate-300">{registro.horaSaida || "—"}</td>
                        <td className="px-4 py-3 font-semibold text-white">{decimal(parseFloat(registro.horasTrabalhadas || "0"))}h</td>
                        <td className="px-4 py-3 font-semibold text-cyan-200">{money(parseFloat(registro.valorTotal || "0"))}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={registro.statusLabel} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setColaboradorDrawerId(registro.colaboradorId)}
                              title="Ver histórico"
                              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-200 transition hover:bg-white/[0.08]"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => abrirEdicaoRegistro(registro)}
                              title="Corrigir"
                              className="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-400/[0.1] text-cyan-100 transition hover:bg-cyan-400/[0.2]"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => apagarRegistro(registro.id)}
                              title="Excluir"
                              className="flex h-9 w-9 items-center justify-center rounded-xl border border-rose-300/20 bg-rose-400/[0.08] text-rose-100 transition hover:bg-rose-400/[0.16]"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Resumo por colaborador */}
              <Card className="rounded-[24px] border-cyan-300/14 bg-[linear-gradient(180deg,rgba(12,34,52,0.96)_0%,rgba(9,27,43,0.94)_100%)] text-white">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-white">
                    <ReceiptText className="h-5 w-5 text-cyan-300" />
                    Resumo por colaborador
                  </CardTitle>
                  <CardDescription className="text-slate-400">
                    Total semanal e mensal por colaborador. A semana fecha de segunda a domingo.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-[16px] border border-white/10">
                    <table className="w-full min-w-[640px] border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-white/10 bg-white/[0.03] text-left text-[11px] uppercase tracking-wide text-slate-400">
                          <th className="px-4 py-3 font-semibold">Colaborador</th>
                          <th className="px-4 py-3 font-semibold">Horas semana</th>
                          <th className="px-4 py-3 font-semibold">Valor semana</th>
                          <th className="px-4 py-3 font-semibold">Horas mês</th>
                          <th className="px-4 py-3 font-semibold">Valor mês</th>
                          <th className="px-4 py-3 text-right font-semibold">Histórico</th>
                        </tr>
                      </thead>
                      <tbody>
                        {collaboratorHourReports.map((colaborador) => (
                          <tr key={colaborador.id} className="border-b border-white/5 transition hover:bg-white/[0.03]">
                            <td className="px-4 py-3 font-semibold text-white">{colaborador.nome}</td>
                            <td className="px-4 py-3 text-white">{decimal(colaborador.relatorio.semana.horas)}h</td>
                            <td className="px-4 py-3 text-cyan-200">{money(colaborador.relatorio.semana.valor)}</td>
                            <td className="px-4 py-3 text-white">{decimal(colaborador.relatorio.mes.horas)}h</td>
                            <td className="px-4 py-3 font-semibold text-emerald-200">{money(colaborador.relatorio.mes.valor)}</td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => setColaboradorDrawerId(colaborador.id)}
                                className="rounded-[10px] border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-cyan-100 transition hover:bg-white/[0.08]"
                              >
                                Ver semana
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
              </div>
              )}

              {/* Sub-aba Equipa */}
              {operacaoTab === "equipa" && (
              <div className="space-y-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
                <div />
                <Button
                  type="button"
                  onClick={() => setCriarNovoVisivel((state) => !state)}
                  className="h-11 rounded-[14px] bg-sky-500 px-5 text-white hover:bg-sky-400"
                >
                  {criarNovoVisivel ? <X className="mr-2 h-4 w-4" /> : <UserPlus className="mr-2 h-4 w-4" />}
                  {criarNovoVisivel ? "Fechar criação" : "Novo colaborador"}
                </Button>
              </div>

              {criarNovoVisivel && (
                <Card className="rounded-[24px] border-slate-700/60 bg-slate-900/90 text-white shadow-lg">
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl font-semibold text-white">Novo colaborador</CardTitle>
                    <CardDescription className="text-slate-400">
                      Os campos exibidos adaptam-se automaticamente à função seleccionada.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {/* Função — primeiro para adaptar os outros campos */}
                    <div>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-slate-400">Função</p>
                      <div className="flex flex-wrap gap-2">
                        {(["assistente", "motorista", "ajudante", "admin"] as Array<Colaborador["funcao"]>).map((funcao) => {
                          const descricoes: Record<Colaborador["funcao"], string> = {
                            assistente: "Recebe pedidos do simulador, pagamento fixo por trabalho atribuído",
                            motorista: "Operação, horários, valor por hora ou diária",
                            ajudante: "Operação, horários, valor por hora ou diária",
                            admin: "Acesso total ao backoffice",
                          };
                          return (
                            <button
                              key={funcao}
                              type="button"
                              onClick={() => setNovoFuncao(funcao)}
                              title={descricoes[funcao]}
                              className={`rounded-[12px] border px-4 py-2.5 text-sm font-medium transition ${
                                novoFuncao === funcao
                                  ? "border-sky-500 bg-sky-500/20 text-sky-300"
                                  : "border-slate-700 bg-slate-800/60 text-slate-400 hover:border-slate-600 hover:text-slate-200"
                              }`}
                            >
                              {formatRoleLabel(funcao)}
                            </button>
                          );
                        })}
                      </div>
                      <p className="mt-2 text-xs text-slate-500">
                        {novoFuncao === "assistente" && "Assistentes recebem pedidos do simulador. O pagamento é fixo por trabalho atribuído (configurável em Definições)."}
                        {novoFuncao === "motorista" && "Motoristas participam na operação e podem receber por hora ou diária."}
                        {novoFuncao === "ajudante" && "Ajudantes participam na operação e podem receber por hora ou diária."}
                        {novoFuncao === "admin" && "Administradores têm acesso total ao backoffice."}
                      </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Nome">
                        <input
                          value={novoNome}
                          onChange={(event) => setNovoNome(event.target.value)}
                          className="h-11 w-full rounded-[12px] border border-slate-700 bg-slate-800/60 px-4 text-white outline-none transition focus:border-sky-500 placeholder:text-slate-500"
                          placeholder="Ex.: MIRIAM"
                        />
                      </Field>
                      <Field label="Palavra-passe inicial">
                        <div className="relative">
                          <input
                            // type="text" — o utilizador é o admin a criar conta de outra pessoa,
                            // não é a login do próprio, pelo que não deve ser um password input.
                            // Isto evita que o Chrome dispare o aviso de vazamento de senha (HIBP).
                            type={mostrarSenhaNovoUsuario ? "text" : "password"}
                            value={novoSenha}
                            onChange={(event) => setNovoSenha(event.target.value)}
                            // Impede Chrome de tratar como campo de login e verificar contra HIBP
                            autoComplete="off"
                            name="clyon-new-user-password"
                            data-lpignore="true"
                            data-form-type="other"
                            className="h-11 w-full rounded-[12px] border border-slate-700 bg-slate-800/60 px-4 pr-24 text-white outline-none transition focus:border-sky-500 placeholder:text-slate-500 font-mono"
                            placeholder="Palavra-passe inicial"
                          />
                          <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                // Gerar senha forte: 14 chars, minúsculas + maiúsculas + números,
                                // sem símbolos ambíguos que dão problemas em partilha por telefone.
                                const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
                                let pwd = "";
                                const arr = new Uint32Array(14);
                                crypto.getRandomValues(arr);
                                for (const n of arr) pwd += chars[n % chars.length];
                                setNovoSenha(pwd);
                                setMostrarSenhaNovoUsuario(true);
                              }}
                              title="Gerar palavra-passe segura"
                              className="rounded-md border border-slate-600 bg-slate-700/60 px-2 py-1 text-[10px] font-semibold text-slate-200 hover:bg-slate-600 hover:text-white transition"
                            >
                              Gerar
                            </button>
                            <button
                              type="button"
                              onClick={() => setMostrarSenhaNovoUsuario((s) => !s)}
                              className="text-slate-400 hover:text-white p-1"
                              aria-label={mostrarSenhaNovoUsuario ? "Esconder" : "Mostrar"}
                            >
                              {mostrarSenhaNovoUsuario ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                        <p className="mt-1 text-[10px] text-slate-400">
                          Use <strong>Gerar</strong> para criar uma senha forte. Envie-a ao colaborador por canal seguro — ele muda depois no primeiro login.
                        </p>
                      </Field>
                    </div>

                    {/* Campos condicionais por função */}
                    {(novoFuncao === "motorista" || novoFuncao === "ajudante") && (
                      <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Valor por hora (€)">
                          <input
                            type="number" step="0.01" min="0"
                            value={novoValorHora}
                            onChange={(e) => setNovoValorHora(e.target.value)}
                            className="h-11 w-full rounded-[12px] border border-slate-700 bg-slate-800/60 px-4 text-white outline-none transition focus:border-sky-500 placeholder:text-slate-500"
                            placeholder="Ex.: 8.50"
                          />
                        </Field>
                        <Field label="Valor por diária (€) — opcional">
                          <input
                            type="number" step="0.01" min="0"
                            value={novoValorDiaria}
                            onChange={(e) => setNovoValorDiaria(e.target.value)}
                            className="h-11 w-full rounded-[12px] border border-slate-700 bg-slate-800/60 px-4 text-white outline-none transition focus:border-sky-500 placeholder:text-slate-500"
                            placeholder="Ex.: 60.00"
                          />
                        </Field>
                      </div>
                    )}

                    {novoFuncao === "assistente" && (
                      <div className="rounded-[16px] border border-sky-500/20 bg-sky-500/5 p-4">
                        <p className="text-xs font-semibold uppercase tracking-widest text-sky-400 mb-2">Modelo de pagamento</p>
                        <p className="text-sm text-slate-400">
                          Pagamento fixo por trabalho atribuído. O valor por trabalho é configurável globalmente em{" "}
                          <span className="font-semibold text-sky-300">Definições → Pagamento assistente por trabalho</span>.
                        </p>
                      </div>
                    )}

                    {novoFuncao === "admin" && (
                      <div className="rounded-[16px] border border-slate-700/50 bg-slate-800/30 p-4">
                        <button
                          type="button"
                          onClick={() => setNovoIsAdmin((s) => !s)}
                          className={`flex items-center gap-3 text-sm transition ${novoIsAdmin ? "text-sky-300" : "text-slate-400 hover:text-slate-200"}`}
                        >
                          <div className={`h-5 w-5 rounded border-2 flex items-center justify-center ${novoIsAdmin ? "border-sky-400 bg-sky-400" : "border-slate-600"}`}>
                            {novoIsAdmin && <span className="text-xs font-bold text-slate-900">✓</span>}
                          </div>
                          Dar acesso total de administrador a este utilizador
                        </button>
                      </div>
                    )}

                    <div className="flex justify-end gap-3 pt-2">
                      <Button type="button" variant="outline" onClick={() => setCriarNovoVisivel(false)}
                        className="h-10 rounded-[12px] border-slate-700 bg-transparent px-5 text-slate-300 hover:bg-slate-800">
                        Cancelar
                      </Button>
                      <Button type="button" disabled={loadingCriar} onClick={criarNovoColaborador}
                        className="h-10 rounded-[12px] bg-sky-500 px-6 text-white hover:bg-sky-400">
                        {loadingCriar ? "A criar..." : "Criar colaborador"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Cards de resumo da equipa */}
              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
                <SummaryStat icon={Users} label="Colaboradores" value={String(teamStats.total)} helper="no total" />
                <SummaryStat icon={CheckCircle2} label="Ativos" value={String(teamStats.ativos)} helper="trabalharam esta semana" tone="emerald" />
                <SummaryStat icon={TimerReset} label="Inativos" value={String(teamStats.inativos)} helper="sem registo esta semana" tone="amber" />
                <SummaryStat icon={Briefcase} label="Motoristas" value={String(teamStats.motoristas)} helper="na equipa" />
                <SummaryStat icon={Users} label="Ajudantes" value={String(teamStats.ajudantes)} helper="na equipa" />
                <SummaryStat icon={ShieldCheck} label="Administradores" value={String(teamStats.admins)} helper="com acesso total" tone="cyan" />
              </div>

              {/* Filtros */}
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={teamSearch}
                  onChange={(event) => setTeamSearch(event.target.value)}
                  placeholder="Pesquisar colaborador..."
                  className="h-11 min-w-[200px] flex-1 rounded-[14px] border border-white/10 bg-white/[0.04] px-4 text-sm text-white outline-none transition focus:border-cyan-300"
                />
                <select
                  value={teamFuncao}
                  onChange={(event) => setTeamFuncao(event.target.value as typeof teamFuncao)}
                  className="h-11 rounded-[14px] border border-cyan-300/20 bg-[#0d1f35] px-3 text-sm font-medium text-white outline-none focus:border-cyan-400 [color-scheme:dark]"
                >
                  <option value="todas">Todas as funções</option>
                  <option value="admin">Administradores</option>
                  <option value="assistente">Assistentes</option>
                  <option value="motorista">Motoristas</option>
                  <option value="ajudante">Ajudantes</option>
                </select>
                <select
                  value={teamStatus}
                  onChange={(event) => setTeamStatus(event.target.value as typeof teamStatus)}
                  className="h-11 rounded-[14px] border border-cyan-300/20 bg-[#0d1f35] px-3 text-sm font-medium text-white outline-none focus:border-cyan-400 [color-scheme:dark]"
                >
                  <option value="todos">Todos os estados</option>
                  <option value="ativo">Trabalhou esta semana</option>
                  <option value="inativo">Sem atividade esta semana</option>
                </select>
              </div>

              {/* Formulário de edição (aparece ao editar) */}
              {editandoId !== null && (
                <Card className="rounded-[24px] border-cyan-300/20 bg-[linear-gradient(180deg,rgba(12,34,52,0.96)_0%,rgba(9,27,43,0.94)_100%)] text-white">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-xl text-white">Editar colaborador</CardTitle>
                    <CardDescription className="text-slate-400">
                      A editar {colaboradores.find((c) => c.id === editandoId)?.nome}.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-4 md:grid-cols-2">
                    <Field label="Nome">
                      <input
                        value={editNome}
                        onChange={(event) => setEditNome(event.target.value)}
                        className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-white outline-none transition focus:border-cyan-300"
                      />
                    </Field>
                    <Field label="Valor por hora">
                      <input
                        type="number"
                        step="0.01"
                        value={editValorHora}
                        onChange={(event) => setEditValorHora(event.target.value)}
                        className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 text-white outline-none transition focus:border-cyan-300"
                      />
                    </Field>
                    <Field label="Função">
                      <div className="grid gap-2 sm:grid-cols-3">
                        {functionOptions.map((funcao) => (
                          <button
                            key={funcao}
                            type="button"
                            onClick={() => setEditFuncao(funcao)}
                            className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                              editFuncao === funcao
                                ? "border-cyan-300 bg-cyan-400 text-slate-950"
                                : "border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.06]"
                            }`}
                          >
                            {formatRoleLabel(funcao)}
                          </button>
                        ))}
                      </div>
                    </Field>
                    <Field label="Nova palavra-passe (opcional)">
                      <div className="relative">
                        <input
                          type={mostrarSenha ? "text" : "password"}
                          value={editSenha}
                          onChange={(event) => setEditSenha(event.target.value)}
                          className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 pr-12 text-white outline-none transition focus:border-cyan-300"
                          placeholder="Deixe vazio para manter"
                        />
                        <button
                          type="button"
                          onClick={() => setMostrarSenha((state) => !state)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-white"
                        >
                          {mostrarSenha ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </Field>
                    <div className="flex items-end justify-end gap-3 md:col-span-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setEditandoId(null)}
                        className="h-12 rounded-2xl border-white/10 bg-white/[0.03] text-white hover:bg-white/[0.08]"
                      >
                        Cancelar
                      </Button>
                      <Button
                        type="button"
                        disabled={loadingEdicao}
                        onClick={() => editarUsuario(editandoId)}
                        className="h-12 rounded-2xl bg-cyan-400 px-6 text-slate-950 hover:bg-cyan-300"
                      >
                        {loadingEdicao ? "A guardar..." : "Guardar alterações"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Tabela compacta de colaboradores */}
              <div className="overflow-x-auto rounded-[20px] border border-white/10 bg-white/[0.02]">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-400">
                      <th className="px-3 py-3 font-medium">Nome</th>
                      <th className="px-3 py-3 font-medium">Função</th>
                      <th className="px-3 py-3 font-medium">Estado</th>
                      <th className="px-3 py-3 font-medium">Valor/hora</th>
                      <th className="px-3 py-3 font-medium">Horas semana</th>
                      <th className="px-3 py-3 font-medium">Horas 30 dias</th>
                      <th className="px-3 py-3 font-medium">Valor mês</th>
                      <th className="px-3 py-3 font-medium">Último registo</th>
                      <th className="px-3 py-3 text-right font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamRowsFiltered.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-3 py-8 text-center text-slate-400">
                          Nenhum colaborador corresponde aos filtros.
                        </td>
                      </tr>
                    ) : (
                      teamRowsFiltered.map((row) => (
                        <tr key={row.id} className="border-t border-white/10 text-slate-200">
                          <td className="px-3 py-3">
                            <button
                              type="button"
                              onClick={() => setColaboradorDrawerId(row.id)}
                              className="flex items-center gap-2 text-left font-medium text-white transition hover:text-cyan-200"
                            >
                              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-cyan-400 text-xs font-semibold text-slate-950">
                                {getInitials(row.nome)}
                              </span>
                              {row.nome}
                            </button>
                          </td>
                          <td className="px-3 py-3 capitalize">
                            {formatRoleLabel(row.funcao)}
                            {row.isAdmin === 1 && (
                              <span className="ml-2 rounded-full border border-cyan-300/30 bg-cyan-400/[0.14] px-2 py-0.5 text-[10px] text-cyan-100">
                                Admin
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <StatusBadge status={row.ativoHoje ? "ativo" : row.estadoAtividade === "ativo" ? "validado" : "inativo"} />
                          </td>
                          <td className="px-3 py-3 font-medium text-white">{row.funcao === "assistente" ? <span className="text-slate-500">—</span> : money(parseFloat(row.valorHora || "0"))}</td>
                          <td className="px-3 py-3">{decimal(row.horasSemana)}h</td>
                          <td className="px-3 py-3">{decimal(row.horas30)}h</td>
                          <td className="px-3 py-3 font-medium text-cyan-200">{money(row.valorMes)}</td>
                          <td className="px-3 py-3">{row.ultimoRegistro ? formatShortDate(row.ultimoRegistro.data) : "—"}</td>
                          <td className="px-3 py-3">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => setColaboradorDrawerId(row.id)}
                                title="Ver histórico"
                                className="rounded-[10px] border border-white/10 bg-white/[0.04] p-2 text-cyan-100 transition hover:bg-white/[0.08]"
                              >
                                <History className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => abrirEdicao(row)}
                                title="Editar"
                                className="rounded-[10px] border border-white/10 bg-white/[0.04] p-2 text-white transition hover:bg-white/[0.08]"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deletarUsuario(row.id, row.nome)}
                                title="Remover"
                                className="rounded-[10px] border border-rose-300/20 bg-rose-400/[0.08] p-2 text-rose-100 transition hover:bg-rose-400/[0.14]"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              </div>
              )}

              {/* Sub-aba Pagamentos */}
              {operacaoTab === "pagamentos" && (
                <PagamentosPanel authHeader={token ? { Authorization: `Bearer ${token}` } : {}} />
              )}

              {/* Sub-aba Funções */}
              {operacaoTab === "funcoes" && (
              <div className="rounded-[18px] border border-slate-700/50 bg-slate-800/40 p-6 text-center">
                <Settings2 className="mx-auto mb-3 h-10 w-10 text-slate-500" />
                <p className="text-base font-semibold text-slate-300">Funções — em construção</p>
                <p className="mt-1 text-sm text-slate-500">Esta área permitirá definir valores padrão por tipo de função.</p>
              </div>
              )}

            </section>
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

              {/* Cards de eventos */}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {[
                  { label: "WhatsApp", hoje: eventTotals.whatsappHoje ?? 0, semana: eventTotals.whatsappSemana ?? 0, icon: MessageCircle },
                  { label: "Ligar", hoje: eventTotals.ligarHoje ?? 0, semana: eventTotals.ligarSemana ?? 0, icon: Phone },
                  { label: "CTA", hoje: eventTotals.ctaHoje ?? 0, semana: eventTotals.ctaSemana ?? 0, icon: MousePointerClick },
                  { label: "Forms", hoje: eventTotals.formHoje ?? 0, semana: eventTotals.formSemana ?? 0, icon: ReceiptText },
                  { label: "Email", hoje: eventTotals.emailHoje ?? 0, semana: eventTotals.emailSemana ?? 0, icon: Mail },
                  { label: "Simulador", hoje: eventTotals.simuladorHoje ?? 0, semana: eventTotals.simuladorSemana ?? 0, icon: Sparkles },
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
                                    {lead.origem
                                      ? lead.origem.replace(/_/g, " ")
                                      : lead.pagePath || "—"}
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

          {activeSection === "contas" && (
            <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
              <ContasPanel authToken={token} />
            </section>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}

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
                  onClick={() => router.push("/colaboradores/admin/imagens")}
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

              {/* Aba: Funções e colaboradores */}
              {settingsTab === "funcoes" && (
                <ActionCard
                  title="Funções e colaboradores"
                  description="Defina quais as funções disponíveis e consulte os colaboradores por função. A criação e edição de colaboradores está disponível na página Equipa."
                >
                  <div className="space-y-4">
                    <div className="rounded-[20px] border border-white/10 bg-white/[0.03] p-5">
                      <h3 className="mb-4 text-base font-semibold text-white">Funções disponíveis no sistema</h3>
                      <div className="grid gap-3 sm:grid-cols-3">
                        {functionOptions.map((funcao) => {
                          const count = colaboradores.filter((c) => c.funcao === funcao).length;
                          return (
                            <div key={funcao} className="rounded-[16px] border border-white/10 bg-white/[0.04] px-4 py-4">
                              <p className="text-sm font-semibold capitalize text-white">{formatRoleLabel(funcao)}</p>
                              <p className="mt-1 text-2xl font-semibold text-cyan-200">{count}</p>
                              <p className="mt-0.5 text-xs text-slate-400">
                                {count === 1 ? "colaborador" : "colaboradores"}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="rounded-[16px] border border-cyan-300/20 bg-cyan-400/[0.06] px-4 py-3 text-sm text-cyan-100">
                      Para adicionar, editar ou remover colaboradores, vá à página <strong>Equipa</strong>. Para alterar permissões de administrador, edite o colaborador diretamente.
                    </div>
                    <div className="overflow-x-auto rounded-[20px] border border-white/10">
                      <table className="w-full min-w-[500px] border-collapse text-sm">
                        <thead>
                          <tr className="border-b border-white/10 bg-white/[0.03] text-left text-[11px] uppercase tracking-wide text-slate-400">
                            <th className="px-4 py-3 font-semibold">Nome</th>
                            <th className="px-4 py-3 font-semibold">Função</th>
                            <th className="px-4 py-3 font-semibold">Acesso</th>
                            <th className="px-4 py-3 font-semibold">Valor/hora</th>
                          </tr>
                        </thead>
                        <tbody>
                          {colaboradores
                            .slice()
                            .sort((a, b) => a.nome.localeCompare(b.nome))
                            .map((colaborador) => (
                              <tr key={colaborador.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                                <td className="px-4 py-3 font-semibold text-white">{colaborador.nome}</td>
                                <td className="px-4 py-3 capitalize text-slate-300">{formatRoleLabel(colaborador.funcao)}</td>
                                <td className="px-4 py-3">
                                  {colaborador.isAdmin === 1 ? (
                                    <span className="rounded-full border border-cyan-300/30 bg-cyan-400/[0.14] px-2.5 py-1 text-[11px] font-semibold text-cyan-100">
                                      Administrador
                                    </span>
                                  ) : (
                                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] text-slate-400">
                                      Colaborador
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-white">{colaborador.funcao === "assistente" ? <span className="text-slate-500">—</span> : money(parseFloat(colaborador.valorHora || "0"))}</td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Billing — gestão de custos por pedido aceite */}
                    {adminBilling.length > 0 && (
                      <div className="rounded-[20px] border border-amber-400/20 bg-amber-400/[0.04] p-5 space-y-4">
                        <h3 className="text-base font-semibold text-amber-200">Faturação de assistentes</h3>
                        <p className="text-xs text-slate-400">Valor por pedido aceite e pagamentos registados. O saldo acumula até que registe um pagamento.</p>
                        <div className="overflow-x-auto">
                          <table className="w-full min-w-[600px] border-collapse text-sm">
                            <thead>
                              <tr className="border-b border-white/10 text-left text-[11px] uppercase tracking-wide text-slate-400">
                                <th className="px-3 py-2 font-semibold">Assistente</th>
                                <th className="px-3 py-2 font-semibold">Aceites</th>
                                <th className="px-3 py-2 font-semibold">€/pedido</th>
                                <th className="px-3 py-2 font-semibold">Total</th>
                                <th className="px-3 py-2 font-semibold">Pago</th>
                                <th className="px-3 py-2 font-semibold">Saldo</th>
                                <th className="px-3 py-2 font-semibold">Registar pagamento</th>
                              </tr>
                            </thead>
                            <tbody>
                              {adminBilling.map((a) => {
                                const cost = parseFloat(a.costPerAcceptedOrder ?? "6");
                                const paid = parseFloat(a.totalPaid ?? "0");
                                const total = a.acceptedCount * cost;
                                const balance = total - paid;
                                return (
                                  <tr key={a.id} className="border-b border-white/5">
                                    <td className="px-3 py-2 font-semibold text-white">{a.nome}</td>
                                    <td className="px-3 py-2 text-white">{a.acceptedCount}</td>
                                    <td className="px-3 py-2">
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className="w-20 rounded-lg border border-white/10 bg-white/[0.05] px-2 py-1 text-sm text-white"
                                        value={billingCostEdits[a.id] ?? cost.toFixed(2)}
                                        onChange={(e) => setBillingCostEdits((prev) => ({ ...prev, [a.id]: e.target.value }))}
                                        onBlur={async () => {
                                          const newCost = billingCostEdits[a.id];
                                          if (newCost === undefined || parseFloat(newCost) === cost) return;
                                          await fetch("/api/admin/billing", {
                                            method: "PATCH",
                                            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                                            body: JSON.stringify({ assistantId: a.id, costPerAcceptedOrder: parseFloat(newCost) }),
                                          });
                                          carregarBilling(token);
                                        }}
                                      />
                                    </td>
                                    <td className="px-3 py-2 font-semibold text-amber-300">{total.toFixed(2)} €</td>
                                    <td className="px-3 py-2 text-emerald-400">{paid.toFixed(2)} €</td>
                                    <td className={`px-3 py-2 font-bold ${balance > 0 ? "text-red-400" : "text-emerald-400"}`}>{balance.toFixed(2)} €</td>
                                    <td className="px-3 py-2">
                                      <div className="flex items-center gap-1">
                                        <input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          placeholder="€"
                                          className="w-20 rounded-lg border border-white/10 bg-white/[0.05] px-2 py-1 text-sm text-white placeholder:text-slate-500"
                                          value={billingPaymentAmounts[a.id] ?? ""}
                                          onChange={(e) => setBillingPaymentAmounts((prev) => ({ ...prev, [a.id]: e.target.value }))}
                                        />
                                        <button
                                          type="button"
                                          className="rounded-lg bg-emerald-500 px-2 py-1 text-xs font-bold text-white hover:bg-emerald-400 transition disabled:opacity-40"
                                          disabled={!billingPaymentAmounts[a.id] || parseFloat(billingPaymentAmounts[a.id]) <= 0}
                                          onClick={async () => {
                                            const amount = parseFloat(billingPaymentAmounts[a.id]);
                                            if (!amount || amount <= 0) return;
                                            await fetch("/api/admin/billing", {
                                              method: "PATCH",
                                              headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
                                              body: JSON.stringify({ assistantId: a.id, addPayment: amount }),
                                            });
                                            setBillingPaymentAmounts((prev) => ({ ...prev, [a.id]: "" }));
                                            carregarBilling(token);
                                          }}
                                        >
                                          Pagar
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </ActionCard>
              )}

              {/* Aba: Imagens do site */}
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
                      onClick={() => router.push("/colaboradores/admin/imagens")}
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
                  title="Segurança do portal"
                  description="Altere a palavra-passe da sua conta de administrador. Utilize uma palavra-passe forte com pelo menos 8 caracteres."
                >
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Nova palavra-passe">
                      <div className="relative">
                        <input
                          type={mostrarSenha ? "text" : "password"}
                          value={editSenha}
                          onChange={(event) => setEditSenha(event.target.value)}
                          placeholder="Mínimo 8 caracteres"
                          className="h-12 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 pr-12 text-white outline-none transition focus:border-cyan-300"
                        />
                        <button
                          type="button"
                          onClick={() => setMostrarSenha((s) => !s)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                        >
                          {mostrarSenha ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </button>
                      </div>
                    </Field>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        disabled={!editSenha || editSenha.length < 8 || loadingEdicao}
                        onClick={() => {
                          const adminColaborador = colaboradores.find((c) => c.isAdmin === 1 || c.funcao === "admin");
                          if (adminColaborador) editarUsuario(adminColaborador.id);
                        }}
                        className="h-12 w-full rounded-2xl bg-cyan-400 px-6 text-slate-950 hover:bg-cyan-300 disabled:opacity-50"
                      >
                        {loadingEdicao ? "A guardar..." : "Guardar palavra-passe"}
                      </Button>
                    </div>
                  </div>
                  <div className="rounded-[16px] border border-white/10 bg-white/[0.02] px-4 py-4 text-sm text-slate-400">
                    <p className="font-semibold text-slate-300">Boas práticas de segurança</p>
                    <ul className="mt-2 list-inside list-disc space-y-1">
                      <li>Use uma palavra-passe com pelo menos 8 caracteres, com letras, números e símbolos.</li>
                      <li>Não partilhe as credenciais de administrador com colaboradores sem permissão.</li>
                      <li>Termine sempre a sessão quando não estiver a usar o portal.</li>
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

      {/* Drawer lateral: histórico semanal do colaborador */}
      {drawerColaborador && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            aria-label="Fechar histórico"
            onClick={() => setColaboradorDrawerId(null)}
            className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
          />
          <aside className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-cyan-300/20 bg-[linear-gradient(180deg,rgba(9,27,43,0.99)_0%,rgba(7,20,33,0.99)_100%)] shadow-[-30px_0_80px_rgba(3,10,18,0.5)]">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-[rgba(9,27,43,0.96)] px-6 py-5 backdrop-blur">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">
                  Histórico semanal
                </p>
                <h3 className="mt-1 text-xl font-semibold text-white">{drawerColaborador.nome}</h3>
                <p className="mt-1 text-sm capitalize text-slate-400">
                  {formatRoleLabel(drawerColaborador.funcao)} • <span className="capitalize">{weekLabel}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setColaboradorDrawerId(null)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white transition hover:bg-white/[0.1]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-3 px-6 py-5">
              {drawerDias.map((dia) => {
                const trabalhou = dia.registros.length > 0;
                return (
                  <div
                    key={dia.label}
                    className={`rounded-[18px] border px-4 py-3 ${
                      trabalhou
                        ? "border-white/10 bg-white/[0.04]"
                        : "border-white/5 bg-white/[0.015]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-white">{dia.label}</span>
                        <span className="text-xs text-slate-500">{formatShortDate(dia.dia.toISOString())}</span>
                      </div>
                      {trabalhou ? (
                        <StatusBadge status={getRecordStatus(dia.registros[0]) === "validado" ? "validado" : getRecordStatus(dia.registros[0]) === "incompleto" ? "incompleto" : "pendente"} />
                      ) : (
                        <span className="text-xs font-medium text-slate-500">Sem registo</span>
                      )}
                    </div>

                    {trabalhou &&
                      dia.registros.map((r) => (
                        <div
                          key={r.id}
                          className="mt-3 grid grid-cols-2 gap-2 rounded-[14px] border border-white/10 bg-white/[0.03] px-3 py-2 text-sm sm:grid-cols-4"
                        >
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-slate-500">Entrada</p>
                            <p className="font-medium text-white">{r.horaEntrada || "—"}</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-slate-500">Sa��da</p>
                            <p className="font-medium text-white">{r.horaSaida || "—"}</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-slate-500">Horas</p>
                            <p className="font-medium text-white">{decimal(parseFloat(r.horasTrabalhadas || "0"))}h</p>
                          </div>
                          <div>
                            <p className="text-[11px] uppercase tracking-wide text-slate-500">Valor</p>
                            <p className="font-medium text-cyan-200">{money(parseFloat(r.valorTotal || "0"))}</p>
                          </div>
                        </div>
                      ))}
                  </div>
                );
              })}
            </div>

            <div className="sticky bottom-0 space-y-4 border-t border-white/10 bg-[rgba(9,27,43,0.96)] px-6 py-5 backdrop-blur">
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-[16px] border border-white/10 bg-white/[0.04] px-3 py-3 text-center">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Horas</p>
                  <p className="mt-1 text-lg font-semibold text-white">{decimal(drawerColaborador.horas)}h</p>
                </div>
                <div className="rounded-[16px] border border-white/10 bg-white/[0.04] px-3 py-3 text-center">
                  <p className="text-[11px] uppercase tracking-wide text-slate-500">Dias</p>
                  <p className="mt-1 text-lg font-semibold text-white">{drawerColaborador.diasTrabalhados}</p>
                </div>
                <div className="rounded-[16px] border border-emerald-300/20 bg-emerald-400/[0.08] px-3 py-3 text-center">
                  <p className="text-[11px] uppercase tracking-wide text-emerald-200/80">A pagar</p>
                  <p className="mt-1 text-lg font-semibold text-emerald-100">{money(drawerColaborador.valor)}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => {
                    setFiltroColaborador(String(drawerColaborador.id));
                    setColaboradorDrawerId(null);
                    setOperacaoTab("horarios");
                    setActiveSection("operacao");
                  }}
                  className="h-11 flex-1 rounded-[14px] bg-sky-500 text-white hover:bg-sky-400"
                >
                  <History className="mr-2 h-4 w-4" />
                  Ver histórico completo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setFiltroColaborador(String(drawerColaborador.id));
                    setColaboradorDrawerId(null);
                    setOperacaoTab("horarios");
                    setActiveSection("operacao");
                  }}
                  className="h-11 rounded-[14px] border-slate-700 bg-slate-800/60 px-4 text-slate-200 hover:bg-slate-700"
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Corrigir registo
                </Button>
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

function CellStat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-0.5 truncate text-sm font-semibold ${accent ? "text-cyan-200" : "text-white"}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: "ativo" | "inativo" | "pendente" | "validado" | "incompleto" }) {
  const config = {
    ativo: { label: "Ativo hoje", className: "border-emerald-300/30 bg-emerald-400/[0.12] text-emerald-100" },
    validado: { label: "Validado", className: "border-emerald-300/30 bg-emerald-400/[0.12] text-emerald-100" },
    pendente: { label: "Pendente", className: "border-amber-300/30 bg-amber-400/[0.12] text-amber-100" },
    incompleto: { label: "Incompleto", className: "border-rose-300/30 bg-rose-400/[0.12] text-rose-100" },
    inativo: { label: "Sem atividade hoje", className: "border-white/15 bg-white/[0.05] text-slate-300" },
  }[status];

  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${config.className}`}>
      {config.label}
    </span>
  );
}

function PendingRow({
  icon: Icon,
  tone,
  label,
  count,
  detail,
}: {
  icon: ComponentType<{ className?: string }>;
  tone: "rose" | "amber" | "cyan";
  label: string;
  count: number;
  detail: string[];
}) {
  const toneClass = {
    rose: "border-rose-300/25 bg-rose-400/[0.08] text-rose-100",
    amber: "border-amber-300/25 bg-amber-400/[0.08] text-amber-100",
    cyan: "border-cyan-300/25 bg-cyan-400/[0.08] text-cyan-100",
  }[tone];

  return (
    <div className={`rounded-[16px] border px-4 py-3 ${toneClass}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <span className="text-sm font-semibold text-white">{label}</span>
        </div>
        <span className="rounded-full bg-white/[0.08] px-2.5 py-0.5 text-xs font-semibold text-white">{count}</span>
      </div>
      {detail.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-slate-300">
          {detail.map((item, index) => (
            <li key={index} className="truncate">{item}</li>
          ))}
        </ul>
      )}
    </div>
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

function FilterPill({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
        active
          ? "border-cyan-300 bg-cyan-400 text-slate-950"
          : "border-cyan-300/14 bg-white/[0.04] text-white hover:bg-white/[0.08]"
      }`}
    >
      {label}
    </button>
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


