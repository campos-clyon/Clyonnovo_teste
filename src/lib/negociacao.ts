/**
 * A negociação entre o cliente e um profissional.
 *
 * **Só valores. Sem caixa de texto, sem mensagens.** É a decisão mais
 * importante deste ficheiro e não é estética: mensagens livres são onde se
 * combina pagamento por fora, se trocam contactos e a plataforma deixa de ver
 * o negócio que devia estar a intermediar.
 *
 * Uma negociação existe por **par (pedido, profissional)**. O mesmo pedido
 * pode ter várias a decorrer ao mesmo tempo, e é isso que obriga ao aperto de
 * mão duplo — ver `AGUARDA_CONTRATACAO` mais abaixo.
 *
 * As regras, por ordem de quanto custam se estiverem erradas:
 *
 * 1. **Alternam.** Enquanto uma proposta está pendente, quem a fez não pode
 *    fazer outra. Sem isto, um lado enterrava o outro em propostas e a
 *    "negociação" passava a ser quem escreve mais depressa.
 *
 * 2. **Cinco de cada lado.** Esgotadas, resta aceitar ou desistir.
 *
 * 3. **Expirar não gasta chance de quem propôs.** Se gastasse, bastava ao
 *    outro lado ficar calado para ganhar a negociação — e o silêncio passava a
 *    ser a melhor jogada.
 *
 * 4. **O profissional aceitar não fecha nada.** Vários podem estar a negociar
 *    o mesmo pedido; sem o segundo passo, o primeiro a aceitar ficava com o
 *    trabalho sem o cliente ter escolhido quem lhe entra em casa. Quando o
 *    cliente aceita, fecha — porque a escolha é dele e já a fez.
 */

export const MAX_PROPOSTAS_POR_LADO = 5;
export const PRAZO_DA_PROPOSTA_HORAS = 48;
/** Quando avisar que está prestes a expirar. */
export const AVISO_ANTES_DE_EXPIRAR_HORAS = 12;

export type Lado = "cliente" | "profissional";

export type EstadoDaProposta = "pendente" | "aceite" | "recusada" | "expirada";

export type Proposta = {
  por: Lado;
  valor: number;
  criadaEm: Date | string;
  estado: EstadoDaProposta;
};

export type EstadoDaNegociacao =
  | "aberta"
  /** O profissional aceitou. Falta o cliente carregar em "Contratar". */
  | "aguarda_contratacao"
  | "acordada"
  | "desistida"
  | "morta";

export type Negociacao = {
  propostas: Proposta[];
  estado: EstadoDaNegociacao;
  /** O valor fechado, quando há. */
  valorAcordado?: number | null;
};

export type Accao =
  | "propor"
  | "aceitar"
  | "desistir"
  /** Só do cliente, e só depois de o profissional ter aceitado. */
  | "contratar";

function comoData(d: Date | string): Date {
  return d instanceof Date ? d : new Date(d);
}

export function expiraEm(proposta: Proposta): Date {
  return new Date(comoData(proposta.criadaEm).getTime() + PRAZO_DA_PROPOSTA_HORAS * 3600_000);
}

export function estaExpirada(proposta: Proposta, agora: Date): boolean {
  return proposta.estado === "pendente" && expiraEm(proposta).getTime() <= agora.getTime();
}

/** Faltam quantas horas — negativo se já passou. Para o aviso. */
export function horasAteExpirar(proposta: Proposta, agora: Date): number {
  return (expiraEm(proposta).getTime() - agora.getTime()) / 3600_000;
}

export function estaPrestesAExpirar(proposta: Proposta, agora: Date): boolean {
  if (proposta.estado !== "pendente") return false;
  const h = horasAteExpirar(proposta, agora);
  return h > 0 && h <= AVISO_ANTES_DE_EXPIRAR_HORAS;
}

/**
 * A proposta que está em cima da mesa, se houver.
 *
 * Uma proposta pendente cujo prazo passou não conta como pendente, mesmo que
 * ninguém tenha corrido o processo que a marca como expirada. O tempo é o que
 * é, e depender de uma tarefa agendada para dizer a verdade sobre o estado
 * dava respostas diferentes conforme a tarefa tivesse corrido ou não.
 */
