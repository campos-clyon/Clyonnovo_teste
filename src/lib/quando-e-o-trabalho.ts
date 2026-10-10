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
   *  · `combinada` — o profissional marcou o dia com o cliente («Marcar»);
   *  · `marcada`  — há data e hora gravadas no pedido;
   *  · `deduzida` — o cliente disse "hoje"/"amanhã" e conta-se desde a criação;
   *  · `janela`   — "esta semana" ou "a próxima semana", que são intervalos e não dias;
   *  · `sem_data` — não há nada, e o trabalho é quando os dois quiserem.
   */
  origem: "combinada" | "marcada" | "deduzida" | "janela" | "sem_data";
};

type Entrada = {
  urgency?: string | null;
  /**
   * O dia que o profissional combinou com o cliente (`negociacoes.dataCombinada`).
   * Vive à parte de `dataAgendada`, que é o que o cliente PEDIU — ver a rota
   * `/api/profissionais/agenda`.
   */
  dataCombinada?: string | Date | null;
  dataAgendada?: string | Date | null;
  /** Quando o cliente fez o pedido — é o zero de "amanhã". */
  criadoEm?: string | Date | null;
};

/*
 * OS FORMATADORES FAZEM-SE UMA VEZ — 07-10-2026.
 *
 * Eram criados a cada chamada, e criar um `Intl.DateTimeFormat` é caro. A
 * lista dos trabalhos do painel chama isto por cartão, mais de uma vez: com
 * 250 trabalhos e um processador quatro vezes mais lento, passava mais de
 * um segundo só a criá-los — era o que mais pesava no painel (perfil de CPU
 * de 07-10-2026). As opções são fixas, e o resultado é o mesmo.
 */
const DIA_CIVIL = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const POR_EXTENSO = new Intl.DateTimeFormat("pt-PT", {
  timeZone: TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
});
const CURTINHO = new Intl.DateTimeFormat("pt-PT", { timeZone: TZ, weekday: "short", day: "numeric" });
const SO_O_DIA = new Intl.DateTimeFormat("pt-PT", { timeZone: TZ, day: "numeric", month: "long" });
const HORA = new Intl.DateTimeFormat("pt-PT", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** O dia civil em Lisboa, "2026-08-28": o mesmo dia para toda a gente. */
function diaCivil(d: Date): string {
  return DIA_CIVIL.format(d);
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

const porExtenso = (d: Date) => POR_EXTENSO.format(d);

const curtinho = (d: Date) => CURTINHO.format(d).replace(/\.$/, "");

const soODia = (d: Date) => SO_O_DIA.format(d);

/** "11:00" — ou `null` à meia-noite, que é o que uma data sem hora vale. */
function horaDe(d: Date): string | null {
  const h = HORA.format(d);
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

/** «Na próxima semana» — 10-10-2026: a semana de segunda a domingo a seguir à do pedido. */
const PROXIMA_SEMANA = new Set(["next_week", "proxima_semana"]);

/**
 * Quando é o trabalho, do ponto de vista de quem o vai fazer.
 *
 * `agora` é um parâmetro para os testes poderem escolher o dia; em produção
 * não se passa.
 */
export function quandoEOTrabalho(t: Entrada, agora: Date = new Date()): QuandoDoTrabalho {
  /*
   * O DIA COMBINADO GANHA A TUDO — 01-10-2026.
   *
   * *«O site é muito lento para mudar as datas e horário; mesmo que altere,
   * ele não faz de imediato.»* Não fazia nunca: o «Marcar» grava em
   * `dataCombinada`, e esta conta só lia `dataAgendada`, o dia que o cliente
   * pediu. O profissional marcava o dia 2, via «Marcado», e por cima
   * continuava a ler «Ontem, 30 de setembro — o dia marcado já passou».
   *
   * O que o cliente pediu não se perde: o detalhe mostra-o por baixo quando é
   * diferente.
   */
  const combinada = paraData(t.dataCombinada);
  if (combinada) {
    const dias = diasEntre(agora, combinada);
    const hora = horaDe(combinada);
    return {
      curto: rotuloCurto(combinada, dias),
      dia: rotuloLongo(combinada, dias),
      hora,
      aviso:
        dias < 0
          ? "O dia combinado já passou. Se ficou para outro dia, corrija-o em baixo."
          : hora
            ? null
            : "Sem hora marcada — combine-a com o cliente.",
      passou: dias < 0,
      origem: "combinada",
    };
  }

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

  if (PROXIMA_SEMANA.has(palavra)) {
    /*
     * «NA PRÓXIMA SEMANA» — 10-10-2026, uma opção nova do «Registar pedido».
     * Também é uma janela: de segunda a domingo da semana a seguir à do
     * pedido. Quando essa semana chega, lê-se «esta semana»; quando passa,
     * diz-se que passou.
     */
    const zero = criado ?? agora;
    const meioDia = Date.parse(`${diaCivil(zero)}T12:00:00Z`);
    const diaDaSemana = new Date(meioDia).getUTCDay(); // 0 = domingo
    const ateSegunda = (8 - diaDaSemana) % 7 || 7;
    const inicio = new Date(meioDia + ateSegunda * 86_400_000);
    const fim = new Date(inicio.getTime() + 6 * 86_400_000);
    const ateAoInicio = diasEntre(agora, inicio);
    const ateAoFim = diasEntre(agora, fim);
    const passou = ateAoFim < 0;
    return {
      curto: passou ? "Passou" : ateAoInicio <= 0 ? "Esta semana" : "Próxima semana",
      dia: passou
        ? `O cliente queria na semana de ${soODia(inicio)}`
        : `Entre ${porExtenso(inicio)} e ${porExtenso(fim)}`,
      hora: null,
      aviso: passou
        ? `O cliente pediu "a próxima semana" a ${soODia(zero)}. Confirme com ele antes de propor.`
        : "Sem dia nem hora marcados — combine-os com o cliente.",
      passou,
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
