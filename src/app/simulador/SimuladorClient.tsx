"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  Check,
  CheckCircle2,
  ChevronDown,
  Image as ImageIcon,
  Loader2,
  LockKeyhole,
  MapPin,
  Package,
  Phone,
  Route,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Truck,
  UploadCloud,
  Wrench,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  trackSimulatorStart,
  trackSimulatorComplete,
  trackSimulatorWhatsApp,
} from "@/lib/analytics";
import { BASE_ADDRESS } from "@/lib/maps-config";
import { createSimulatorSettingsMap } from "@/lib/simulator-settings";
import { cn } from "@/lib/utils";

/* ─── tipos ─────────────────────────────────────────────── */
type CategoriaId = "moveis" | "monos" | "entulho" | "mudancas" | "limpeza";
type ModoCalculo = "entulho" | "moveis" | "mudancas";
type ModoTrajeto = "base" | "custom";

type Categoria = {
  id: CategoriaId;
  nome: string;
  descricao: string;
  icon: LucideIcon;
  calculo: ModoCalculo;
  trajeto: ModoTrajeto;
};

type ChoiceOption = { value: string; label: string };
type MapsPrediction = {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
};
type SettingsResponse = {
  settings?: Array<{ key: string; value: string | number }>;
};
type FieldTone = "default" | "next" | "warning" | "error";

/* ─── dados ──────────────────────────────────────────────── */
const categorias: Categoria[] = [
  { id: "moveis",   nome: "Recolha de móveis",   descricao: "Móveis antigos e recheios.",                        icon: Package, calculo: "moveis",   trajeto: "base" },
  { id: "monos",    nome: "Recolha de monos",    descricao: "Volumes grandes, sucata e despejos.",               icon: Package, calculo: "moveis",   trajeto: "base" },
  { id: "entulho",  nome: "Recolha de entulho",  descricao: "Obras, resíduos e limpezas pesadas.",               icon: Wrench,  calculo: "entulho",  trajeto: "base" },
  { id: "mudancas", nome: "Mudanças",             descricao: "Origem e destino reais com cálculo automático.",    icon: Truck,   calculo: "mudancas", trajeto: "custom" },
  { id: "limpeza",  nome: "Limpeza pós-obra",    descricao: "Acabamento final e recolha associada.",             icon: Sparkles,calculo: "entulho",  trajeto: "base" },
];
const categoriaIds = new Set<CategoriaId>(["moveis", "monos", "entulho", "mudancas", "limpeza"]);

type CountryOption = { code: string; dial: string; flag: string; label: string };
const COUNTRY_OPTIONS: CountryOption[] = [
  { code: "PT", dial: "+351", flag: "🇵🇹", label: "Portugal" },
  { code: "ES", dial: "+34",  flag: "🇪🇸", label: "Espanha" },
  { code: "FR", dial: "+33",  flag: "🇫🇷", label: "França" },
  { code: "GB", dial: "+44",  flag: "🇬🇧", label: "Reino Unido" },
  { code: "DE", dial: "+49",  flag: "🇩🇪", label: "Alemanha" },
  { code: "CH", dial: "+41",  flag: "🇨🇭", label: "Suíça" },
  { code: "NL", dial: "+31",  flag: "🇳🇱", label: "Países Baixos" },
];

const MUDANCAS_WHATSAPP_PHONE = "+351924370335";
const SIMULADOR_WHATSAPP_PHONE = "+351931632622";

/* ─── stepper steps ──────────────────────────────────────── */
type Step = 1 | 2 | 3 | 4;

/* ─── props ──────────────────────────────────────────────── */
type SimuladorClientProps = { initialCategoriaId?: CategoriaId | null };

