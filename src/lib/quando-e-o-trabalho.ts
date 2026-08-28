/**
 * QUANDO É O TRABALHO — a data e a hora, e não uma palavra relativa.
 *
 * "O pedido no feed diz que o cliente deseja que seja recolhido amanhã, mas ao
 * clicar ele deveria mostrar a data e horário para o parceiro ver se faz
 * sentido na sua agenda."
 *
 * O painel dizia «Amanhã» na lista e voltava a dizer «Amanhã» lá dentro. Quem
 * tem a semana marcada não decide com isso: precisa de um dia, para saber se
 * já tem lá outra coisa.
 *
 * E HÁ UM PROBLEMA PIOR ESCONDIDO NA PALAVRA. «Amanhã» foi escrito pelo
 * cliente no dia em que fez o pedido e ficou gravado como está — mas lê-se
 * sempre em relação a HOJE. Um pedido de segunda-feira a dizer «amanhã»
 * continuava a dizer «amanhã» na quinta. O #226 é exactamente isso: pediu-se a
 * 25 de agosto para o dia seguinte, e três dias depois o cartão ainda
 * prometia amanhã.
 *
 * Por isso a conta faz-se a partir do dia em que o pedido foi criado, e só
 * depois se traduz para hoje/amanhã/ontem. A palavra volta a querer dizer o
 * que diz.
 *
 * NADA AQUI INVENTA UMA HORA. Quando o cliente não marcou nenhuma — que é o
 * caso da esmagadora maioria, porque o simulador nunca a pergunta — diz-se
 * isso por palavras, e não «às 00:00».
 */

/**
 * O fuso é o de Portugal, e não o do telemóvel de quem lê.
 *
 * O trabalho é às onze em Lisboa. Se ele estiver a ver isto de férias em
 * Espanha, continua a ser às onze em Lisboa.
 */
const TZ = "Europe/Lisbon";

export type QuandoDoTrabalho = {
  /** Curto, para o cartão da lista: "Amanhã", "Sáb, 29", "Já passou". */
  curto: string;
  /** O dia por extenso: "Amanhã, sábado, 29 de agosto". */
  dia: string;
  /** "11:00", ou `null` quando ninguém marcou hora. */
  hora: string | null;
  /** O que ainda falta combinar, ou o que já correu mal. */
  aviso: string | null;
  /** O dia que o cliente pediu já passou. */
  passou: boolean;
  /**
   * De onde saiu isto:
   *  · `marcada`  — há data e hora gravadas no pedido;
   *  · `deduzida` — o cliente disse "hoje"/"amanhã" e conta-se desde a criação;
   *  · `janela`   — "esta semana", que é um intervalo e não um dia;
   *  · `sem_data` — não há nada, e o trabalho é quando os dois quiserem.
   */
  origem: "marcada" | "deduzida" | "janela" | "sem_data";
};

type Entrada = {
  urgency?: string | null;
  dataAgendada?: string | Date | null;
  /** Quando o cliente fez o pedido — é o zero de "amanhã". */
  criadoEm?: string | Date | null;
};