export function propostaPendente(n: Negociacao, agora: Date): Proposta | null {
  for (let i = n.propostas.length - 1; i >= 0; i--) {
    const p = n.propostas[i];
    if (p.estado === "pendente") return estaExpirada(p, agora) ? null : p;
  }
  return null;
}

/** A última proposta que ficou em cima da mesa, expirada ou não. */
export function ultimaProposta(n: Negociacao): Proposta | null {
  return n.propostas.length > 0 ? n.propostas[n.propostas.length - 1] : null;
}

/**
 * Quantas propostas um lado já gastou.
 *
 * As expiradas não contam — regra 3. Contam-se as que tiveram resposta
 * (recusadas, aceites) e a que está viva.
 */
export function propostasUsadas(n: Negociacao, lado: Lado, agora: Date): number {
  return n.propostas.filter(
    (p) => p.por === lado && p.estado !== "expirada" && !estaExpirada(p, agora),
  ).length;
}

export function propostasRestantes(n: Negociacao, lado: Lado, agora: Date): number {
  return Math.max(0, MAX_PROPOSTAS_POR_LADO - propostasUsadas(n, lado, agora));
}

/**
 * O que este lado pode fazer agora.
 *
 * É a única fonte de verdade sobre isso: os ecrãs desenham o que esta função
 * devolver, e a API recusa o que ela não devolver. Duas listas — uma para
 * mostrar botões, outra para validar — era garantir que um dia divergiam.
 */
export function accoesDisponiveis(n: Negociacao, lado: Lado, agora: Date): Accao[] {
  if (n.estado === "acordada" || n.estado === "desistida" || n.estado === "morta") return [];

  // O profissional aceitou e a bola está do lado do cliente. Mais ninguém faz
  // nada até ele decidir.
  if (n.estado === "aguarda_contratacao") {
    return lado === "cliente" ? ["contratar", "desistir"] : ["desistir"];
  }

  const pendente = propostaPendente(n, agora);
  const restantes = propostasRestantes(n, lado, agora);
  const accoes: Accao[] = [];

  // Há proposta do outro lado em cima da mesa: pode aceitá-la.
  if (pendente && pendente.por !== lado) accoes.push("aceitar");

  // Só propõe quem não tem proposta sua pendente e ainda tem chances.
  const temPropostaSuaPendente = pendente?.por === lado;
  if (!temPropostaSuaPendente && restantes > 0) accoes.push("propor");

  accoes.push("desistir");
  return accoes;
}

export function podeFazer(n: Negociacao, lado: Lado, accao: Accao, agora: Date): boolean {
  return accoesDisponiveis(n, lado, agora).includes(accao);
}

export type ResultadoDaAccao =
  | { ok: true; negociacao: Negociacao }
  | { ok: false; erro: string };

/** Marca como expiradas as propostas cujo prazo passou. */
function comExpiradasMarcadas(n: Negociacao, agora: Date): Negociacao {
  return {
    ...n,
    propostas: n.propostas.map((p) =>
      estaExpirada(p, agora) ? { ...p, estado: "expirada" as const } : p,
    ),
  };
}

