/**
 * «COMO RECEBE» E O VALOR A PASSAR À CLYON — d4 (CEO e dono, 18-11-2026).
 *
 * Num trabalho contratado do modelo de 15-11 o parceiro via o valor, mas não
 * via como o cliente escolheu pagar-lhe (gravado pela /api/pagamentos/ao-parceiro
 * em `negociacoes.pagarAoParceiroPor`), nem quanto passa à CLYON e até quando.
 * E o valor por passar dizia-se «em atraso» desde o primeiro minuto, dentro do
 * prazo. Aqui decide-se tudo isso, num sítio só:
 *
 *   · `linhaDoValorAPassar` — «A passar à CLYON · X € até dd/mm» dentro do
 *     prazo; «Em atraso» só depois dele; «Já passou à CLYON» quando está pago.
 *     O painel, a carteira, os Pagamentos do backoffice e a rota que a app
 *     CLYON Pro lê dizem esta linha.
 *   · `comoRecebeNoNovoModelo` — o bloco «Como recebe» do trabalho contratado.
 *
 * As datas em hora de Lisboa, seja qual for o fuso de quem corre o código.
 * Puro: o painel, a app (pela rota) e os testes lêem isto.
 */
import { diaEmLisboa } from "./hora-de-lisboa";
import { DIAS_PARA_PAGAR_O_VALOR_EM_ATRASO, FICA_CONSIGO_E_PASSA_A_CLYON, FICA_CONSIGO_E_PASSA_A_CLYON_NO_INICIO } from "./novo-modelo";

/**
 * A frase única do valor, para a app CLYON Pro: as apps não importam
 * `novo-modelo.ts` (é lá que vive a data do modelo, que elas não podem ter).
 */
export { FICA_CONSIGO_E_PASSA_A_CLYON };
import { PAGAR_O_VALOR_EM_ATRASO } from "./valor-em-atraso";
import { PARTE_DA_CLYON_COM_RESERVA } from "./reserva";
import { COMO_PAGAR_EM_PALAVRAS, lerComoPagar, type ComoPagarAoParceiro } from "./pagar-ao-parceiro";

const DIA = 86_400_000;

/** O título do bloco. */
export const COMO_RECEBE = "Como recebe";

/** O cliente ainda não escolheu como paga ao parceiro. */
export const CLIENTE_AINDA_NAO_ESCOLHEU =
  "O cliente ainda não escolheu como lhe paga: transferência, MB WAY ou dinheiro no local.";

/** Sem confirmação ainda, o prazo ainda não começou a contar. */
export const PRAZO_DEPOIS_DE_CONFIRMAR = `até ${DIAS_PARA_PAGAR_O_VALOR_EM_ATRASO} dias depois de o trabalho ficar confirmado`;

function eurosDoValor(v: number): string {
  return `${(Math.round(v * 100) / 100).toFixed(2).replace(".", ",")} €`;
}

/** `dd/mm` em Lisboa. */
export function diaEMesEmLisboa(instante: Date): string {
  const [, mes, dia] = diaEmLisboa(instante).split("-");
  return `${dia}/${mes}`;
}

export type EstadoDoValorAPassar = "depois_de_confirmar" | "a_passar" | "em_atraso" | "passado";

export type LinhaDoValorAPassar = {
  estado: EstadoDoValorAPassar;
  /** «A passar à CLYON · 12,30 € até 22/11», «Em atraso · …», «Já passou à CLYON · …». */
  linha: string;
  /** O fim do prazo (ISO), quando já corre. */
  prazoAte: string | null;
};

/**
 * A linha do valor que o parceiro passa à CLYON (a taxa da plataforma e o IVA
 * dela). «Em atraso» só depois do prazo (`prazoDoValorEmAtraso`, 4 dias do
 * fecho), nunca dentro dele.
 */
