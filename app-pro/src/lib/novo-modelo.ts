/**
 * O MODELO DE 15-11-2026 NA APP CLYON PRO — d10 (CEO e dono, 12-11-2026).
 *
 * O cliente paga o trabalho diretamente ao profissional (transferência, MB WAY
 * ou dinheiro no local); o profissional passa à CLYON a taxa da plataforma e o
 * IVA dela, por referência Multibanco ou MB WAY, uma por trabalho.
 *
 * A DATA NÃO VIVE AQUI. A app não sabe quando o modelo começa: quem o diz é o
 * site, que manda `novoModelo` na carteira e no perfil só a partir de 15-11
 * (`src/lib/novo-modelo.ts` + `relogio-do-modelo.ts`), e `null` antes. Cada
 * bloco desta app só aparece com esse objeto — antes da data, a app fica igual
 * a hoje, sem uma cópia da data que possa divergir.
 *
 * As frases vêm dos ficheiros do site, por caminho relativo (as mesmas do
 * painel). Puro (sem React Native): os testes do site importam-no.
 */
import { DIAS_PARA_PAGAR_O_VALOR_EM_ATRASO, PAGAR_O_VALOR_EM_ATRASO } from "../../../src/lib/valor-em-atraso";
import { NOME_DA_FATURA, MENSAGENS_DA_FATURA } from "../../../src/lib/faturas-do-trabalho";
import { COMO_PAGAR_EM_PALAVRAS } from "../../../src/lib/pagar-ao-parceiro";
import { COMPLETAR_O_PERFIL } from "../../../src/lib/dados-para-receber";
import { perguntasDoProfissional, type PerguntaFrequente } from "../../../src/lib/ajuda-plataforma";
import type { Taxas } from "../../../src/lib/taxas-plataforma";
import { PARTE_DA_CLYON_COM_RESERVA } from "../../../src/lib/reserva";

export { PAGAR_O_VALOR_EM_ATRASO, NOME_DA_FATURA, MENSAGENS_DA_FATURA, COMO_PAGAR_EM_PALAVRAS, PARTE_DA_CLYON_COM_RESERVA };

/** O que falta para receber, como `estadoDosDadosParaReceber` (src/lib/dados-para-receber.ts) o devolve. */
export type DadosParaReceber =
  | { estado: "completos" | "ainda_nao_vale" }
  | { estado: "aviso"; falta: string[]; ate: string; frase: string }
  | { estado: "impede"; falta: string[]; frase: string };

/** O bloco `novoModelo` de `GET /api/profissionais/carteira` — `null` antes de 15-11. */
export type NovoModeloDaCarteira = {
  emVigor: boolean;
  valorEmAtraso: number;
  valores: Array<{
    negociacaoId: number;
    pedidoId: number | null;
    total: number;
    iva: number;
    taxa: number;
    nasceuEm: string | null;
    prazoAte: string | null;
    multibanco: { entidade: string | null; referencia: string | null } | null;
    /** d39/d55: com valor único a parte da CLYON leva a reserva. O site manda-o; sem ele, fica a frase de hoje. */
    comReserva?: boolean;
  }>;
  standBy: { total: number; accao: string; explicacao: string; negociacoes: number[] } | null;
  dadosParaReceber: DadosParaReceber | null;
};

/** O bloco `novoModelo` de `GET /api/profissionais/perfil` — `null` antes de 15-11. */
export type NovoModeloDoPerfil = {
  dadosParaReceber: DadosParaReceber;
  perfilFiscal: { tipoDeFatura: "com_iva" | "isento" | "a_confirmar"; fatura: string; emiteGuia: boolean; guia: string | null };
  regimeIvaConfirmado: boolean;
};

/** As faturas de um trabalho, como `GET /api/profissionais/trabalho/fatura` as devolve. */
export type FaturasDoTrabalho = {
  novoModelo: boolean;
  daTaxa: { url: string; nome: string | null; em: string | null } | null;
  doTrabalho: { url: string; nome: string | null; em: string | null } | null;
};

