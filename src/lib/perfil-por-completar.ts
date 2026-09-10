import { RUBRICAS_DOS_CUSTOS_FIXOS } from "./custos-fixos-do-profissional";

/**
 * O QUE FALTA NO PERFIL DE UM PROFISSIONAL.
 *
 * Um perfil a meio não dá erro nenhum: dá silêncio. Sem categorias escolhidas
 * não chega pedido nenhum; sem a base no mapa as distâncias saem erradas e um
 * trabalho ao lado passa ao largo; sem IBAN nem MB WAY o dinheiro fica à
 * espera de um número que ninguém pediu. Nada disto aparece em lado nenhum —
 * a conta parece a funcionar, e o que falha é invisível.
 *
 * Este ficheiro é a única lista do que falta. É lido em três sítios — o cartão
 * no topo do menu, o triângulo em cada linha, e o aviso dentro de cada secção
 * — e é por ser um só que os três nunca discordam.
 *
 * DUAS ALTURAS, E A DIFERENÇA IMPORTA:
 *
 *   · **essencial** — trava trabalho ou dinheiro. Enquanto faltar, há coisas
 *     que simplesmente não acontecem;
 *   · **melhora** — a conta funciona à mesma, mas com os números de
 *     referência da CLYON em vez dos dele. O valor sugerido em cada pedido é
 *     o de um profissional médio, e ele não é um profissional médio.
 *
 * Misturar as duas seria transformar um travão numa dica. Um cartão que grita
 * por causa de uma margem por escolher ensina a ignorar o cartão — e no dia em
 * que o que falta é o IBAN, já ninguém olha.
 */

export type SeccaoComFalta = "dados" | "servicos" | "faturacao" | "banco";

export type Falta = {
  /** Identifica a falta em código e em testes. */
  chave: string;
  seccao: SeccaoComFalta;
  /** O nome do campo, como ele o lê no ecrã. */
  rotulo: string;
  /** O que acontece por estar em falta. Nunca "é obrigatório". */
  porque: string;
  peso: "essencial" | "melhora";
};

/**
 * O que se precisa de saber sobre o perfil para dizer o que falta.
 *
 * É um subconjunto do `Perfil` do painel, escrito à parte de propósito: esta
 * conta também corre do lado do servidor, e não pode depender de um tipo que
 * vive dentro de um ecrã.
 */
export type PerfilParaCompletar = {
  nome?: string | null;
  telefone?: string | null;
  cidade?: string | null;
  baseLat?: number | null;
  baseLng?: number | null;
  nif?: string | null;
  moradaFiscal?: string | null;
  codigoPostalFiscal?: string | null;
  localidadeFiscal?: string | null;
  categorias?: string[] | null;
  custoKm?: number | null;
  custoHoraPessoa?: number | null;
  pessoasNaEquipa?: number | null;
  horasPorTrabalho?: number | null;
  custosFixosAnuais?: Record<string, number | null> | null;
  trabalhosPorMes?: number | null;
  margemPercent?: number | null;
  riscoPercent?: number | null;
  emiteGuiaTransporte?: boolean | null;
  numeroTransportador?: string | null;
  temIban?: boolean | null;
  ibanTitular?: string | null;
  mbway?: string | null;
};

const vazio = (v: string | null | undefined): boolean => !v || v.trim() === "";

/** Um número que o profissional escreveu mesmo — zero não conta como resposta. */
const semNumero = (v: number | null | undefined): boolean =>
  v == null || !Number.isFinite(v) || v <= 0;

/** Alguma rubrica dos custos fixos preenchida? Zero conta: «não pago IUC» é resposta. */
function algumCustoFixo(c: Record<string, number | null> | null | undefined): boolean {
  if (!c) return false;
  return RUBRICAS_DOS_CUSTOS_FIXOS.some(({ chave }) => {
    const v = c[chave];
    return v != null && Number.isFinite(v) && v >= 0;
  });
}

/**
 * A lista do que falta, dos travões para as melhorias.
 *
 * A ordem é a ordem de quem lê: primeiro o que o impede de trabalhar, depois o
 * que o impede de receber, e só no fim o que torna a sugestão de valor a conta
 * dele em vez da nossa.
 */
