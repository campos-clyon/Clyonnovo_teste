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
import { PAGAR_O_VALOR_EM_ATRASO } from "../../../src/lib/valor-em-atraso";
import { NOME_DA_FATURA, MENSAGENS_DA_FATURA } from "../../../src/lib/faturas-do-trabalho";
import { COMO_PAGAR_EM_PALAVRAS } from "../../../src/lib/pagar-ao-parceiro";

export { PAGAR_O_VALOR_EM_ATRASO, NOME_DA_FATURA, MENSAGENS_DA_FATURA, COMO_PAGAR_EM_PALAVRAS };

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

/** «Taxa da plataforma 25,00 € + IVA 5,75 €» — as duas partes de um valor em atraso. */
export function partesDoValorEmAtraso(v: { taxa: number; iva: number }, euros: (n: number) => string): string {
  return v.iva > 0 ? `Taxa da plataforma ${euros(v.taxa)} + IVA ${euros(v.iva)}` : `Taxa da plataforma ${euros(v.taxa)}`;
}

/** A linha do perfil fiscal, como o cliente a lê ao escolher: «Fatura com IVA · Emite guia de resíduos». */
export function linhaDoPerfilFiscal(p: NovoModeloDoPerfil["perfilFiscal"]): string {
  return p.guia ? `${p.fatura} · ${p.guia}` : p.fatura;
}

/** A rota aceita imagem ou PDF; a app manda uma fotografia ou uma captura (sem módulo nativo novo). */
export const AJUDA_DA_FATURA_NA_APP =
  "Fotografe a fatura que emitiu ao cliente ou escolha uma captura da galeria. O cliente vê-a no pedido, ao lado da fatura da taxa da plataforma.";