export function linhaDoValorAPassar(
  v: { total: number; prazoAte: Date | null; paga: boolean },
  agora: Date,
): LinhaDoValorAPassar {
  const x = eurosDoValor(v.total);
  const prazo = v.prazoAte && !Number.isNaN(v.prazoAte.getTime()) ? v.prazoAte : null;
  const prazoAte = prazo ? prazo.toISOString() : null;
  if (v.paga || v.total <= 0) return { estado: "passado", linha: `Já passou à CLYON · ${x}`, prazoAte };
  if (!prazo) return { estado: "depois_de_confirmar", linha: `A passar à CLYON · ${x} ${PRAZO_DEPOIS_DE_CONFIRMAR}`, prazoAte };
  if (agora.getTime() > prazo.getTime()) {
    return { estado: "em_atraso", linha: `Em atraso · ${x} · o prazo era ${diaEMesEmLisboa(prazo)}`, prazoAte };
  }
  return { estado: "a_passar", linha: `A passar à CLYON · ${x} até ${diaEMesEmLisboa(prazo)}`, prazoAte };
}

/** O fim do prazo, a partir do fecho (o mesmo de `prazoDoValorEmAtraso`). */
export function prazoAPartirDoFecho(fecho: Date | null): Date | null {
  if (!fecho || Number.isNaN(fecho.getTime())) return null;
  return new Date(fecho.getTime() + DIAS_PARA_PAGAR_O_VALOR_EM_ATRASO * DIA);
}

export type ComoRecebe = {
  titulo: typeof COMO_RECEBE;
  /** A forma que o cliente escolheu; `null` = ainda não escolheu. */
  forma: ComoPagarAoParceiro | null;
  /** «O cliente paga-lhe por MB WAY para o seu número.» — `COMO_PAGAR_EM_PALAVRAS.parceiro`. */
  formaTexto: string;
  /** «Fica consigo; a taxa da plataforma e o IVA dela passam à CLYON» — a frase única. */
  fraseDoValor: string;
  /** O que passa à CLYON (a taxa e o IVA dela), em euros; `null` sem valor acordado. */
  aPassarAClyon: number | null;
  estado: EstadoDoValorAPassar | null;
  linhaDoValor: string | null;
  prazoAte: string | null;
};

/**
 * O bloco «Como recebe» de um trabalho contratado do modelo de 15-11.
 * `fecho` é o instante em que o valor nasce (a confirmação — `quandoLiberta`);
 * `null` enquanto o trabalho não estiver confirmado.
 */
export function comoRecebeNoNovoModelo(
  o: { forma: unknown; aPassarAClyon: number | null; fecho: Date | null; paga: boolean },
  agora: Date,
): ComoRecebe {
  const forma = lerComoPagar(o.forma);
  const linha =
    o.aPassarAClyon != null && Number.isFinite(o.aPassarAClyon)
      ? linhaDoValorAPassar({ total: o.aPassarAClyon, prazoAte: prazoAPartirDoFecho(o.fecho), paga: o.paga }, agora)
      : null;
  return {
    titulo: COMO_RECEBE,
    forma,
    formaTexto: forma ? COMO_PAGAR_EM_PALAVRAS[forma].parceiro : CLIENTE_AINDA_NAO_ESCOLHEU,
    fraseDoValor: FICA_CONSIGO_E_PASSA_A_CLYON_NO_INICIO,
    aPassarAClyon: o.aPassarAClyon,
    estado: linha?.estado ?? null,
    linhaDoValor: linha?.linha ?? null,
    prazoAte: linha?.prazoAte ?? null,
  };
}

/*
 * A FAIXA DO INÍCIO — d6 (CEO e dono, 19-11-2026). O que o parceiro tem a passar
 * à CLYON, à entrada, igual no painel e na app CLYON Pro: a rota da carteira
 * manda-a já escrita (`novoModelo.faixa`) e os dois desenham-na tal como vem.
 *
 *   · 1 trabalho: o título é a linha do servidor (`linhaDoValorAPassar`).
 *   · vários: «X € de N trabalhos · o primeiro prazo é dd/mm» — cada trabalho
 *     tem o seu prazo, por isso não se diz «pague tudo até» o primeiro.
 *   · «em atraso» só quando algum já passou do prazo, e então diz-se quanto é
 *     o que está em atraso, à parte do que ainda está no prazo.
 *
 * O dia num só formato (dd/mm, em Lisboa). Em stand-by não há faixa: aí manda o
 * `standBy` (a explicação e a acção). `null` sem nada a passar.
 */
export const PAGAR_A_CLYON = "Pagar a parte da CLYON";

