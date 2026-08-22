"use client";

import { useState, useRef, useEffect, useId } from "react";
import { enviarFicheiro } from "@/lib/enviar-ficheiro";
import { PRAZO_DE_RESPOSTA } from "@/lib/seo-data";

const SERVICE_OPTIONS = [
  { value: "recolha_moveis",           label: "Recolha de móveis" },
  { value: "recolha_monos",            label: "Recolha de monos" },
  { value: "recolha_entulho",          label: "Recolha de entulho" },
  { value: "esvaziamento_casa",        label: "Esvaziamento de casa" },
  { value: "esvaziamento_apartamento", label: "Esvaziamento de apartamento" },
  { value: "mudanca",                  label: "Mudança" },
  { value: "outro",                    label: "Outro" },
];

const ELEVATOR_OPTIONS = [
  // "Não sei" continua a ser resposta válida — há quem não saiba mesmo. O que
  // muda é deixar de ser a resposta por omissão de quem nunca olhou.
  { value: "",        label: "Escolha…" },
  { value: "yes",     label: "Sim" },
  { value: "small",   label: "Pequeno" },
  { value: "no",      label: "Não" },
  { value: "unknown", label: "Não sei" },
];

// "" era rés-do-chão, e por isso quem não escolhesse nada parecia ter dito
// que era no rés-do-chão. Agora "" significa apenas "ainda não respondeu", e o
// rés-do-chão tem valor próprio — "0", que o dicionário já traduz.
const ANDAR_OPTIONS = [
  { value: "",    label: "Escolha o andar…" },
  { value: "0",   label: "Rés-do-chão" },
  { value: "1",   label: "1.º andar" },
  { value: "2",   label: "2.º andar" },
  { value: "3",   label: "3.º andar" },
  { value: "4",   label: "4.º andar" },
  { value: "4+",  label: "5.º ou superior" },
];


/*
 * OS 16 PÍXEIS NÃO SÃO UMA PREFERÊNCIA DE ESTILO
 *
 * Os campos estavam a `text-sm` = 14 px. O Safari do iOS dá zoom automático a
 * qualquer input com fonte abaixo de 16 px, e NÃO desfaz o zoom ao sair do
 * campo. O cliente escrevia o nome, a página ficava ampliada e desalinhada, e
 * tinha de fazer pinch para continuar — a cada um dos nove campos.
 *
 * É o atrito mais caro do site inteiro: acontece no primeiro toque do único
 * elemento que gera receita, e não deixa rasto nenhum nas analytics. Lê-se
 * como "abandonou o formulário".
 *
 * A altura mínima de 48 px vem da mesma família de razões: o mínimo para um
 * alvo de toque é 44 px, e estes campos estavam a rondar os 40.
 */
function inputCls(error?: string) {
  return `w-full rounded-lg border bg-white px-3.5 py-3 text-base text-slate-800 placeholder-tinta-fraca outline-none transition min-h-[48px] focus:border-acao focus:ring-1 focus:ring-acao/25 ${error ? "border-erro" : "border-slate-200"}`;
}

function selectCls(error?: string) {
  return `clyon-select w-full rounded-lg border bg-white pl-3.5 py-3 text-base text-slate-800 outline-none transition min-h-[48px] ${error ? "border-erro" : "border-slate-200"}`;
}

/**
 * O rótulo de um campo.
 *
 * `htmlFor` deixou de ser opcional. Sem ele — e sem `id` no input — o rótulo
 * não é clicável (o alvo de toque perde-se) e um leitor de ecrã anuncia
 * "caixa de texto" sem dizer de quê. Havia nove campos assim.
 *
 * E deixa de ser 10 px em maiúsculas com `tracking-widest`, que é o formato
 * mais lento de ler que existe, precisamente onde é preciso ler depressa.
 */
function Label({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-semibold text-tinta-fraca">
      {children}
    </label>
  );
}

/**
 * A mensagem de erro.
 *
 * `role="alert"` porque um erro que aparece em ecrã e não é anunciado não
 * existe para quem não está a olhar para aquele ponto da página. O `id` liga-o
 * ao campo por `aria-describedby`.
 */
function Err({ id, msg }: { id: string; msg?: string }) {
  if (!msg) return null;
  return (
    <p id={id} role="alert" className="mt-1 text-[13px] font-medium text-erro">
      {msg}
    </p>
  );
}