export function oQueFaltaNoPerfil(p: PerfilParaCompletar): Falta[] {
  const faltas: Falta[] = [];

  // ── O que trava ──────────────────────────────────────────────────────────

  if (!p.categorias || p.categorias.length === 0) {
    faltas.push({
      chave: "categorias",
      seccao: "servicos",
      rotulo: "O que faz",
      porque: "Sem nenhum serviço escolhido não lhe chega pedido nenhum.",
      peso: "essencial",
    });
  }

  if (p.baseLat == null || p.baseLng == null) {
    faltas.push({
      chave: "base-no-mapa",
      seccao: "dados",
      rotulo: "Morada da base",
      porque:
        "Escolha-a da lista que aparece ao escrever. Sem o ponto no mapa, as distâncias saem erradas e um trabalho ao lado pode não lhe chegar.",
      peso: "essencial",
    });
  }

  if (vazio(p.telefone)) {
    faltas.push({
      chave: "telefone",
      seccao: "dados",
      rotulo: "Telefone",
      porque: "É por aqui que o cliente lhe liga depois de o contratar.",
      peso: "essencial",
    });
  }

  if (!p.temIban && vazio(p.mbway)) {
    faltas.push({
      chave: "onde-receber",
      seccao: "banco",
      rotulo: "IBAN ou MB WAY",
      // A mesma frase da carteira. Ali diz-se «sem ele não há para onde
      // transferir o seu saldo», e não podem ser duas explicações diferentes
      // para a mesma caixa vazia.
      porque: "Sem um destes não há para onde transferir o seu saldo.",
      peso: "essencial",
    });
  } else if (p.temIban && vazio(p.ibanTitular)) {
    faltas.push({
      chave: "titular",
      seccao: "banco",
      rotulo: "Titular da conta",
      porque: "O nome tal como está no banco — uma transferência com o nome trocado volta para trás.",
      peso: "essencial",
    });
  }

  if (vazio(p.nif)) {
    faltas.push({
      chave: "nif",
      seccao: "faturacao",
      rotulo: "NIF",
      porque: "Quem recebe dinheiro tem de estar identificado, passe fatura ou não.",
      peso: "essencial",
    });
  }

  if (vazio(p.moradaFiscal) || vazio(p.codigoPostalFiscal) || vazio(p.localidadeFiscal)) {
    faltas.push({
      chave: "morada-fiscal",
      seccao: "faturacao",
      rotulo: "Morada fiscal",
      porque: "A da declaração de atividade. Muitas vezes não é a mesma de onde trabalha.",
      peso: "essencial",
    });
  }

  // Só se ele disse que emite: a quem não emite, isto não diz respeito.
  if (p.emiteGuiaTransporte && vazio(p.numeroTransportador)) {
    faltas.push({
      chave: "numero-transportador",
      seccao: "faturacao",
      rotulo: "Número de transportador",
      porque:
        "Disse que emite guia de transporte de resíduos. Sem o número não podemos verificá-la, e é ela que abre o entulho e os monos.",
      peso: "essencial",
    });
  }

  // ── O que melhora a sugestão de valor ────────────────────────────────────

  if (semNumero(p.custoKm)) {
    faltas.push({
      chave: "custo-km",
      seccao: "servicos",
      rotulo: "Custo por km",
      porque: "Enquanto estiver vazio, a conta usa o combustível de referência da CLYON.",
      peso: "melhora",
    });
  }

  if (semNumero(p.custoHoraPessoa)) {
    faltas.push({
      chave: "custo-hora",
      seccao: "servicos",
      rotulo: "Custo por hora e pessoa",
      porque: "O que lhe custa uma hora de cada pessoa da equipa, a si.",
      peso: "melhora",
    });
  }

  if (semNumero(p.pessoasNaEquipa)) {
    faltas.push({
      chave: "pessoas",
      seccao: "servicos",
      rotulo: "Pessoas na equipa",
      porque: "Quantos vão a um trabalho. Multiplica o custo por hora.",
      peso: "melhora",
    });
  }

  if (semNumero(p.horasPorTrabalho)) {
    faltas.push({
      chave: "horas",
      seccao: "servicos",
      rotulo: "Tempo médio por trabalho",
      porque:
        "Com isto preenchido a conta usa o seu tempo, deslocação incluída, em vez de o estimar a partir do pedido.",
      peso: "melhora",
    });
  }

  if (!algumCustoFixo(p.custosFixosAnuais)) {
    faltas.push({
      chave: "custos-fixos",
      seccao: "servicos",
      rotulo: "Custos fixos, por ano",
      porque:
        "Via Verde, manutenção, IUC, inspeção e seguro: o que paga tenha ou não trabalho. Fora da conta, sai da sua margem sem se ver.",
      peso: "melhora",
    });
  } else if (semNumero(p.trabalhosPorMes)) {
    // Só depois de haver custos fixos é que o divisor faz falta.
    faltas.push({
      chave: "trabalhos-por-mes",
      seccao: "servicos",
      rotulo: "Trabalhos por mês",
      porque: "Sem este número não há por quantos trabalhos dividir os custos fixos do ano.",
      peso: "melhora",
    });
  }

  if (p.margemPercent == null) {
    faltas.push({
      chave: "margem",
      seccao: "servicos",
      rotulo: "Margem de lucro desejada",
      porque: "Por escolher, a sugestão usa a margem de referência da CLYON e não a sua.",
      peso: "melhora",
    });
  }

  if (p.riscoPercent == null) {
    faltas.push({
      chave: "risco",
      seccao: "servicos",
      rotulo: "Seguro de risco",
      porque:
        "A reserva para móveis partidos, cancelamentos à porta e viagens em vão. Em zero, essas perdas saem todas da sua margem.",
      peso: "melhora",
    });
  }

  return faltas;
}