export function propor(
  n: Negociacao,
  lado: Lado,
  valor: number,
  agora: Date,
): ResultadoDaAccao {
  if (!Number.isFinite(valor) || valor <= 0) {
    return { ok: false, erro: "Indique um valor." };
  }
  if (!podeFazer(n, lado, "propor", agora)) {
    /*
     * PORQUE NÃO — dito como é, e não como calha.
     *
     * Havia duas frases para três situações, e a que sobrava mentia. Um
     * pedido em que o profissional JÁ ACEITOU respondia "já tem uma proposta
     * à espera de resposta" a quem tentava contrapropor — o que não era
     * verdade, não explicava nada, e deixava quem lá estava a pensar que o
     * site tinha avariado. Aconteceu a sério: o valor de partida saiu alto,
     * o profissional aceitou-o, e do outro lado o cliente só tinha 30 €.
     *
     * Uma mensagem de recusa tem duas obrigações: dizer o que se passa, e
     * dizer por onde se sai.
     */
    if (n.estado === "aguarda_contratacao") {
      const aceite = [...n.propostas].reverse().find((p) => p.estado === "aceite");
      const quanto = aceite ? `${aceite.valor.toFixed(2).replace(".", ",")} €` : "o valor proposto";
      return {
        ok: false,
        erro:
          `O profissional já aceitou ${quanto} — a partir daqui só falta fechar. ` +
          `Para mudar o valor tem de desistir desta negociação e voltar a enviar o ` +
          `pedido com o valor de partida certo.`,
      };
    }
    if (n.estado === "acordada") {
      return { ok: false, erro: "Este trabalho já está fechado." };
    }
    if (n.estado === "desistida" || n.estado === "morta") {
      return { ok: false, erro: "Esta negociação terminou." };
    }
    const restantes = propostasRestantes(n, lado, agora);
    return {
      ok: false,
      erro:
        restantes === 0
          ? "Gastou as cinco propostas. Só pode aceitar ou desistir."
          : "Já tem uma proposta à espera de resposta — espere que o outro lado responda.",
    };
  }

  const base = comExpiradasMarcadas(n, agora);
  // Propor é recusar o que estava em cima da mesa. Fazer as duas coisas em
  // passos separados deixava um instante em que havia duas pendentes.
  const propostas = base.propostas.map((p) =>
    p.estado === "pendente" ? { ...p, estado: "recusada" as const } : p,
  );

  return {
    ok: true,
    negociacao: {
      ...base,
      estado: "aberta",
      propostas: [
        ...propostas,
        { por: lado, valor: Math.round(valor * 100) / 100, criadaEm: agora, estado: "pendente" },
      ],
    },
  };
}

/**
 * Aceitar a proposta do outro lado.
 *
 * O cliente aceitar fecha; o profissional aceitar não. A assimetria é a regra
 * 4 — vários profissionais podem estar a negociar o mesmo pedido, e o cliente
 * tem de escolher quem lhe entra em casa.
 */
export function aceitar(n: Negociacao, lado: Lado, agora: Date): ResultadoDaAccao {
  if (!podeFazer(n, lado, "aceitar", agora)) {
    return { ok: false, erro: "Não há proposta para aceitar." };
  }

  const pendente = propostaPendente(n, agora)!;
  const base = comExpiradasMarcadas(n, agora);
  const propostas = base.propostas.map((p) =>
    p.estado === "pendente" ? { ...p, estado: "aceite" as const } : p,
  );

  return {
    ok: true,
    negociacao: {
      ...base,
      propostas,
      valorAcordado: pendente.valor,
      estado: lado === "cliente" ? "acordada" : "aguarda_contratacao",
    },
  };
}

/** O cliente escolhe este profissional. É aqui que o trabalho fica fechado. */
export function contratar(n: Negociacao, agora: Date): ResultadoDaAccao {
  if (!podeFazer(n, "cliente", "contratar", agora)) {
    return { ok: false, erro: "Não há nada para contratar." };
  }
  return { ok: true, negociacao: { ...n, estado: "acordada" } };
}

export function desistir(n: Negociacao, lado: Lado, agora: Date): ResultadoDaAccao {
  if (!podeFazer(n, lado, "desistir", agora)) {
    return { ok: false, erro: "Esta negociação já terminou." };
  }
  const base = comExpiradasMarcadas(n, agora);
  return { ok: true, negociacao: { ...base, estado: "desistida" } };
}

/**
 * Chegou-se ao fim sem acordo possível?
 *
 * Os dois lados sem propostas e nada em cima da mesa: resta aceitar a última,
 * e se ninguém aceitar, o pedido morre.
 */
export function semSaida(n: Negociacao, agora: Date): boolean {
  if (n.estado !== "aberta") return false;
  return (
    propostasRestantes(n, "cliente", agora) === 0 &&
    propostasRestantes(n, "profissional", agora) === 0 &&
    propostaPendente(n, agora) === null
  );
}

/** Uma negociação nova, com o valor que o cliente pediu como ponto de partida. */
export function negociacaoNova(valorPedidoPeloCliente: number, agora: Date): Negociacao {
  return {
    estado: "aberta",
    valorAcordado: null,
    propostas: [
      {
        por: "cliente",
        valor: Math.round(valorPedidoPeloCliente * 100) / 100,
        criadaEm: agora,
        estado: "pendente",
      },
    ],
  };
}