type FormData = {
  primeiroNome: string;
  ultimoNome: string;
  indicativo: string;
  telefone: string;
  tipoServico: string;
  rua: string;
  codigoPostal: string;
  numeroPosta: string;
  andar: string;
  /** "" enquanto o cliente não escolher — o andar sem elevador muda o preço. */
  elevador: "" | "yes" | "small" | "no" | "unknown";
  descricao: string;
};

type Errors = Partial<Record<keyof FormData, string>>;

type EstimateResult = {
  estimatedPriceWithVat: number | null;
  estimatedPriceWithoutVat: number | null;
  estimateMinWithVat: number | null;
  estimateMaxWithVat: number | null;
  status: string;
  confidence: string;
  customerMessage: string;
};

const CARD_MIN_HEIGHT = 420;

export default function HeroQuoteForm() {
  /*
   * Um prefixo único por instância, para os ids dos campos.
   *
   * `useId()` e não uma string fixa: este formulário aparece na homepage e em
   * várias páginas de serviço, e pode haver mais do que um na mesma página. Com
   * ids fixos, dois formulários no mesmo documento partilhavam `id="telefone"`
   * — e clicar num rótulo focava o campo do outro.
   */
  const uid = useId();
  const idDe = (campo: string) => `${uid}-${campo}`;
  const idDoErro = (campo: string) => `${uid}-${campo}-erro`;

  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState<FormData>({
    primeiroNome: "",
    ultimoNome: "",
    indicativo: "+351",
    telefone: "",
    tipoServico: "",
    rua: "",
    codigoPostal: "",
    numeroPosta: "",
    andar: "",
    elevador: "",
    descricao: "",
  });
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [sent, setSent] = useState(false);
  const [estimate, setEstimate] = useState<EstimateResult | null>(null);
  const [serverError, setServerError] = useState("");

  const [images, setImages] = useState<File[]>([]);
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Countdown ticker
  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  function startCountdown() {
    setCountdown(15);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(countdownRef.current!);
          return null;
        }
        return prev - 1;
      });
    }, 1000);
  }

  function set(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function addImages(files: FileList | null) {
    if (!files) return;
    setImages((prev) => [...prev, ...Array.from(files)].slice(0, 5));
    setShowUploadMenu(false);
  }

  function validateStep1(): boolean {
    const e: Errors = {};
    if (form.primeiroNome.trim().length < 2) e.primeiroNome = "Mínimo 2 caracteres";
    if (form.ultimoNome.trim().length < 2)   e.ultimoNome   = "Mínimo 2 caracteres";
    if (!form.indicativo.trim())              e.indicativo   = "Obrigatório";
    if (form.telefone.trim().length < 6)      e.telefone     = "Número inválido";
    if (!form.tipoServico)                    e.tipoServico  = "Escolha um serviço";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function validateStep2(): boolean {
    const e: Errors = {};
    if (form.rua.trim().length < 3)          e.rua          = "Mínimo 3 caracteres";
    if (form.codigoPostal.trim().length < 4) e.codigoPostal = "Código postal inválido";
    // Andar e elevador mudam o preço mais do que quase tudo o resto: um 4.º
    // sem elevador não é o mesmo trabalho que um rés-do-chão. Deixá-los por
    // responder dava orçamentos que não se aguentavam no local.
    if (!form.andar)                         e.andar        = "Indique o andar";
    if (!form.elevador)                      e.elevador     = "Indique se há elevador";
    if (form.descricao.length > 300)         e.descricao    = "Máximo 300 caracteres";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function nextStep(ev: React.FormEvent) {
    ev.preventDefault();
    if (validateStep1()) setStep(2);
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!validateStep2()) return;
    setLoading(true);
    setServerError("");
    startCountdown();

    try {
      /*
       * As fotos vão com o pedido. Até aqui não iam.
       *
       * O `images` era preenchido pelos botões de câmara e galeria, contado no
       * ecrã ("2 imagens selecionadas"), e nunca chegava ao corpo do POST — que
       * enviava apenas {...form, pagePath}. O cliente anexava, via a
       * confirmação, e a foto era deitada fora em silêncio.
       *
       * É o pior sítio para perder informação: a foto é o que mais melhora a
       * precisão de um orçamento por volume, e é a única coisa que o cliente
       * dá de livre vontade. Sem ela, há um telefonema a pedir o que já tinha
       * sido enviado — e a promessa de "orçamento sem telefonemas" cai.
       *
       * Sobem primeiro, e vai só o URL. Cinco fotos de telemóvel são uns 25 MB
       * em bruto, e o corpo de um pedido serverless tem 4,5 MB de tecto — por
       * isso não podiam ir dentro do JSON nem em multipart. `enviarFicheiro` é
       * o mesmo caminho que o simulador usa: reduz a imagem e escolhe entre a
       * nossa função e o Blob conforme o tamanho.
       *
       * Se uma falhar, o pedido segue à mesma com as que resultaram. Perder o
       * pedido inteiro por causa de uma foto seria trocar um problema por um
       * pior.
       */
      const fotos: Array<{ url: string; name: string; size: number; type: string }> = [];
      for (const ficheiro of images) {
        try {
          const r = await enviarFicheiro(ficheiro);
          // O helper já devolve o ficheiro reduzido, com o tamanho real depois
          // da compressão — usar o original aqui gravava um número que não
          // corresponde ao que está no armazenamento.
          if (r.ok) fotos.push(r.ficheiro);
        } catch {
          /* esta não subiu — as outras seguem */
        }
      }

      const res = await fetch("/api/hero-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          fotos,
          pagePath: typeof window !== "undefined" ? window.location.pathname : "/",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setLoading(false);
        setCountdown(null);
        if (countdownRef.current) clearInterval(countdownRef.current);
        setServerError(data.error ?? "Erro ao enviar. Tente novamente.");
        return;
      }

      setEstimate(data.estimate);
      setSent(true);
    } catch {
      setLoading(false);
      setCountdown(null);
      if (countdownRef.current) clearInterval(countdownRef.current);
      setServerError("Erro de rede. Verifique a sua ligação e tente novamente.");
    }
  }

  // ── auto-reset after 60s ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!sent) return;
    const t = setTimeout(() => {
      setSent(false);
      setEstimate(null);
      setStep(1);
      setForm({
        primeiroNome: "", ultimoNome: "", indicativo: "+351", telefone: "",
        tipoServico: "", rua: "", codigoPostal: "", numeroPosta: "",
        andar: "", elevador: "", descricao: "",
      });
      setImages([]);
      setErrors({});
      setServerError("");
    }, 60_000);
    return () => clearTimeout(t);
  }, [sent]);

  // ── success ───────────────────────────────────────────────────────────────────

  if (sent) {
    return (
      <div
        className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50"
        style={{ minHeight: CARD_MIN_HEIGHT }}
      >
        {/* top accent bar */}
        <div className="h-1 w-full rounded-t-2xl bg-gradient-to-r from-cyan-400 via-teal-400 to-cyan-500" />

        <div className="flex flex-1 flex-col items-center justify-center px-6 py-8 text-center">
          {/* animated check */}
          <div className="relative flex h-16 w-16 items-center justify-center">
            <div className="absolute inset-0 animate-ping rounded-full bg-acao/20" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full border-2 border-cyan-400/40 bg-cyan-50">
              <svg className="h-7 w-7 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </div>

          <h3 className="mt-5 text-xl font-bold text-tinta">Pedido enviado com sucesso!</h3>

          <p className="mt-2 max-w-[280px] text-sm leading-relaxed text-tinta-fraca">
            Recebe as propostas dos profissionais dentro de {PRAZO_DE_RESPOSTA.porExtenso}. Escolhe a que quiser — ou nenhuma, sem compromisso.
          </p>

          {/* info pills */}
          <div className="mt-6 flex flex-col gap-2 w-full max-w-[300px]">
            <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <span className="text-lg">📞</span>
              <div className="text-left">
                <p className="text-[13px] font-semibold text-tinta">Resposta em &lt;24&nbsp;h</p>
                <p className="text-[13px] text-tinta-fraca">Via chamada ou WhatsApp</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <span className="text-lg">📋</span>
              <div className="text-left">
                <p className="text-[13px] font-semibold text-tinta">Orçamento confirmado antes de avançar</p>
                <p className="text-[13px] text-tinta-fraca">Nenhum trabalho sem a sua aprovação</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
              <span className="text-lg">✅</span>
              <div className="text-left">
                <p className="text-[13px] font-semibold text-tinta">Sem custos ocultos</p>
                <p className="text-[13px] text-tinta-fraca">O preço fechado é o preço final</p>
              </div>
            </div>
          </div>

          <p className="mt-6 text-[13px] text-tinta-fraca">
            Este formulário irá reiniciar automaticamente em 1 minuto.
          </p>
        </div>
      </div>
    );
  }

  // ── form card (fixed height) ───────────────────────────────────────────────

  return (
    <div
      className="flex flex-col rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/50"
      style={{ minHeight: CARD_MIN_HEIGHT }}
    >
      {/*
        O QUE ESTE CARTÃO É.

        Abria com uma barra de progresso e a linha "Passo 1/2 · Contacto" a
        10 px. Sem título, sem promessa, sem cabeçalho semântico — e o primeiro
        campo a pedir o nome próprio. Quem chega do Google via um cartão a
        pedir dados sem lhe explicar em troca de quê.

        É o elemento que converte, e era o único da dobra sem hierarquia
        tipográfica própria: o H1 a 51 px e as pílulas coloridas ganhavam-lhe a
        atenção, e ele lia-se como um bloco cinzento de campos.

        O prazo vem da constante e não escrito à mão — é a mesma promessa que o
        hero faz duas linhas acima, e duas cópias divergem sempre.
      */}
      <div className="border-b border-slate-100 px-5 pb-3 pt-5">
        <h2 className="text-[22px] font-bold leading-tight text-tinta">Receba o seu preço</h2>
        <p className="mt-1 text-sm text-tinta-fraca">
          Dois passos, dois minutos. {PRAZO_DE_RESPOSTA.frase}, sem compromisso.
        </p>
      </div>

      {/* progress bar */}
      <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
        <div className="flex flex-1 items-center gap-1.5">
          <div className="h-1 flex-1 rounded-full bg-acao" />
          <div className={`h-1 flex-1 rounded-full transition-colors ${step === 2 ? "bg-acao" : "bg-slate-200"}`} />
        </div>
        <span className="text-[13px] text-tinta-fraca">
          {step === 1 ? "Passo 1/2 · Contacto" : "Passo 2/2 · Localização"}
        </span>
      </div>

      {/* ── STEP 1 ── */}
      {step === 1 && (
        <form onSubmit={nextStep} noValidate className="flex flex-1 flex-col p-5">
          <div className="flex flex-1 flex-col justify-between space-y-3">
            <div className="space-y-3">
              {/* Nome */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor={idDe("primeiroNome")}>Primeiro nome</Label>
                  <input id={idDe("primeiroNome")} className={inputCls(errors.primeiroNome)} aria-invalid={errors.primeiroNome ? true : undefined} aria-describedby={errors.primeiroNome ? idDoErro("primeiroNome") : undefined} placeholder="Ana"
                    value={form.primeiroNome} onChange={(e) => set("primeiroNome", e.target.value)}
                    autoComplete="given-name" />
                  <Err id={idDoErro("primeiroNome")} msg={errors.primeiroNome} />
                </div>
                <div>
                  <Label htmlFor={idDe("ultimoNome")}>Último nome</Label>
                  <input id={idDe("ultimoNome")} className={inputCls(errors.ultimoNome)} aria-invalid={errors.ultimoNome ? true : undefined} aria-describedby={errors.ultimoNome ? idDoErro("ultimoNome") : undefined} placeholder="Silva"
                    value={form.ultimoNome} onChange={(e) => set("ultimoNome", e.target.value)}
                    autoComplete="family-name" />
                  <Err id={idDoErro("ultimoNome")} msg={errors.ultimoNome} />
                </div>
              </div>

              {/* Telefone */}
              <div className="grid grid-cols-[72px_1fr] gap-2">
                <div>
                  <Label htmlFor={idDe("indicativo")}>Ind.</Label>
                  <input id={idDe("indicativo")} className={inputCls(errors.indicativo)} aria-invalid={errors.indicativo ? true : undefined} aria-describedby={errors.indicativo ? idDoErro("indicativo") : undefined} inputMode="tel" placeholder="+351"
                    value={form.indicativo} onChange={(e) => set("indicativo", e.target.value)}
                    autoComplete="tel-country-code" maxLength={6} />
                  <Err id={idDoErro("indicativo")} msg={errors.indicativo} />
                </div>
                <div>
                  <Label htmlFor={idDe("telefone")}>Telemóvel</Label>
                  <input id={idDe("telefone")} className={inputCls(errors.telefone)} aria-invalid={errors.telefone ? true : undefined} aria-describedby={errors.telefone ? idDoErro("telefone") : undefined} inputMode="tel" placeholder="912 345 678"
                    value={form.telefone} onChange={(e) => set("telefone", e.target.value)}
                    type="tel" autoComplete="tel-national" maxLength={20} />
                  <Err id={idDoErro("telefone")} msg={errors.telefone} />
                </div>
              </div>

              {/* Serviço */}
              <div>
                <Label htmlFor={idDe("tipoServico")}>Tipo de serviço</Label>
                <select id={idDe("tipoServico")} className={selectCls(errors.tipoServico)} aria-invalid={errors.tipoServico ? true : undefined} aria-describedby={errors.tipoServico ? idDoErro("tipoServico") : undefined}
                  value={form.tipoServico} onChange={(e) => set("tipoServico", e.target.value)}>
                  <option value="">Escolha o serviço…</option>
                  {SERVICE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <Err id={idDoErro("tipoServico")} msg={errors.tipoServico} />
              </div>
            </div>

            {/* spacer + CTA at bottom to match phase 2 height */}
            <div className="mt-auto space-y-3 pt-3">
              <button type="submit"
                className="w-full rounded-xl bg-acao py-3 text-sm font-bold text-white shadow-lg shadow-cyan-500/25 transition hover:bg-acao-hover">
                Próximo
              </button>
              {/* A linha "Sem compromisso · Gratuito · Resposta <24 h" saiu
                  daqui e do passo 2: passou a estar dita uma vez, no cabeçalho
                  do cartão, que é onde a decisão de começar é tomada. */}
            </div>
          </div>
        </form>
      )}

      {/* ── STEP 2 ── */}
      {step === 2 && (
        <form onSubmit={handleSubmit} noValidate className="flex flex-1 flex-col p-5">
          <div className="flex flex-1 flex-col justify-between space-y-3">
            <div className="space-y-3">
              {/* Rua */}
              <div>
                <Label htmlFor={idDe("rua")}>Rua / Avenida</Label>
                <input id={idDe("rua")} className={inputCls(errors.rua)} aria-invalid={errors.rua ? true : undefined} aria-describedby={errors.rua ? idDoErro("rua") : undefined} placeholder="Rua das Flores"
                  value={form.rua} onChange={(e) => set("rua", e.target.value)}
                  autoComplete="street-address" />
                <Err id={idDoErro("rua")} msg={errors.rua} />
              </div>

              {/* CP + porta */}
              <div className="grid grid-cols-[1fr_76px] gap-2">
                <div>
                  <Label htmlFor={idDe("codigoPostal")}>Código postal</Label>
                  <input id={idDe("codigoPostal")} className={inputCls(errors.codigoPostal)} aria-invalid={errors.codigoPostal ? true : undefined} aria-describedby={errors.codigoPostal ? idDoErro("codigoPostal") : undefined} inputMode="numeric" placeholder="2840-123"
                    value={form.codigoPostal} onChange={(e) => set("codigoPostal", e.target.value)}
                    autoComplete="postal-code" maxLength={12} />
                  <Err id={idDoErro("codigoPostal")} msg={errors.codigoPostal} />
                </div>
                <div>
                  <Label htmlFor={idDe("numeroPosta")}>Nº porta</Label>
                  <input id={idDe("numeroPosta")} className={inputCls()} placeholder="12"
                    value={form.numeroPosta} onChange={(e) => set("numeroPosta", e.target.value)}
                    inputMode="numeric" maxLength={10} />
                </div>
              </div>

              {/* Andar + elevador */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label htmlFor={idDe("andar")}>Andar</Label>
                  <select id={idDe("andar")} className={selectCls(errors.andar)} aria-invalid={errors.andar ? true : undefined} aria-describedby={errors.andar ? idDoErro("andar") : undefined} value={form.andar}
                    onChange={(e) => set("andar", e.target.value)}>
                    {ANDAR_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <Err id={idDoErro("andar")} msg={errors.andar} />
                </div>
                <div>
                  <Label htmlFor={idDe("elevador")}>Elevador</Label>
                  <select id={idDe("elevador")} className={selectCls(errors.elevador)} aria-invalid={errors.elevador ? true : undefined} aria-describedby={errors.elevador ? idDoErro("elevador") : undefined} value={form.elevador}
                    onChange={(e) => set("elevador", e.target.value as FormData["elevador"])}>
                    {ELEVATOR_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <Err id={idDoErro("elevador")} msg={errors.elevador} />
                </div>
              </div>

              {/* Descrição + upload */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <Label htmlFor={idDe("descricao")}>Descrição <span className="font-normal text-tinta-fraca">(opcional)</span></Label>
                  <span className={`text-[13px] ${form.descricao.length > 280 ? "text-amber-500" : "text-tinta-fraca"}`}>
                    {form.descricao.length}/300
                  </span>
                </div>

                <div className={`relative rounded-lg border bg-white transition focus-within:border-acao focus-within:ring-1 focus-within:ring-acao/25 ${errors.descricao ? "border-erro" : "border-slate-200"}`}>
                  <textarea
                    id={idDe("descricao")}
                    value={form.descricao}
                    onChange={(e) => set("descricao", e.target.value)}
                    aria-invalid={errors.descricao ? true : undefined}
                    aria-describedby={errors.descricao ? idDoErro("descricao") : undefined}
                    maxLength={310}
                    rows={3}
                    placeholder="Ex: 1 sofá de 3 lugares, 1 colchão de casal…"
                    className="w-full resize-none rounded-lg bg-transparent px-3.5 pb-8 pt-3 text-base text-slate-800 placeholder-tinta-fraca outline-none"
                  />
                  <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between rounded-b-lg border-t border-slate-100 bg-slate-50 px-3 py-1.5">
                    {images.length > 0 ? (
                      <span className="text-[13px] text-tinta-fraca">
                        {images.length} imagem{images.length > 1 ? "ns" : ""} selecionada{images.length > 1 ? "s" : ""}
                      </span>
                    ) : (
                      <span className="text-[13px] text-tinta-fraca">Adicionar fotos</span>
                    )}
                    <div className="relative">
                      <button type="button"
                        onClick={() => setShowUploadMenu((v) => !v)}
                        className="flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-base text-tinta-fraca transition hover:border-cyan-400 hover:bg-cyan-50 hover:text-acao"
                        aria-label="Adicionar imagem">
                        +
                      </button>
                      {showUploadMenu && (
                        <div className="absolute bottom-8 right-0 z-20 w-40 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                          <button type="button" onClick={() => cameraRef.current?.click()}
                            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-900">
                            <span>📷</span> Tirar foto
                          </button>
                          <button type="button" onClick={() => galleryRef.current?.click()}
                            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-900">
                            <span>🖼️</span> Escolher do telemóvel
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <Err id={idDoErro("descricao")} msg={errors.descricao} />
              </div>
            </div>

            {/* hidden inputs */}
            <input ref={cameraRef} type="file" accept="image/*" capture="environment"
              multiple className="hidden" onChange={(e) => addImages(e.target.files)} />
            <input ref={galleryRef} type="file" accept="image/*"
              multiple className="hidden" onChange={(e) => addImages(e.target.files)} />

            {serverError && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                {serverError}
              </p>
            )}

            {/* CTA at bottom */}
            <div className="mt-auto space-y-3 pt-3">
              <div className="flex gap-2">
                <button type="button"
                  onClick={() => { setStep(1); setErrors({}); }}
                  disabled={loading}
                  className="rounded-xl border border-slate-200 px-4 py-3 text-sm text-tinta-fraca transition hover:border-slate-300 hover:text-slate-700 disabled:opacity-40">
                  ← Voltar
                </button>
                <button type="submit" disabled={loading}
                  className="relative flex-1 overflow-hidden rounded-xl bg-acao py-3 text-sm font-bold text-white shadow-lg shadow-cyan-500/25 transition hover:bg-acao-hover disabled:cursor-not-allowed disabled:bg-acao">
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      A calcular o seu preço… (até 15 s)
                      {countdown !== null && (
                        <span className="tabular-nums text-white/70">{countdown}s</span>
                      )}
                    </span>
                  ) : (
                    "Pedir orçamento grátis"
                  )}
                </button>
              </div>
              {/* A linha "Sem compromisso · Gratuito · Resposta <24 h" saiu
                  daqui e do passo 2: passou a estar dita uma vez, no cabeçalho
                  do cartão, que é onde a decisão de começar é tomada. */}
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