export const ROTA_DA_FATURA = (negociacaoId: number) => `/api/profissionais/trabalho/fatura?negociacaoId=${negociacaoId}`;

/**
 * O ENDEREÇO QUE SE ABRE DE UMA FATURA — d28 (15-11-2026). Desde a d28 o site
 * manda as faturas como link relativo da rota de leitura
 * (`/api/faturas-do-trabalho/<id>?ate=…&a=…`); o Android não abre um caminho
 * sem origem. Junta-se a origem do site (`SITE`, a mesma das chamadas à API),
 * como `abrirNoNavegador` faz na app de cliente. Um endereço https (as faturas
 * de antes, no armazenamento público) abre-se tal e qual; outra coisa, nada.
 */
export function enderecoDaFatura(url: string | null | undefined, site: string): string | null {
  if (!url) return null;
  if (url.startsWith("https://")) return url;
  if (url.startsWith("/") && !url.startsWith("//")) return `${site.replace(/\/+$/, "")}${url}`;
  return null;
}

/** Para onde leva o aviso dos dados em falta: só o regime → Faturação; o resto → IBAN e MB WAY. */
export function destinoDosDadosEmFalta(falta: readonly string[]): "/conta/banco" | "/conta/faturacao" {
  return falta.length > 0 && falta.every((f) => f === "regime") ? "/conta/faturacao" : "/conta/banco";
}

/** O aviso (até 22-11) ou o impedimento dos dados para receber — `null` quando não há nada a dizer. */
export function avisoDosDadosParaReceber(
  d: DadosParaReceber | null | undefined,
): { frase: string; impede: boolean; destino: "/conta/banco" | "/conta/faturacao" } | null {
  if (!d || (d.estado !== "aviso" && d.estado !== "impede")) return null;
  return { frase: d.frase, impede: d.estado === "impede", destino: destinoDosDadosEmFalta(d.falta) };
}

/**
 * O 403 DO MODELO NOVO ao aceitar ou propor (`impedimentoDoNovoModelo`, src/lib/novo-modelo-no-servidor.ts):
 * em stand-by → «Pagar o valor em atraso», para a carteira; sem os dados para
 * receber → o perfil. Outro erro qualquer → `null`.
 */
export function impedimentoDoErro(
  corpo: Record<string, unknown> | null | undefined,
): { botao: string; destino: "/carteira" | "/conta/banco" | "/conta/faturacao" } | null {
  if (!corpo) return null;
  if (corpo.standBy === true) {
    return { botao: typeof corpo.accao === "string" && corpo.accao ? corpo.accao : PAGAR_O_VALOR_EM_ATRASO, destino: "/carteira" };
  }
  if (corpo.faltamDadosParaReceber === true) {
    const falta = Array.isArray(corpo.falta) ? corpo.falta.filter((x): x is string => typeof x === "string") : [];
    return { botao: "Preencher no perfil", destino: destinoDosDadosEmFalta(falta) };
  }
  return null;
}

/** A frase da caixa do valor em atraso, fora do stand-by (no stand-by lê-se a do site, `explicacaoDoStandBy`). */
export const EXPLICACAO_DO_VALOR_EM_ATRASO =
  "Passe à CLYON a taxa da plataforma e o IVA dela de cada trabalho até ao fim do prazo. Depois disso continua a ver os pedidos, mas não pode aceitar pedidos nem enviar propostas até o pagamento ser confirmado.";

/** Os trabalhos com valor em atraso — saem da lista antiga das dívidas (lá a palavra é outra). */
export function negociacoesDoValorEmAtraso(nm: NovoModeloDaCarteira | null | undefined): Set<number> {
  return new Set((nm?.valores ?? []).map((v) => v.negociacaoId));
}

