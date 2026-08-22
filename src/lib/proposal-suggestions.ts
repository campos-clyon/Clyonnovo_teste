/**
 * Sugestões de justificação para a proposta de preço ao cliente.
 *
 * A justificação é obrigatória (plano de negociação §9) porque reduz
 * contrapropostas motivadas por desconfiança. Mas um campo obrigatório sem
 * ajuda produz texto apressado e genérico — que não convence ninguém.
 *
 * Estas sugestões saem dos FACTOS do pedido (request_facts) e da direcção do
 * ajuste face ao valor do motor: se o admin sobe o preço, propõem-se as razões
 * que justificam subir; se desce, as que justificam descer. Um texto que cita
 * o 3.º andar sem elevador do próprio cliente vale mais do que "devido às
 * características do serviço".
 */

/** Ficha do pedido — contrato entre a app, o motor e a IA (§3.2 da nota). */
export interface RequestFacts {
  service?: string | null;
  local?: {
    andar?: number | string | null;
    elevador?: boolean | null;
    carrinha_perto?: boolean | null;
    tipo?: string | null;
    lat?: number | null;
  } | null;
  carga?: {
    itens?: Array<{ nome?: string; qtd?: number }> | null;
    volume_m3?: number | null;
    escala?: string | null;
  } | null;
  fotos?: unknown[] | null;
  quando?: { urgencia?: string | null } | null;
  notas_cliente?: string | null;
}

export type SuggestionTone = "increase" | "decrease" | "neutral";

export interface Suggestion {
  id: string;
  /** Texto pronto a enviar ao cliente */
  text: string;
  tone: SuggestionTone;
  /** Facto que o justifica — mostrado como etiqueta curta na UI */
  basis: string;
}

export interface SuggestionInput {
  /** Valor que o admin escreveu na proposta */
  proposalAmount: number | null;
  /** Valor calculado pelo motor (a referência) */
  referencePrice: number | null;
  /** Piso anti-prejuízo do motor */
  engineFloor?: number | null;
  facts?: RequestFacts | null;
  priceStatus?: string | null;
}

export interface SuggestionResult {
  /** "up" | "down" | "same" — direcção do ajuste face ao motor */
  direction: "up" | "down" | "same";
  /** Diferença absoluta em euros (0 quando não há referência) */
  deltaEur: number;
  /** Percentagem face à referência */
  deltaPct: number;
  suggestions: Suggestion[];
  /** Aviso quando a proposta desce abaixo do piso anti-prejuízo */
  belowFloorWarning: string | null;
}

/** Itens que costumam exigir equipa reforçada ou equipamento próprio. */
const ITENS_EXIGENTES = [
  "piano", "cofre", "arca", "frigorífico americano", "frigorifico americano",
  "máquina de lavar", "maquina de lavar", "roupeiro", "armário", "armario",
  "sofá", "sofa", "aquário", "aquario", "billar", "bilhar", "caldeira",
];

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function andarLabel(andar: number): string {
  if (andar === 0) return "rés-do-chão";
  return `${andar}.º andar`;
}

function totalItens(facts: RequestFacts | null | undefined): number {
  const itens = facts?.carga?.itens;
  if (!Array.isArray(itens)) return 0;
  return itens.reduce((s, it) => s + (num(it?.qtd) ?? 1), 0);
}

function itensExigentes(facts: RequestFacts | null | undefined): string[] {
  const itens = facts?.carga?.itens;
  if (!Array.isArray(itens)) return [];
  const out: string[] = [];
  for (const it of itens) {
    const nome = String(it?.nome ?? "").toLowerCase();
    if (ITENS_EXIGENTES.some((kw) => nome.includes(kw))) {
      out.push(String(it?.nome ?? "").trim());
    }
  }
  return out;
}

/**
 * Gera sugestões de justificação. Função pura — a UI só apresenta.
 *
 * Limiar de 3% (mínimo 5 €) para não classificar arredondamentos como
 * ajuste: propor 250 € sobre 249 € não é "subir o preço".
 */
