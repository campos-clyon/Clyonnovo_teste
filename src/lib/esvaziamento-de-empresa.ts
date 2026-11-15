/*
 * O ESVAZIAMENTO DE ARMAZÉNS, ESCRITÓRIOS E LOJAS — 15-11-2026 (d43).
 *
 * Um tipo de serviço próprio para as empresas: um armazém, um escritório ou
 * uma loja não se medem por tipologia (T0…T4), e quem os esvazia quer saber
 * outras coisas — se é fora de horas, se precisa da guia de transporte, e
 * que a fatura vem com o NIF da empresa. Sem preço publicado: o espaço e o
 * que lá está mudam tudo, e cada parceiro orça com as fotografias.
 *
 * O id é `esvaziamento_empresa` (service-categories.ts). Pertence ao grupo
 * «Esvaziamentos»: chega a quem esvazia casas.
 */

export const ESVAZIAMENTO_DE_EMPRESA = "esvaziamento_empresa";

/** Que espaço é. */
export const ESPACOS_DA_EMPRESA = [
  { id: "armazem", nome: "Armazém" },
  { id: "escritorio", nome: "Escritório" },
  { id: "loja", nome: "Loja" },
  { id: "outro", nome: "Outro espaço" },
] as const;

/**
 * O que a empresa pode pedir além do esvaziamento. A guia de transporte é a
 * do formulário de sempre (`precisaGuiaTransporte`), e a fatura com NIF
 * também (`precisaFatura` + `nifFactura`): aqui só o que não tinha onde ir.
 */
export const PEDIDOS_DA_EMPRESA = {
  foraDeHoras: "Fora de horas (à noite ou ao fim de semana)",
} as const;

/** A frase da fatura: a fatura sai sempre, com o NIF que a empresa der. */
export const FATURA_COM_NIF = "Fatura com o NIF da empresa.";

export const PREFIXO_DO_ESPACO_DA_EMPRESA = "Espaço da empresa: ";
export const PREFIXO_DOS_PEDIDOS_DA_EMPRESA = "Pedidos da empresa: ";
const PREFIXO_DO_ESPACO = PREFIXO_DO_ESPACO_DA_EMPRESA;
const PREFIXO_DOS_PEDIDOS = PREFIXO_DOS_PEDIDOS_DA_EMPRESA;

/** A linha do espaço, para a descrição do pedido («Espaço da empresa: Armazém.»). */
export function linhaDoEspacoDaEmpresa(espaco: string | null | undefined): string {
  const e = ESPACOS_DA_EMPRESA.find((x) => x.id === espaco);
  return e ? `${PREFIXO_DO_ESPACO}${e.nome}.` : "";
}

/** A linha do que pediu («Pedidos da empresa: fora de horas (à noite ou ao fim de semana).»). */
export function linhaDosPedidosDaEmpresa(p: { foraDeHoras?: boolean }): string {
  return p.foraDeHoras ? `${PREFIXO_DOS_PEDIDOS}${PEDIDOS_DA_EMPRESA.foraDeHoras.toLowerCase()}.` : "";
}

/** Troca (ou tira) a linha que começa por `prefixo` na descrição, sem mexer no resto. */
function comALinha(descricao: string | undefined, prefixo: string, linha: string): string {
  const resto = (descricao ?? "")
    .split("\n")
    .filter((l) => !l.startsWith(prefixo));
  // No fim, e não no começo: a linha da «Quantidade» do seletor de volume vive na primeira.
  return [...resto, linha].filter((l) => l.trim() !== "").join("\n").trim();
}

export function comOEspacoDaEmpresa(descricao: string | undefined, espaco: string | null | undefined): string {
  return comALinha(descricao, PREFIXO_DO_ESPACO, linhaDoEspacoDaEmpresa(espaco));
}

export function comOsPedidosDaEmpresa(
  descricao: string | undefined,
  p: { foraDeHoras?: boolean },
): string {
  return comALinha(descricao, PREFIXO_DOS_PEDIDOS, linhaDosPedidosDaEmpresa(p));
}