/** Este valor já passou dos 4 dias? (O site diz o prazo; a app só compara.) */
export function passouDoPrazo(prazoAte: string | null, agora: number): boolean {
  if (!prazoAte) return false;
  const fim = Date.parse(prazoAte);
  return Number.isFinite(fim) && agora > fim;
}

/**
 * «Taxa da plataforma 25,00 € + IVA 5,75 €» — as duas partes de um valor em atraso.
 * Com reserva (d55, como o painel em Carteira.tsx): «Parte da CLYON (taxa da
 * plataforma e reserva) 40,00 € + IVA 9,20 €» — sem dizer «valor único».
 */
export function partesDoValorEmAtraso(v: { taxa: number; iva: number; comReserva?: boolean }, euros: (n: number) => string): string {
  const nome = v.comReserva === true ? maiuscula(PARTE_DA_CLYON_COM_RESERVA) : "Taxa da plataforma";
  return v.iva > 0 ? `${nome} ${euros(v.taxa)} + IVA ${euros(v.iva)}` : `${nome} ${euros(v.taxa)}`;
}

function maiuscula(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** A linha do perfil fiscal, como o cliente a lê ao escolher: «Fatura com IVA · Emite guia de resíduos». */
export function linhaDoPerfilFiscal(p: NovoModeloDoPerfil["perfilFiscal"]): string {
  return p.guia ? `${p.fatura} · ${p.guia}` : p.fatura;
}

/** A rota aceita imagem ou PDF; a app manda uma fotografia ou uma captura (sem módulo nativo novo). */
export const AJUDA_DA_FATURA_NA_APP =
  "Fotografe a fatura que emitiu ao cliente ou escolha uma captura da galeria. O cliente vê-a no pedido, ao lado da fatura da taxa da plataforma.";

// ── d18 (13-11-2026): a faixa do Início, o regime por um toque e os Termos ──

/**
 * A FAIXA DO VALOR EM ATRASO NO INÍCIO — d18. Fora do stand-by, quem tem um
 * valor por passar à CLYON vê-o logo à entrada, com o prazo dos 4 dias (o prazo
 * mais próximo vem do site, `prazoAte`) e o botão «Pagar o valor em atraso»,
 * que leva à carteira. Em stand-by diz-se a frase do site (`standBy.explicacao`).
 * `null` sem nada a pagar, e sempre antes de 15-11 (o site não manda `novoModelo`).
 */
export function faixaDoValorEmAtraso(
  nm: NovoModeloDaCarteira | null | undefined,
  euros: (n: number) => string,
  dia: (iso: string | null) => string | null,
): { standBy: boolean; titulo: string; texto: string; botao: string } | null {
  if (!nm) return null;
  if (nm.standBy) {
    return { standBy: true, titulo: `Conta em stand-by · ${euros(nm.standBy.total)}`, texto: nm.standBy.explicacao, botao: PAGAR_O_VALOR_EM_ATRASO };
  }
  if (nm.valores.length === 0) return null;
  const total = Math.round(nm.valores.reduce((s, v) => s + v.total, 0) * 100) / 100;
  const prazos = nm.valores.map((v) => v.prazoAte).filter((p): p is string => !!p).sort();
  const ate = prazos.length > 0 ? dia(prazos[0]) : null;
  const trabalhos = nm.valores.length === 1 ? "de 1 trabalho" : `de ${nm.valores.length} trabalhos`;
  return {
    standBy: false,
    titulo: `Valor em atraso · ${euros(total)}`,
    texto:
      `${nm.valores.some((v) => v.comReserva === true) ? `A ${PARTE_DA_CLYON_COM_RESERVA}` : "A taxa da plataforma"} e o IVA dela ${trabalhos}. Tem ${DIAS_PARA_PAGAR_O_VALOR_EM_ATRASO} dias depois de o trabalho ficar confirmado` +
      (ate ? `: pague até ${ate}.` : ".") +
      " Depois disso, a conta fica em stand-by até pagar.",
    botao: PAGAR_O_VALOR_EM_ATRASO,
  };
}

/** O botão da faixa dos dados para receber (d11 v2 revisto pelo CEO). */
export { COMPLETAR_O_PERFIL };

/** O regime de IVA com que o ecrã começa: só o confirmado; vazio = por confirmar (d19). */
export function regimeInicial(regimeDoPerfil: string | null | undefined): "isento" | "normal" | "" {
  return regimeDoPerfil === "normal" || regimeDoPerfil === "isento" ? regimeDoPerfil : "";
}

/** O que segue no PUT do perfil: o regime só com um toque, e então confirmado (d19). */
export function corpoDoRegime(
  regime: "isento" | "normal" | "",
  escolhido: boolean,
): { regimeIva?: "isento" | "normal"; confirmarRegime?: true } {
  return escolhido && regime !== "" ? { regimeIva: regime, confirmarRegime: true } : {};
}

/** A mesma frase do painel por baixo de «Regime de IVA» quando está por confirmar. */
export const REGIME_POR_CONFIRMAR = "Por confirmar: escolha um dos dois e guarde.";

/** O que `GET /api/profissionais/termos` devolve (d20). Sem sessão vem só a parte pública. */
export type EstadoDosTermos = {
  versao: string;
  versaoPorExtenso: string;
  emVigor: boolean;
  aceiteEm: string | null;
  precisaDeAceitar: boolean;
  textos: {
    titulo: string;
    resumo: string;
    ligacao: string;
    url: string;
    caixa: string;
    caixaDaPalavraPasse: string;
    aceitar: string;
    agoraNao: string;
  };
};

export const ROTA_DOS_TERMOS = "/api/profissionais/termos";

/** A resposta da rota serve? (Um site antigo dá 404; outra coisa qualquer não mostra nada.) */
export function termosLidos(v: unknown): EstadoDosTermos | null {
  const t = v as Partial<EstadoDosTermos> | null;
  if (!t || typeof t.versao !== "string" || !t.textos || typeof t.textos.caixa !== "string") return null;
  return t as EstadoDosTermos;
}

/** O ecrã do primeiro acesso aparece? Só com o servidor a dizê-lo — e não depois de «Agora não» nesta abertura. */
export function mostrarOsTermos(t: EstadoDosTermos | null, adiadoNestaVersao: string | null): boolean {
  return !!t && t.precisaDeAceitar && adiadoNestaVersao !== t.versao;
}

/** O corpo do definir-senha: a versão só com a caixa marcada, e só com os Termos em vigor (d20). */
export function aceitaTermosNoCorpo(t: EstadoDosTermos | null, marcada: boolean): { aceitaTermos?: string } {
  return t?.emVigor && marcada ? { aceitaTermos: t.versao } : {};
}

// ── d27, parte 3 (15-11-2026): a Ajuda pelo modelo que o servidor diz ──

/** Um instante antes de qualquer modelo e um depois de todos: a função do site pede uma data; a app não tem a do modelo. */
const ANTES_DE_TUDO = new Date(0);
const DEPOIS_DE_TUDO = new Date(8.64e15);

/**
 * AS PERGUNTAS DA AJUDA PELO SERVIDOR — d27. `perguntasDoProfissional` escolhe
 * o modelo por uma data; com o relógio do telemóvel, um telemóvel com a data
 * errada (ou o servidor ainda no modelo antigo) dava respostas de outro modelo.
 * Aqui a escolha é a do servidor — `novoModelo` do perfil, como «Como
 * funciona» e a carteira. A data do modelo continua a não viver na app: o sim
 * ou não do servidor passa à função do site como o primeiro instante possível
 * (modelo antigo) ou o último (modelo novo).
 */
export function perguntasDaAjuda(taxas: Taxas | null, noNovoModelo: boolean): PerguntaFrequente[] {
  return perguntasDoProfissional(taxas, noNovoModelo ? DEPOIS_DE_TUDO : ANTES_DE_TUDO);
}
