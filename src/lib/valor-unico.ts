import { lerValorFixo } from "./oferta-clyon";
import { totalDoValorUnico } from "./valor-unico-ao-cliente";
import { servicoComArtigo } from "./mensagem-das-propostas";
import { linhasDoOrcamento } from "./mensagem-do-orcamento";
import { type BaseDoPreco } from "./base-do-preco";

/**
 * O VALOR ÚNICO — 15-11-2026 (d39, decisão do dono; caminho B do CEO).
 *
 * Numa negociação com várias propostas (o #621: 125 / 140 / 150 € de três
 * parceiros), a lista com nomes e valores ia ao cliente e o cliente não
 * respondia. Agora pode ir-lhe UM valor, sem nomes:
 *
 *   · as propostas continuam vivas — ninguém deixa de negociar;
 *   · o cliente não vê a lista nem quem propôs até a CLYON escolher
 *     (`negociacoesParaOCliente` só deixa sair a contratada);
 *   · aceite o valor, a CLYON escolhe o parceiro entre os que propuseram
 *     («Escolher por mim») e aceita a proposta DELE pelo valor dele, com o
 *     «Responder como CLYON → Aceitar» de sempre;
 *   · a diferença entre o valor único e o do parceiro fica à vista na Mesa.
 *
 * Os valores são sempre os que o cliente veria em cada proposta, sem IVA (o
 * `semIva` de `propostasParaOCliente`) — o mesmo número que o valor único é.
 * Esta lib é PURA: a Mesa, a rota, o email e os testes usam a mesma.
 */

/** O valor que aparece escrito por omissão: a mediana (com duas, a média), arredondada a 5 €. */
export function valorUnicoSugerido(valores: readonly number[]): number | null {
  const v = valores.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const meio = Math.floor(v.length / 2);
  const mediana = v.length % 2 === 1 ? v[meio] : (v[meio - 1] + v[meio]) / 2;
  const arredondado = Math.round(mediana / 5) * 5;
  // Uma proposta de 2 € não arredonda para 0: fica nos 5 €.
  return Math.max(5, arredondado);
}

/** O valor escrito pela equipa: as mesmas regras do valor de um trabalho (sem IVA). */
export function lerValorUnico(v: unknown): { ok: true; valor: number } | { ok: false; erro: string } {
  return lerValorFixo(v);
}

const euros = (v: number) => `${v.toFixed(2).replace(".", ",")} €`;

export {
  QUEM_FAZ_NO_VALOR_UNICO,
  totalDoValorUnico,
  valorUnicoComIva,
  valorUnicoDaLinha,
  valorUnicoParaOCliente,
} from "./valor-unico-ao-cliente";
export const RESPONDA_SIM = "Responda SIM para aceitar.";

export type DadosDoValorUnico = {
  nomeCliente?: string | null;
  /** O serviço por extenso: «recolha de móveis». */
  servico?: string | null;
  /** O id do serviço («recolha_moveis»), para a nota dos itens a mais certa. */
  servicoId?: string | null;
  cidade?: string | null;
  valorSemIva: number;
  base?: BaseDoPreco | null;
};

/**
 * A MENSAGEM DO VALOR ÚNICO — igual no WhatsApp (o «Enviar orçamento» e o
 * «Enviar pela CLYON») e no email. Sem nomes e sem lista: o serviço e a zona,
 * o valor com o IVA ao lado, o que cobre, quem faz e «Responda SIM».
 */
export function mensagemDoValorUnico(d: DadosDoValorUnico, agora: Date): string {
  return linhasDoValorUnico(d, agora).join("\n");
}

/** As mesmas linhas, para o email as pôr em parágrafos. */
export function linhasDoValorUnico(d: DadosDoValorUnico, agora: Date): string[] {
  /*
   * CURTA, EM QUATRO PARTES — 15-11-2026 (d47). O valor com o IVA ao lado, o
   * que cobre e o extra com preço, quem faz (encurtado), e «Responda SIM». Ver
   * `mensagem-do-orcamento.ts`.
   */
  return linhasDoOrcamento(
    {
      cliente: d.nomeCliente,
      servicoComArtigo: servicoComArtigo(d.servico),
      servicoId: d.servicoId ?? null,
      localidade: d.cidade,
      semIva: d.valorSemIva,
      total: totalDoValorUnico(d.valorSemIva),
      base: d.base ?? "total",
      modelo: "valor_unico",
    },
    agora,
  );
}