export type FaixaDoValorAPassar = {
  /** «em_atraso» se algum dos valores passou do prazo; senão o estado do primeiro. */
  estado: EstadoDoValorAPassar;
  titulo: string;
  texto: string;
  /** «Pagar à CLYON» no prazo; «Pagar o valor em atraso» com algum em atraso. Leva à carteira. */
  botao: string;
  /** A soma do que falta passar, em euros. */
  total: number;
  /** A parte que já está em atraso, em euros (0 se nenhuma). */
  emAtraso: number;
  trabalhos: number;
  /** O prazo mais próximo (ISO), se algum já corre. */
  primeiroPrazo: string | null;
};

type ValorDaFaixa = {
  total: number;
  prazoAte: string | null;
  estado?: EstadoDoValorAPassar;
  linha?: string;
  comReserva?: boolean;
};


export function faixaDoValorAPassar(valores: ValorDaFaixa[], agora: Date): FaixaDoValorAPassar | null {
  const porPassar = valores.filter((v) => v.total > 0 && v.estado !== "passado");
  if (porPassar.length === 0) return null;
  const cent = (n: number) => Math.round(n * 100);
  const total = porPassar.reduce((s, v) => s + cent(v.total), 0) / 100;
  const estadoDe = (v: ValorDaFaixa): EstadoDoValorAPassar =>
    v.estado ??
    linhaDoValorAPassar({ total: v.total, prazoAte: v.prazoAte ? new Date(v.prazoAte) : null, paga: false }, agora).estado;
  const atrasados = porPassar.filter((v) => estadoDe(v) === "em_atraso");
  const emAtraso = atrasados.reduce((s, v) => s + cent(v.total), 0) / 100;
  const prazos = porPassar
    .map((v) => v.prazoAte)
    .filter((p): p is string => !!p && !Number.isNaN(new Date(p).getTime()))
    .sort();
  const primeiroPrazo = prazos[0] ?? null;
  const n = porPassar.length;
  const oQue = porPassar.some((v) => v.comReserva === true)
    ? `A ${PARTE_DA_CLYON_COM_RESERVA} e o IVA dela`
    : "A taxa da plataforma e o IVA dela";
  const depois = "Depois do prazo, não pode aceitar nem enviar propostas até pagar.";

  if (n === 1) {
    const v = porPassar[0];
    const linha =
      v.linha ??
      linhaDoValorAPassar({ total: v.total, prazoAte: v.prazoAte ? new Date(v.prazoAte) : null, paga: false }, agora).linha;
    const estado = estadoDe(v);
    const texto =
      estado === "em_atraso"
        ? `${oQue} de 1 trabalho, já fora do prazo. ${depois}`
        : primeiroPrazo
          ? `${oQue} de 1 trabalho: pague até ${diaEMesEmLisboa(new Date(primeiroPrazo))}. ${depois}`
          : `${oQue} de 1 trabalho, ${PRAZO_DEPOIS_DE_CONFIRMAR}. ${depois}`;
    return {
      estado,
      titulo: linha,
      texto,
      botao: estado === "em_atraso" ? PAGAR_O_VALOR_EM_ATRASO : PAGAR_A_CLYON,
      total,
      emAtraso,
      trabalhos: 1,
      primeiroPrazo,
    };
  }

  const titulo =
    `${eurosDoValor(total)} de ${n} trabalhos` +
    (primeiroPrazo ? ` · o primeiro prazo é ${diaEMesEmLisboa(new Date(primeiroPrazo))}` : "");
  const cadaUm = `${oQue} de ${n} trabalhos. Cada trabalho tem o seu prazo: ${DIAS_PARA_PAGAR_O_VALOR_EM_ATRASO} dias depois de ficar confirmado.`;
  const parteEmAtraso =
    atrasados.length > 0
      ? ` Em atraso: ${eurosDoValor(emAtraso)} (${atrasados.length === 1 ? "1 trabalho" : `${atrasados.length} trabalhos`}); o resto ainda está no prazo.`
      : "";
  const estado: EstadoDoValorAPassar =
    atrasados.length > 0 ? "em_atraso" : primeiroPrazo ? "a_passar" : "depois_de_confirmar";
  return {
    estado,
    titulo,
    texto: `${cadaUm}${parteEmAtraso} ${depois}`,
    botao: atrasados.length > 0 ? PAGAR_O_VALOR_EM_ATRASO : PAGAR_A_CLYON,
    total,
    emAtraso,
    trabalhos: n,
    primeiroPrazo,
  };
}