/* ═══════════════════════════════════════════════════════════
   COMPONENTE PRINCIPAL
═══════════════════════════════════════════════════════════ */
export default function SimuladorClient({ initialCategoriaId = null }: SimuladorClientProps) {
  const summaryRef = useRef<HTMLDivElement | null>(null);

  /* pricing */
  const [pricingMap, setPricingMap] = useState(() => createSimulatorSettingsMap());

  /* stepper */
  const [step, setStep] = useState<Step>(1);
  const [categoriaId, setCategoriaId] = useState<CategoriaId | null>(initialCategoriaId);
  const categoria = categorias.find((c) => c.id === categoriaId) ?? null;

  /* passo 1 – serviço */
  /* passo 2 – morada + fotos + detalhes */
  const [origem, setOrigem] = useState("");
  const [destino, setDestino] = useState("");
  const [km, setKm] = useState<number | null>(null);
  const [kmLoading, setKmLoading] = useState(false);
  const [kmErro, setKmErro] = useState("");
  const [fotos, setFotos] = useState<File[]>([]);
  const [fotosUploading, setFotosUploading] = useState(false);
  const [fotosUrls, setFotosUrls] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [tipoAcesso, setTipoAcesso] = useState("");
  const [numeroAndares, setNumeroAndares] = useState("1");
  const [temElevador, setTemElevador] = useState("");
  const [acessoDificil, setAcessoDificil] = useState(false);
  const [entulhoModo, setEntulhoModo] = useState("");
  const [quantidadeSacos, setQuantidadeSacos] = useState("");
  const [moveisModo, setMoveisModo] = useState("");
  const [cargas, setCargas] = useState("1");
  const [peq, setPeq] = useState("");
  const [med, setMed] = useState("");
  const [gra, setGra] = useState("");
  const [quantidadePessoas, setQuantidadePessoas] = useState("");
  const [tempoEstimado, setTempoEstimado] = useState("2");
  const [pessoasManual, setPessoasManual] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  /* passo 3 – IA a processar */
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiStep, setAiStep] = useState(0); // 0-4 etapas da animação
  const [orcamento, setOrcamento] = useState<number | null>(null);

  /* passo 4 – confirmação */
  const [telemovel, setTelemovel] = useState("");
  const [telemovelError, setTelemovelError] = useState("");
  const [countryDial, setCountryDial] = useState("+351");
  const [customDial, setCustomDial] = useState("");
  const [showCustomDial, setShowCustomDial] = useState(false);
  const activeDial = showCustomDial ? customDial.trim() : countryDial;

  /* ── carregar settings ── */
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const res = await fetch("/api/simulador/settings");
        if (!res.ok) return;
        const data = (await res.json()) as SettingsResponse;
        if (active) setPricingMap(createSimulatorSettingsMap(data.settings));
      } catch { /* mantém valores locais */ }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!initialCategoriaId || !categoriaIds.has(initialCategoriaId)) return;
    setCategoriaId((c) => (c === initialCategoriaId ? c : initialCategoriaId));
  }, [initialCategoriaId]);

  /* ── reset ── */
  const resetFlow = useCallback(() => {
    setStep(1);
    setOrigem(""); setDestino(""); setKm(null); setKmLoading(false); setKmErro("");
    setFotos([]); setFotosUrls([]); setFotosUploading(false); setIsDragging(false);
    setTipoAcesso(""); setNumeroAndares("1"); setTemElevador(""); setAcessoDificil(false);
    setEntulhoModo(""); setQuantidadeSacos(""); setMoveisModo(""); setCargas("1");
    setPeq(""); setMed(""); setGra("");
    setQuantidadePessoas(""); setTempoEstimado("2"); setPessoasManual(false);
    setShowValidation(false); setAiProcessing(false); setAiStep(0); setOrcamento(null);
    setTelemovel(""); setTelemovelError(""); setCountryDial("+351");
    setCustomDial(""); setShowCustomDial(false);
  }, []);

  const escolherCategoria = (id: CategoriaId) => {
    resetFlow();
    setCategoriaId(id);
    setStep(2);
    trackSimulatorStart(id);
  };

  /* ── validações passo 2 ── */
  const origemValida    = categoria?.trajeto === "base" || origem.trim().length >= 3;
  const destinoValido   = destino.trim().length >= 3;
  const entulhoModoValido   = categoria?.calculo !== "entulho" || Boolean(entulhoModo);
  const quantidadeSacosValida = categoria?.calculo !== "entulho" || Boolean(quantidadeSacos);
  const moveisModoValido = categoria?.calculo !== "moveis" || Boolean(moveisModo);
  const cargasValida    = categoria?.calculo !== "moveis" || moveisModo !== "carga" || Boolean(cargas);
  const itensMoveisValidos = categoria?.calculo !== "moveis" || moveisModo !== "item" || Boolean(peq || med || gra);
  const acessoValido    = Boolean(tipoAcesso);
  const pessoasValida   = Boolean(quantidadePessoas);
  const tempoValido     = Boolean(tempoEstimado);
  const kmOk            = km !== null;

  const podeAvancarPasso2 = (() => {
    if (!kmOk || !acessoValido || !pessoasValida || !tempoValido) return false;
    if (tipoAcesso === "apartamento" && (!numeroAndares || !temElevador)) return false;
    if (categoria?.calculo === "entulho" && (!entulhoModo || !quantidadeSacos)) return false;
    if (categoria?.calculo === "moveis") {
      if (!moveisModo) return false;
      if (moveisModo === "carga" && !cargas) return false;
      if (moveisModo === "item" && !(peq || med || gra)) return false;
    }
    return true;
  })();

  /* ── calcular distância ── */
  /* ── fotos ── */
  const adicionarFotos = (novos: File[]) => {
    setFotos((prev) => {
      const combined = [...prev, ...novos].slice(0, 8);
      return combined;
    });
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false);
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    adicionarFotos(files);
  }, []);

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    adicionarFotos(files);
    e.target.value = "";
  };

  /* ── upload fotos ── */
  const uploadFotos = async (): Promise<string[]> => {
    if (fotos.length === 0) return [];
    setFotosUploading(true);
    try {
      const fd = new FormData();
      fotos.forEach((f) => fd.append("fotos", f));
      const res = await fetch("/api/simulador/upload-fotos", { method: "POST", body: fd });
      const data = await res.json();
      return (data.urls as string[]) ?? [];
    } catch { return []; }
    finally { setFotosUploading(false); }
  };

  /* ── calcular orçamento (motor real) ── */
  const calcularOrcamento = () => {
    if (!categoria || km === null) return;
    const pessoas = Number(quantidadePessoas || 0);
    const horas   = Number(tempoEstimado || 0);
    const andares = Number(numeroAndares || 0);
    const sacos   = Number(quantidadeSacos || 0);
    const cargasN = Number(cargas || 1);
    const pequeno = Number(peq || 0);
    const medio   = Number(med || 0);
    const grande  = Number(gra || 0);

    let adicionalAcesso = 0;
    if (tipoAcesso === "apartamento") {
      adicionalAcesso = temElevador === "sim"
        ? andares * pricingMap.apartamento_com_elevador_por_andar
        : andares * pricingMap.apartamento_sem_elevador_por_andar;
    }
    const adicionalDificil = acessoDificil ? pricingMap.acesso_dificil_extra : 0;
    let total = 0;

    if (categoria.calculo === "moveis") {
      if (moveisModo === "item") {
        total = (pequeno * pricingMap.moveis_item_pequeno + medio * pricingMap.moveis_item_medio + grande * pricingMap.moveis_item_grande + km * pricingMap.moveis_distancia_km + adicionalAcesso + adicionalDificil) * pricingMap.entulho_multiplicador;
      } else {
        const base = (horas + pricingMap.moveis_carga_base) * (pessoas + 1) * pricingMap.hora_base;
        total = (base + km * pricingMap.moveis_distancia_km + adicionalAcesso + adicionalDificil + base * pricingMap.moveis_carga_multiplicador) * cargasN;
      }
    }
    if (categoria.calculo === "entulho") {
      const material = entulhoModo === "chao" ? sacos * pricingMap.entulho_saco_chao : sacos * pricingMap.entulho_saco_ensacado;
      total = (horas * pessoas * pricingMap.hora_base + material + km * pricingMap.entulho_distancia_km + adicionalAcesso + adicionalDificil) * pricingMap.entulho_multiplicador;
    }
    if (categoria.calculo === "mudancas") {
      total = (horas * pessoas * pricingMap.hora_base + km * pricingMap.mudancas_distancia_km + adicionalAcesso + adicionalDificil) * pricingMap.mudancas_multiplicador;
    }
    return Math.round(total * 100) / 100;
  };

  /* ── avançar para passo 3 (animação IA) ── */
  const avancarParaIA = async () => {
    setShowValidation(true);

    // Se a distância ainda não foi calculada, calcular agora automaticamente
    if (km === null) {
      const origin = categoria?.trajeto === "custom" ? origem.trim() : BASE_ADDRESS;
      if (!origin || !destino.trim()) return;
      setKmLoading(true); setKmErro("");
      try {
        const res = await fetch("/api/maps/distance", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ origin, destination: destino.trim() }),
        });
        const data = await res.json();
        if (!res.ok) { setKmErro("Não foi possível calcular a distância. Tente novamente."); setKmLoading(false); return; }
        const kmVal = Number(data.distanceKm ?? 0);
        setKm(kmVal);
        if (categoria?.trajeto === "custom") setOrigem(String(data.originAddress ?? origin));
        setDestino(String(data.destinationAddress ?? destino));
        setKmLoading(false);
        // Rever validações com km preenchido — se ainda faltarem campos, parar aqui
        if (!acessoValido || !pessoasValida || !tempoValido) return;
      } catch {
        setKmErro("Erro ao calcular distância. Tente novamente.");
        setKmLoading(false);
        return;
      }
    }

    if (!podeAvancarPasso2) return;
    setStep(3);
    setAiProcessing(true);
    setAiStep(0);

    const urls = await uploadFotos();
    setFotosUrls(urls);

    // Animação sequencial das etapas
    const delays = [600, 1200, 1800, 2400];
    delays.forEach((d, i) => {
      setTimeout(() => setAiStep(i + 1), d);
    });

    // Calcular orçamento real após animação
    setTimeout(() => {
      const valor = calcularOrcamento();
      setOrcamento(valor ?? 0);
      if (categoria) trackSimulatorComplete(categoria.id, valor ?? 0, destino);
      setAiProcessing(false);
      setStep(4);
    }, 3200);
  };

  /* ── confirmar pedido ── */
  const confirmarPedido = async () => {
    if (!categoria || km === null || orcamento === null) return;
    const cleanedDial = activeDial.replace(/[^\d+]/g, "");
    if (!cleanedDial || !/^\+?\d{1,4}$/.test(cleanedDial)) {
      setTelemovelError("Indique um código de país válido (ex.: +351)"); return;
    }
    const cleanedPhone = telemovel.replace(/\D/g, "");
    if (!cleanedPhone || cleanedPhone.length < 6) {
      setTelemovelError("Telemóvel é obrigatório para enviar o pedido"); return;
    }
    const dialN = cleanedDial.startsWith("+") ? cleanedDial : `+${cleanedDial}`;
    const telCompleto = `${dialN} ${telemovel}`.trim();

    trackSimulatorWhatsApp(categoria.id, orcamento, true);

    // NOVO: Guardar pedido em BD ANTES de ir para WhatsApp
    try {
      const orderData = {
        serviceType: categoria.nome,
        description: `Origem: ${origem || "Base CLYON"}, Destino: ${destino}, Distância: ${km.toFixed(1)}km, Pessoas: ${quantidadePessoas}, Tempo: ${tempoEstimado}h${acessoDificil ? ", Acesso difícil" : ""}`,
        receiver: {
          name: telemovel, // Não temos nome, usar telefone como placeholder
          phone: telCompleto,
          email: "",
        },
        address: {
          formattedAddress: `${origem || "Base CLYON"} → ${destino}`,
          city: destino,
        },
        floor: tipoAcesso === "apartamento" ? `${numeroAndares}º` : "Rés-do-chão",
        hasElevator: tipoAcesso === "apartamento" ? temElevador : "N/A",
        parkingDistance: acessoDificil ? "Acesso difícil" : "Normal",
        urgency: "normal",
        distanceFromBase: {
          distanceKm: km,
          durationText: `${tempoEstimado}h`,
        },
        files: fotosUrls,
      };

      const res = await fetch("/api/simulador/pedido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          order: orderData,
          estimate: {
            status: "estimated",
            estimatedPriceWithoutVat: orcamento / 1.23,
            vatAmount: orcamento - (orcamento / 1.23),
            estimatedPriceWithVat: orcamento,
            difficultyLevel: acessoDificil ? 3 : 2,
            summary: `${categoria.nome} de ${origem || "Base CLYON"} para ${destino}`,
            customerMessage: `Orçamento estimado em €${orcamento.toFixed(2)}`,
          },
          chatHistory: [],
        }),
      });

      if (res.ok) {
        const data = await res.json();
      } else {
        const err = await res.json();
        console.error("[v0] SimuladorClient: ❌ Erro ao guardar pedido:", err);
      }
    } catch (err) {
      console.error("[v0] SimuladorClient: ❌ Erro ao guardar:", err);
      // Continuar com WhatsApp mesmo se BD falhar
    }

    const linhas = [
      "Olá! Simulei um orçamento no site CLYON:",
      "",
      `*Serviço:* ${categoria.nome}`,
      categoria.trajeto === "custom" ? `*Origem:* ${origem}` : "*Origem:* Base CLYON",
      `*Destino:* ${destino}`,
      `*Distância:* ${km.toFixed(1)} km`,
      `*Telemóvel:* ${telCompleto}`,
      "",
      `*Acesso:* ${tipoAcesso || "-"}`,
      tipoAcesso === "apartamento" ? `*Andares:* ${numeroAndares || "0"} | *Elevador:* ${temElevador || "-"}` : null,
      `*Pessoas:* ${quantidadePessoas || "-"} | *Tempo:* ${tempoEstimado || "-"} h`,
      acessoDificil ? "*Acesso difícil:* Sim" : null,
      categoria.calculo === "entulho" ? `*Entulho:* ${entulhoModo || "-"} | Sacos: ${quantidadeSacos || "0"}` : null,
      categoria.calculo === "moveis" && moveisModo === "item" ? `*Móveis:* Peq:${peq||0} Méd:${med||0} Gr:${gra||0}` : null,
      categoria.calculo === "moveis" && moveisModo === "carga" ? `*Cargas:* ${cargas||1}` : null,
      fotosUrls.length > 0 ? `*Fotos:* ${fotosUrls.join(", ")}` : null,
      "",
      `*Estimativa IA CLYON:* EUR ${orcamento.toFixed(2)}`,
      "",
      "Podem confirmar disponibilidade?",
    ].filter(Boolean);

    const msg = encodeURIComponent(linhas.join("\n"));
    const dest = categoria.id === "mudancas" ? MUDANCAS_WHATSAPP_PHONE : SIMULADOR_WHATSAPP_PHONE;
    window.location.href = `https://wa.me/${dest.replace(/\D/g, "")}?text=${msg}`;
  };

  /* ═══════════════════════════════════
     PASSO 1 — SELEÇÃO DE SERVIÇO
  ═══════════════════════════════════ */
  if (!categoria || step === 1) {
    return (
      <div className="min-h-screen bg-[#050d18]">
        {/* hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(6,182,212,0.18),transparent)]" />
          <div className="relative mx-auto max-w-4xl px-4 pb-10 pt-16 text-center sm:px-6">
            {/* badges */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">
                <Star className="h-3 w-3 fill-cyan-300" />
                163 avaliações 5 estrelas
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-300">
                <MapPin className="h-3 w-3" />
                24+ localidades
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                <ShieldCheck className="h-3 w-3" />
                Preço fixo garantido
              </span>
            </div>
            <h1 className="mt-6 text-balance text-3xl font-bold leading-tight tracking-tight text-white sm:text-5xl">
              Orçamento inteligente<br />
              <span className="text-cyan-400">em menos de 60 segundos.</span>
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-pretty text-base leading-7 text-slate-400">
              Sem leilões, sem negociação. A CLYON analisa os seus dados e devolve um preço fixo e transparente imediatamente.
            </p>
          </div>
        </section>

        {/* cards de serviço */}
        <section className="pb-20">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <p className="mb-5 text-center text-xs font-semibold uppercase tracking-widest text-slate-500">
              Escolha o serviço
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {categorias.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => escolherCategoria(item.id)}
                    className="group relative overflow-hidden rounded-2xl border border-white/10 bg-white/5 p-5 text-left transition hover:border-cyan-500/50 hover:bg-white/10"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-400">
                        <Icon className="h-5 w-5" />
                      </div>
                      <ArrowRight className="h-4 w-4 text-slate-600 transition group-hover:text-cyan-400 group-hover:translate-x-0.5" />
                    </div>
                    <h3 className="mt-3 text-base font-semibold text-white">{item.nome}</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-400">{item.descricao}</p>
                  </button>
                );
              })}
            </div>

            {/* trust signals */}
            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {[
                { icon: ShieldCheck, title: "Profissionais verificados", desc: "Rigorosos processos de seleção e antecedentes." },
                { icon: CheckCircle2, title: "Garantia de 15 dias",       desc: "Se não ficar satisfeito, retificamos sem custos." },
                { icon: LockKeyhole,  title: "Sem taxas ocultas",         desc: "Preço fixo, transparente e confirmado antes do serviço." },
              ].map((t) => {
                const Icon = t.icon;
                return (
                  <div key={t.title} className="flex items-start gap-3 rounded-2xl border border-white/8 bg-white/4 p-4">
                    <Icon className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-400" />
                    <div>
                      <p className="text-sm font-semibold text-white">{t.title}</p>
                      <p className="mt-0.5 text-xs leading-5 text-slate-400">{t.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    );
  }

  /* ═══════════════════════════════════
     PASSO 2 — DADOS
  ══════════��════════════════════════ */
  if (step === 2) {
    return (
      <div className="min-h-screen bg-[#050d18]">
        <div className="mx-auto max-w-2xl px-4 pb-20 pt-10 sm:px-6">
          {/* voltar */}
          <button
            type="button"
            onClick={() => { resetFlow(); setCategoriaId(null); }}
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar aos serviços
          </button>

          {/* stepper */}
          <StepperBar current={2} />

          <div className="mt-8 space-y-6">
            {/* morada */}
            <FormSection title="Morada do serviço">
              {categoria.trajeto === "custom" && (
                <AddressField
                  id="origem"
                  label="Morada de origem *"
                  value={origem}
                  onChange={(v) => { setOrigem(v); setKm(null); }}
                  placeholder="Ex: Rua da Paz 12, Lisboa"
                  tone={showValidation && !origemValida ? "warning" : "default"}
                  dark
                />
              )}
              {categoria.trajeto === "base" && (
                <div className="flex items-center gap-2 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-300">
                  <MapPin className="h-4 w-4 flex-shrink-0" />
                  Origem: Base operacional CLYON (aplicada automaticamente)
                </div>
              )}
              <AddressField
                id="destino"
                label={categoria.trajeto === "custom" ? "Morada de destino *" : "Morada do serviço *"}
                value={destino}
                onChange={(v) => { setDestino(v); setKm(null); }}
                placeholder="Ex: Rua da Paz 12, Lisboa"
                tone={showValidation && !destinoValido ? "warning" : "default"}
                dark
              />
              {km !== null && (
                <div className="flex items-center gap-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3">
                  <CheckCircle2 className="h-5 w-5 text-cyan-400" />
                  <div>
                    <p className="text-sm font-semibold text-cyan-300">Distância calculada</p>
                    <p className="text-xs text-slate-400">{km.toFixed(1)} km — usado no cálculo do preço</p>
                  </div>
                  <span className="ml-auto text-2xl font-bold text-white">{km.toFixed(1)}<span className="text-sm font-normal text-slate-400"> km</span></span>
                </div>
              )}
            </FormSection>

            {/* fotos */}
            <FormSection title="Fotos do material" subtitle="Opcional — ajudam a confirmar o orçamento (máx. 8 fotos)">
              <div
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition",
                  isDragging
                    ? "border-cyan-400 bg-cyan-500/10"
                    : "border-white/15 bg-white/4 hover:border-white/30",
                )}
              >
                <UploadCloud className="h-8 w-8 text-slate-500" />
                <div>
                  <p className="text-sm font-medium text-slate-300">Arraste fotos aqui ou</p>
                  <label className="mt-1 inline-block cursor-pointer text-sm font-semibold text-cyan-400 hover:underline">
                    selecione do dispositivo
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="sr-only"
                      onChange={onFileInput}
                    />
                  </label>
                </div>
                <p className="text-xs text-slate-500">JPG, PNG, HEIC — até 8 fotos</p>
              </div>
              {fotos.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {fotos.map((f, i) => (
                    <div key={i} className="group relative aspect-square overflow-hidden rounded-xl">
                      <img
                        src={URL.createObjectURL(f)}
                        alt={`foto ${i + 1}`}
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => setFotos((prev) => prev.filter((_, j) => j !== i))}
                        className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 transition group-hover:opacity-100"
                        aria-label="Remover foto"
                      >
                        <Trash2 className="h-5 w-5 text-white" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </FormSection>

            {/* detalhes específicos do serviço */}
            {km !== null && (
              <FormSection title="Detalhes do serviço">
                {/* entulho */}
                {categoria.calculo === "entulho" && (
                  <>
                    <DarkField label="O entulho está em sacos ou no chão? *">
                      <ChoiceGrid
                        value={entulhoModo}
                        onChange={setEntulhoModo}
                        options={[{ value: "sacos", label: "Em sacos" }, { value: "chao", label: "No chão" }]}
                        tone={showValidation && !entulhoModoValido ? "warning" : "default"}
                      />
                    </DarkField>
                    <DarkField label="Quantidade de sacos *">
                      <DarkInput id="sacos" type="number" min="0" value={quantidadeSacos} onChange={(e) => setQuantidadeSacos(e.target.value)} placeholder="0" className="w-28" />
                    </DarkField>
                  </>
                )}

                {/* móveis */}
                {categoria.calculo === "moveis" && (
                  <>
                    <DarkField label="Como deseja calcular? *">
                      <ChoiceGrid
                        value={moveisModo}
                        onChange={setMoveisModo}
                        options={[{ value: "carga", label: "Por carga" }, { value: "item", label: "Por item" }]}
                        tone={showValidation && !moveisModoValido ? "warning" : "default"}
                      />
                    </DarkField>
                    {moveisModo === "carga" && (
                      <DarkField label="Quantas cargas? *">
                        <DarkInput id="cargas" type="number" min="1" value={cargas} onChange={(e) => setCargas(e.target.value)} placeholder="1" className="w-28" />
                      </DarkField>
                    )}
                    {moveisModo === "item" && (
                      <DarkField label="Número de itens *">
                        <div className="grid grid-cols-3 gap-3">
                          {[
                            { id: "peq", label: "Pequeno", value: peq, set: setPeq },
                            { id: "med", label: "Médio",   value: med, set: setMed },
                            { id: "gra", label: "Grande",  value: gra, set: setGra },
                          ].map((it) => (
                            <div key={it.id} className="space-y-1">
                              <label htmlFor={it.id} className="text-xs text-slate-400">{it.label}</label>
                              <DarkInput id={it.id} type="number" min="0" value={it.value} onChange={(e) => it.set(e.target.value)} placeholder="0" />
                            </div>
                          ))}
                        </div>
                      </DarkField>
                    )}
                  </>
                )}

                {/* acesso */}
                <DarkField label="Tipo de acesso *">
                  <ChoiceGrid
                    value={tipoAcesso}
                    onChange={setTipoAcesso}
                    options={[{ value: "apartamento", label: "Apartamento" }, { value: "casa", label: "Casa/Moradia" }]}
                    tone={showValidation && !acessoValido ? "warning" : "default"}
                  />
                </DarkField>
                {tipoAcesso === "apartamento" && (
                  <div className="grid grid-cols-2 gap-3">
                    <DarkField label="Andares *">
                      <DarkInput id="andares" type="number" min="1" value={numeroAndares} onChange={(e) => setNumeroAndares(e.target.value)} />
                    </DarkField>
                    <DarkField label="Elevador? *">
                      <ChoiceGrid
                        value={temElevador}
                        onChange={setTemElevador}
                        options={[{ value: "sim", label: "Sim" }, { value: "nao", label: "Não" }]}
                        tone={showValidation && tipoAcesso === "apartamento" && !temElevador ? "warning" : "default"}
                      />
                    </DarkField>
                  </div>
                )}

                {/* pessoas + tempo */}
                <div className="grid grid-cols-2 gap-3">
                  <DarkField label="Pessoas necessárias *">
                    <PeopleSelector
                      value={quantidadePessoas}
                      onChange={setQuantidadePessoas}
                      manualMode={pessoasManual}
                      onManualModeChange={setPessoasManual}
                      tone={showValidation && !pessoasValida ? "warning" : "default"}
                      dark
                    />
                  </DarkField>
                  <DarkField label="Tempo estimado (h) *">
                    <DarkInput id="tempo" type="number" min="1" value={tempoEstimado} onChange={(e) => setTempoEstimado(e.target.value)} placeholder="2" />
                  </DarkField>
                </div>

                {/* acesso difícil */}
                <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <Checkbox
                    id="dificil"
                    checked={acessoDificil}
                    onCheckedChange={(v) => setAcessoDificil(Boolean(v))}
                  />
                  <span className="text-sm text-slate-300">Acesso considerado difícil (rua estreita, sem paragem próxima)</span>
                </label>
              </FormSection>
            )}

            {/* feedback de erro de distância */}
            {kmErro && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
                <p className="text-center text-sm text-red-300">{kmErro}</p>
              </div>
            )}

            {/* botão avançar */}
            <button
              type="button"
              onClick={avancarParaIA}
              disabled={!destinoValido || fotosUploading || kmLoading}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-2xl px-6 py-4 text-base font-semibold text-white transition",
                destinoValido && !fotosUploading && !kmLoading
                  ? "bg-cyan-600 hover:bg-cyan-700 shadow-[0_12px_32px_-12px_rgba(6,182,212,0.5)]"
                  : "bg-white/10 text-slate-500 cursor-not-allowed",
              )}
            >
              {kmLoading
                ? <><Loader2 className="h-5 w-5 animate-spin" />A calcular distância...</>
                : fotosUploading
                  ? <><Loader2 className="h-5 w-5 animate-spin" />A enviar fotos...</>
                  : <><BrainCircuit className="h-5 w-5" />Gerar orçamento com IA</>}
              {!kmLoading && !fotosUploading && <ArrowRight className="h-4 w-4" />}
            </button>
            {showValidation && !podeAvancarPasso2 && !kmLoading && km !== null && (
              <p className="text-center text-sm text-amber-400">
                Preencha todos os campos obrigatórios para continuar.
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════
     PASSO 3 — IA A PROCESSAR
  ═══════════════════════════════════ */
  if (step === 3) {
    const etapas = [
      "A analisar as fotos e o tipo de serviço...",
      "A calcular volume e complexidade de acesso...",
      "A verificar distância e disponibilidade...",
      "A gerar o preço fixo garantido...",
    ];
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#050d18] px-4">
        <div className="w-full max-w-md space-y-8 text-center">
          {/* ícone animado */}
          <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
            <div className="absolute inset-0 animate-ping rounded-full bg-cyan-500/20" />
            <div className="absolute inset-3 animate-pulse rounded-full bg-cyan-500/15" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-cyan-600 shadow-[0_0_40px_rgba(6,182,212,0.5)]">
              <BrainCircuit className="h-8 w-8 text-white" />
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white">IA CLYON a processar</h2>
            <p className="mt-2 text-sm text-slate-400">Análise em tempo real do seu pedido</p>
          </div>

          {/* etapas */}
          <div className="space-y-3 text-left">
            {etapas.map((etapa, i) => {
              const done = aiStep > i + 1;
              const active = aiStep === i + 1;
              return (
                <div
                  key={i}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition-all duration-500",
                    done   ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-300" :
                    active ? "border border-cyan-500/40 bg-cyan-500/10 text-cyan-200" :
                             "border border-white/5 bg-white/3 text-slate-600",
                  )}
                >
                  {done ? (
                    <Check className="h-4 w-4 flex-shrink-0 text-emerald-400" />
                  ) : active ? (
                    <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-cyan-400" />
                  ) : (
                    <div className="h-4 w-4 flex-shrink-0 rounded-full border border-white/15" />
                  )}
                  {etapa}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  /* ═══════════════════════════════════
     PASSO 4 — RESULTADO + CONFIRMAÇÃO
  ═══════════════════════════════════ */
  return (
    <div className="min-h-screen bg-[#050d18]">
      <div className="mx-auto max-w-xl px-4 pb-20 pt-10 sm:px-6">
        <StepperBar current={4} />

        <div className="mt-8 space-y-5">
          {/* resultado de preço */}
          <div className="overflow-hidden rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-[#091a2e] to-[#050d18]">
            <div className="border-b border-cyan-500/20 px-6 py-4">
              <div className="flex items-center gap-2">
                <BrainCircuit className="h-5 w-5 text-cyan-400" />
                <p className="text-sm font-semibold text-cyan-300">Resultado da análise IA CLYON</p>
              </div>
            </div>
            <div className="px-6 py-6 text-center" ref={summaryRef}>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Valor estimado</p>
              <p className="mt-2 text-5xl font-bold text-white">
                {orcamento !== null ? `€${orcamento.toFixed(2)}` : "—"}
              </p>
              <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                <ShieldCheck className="h-3.5 w-3.5" />
                Preço fixo · Sem taxas ocultas · Sem leilão
              </div>
            </div>
            {/* resumo */}
            <div className="border-t border-white/8 px-6 py-4 space-y-2">
              {[
                { label: "Serviço",    value: categoria.nome },
                { label: "Destino",    value: destino },
                { label: "Distância",  value: `${km?.toFixed(1) ?? "—"} km` },
                { label: "Acesso",     value: tipoAcesso || "—" },
                { label: "Equipa",     value: quantidadePessoas ? `${quantidadePessoas} pessoa(s)` : "—" },
                fotos.length > 0 ? { label: "Fotos",  value: `${fotos.length} enviada(s)` } : null,
              ].filter(Boolean).map((r) => (
                <div key={r!.label} className="flex items-baseline justify-between text-sm">
                  <span className="text-slate-500">{r!.label}</span>
                  <span className="font-medium text-slate-200">{r!.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* disclaimer */}
          <p className="text-center text-xs leading-5 text-slate-500">
            Esta estimativa é gerada automaticamente e pode ser ajustada após confirmação por um especialista CLYON.
          </p>

          {/* confirmação humana */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-cyan-500/15">
                <Phone className="h-4 w-4 text-cyan-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Um especialista CLYON vai confirmar a sua vaga</p>
                <p className="mt-0.5 text-xs text-slate-400">Deixe o seu contacto — respondemos em minutos.</p>
              </div>
            </div>

            {/* campo telefone */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-400">Telemóvel *</label>
              <div className="flex gap-2">
                {showCustomDial ? (
                  <Input
                    type="tel"
                    value={customDial}
                    onChange={(e) => { setCustomDial(e.target.value); setTelemovelError(""); }}
                    placeholder="+000"
                    aria-label="Código do país"
                    className="h-11 w-20 rounded-xl border-white/20 bg-white/10 text-center text-white placeholder:text-slate-500"
                  />
                ) : (
                  <select
                    value={countryDial}
                    onChange={(e) => {
                      if (e.target.value === "custom") { setShowCustomDial(true); setCustomDial(countryDial); }
                      else { setShowCustomDial(false); setCountryDial(e.target.value); }
                    }}
                    aria-label="Código do país"
                    className="h-11 w-28 rounded-xl border border-white/20 bg-white/10 px-2 text-sm text-white [&>option]:text-slate-900"
                  >
                    {COUNTRY_OPTIONS.map((c) => (
                      <option key={c.code} value={c.dial}>{c.flag} {c.dial}</option>
                    ))}
                    <option value="custom">Outro…</option>
                  </select>
                )}
                <Input
                  type="tel"
                  value={telemovel}
                  onChange={(e) => {
                    setTelemovel(e.target.value.replace(/\D/g, "").replace(/(\d{3})(?=\d)/g, "$1 ").trim().slice(0, 18));
                    setTelemovelError("");
                  }}
                  placeholder="912 345 678"
                  className={cn(
                    "h-11 flex-1 rounded-xl border bg-white/10 text-white placeholder:text-slate-500",
                    telemovelError ? "border-red-400" : "border-white/20 focus:border-cyan-400",
                  )}
                />
              </div>
              {telemovelError && <p className="text-xs text-red-400">{telemovelError}</p>}
            </div>

            {/* botão confirmar */}
            <button
              type="button"
              onClick={confirmarPedido}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 py-4 text-base font-semibold text-white transition hover:bg-emerald-700 shadow-[0_12px_32px_-12px_rgba(16,185,129,0.5)]"
            >
              <Phone className="h-5 w-5" />
              Confirmar e agendar via WhatsApp
            </button>
          </div>

          {/* recomeçar */}
          <button
            type="button"
            onClick={() => { resetFlow(); setCategoriaId(null); }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-transparent px-4 py-3 text-sm font-medium text-slate-400 hover:text-white transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Simular outro serviço
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   SUB-COMPONENTES
══════════════════════════════════════════���════════════════ */

function StepperBar({ current }: { current: number }) {
  const steps = [
    { n: 1, label: "Serviço" },
    { n: 2, label: "Dados" },
    { n: 3, label: "Análise IA" },
    { n: 4, label: "Resultado" },
  ];
  return (
    <div className="flex items-center gap-0">
      {steps.map((s, i) => {
        const done = current > s.n;
        const active = current === s.n;
        return (
          <div key={s.n} className="flex flex-1 items-center">
            <div className="flex flex-col items-center gap-1">
              <div className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition",
                done   ? "bg-emerald-500 text-white" :
                active ? "bg-cyan-600 text-white shadow-[0_0_12px_rgba(6,182,212,0.5)]" :
                         "bg-white/10 text-slate-500",
              )}>
                {done ? <Check className="h-3.5 w-3.5" /> : s.n}
              </div>
              <span className={cn("text-[10px] font-medium", active ? "text-cyan-300" : done ? "text-emerald-400" : "text-slate-600")}>{s.label}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn("mx-1 h-px flex-1 transition", done ? "bg-emerald-500/50" : "bg-white/10")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function FormSection({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold text-white">{title}</h3>
        {subtitle && <p className="mt-0.5 text-xs text-slate-400">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function DarkField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-slate-300">{label}</label>
      {children}
    </div>
  );
}

function DarkInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "h-11 w-full rounded-xl border border-white/20 bg-white/8 px-3 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/20",
        className,
      )}
    />
  );
}

function ChoiceGrid({
  value,
  onChange,
  options,
  tone = "default",
}: {
  value: string;
  onChange: (v: string) => void;
  options: ChoiceOption[];
  tone?: FieldTone;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-xl border px-4 py-3 text-sm font-semibold transition",
              active
                ? "border-cyan-500 bg-cyan-600 text-white"
                : tone === "warning"
                  ? "border-amber-500/40 bg-white/5 text-slate-300 hover:border-white/30"
                  : "border-white/15 bg-white/5 text-slate-300 hover:border-white/30",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

type FieldToneType = "default" | "next" | "warning" | "error";

function AddressField({
  id, label, value, onChange, placeholder, tone = "default", dark = false,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  placeholder: string; tone?: FieldToneType; dark?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  const [predictions, setPredictions] = useState<MapsPrediction[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const query = value.trim();
    if (!focused || query.length < 3) { setPredictions([]); return; }
    const ctrl = new AbortController();
    const t = window.setTimeout(async () => {
      try {
        setLoading(true);
        const res = await fetch("/api/maps/autocomplete", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: query }), signal: ctrl.signal,
        });
        const data = await res.json();
        setPredictions(res.ok && Array.isArray(data.predictions) ? data.predictions : []);
      } catch { setPredictions([]); }
      finally { setLoading(false); }
    }, 260);
    return () => { ctrl.abort(); window.clearTimeout(t); };
  }, [focused, value]);

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={cn("text-sm font-medium", dark ? "text-slate-300" : "text-slate-700")}>{label}</label>
      <div className="relative">
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 140)}
          placeholder={placeholder}
          autoComplete="street-address"
          className={cn(
            "h-11 w-full rounded-xl border px-3 pr-10 text-sm focus:outline-none focus:ring-2",
            dark
              ? cn("border-white/20 bg-white/8 text-white placeholder:text-slate-500 focus:border-cyan-400 focus:ring-cyan-400/20",
                  tone === "warning" && "border-amber-500/50")
              : cn("border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-cyan-400 focus:ring-cyan-100",
                  tone === "warning" && "border-amber-400"),
          )}
        />
        {loading && (
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            <Loader2 className="h-4 w-4 animate-spin text-cyan-400" />
          </div>
        )}
        {focused && predictions.length > 0 && (
          <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-xl border border-white/15 bg-[#0d1f35] shadow-xl">
            {predictions.map((p) => (
              <button
                key={p.placeId}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onChange(p.description); setPredictions([]); setFocused(false); }}
                className="flex w-full items-start gap-3 border-b border-white/8 px-4 py-3 text-left last:border-0 hover:bg-white/8"
              >
                <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyan-400" />
                <div>
                  <p className="text-sm font-semibold text-white">{p.mainText}</p>
                  <p className="text-xs text-slate-400">{p.secondaryText || p.description}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PeopleSelector({
  value, onChange, manualMode, onManualModeChange, tone = "default", dark = false,
}: {
  value: string; onChange: (v: string) => void;
  manualMode: boolean; onManualModeChange: (m: boolean) => void;
  tone?: FieldTone; dark?: boolean;
}) {
  const btnBase = cn("flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold transition border");
  return (
    <div className="flex flex-wrap gap-2">
      {manualMode ? (
        <>
          <DarkInput
            type="number" min="8" value={value}
            onChange={(e) => onChange((e.target as HTMLInputElement).value)}
            placeholder="8" className="w-20 h-10"
          />
          <button type="button" onClick={() => { onManualModeChange(false); onChange(""); }}
            className="rounded-xl border border-white/15 bg-white/5 px-3 text-xs text-slate-400 hover:text-white">
            Voltar
          </button>
        </>
      ) : (
        <>
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <button
              key={n} type="button"
              onClick={() => { onManualModeChange(false); onChange(String(n)); }}
              className={cn(btnBase,
                value === String(n)
                  ? "border-cyan-500 bg-cyan-600 text-white"
                  : dark
                    ? "border-white/15 bg-white/5 text-slate-300 hover:border-white/30"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
              )}
            >{n}</button>
          ))}
          <button type="button" onClick={() => { onManualModeChange(true); onChange(""); }}
            className={cn(btnBase, "w-auto px-3",
              dark ? "border-white/15 bg-white/5 text-slate-300 hover:border-white/30"
                   : "border-slate-200 bg-white text-slate-600 hover:border-slate-300",
            )}>8+</button>
        </>
      )}
    </div>
  );
}