/* ── «ESCOLHER POR MIM» ─────────────────────────────────────────────────── */

export type CandidatoAoValorUnico = {
  negociacaoId: number;
  nome: string;
  /** O que o cliente pagaria pela proposta dele, sem IVA. */
  semIva: number;
  /** A nota que conta (média e quantas). Sem avaliações, null. */
  nota: { media: number; quantas: number } | null;
  /** NIF, identidade e contacto confirmados. */
  verificado: boolean;
};

export type SugestaoDoValorUnico = {
  candidato: CandidatoAoValorUnico;
  /** Pediu mais do que o valor único: avisa-se antes de aceitar. */
  acimaDoValorUnico: boolean;
  /** Valor único − o dele: positiva, sobra; negativa, falta. */
  diferenca: number;
  porque: string;
};

/**
 * O PARCEIRO SUGERIDO: entre os verificados que pediram até ao valor único,
 * o mais bem avaliado (mais avaliações a desempatar, depois o mais barato);
 * sem nenhum até ao valor único, o mais barato. Só uma sugestão — quem aceita
 * é a equipa, pelo «Responder como CLYON → Aceitar».
 */
export function escolherPorMim(candidatos: readonly CandidatoAoValorUnico[], valorUnico: number): SugestaoDoValorUnico | null {
  const validos = candidatos.filter((c) => c.verificado && Number.isFinite(c.semIva) && c.semIva > 0);
  if (validos.length === 0) return null;
  const dentro = validos.filter((c) => c.semIva <= valorUnico + 0.005);
  const media = (c: CandidatoAoValorUnico) => c.nota?.media ?? -1;
  const quantas = (c: CandidatoAoValorUnico) => c.nota?.quantas ?? 0;
  let escolhido: CandidatoAoValorUnico;
  let porque: string;
  if (dentro.length > 0) {
    escolhido = [...dentro].sort((a, b) => media(b) - media(a) || quantas(b) - quantas(a) || a.semIva - b.semIva)[0];
    porque = escolhido.nota
      ? `o mais bem avaliado (${escolhido.nota.media.toFixed(1).replace(".", ",")} em ${escolhido.nota.quantas}) entre os que pediram até ${euros(valorUnico)}`
      : `entre os que pediram até ${euros(valorUnico)}, nenhum tem avaliações: o mais barato`;
  } else {
    escolhido = [...validos].sort((a, b) => a.semIva - b.semIva)[0];
    porque = `ninguém pediu até ${euros(valorUnico)}: o mais barato`;
  }
  const diferenca = Math.round((valorUnico - escolhido.semIva) * 100) / 100;
  return { candidato: escolhido, acimaDoValorUnico: escolhido.semIva > valorUnico + 0.005, diferenca, porque };
}

/**
 * «reserva para imprevistos: +15,00 € (fica na parte da CLYON)» — d39, decidido
 * a 15-11-2026: a diferença é a reserva, gravada ao fechar (reserva.ts).
 */
export function diferencaEmTexto(valorUnico: number, semIvaDoParceiro: number): string {
  const d = Math.round((valorUnico - semIvaDoParceiro) * 100) / 100;
  const sinal = d > 0 ? "+" : d < 0 ? "−" : "";
  const onde = d < 0 ? "a parte da CLYON desce" : "fica na parte da CLYON";
  return `reserva para imprevistos: ${sinal}${euros(Math.abs(d))} (${onde})`;
}

/** O aviso antes de aceitar uma proposta acima do valor único. */
export function avisoAcimaDoValorUnico(nome: string, semIvaDoParceiro: number, valorUnico: number): string {
  return (
    `${nome} pediu ${euros(semIvaDoParceiro)} + IVA, mais do que o valor único enviado ao cliente (${euros(valorUnico)} + IVA). ` +
    `A diferença (${euros(semIvaDoParceiro - valorUnico)}) sai da parte da CLYON: a reserva fica negativa e, se passar a taxa, a CLYON paga-lhe o resto por crédito na carteira. Aceitar mesmo assim?`
  );
}