/** O dia civil em Lisboa, "2026-08-28": o mesmo dia para toda a gente. */
function diaCivil(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Quantos dias de calendário separam dois instantes, contados em Lisboa. */
function diasEntre(de: Date, para: Date): number {
  const a = Date.parse(`${diaCivil(de)}T00:00:00Z`);
  const b = Date.parse(`${diaCivil(para)}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}

function paraData(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

const maiuscula = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

const porExtenso = (d: Date) =>
  new Intl.DateTimeFormat("pt-PT", {
    timeZone: TZ,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);

const curtinho = (d: Date) =>
  new Intl.DateTimeFormat("pt-PT", {
    timeZone: TZ,
    weekday: "short",
    day: "numeric",
  })
    .format(d)
    .replace(/\.$/, "");

const soODia = (d: Date) =>
  new Intl.DateTimeFormat("pt-PT", { timeZone: TZ, day: "numeric", month: "long" }).format(d);

/** "11:00" — ou `null` à meia-noite, que é o que uma data sem hora vale. */
function horaDe(d: Date): string | null {
  const h = new Intl.DateTimeFormat("pt-PT", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  /*
   * Meia-noite não é uma hora marcada: é o que sobra quando se grava um dia
   * sem hora nenhuma. Ninguém vai buscar um sofá às 00:00, e escrevê-lo daria
   * ao profissional a certeza errada.
   */
  return h === "00:00" || h === "24:00" ? null : h;
}

/** As palavras que o cliente pode ter dito, e quantos dias depois querem dizer. */
const DIAS_DEPOIS: Record<string, number> = {
  today: 0,
  hoje: 0,
  tomorrow: 1,
  amanha: 1,
  "amanhã": 1,
};

const ESTA_SEMANA = new Set(["this_week", "esta_semana", "semana"]);

/**
 * Quando é o trabalho, do ponto de vista de quem o vai fazer.
 *
 * `agora` é um parâmetro para os testes poderem escolher o dia; em produção
 * não se passa.
 */
export function quandoEOTrabalho(t: Entrada, agora: Date = new Date()): QuandoDoTrabalho {
  const marcada = paraData(t.dataAgendada);

  /*
   * A DATA GRAVADA GANHA SEMPRE à palavra do cliente.
   *
   * Quando alguém marcou o dia — ao telefone, no backoffice, ou porque o
   * cliente escolheu no formulário — é esse o combinado. A urgência é o que
   * ele desejava antes de haver conversa; a data é o que ficou.
   */
  if (marcada) {
    const dias = diasEntre(agora, marcada);
    const hora = horaDe(marcada);
    return {
      curto: rotuloCurto(marcada, dias),
      dia: rotuloLongo(marcada, dias),
      hora,
      aviso:
        dias < 0
          ? "O dia marcado já passou. Fale com o cliente antes de propor."
          : hora
            ? null
            : "Sem hora marcada — combine-a com o cliente.",
      passou: dias < 0,
      origem: "marcada",
    };
  }

  const palavra = (t.urgency ?? "").trim().toLowerCase();
  const criado = paraData(t.criadoEm);

  if (palavra in DIAS_DEPOIS) {
    /*
     * O zero de "amanhã" é o dia do PEDIDO, e não hoje.
     *
     * Sem a data de criação não há conta possível, e aí conta-se desde hoje —
     * que é o que o painel fazia sempre. Fica assinalado no aviso: mais vale
     * dizer que se está a supor do que fingir que se sabe.
     */
    const zero = criado ?? agora;
    const alvo = new Date(
      Date.parse(`${diaCivil(zero)}T12:00:00Z`) + DIAS_DEPOIS[palavra] * 86_400_000,
    );
    const dias = diasEntre(agora, alvo);
    return {
      curto: rotuloCurto(alvo, dias),
      dia: rotuloLongo(alvo, dias),
      hora: null,
      aviso:
        dias < 0
          ? `O cliente pediu "${palavra === "today" || palavra === "hoje" ? "hoje" : "amanhã"}" ` +
            `a ${soODia(zero)}. Esse dia já passou — confirme com ele antes de propor.`
          : "O cliente não marcou hora — combine-a com ele.",
      passou: dias < 0,
      origem: "deduzida",
    };
  }

  if (ESTA_SEMANA.has(palavra)) {
    /*
     * "Esta semana" é uma janela, e não um dia. Escrever um dia qualquer lá
     * dentro seria inventá-lo — o que se pode dizer é até quando.
     */
    const zero = criado ?? agora;
    const fim = new Date(Date.parse(`${diaCivil(zero)}T12:00:00Z`) + 7 * 86_400_000);
    const dias = diasEntre(agora, fim);
    return {
      curto: dias < 0 ? "Passou" : "Esta semana",
      dia:
        dias < 0
          ? `O cliente queria na semana de ${soODia(zero)}`
          : `Até ${porExtenso(fim)}`,
      hora: null,
      aviso:
        dias < 0
          ? `O cliente pediu "esta semana" a ${soODia(zero)}. Confirme com ele antes de propor.`
          : "Sem dia nem hora marcados — combine-os com o cliente.",
      passou: dias < 0,
      origem: "janela",
    };
  }

  return {
    curto: "Sem pressa",
    dia: "Sem data marcada",
    hora: null,
    aviso: "O cliente não tem pressa. Proponha o dia que lhe der jeito.",
    passou: false,
    origem: "sem_data",
  };
}

function rotuloCurto(d: Date, dias: number): string {
  if (dias === 0) return "Hoje";
  if (dias === 1) return "Amanhã";
  if (dias === -1) return "Ontem";
  if (dias > 1 && dias <= 6) return maiuscula(curtinho(d));
  return maiuscula(soODia(d));
}

function rotuloLongo(d: Date, dias: number): string {
  if (dias === 0) return `Hoje, ${porExtenso(d)}`;
  if (dias === 1) return `Amanhã, ${porExtenso(d)}`;
  if (dias === -1) return `Ontem, ${porExtenso(d)}`;
  return maiuscula(porExtenso(d));
}

/**
 * Uma linha só, para onde não há espaço para duas: "Amanhã, sábado, 29 de
 * agosto, às 11:00".
 */
export function quandoPorExtenso(t: Entrada, agora: Date = new Date()): string {
  const q = quandoEOTrabalho(t, agora);
  return q.hora ? `${q.dia}, às ${q.hora}` : q.dia;
}

/**
 * O trabalho é hoje ou amanhã, A SÉRIO — contado a partir de hoje e não da
 * palavra congelada no pedido.
 *
 * É isto que decide o distintivo ⚡ na lista. Antes bastava a palavra, e um
 * pedido de há três dias a dizer «amanhã» continuava a acender-se.
 */
export function eMesmoUrgente(t: Entrada, agora: Date = new Date()): boolean {
  const q = quandoEOTrabalho(t, agora);
  if (q.passou) return false;
  return q.curto === "Hoje" || q.curto === "Amanhã";
}