export type ResumoDoPerfil = {
  faltas: Falta[];
  essenciais: Falta[];
  melhorias: Falta[];
  /** Quantos campos foram avaliados — o denominador da percentagem. */
  total: number;
  feitos: number;
  /** 0 a 100, arredondado. 100 só quando não falta nada. */
  percentagem: number;
  completo: boolean;
};

/**
 * Quantos campos existem para avaliar — o denominador da percentagem.
 *
 * Treze são sempre perguntados. Os outros três só existem depois de uma
 * resposta anterior: o titular só faz sentido com IBAN, o número de
 * transportador só a quem disse que emite guia, e o divisor dos custos fixos
 * só depois de haver custos fixos. O denominador tem de crescer com eles —
 * senão a percentagem subia por se ter respondido «sim» a uma pergunta.
 */
function quantosCamposConta(p: PerfilParaCompletar): number {
  const SEMPRE = 13;
  return (
    SEMPRE +
    (p.temIban ? 1 : 0) +
    (p.emiteGuiaTransporte ? 1 : 0) +
    (algumCustoFixo(p.custosFixosAnuais) ? 1 : 0)
  );
}

/** O estado do perfil de uma vez: o que falta, quanto falta, e se acabou. */
export function resumoDoPerfil(p: PerfilParaCompletar): ResumoDoPerfil {
  const faltas = oQueFaltaNoPerfil(p);
  const total = quantosCamposConta(p);
  // Uma falta a mais do que os campos contados seria um erro de contagem, não
  // um perfil negativo: o mínimo é zero.
  const feitos = Math.max(0, total - faltas.length);
  return {
    faltas,
    essenciais: faltas.filter((f) => f.peso === "essencial"),
    melhorias: faltas.filter((f) => f.peso === "melhora"),
    total,
    feitos,
    percentagem: total > 0 ? Math.round((feitos / total) * 100) : 100,
    completo: faltas.length === 0,
  };
}

/** As faltas de uma secção — para o aviso dentro do ecrã e o triângulo na linha. */
export function faltasDaSeccao(faltas: Falta[], seccao: SeccaoComFalta): Falta[] {
  return faltas.filter((f) => f.seccao === seccao);
}

/** Uma falta pela chave, para marcar o campo exacto no formulário. */
export function faltaPelaChave(faltas: Falta[], chave: string): Falta | undefined {
  return faltas.find((f) => f.chave === chave);
}