export function suggestJustifications(input: SuggestionInput): SuggestionResult {
  const { proposalAmount, referencePrice, engineFloor, facts, priceStatus } = input;

  const amount = num(proposalAmount);
  const ref = num(referencePrice);

  let direction: "up" | "down" | "same" = "same";
  let deltaEur = 0;
  let deltaPct = 0;

  if (amount !== null && ref !== null && ref > 0) {
    deltaEur = Math.round((amount - ref) * 100) / 100;
    deltaPct = Math.round((deltaEur / ref) * 1000) / 10;
    const limiar = Math.max(5, ref * 0.03);
    if (deltaEur > limiar) direction = "up";
    else if (deltaEur < -limiar) direction = "down";
  }

  const floor = num(engineFloor);
  const belowFloorWarning =
    amount !== null && floor !== null && amount < floor
      ? `Esta proposta (${amount} €) fica abaixo do piso anti-prejuízo do motor (${floor} €). Confirma antes de enviar.`
      : null;

  const andar = num(facts?.local?.andar);
  const elevador = facts?.local?.elevador;
  const carrinhaPerto = facts?.local?.carrinha_perto;
  const urgencia = facts?.quando?.urgencia ?? null;
  const volume = num(facts?.carga?.volume_m3);
  const nItens = totalItens(facts);
  const exigentes = itensExigentes(facts);
  const semFotos = !Array.isArray(facts?.fotos) || facts.fotos.length === 0;
  const semCoordenadas = facts?.local != null && facts.local.lat == null;

  const s: Suggestion[] = [];

  // ── Razões para SUBIR ────────────────────────────────────────────────────
  if (direction === "up") {
    if (elevador === false && andar !== null && andar > 0) {
      s.push({
        id: "escadas",
        basis: `${andarLabel(andar)} sem elevador`,
        text: `O acesso é por escadas até ao ${andarLabel(andar)}, sem elevador. Isso obriga a mais tempo de trabalho e a uma equipa reforçada para transportar tudo em segurança.`,
        tone: "increase",
      });
    }
    if (carrinhaPerto === false) {
      s.push({
        id: "carrinha-longe",
        basis: "carrinha não encosta",
        text: "A carrinha não consegue encostar à entrada, por isso a carga tem de ser transportada à mão até ao veículo. É esse percurso extra que se reflecte no valor.",
        tone: "increase",
      });
    }
    if (urgencia === "hoje" || urgencia === "today") {
      s.push({
        id: "urgencia-hoje",
        basis: "urgência: hoje",
        text: "Para conseguirmos ir hoje temos de reorganizar a rota já planeada e deslocar uma equipa fora do circuito. É esse encaixe de última hora que o valor reflecte.",
        tone: "increase",
      });
    } else if (urgencia === "amanha" || urgencia === "amanhã" || urgencia === "tomorrow") {
      s.push({
        id: "urgencia-amanha",
        basis: "urgência: amanhã",
        text: "A recolha para amanhã implica encaixar o serviço numa rota já fechada, o que tem um custo acrescido face a uma data flexível.",
        tone: "increase",
      });
    }
    if (exigentes.length > 0) {
      const lista = exigentes.slice(0, 3).join(", ");
      s.push({
        id: "itens-exigentes",
        basis: lista,
        text: `Há itens que exigem cuidado e equipa reforçada (${lista}). São peças pesadas ou volumosas, e o valor cobre o pessoal e o tempo necessários para as mover sem danos.`,
        tone: "increase",
      });
    }
    if (volume !== null && volume >= 8) {
      s.push({
        id: "volume-grande",
        basis: `${volume} m³`,
        text: `O volume estimado é de cerca de ${volume} m³, o que ocupa mais do que uma carrinha e obriga a mais do que uma viagem.`,
        tone: "increase",
      });
    } else if (nItens >= 8) {
      s.push({
        id: "muitos-itens",
        basis: `${nItens} itens`,
        text: `São ${nItens} itens no total, o que corresponde a uma carga completa e não a uma recolha pontual.`,
        tone: "increase",
      });
    }
    if (semFotos) {
      s.push({
        id: "sem-fotos",
        basis: "sem fotos",
        text: "Como não temos fotos, mantivemos uma margem para imprevistos no local. Se nos enviar fotos do que precisa de recolher, podemos rever este valor.",
        tone: "increase",
      });
    }
  }

  // ── Razões para DESCER ───────────────────────────────────────────────────
  if (direction === "down") {
    const acessoFacil: string[] = [];
    if (elevador === true) acessoFacil.push("há elevador");
    if (andar === 0) acessoFacil.push("é ao rés-do-chão");
    if (carrinhaPerto === true) acessoFacil.push("a carrinha encosta à entrada");

    if (acessoFacil.length > 0) {
      const lista = acessoFacil.length === 1
        ? acessoFacil[0]
        : `${acessoFacil.slice(0, -1).join(", ")} e ${acessoFacil[acessoFacil.length - 1]}`;
      s.push({
        id: "acesso-facil",
        basis: acessoFacil.join(" · "),
        text: `Ajustámos o valor para baixo: o acesso é fácil — ${lista}. Isso reduz bastante o tempo de trabalho e não obriga a equipa reforçada.`,
        tone: "decrease",
      });
    }
    if (volume !== null && volume > 0 && volume <= 3) {
      s.push({
        id: "volume-pequeno",
        basis: `${volume} m³`,
        text: `O volume é reduzido (cerca de ${volume} m³) e cabe numa carrinha com folga, por isso conseguimos fazê-lo com uma equipa mais pequena.`,
        tone: "decrease",
      });
    } else if (nItens > 0 && nItens <= 3) {
      s.push({
        id: "poucos-itens",
        basis: `${nItens} ${nItens === 1 ? "item" : "itens"}`,
        text: `Como são apenas ${nItens} ${nItens === 1 ? "item" : "itens"}, a recolha é rápida e não exige um segundo operador — reflectimos isso no valor.`,
        tone: "decrease",
      });
    }
    if (urgencia === "flexivel" || urgencia === "flexível" || urgencia === "flexible" || urgencia === "no") {
      s.push({
        id: "data-flexivel",
        basis: "data flexível",
        text: "Como a data é flexível, conseguimos encaixar este trabalho numa rota que já temos planeada para a sua zona — e passamos essa poupança para si.",
        tone: "decrease",
      });
    }
    s.push({
      id: "ajuste-comercial",
      basis: "ajuste comercial",
      text: "Revimos a estimativa inicial e conseguimos melhorar o valor para este serviço. É o preço final, sem custos adicionais no dia.",
      tone: "decrease",
    });
  }

  // ── Confirmar o valor do motor ───────────────────────────────────────────
  if (direction === "same") {
    const partes: string[] = [];
    if (nItens > 0) partes.push(`os ${nItens} ${nItens === 1 ? "item" : "itens"} indicados`);
    if (elevador === false && andar !== null && andar > 0) partes.push(`o acesso pelo ${andarLabel(andar)} sem elevador`);
    else if (andar !== null) partes.push(`o acesso (${andarLabel(andar)})`);
    partes.push("a deslocação da equipa");

    s.push({
      id: "detalhe-calculo",
      basis: "cálculo do motor",
      text: `Este valor foi calculado com base em ${partes.join(", ")}. Inclui mão de obra, transporte e o destino licenciado dos materiais — sem custos adicionais no dia.`,
      tone: "neutral",
    });
    s.push({
      id: "tudo-incluido",
      basis: "tudo incluído",
      text: "O valor cobre a deslocação, a equipa e a remoção completa dos itens indicados, incluindo o destino licenciado dos materiais. Não há extras no dia do serviço.",
      tone: "neutral",
    });
    if (semFotos) {
      s.push({
        id: "confirmar-fotos",
        basis: "sem fotos",
        text: "Este valor assume o que nos descreveu. Se nos enviar fotos, confirmamos o preço definitivo antes do dia do serviço.",
        tone: "neutral",
      });
    }
  }

  // ── Avisos que valem em qualquer direcção ────────────────────────────────
  if (priceStatus === "revisao" && direction !== "down") {
    s.push({
      id: "revisao-presencial",
      basis: "pedido marcado para revisão",
      text: "Pelo que nos descreveu, este serviço tem particularidades que preferimos confirmar no local. O valor indicado é a nossa melhor estimativa e só é fechado depois dessa confirmação.",
      tone: "neutral",
    });
  }
  if (semCoordenadas && direction !== "down") {
    s.push({
      id: "morada-manual",
      basis: "morada sem coordenadas",
      text: "A morada foi escrita à mão, por isso a distância é estimada. Assim que confirmarmos a localização exacta, ajustamos o valor se houver diferença.",
      tone: "neutral",
    });
  }

  return { direction, deltaEur, deltaPct, suggestions: s, belowFloorWarning };
}
