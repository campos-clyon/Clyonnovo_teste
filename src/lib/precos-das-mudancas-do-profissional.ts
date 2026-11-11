/**
 * OS PREÇOS DAS MUDANÇAS, DITOS AO PROFISSIONAL — 11-11-2026.
 *
 * A lista das mudanças está aberta aos clientes desde 10-11-2026, e o ecrã dos
 * preços ainda dizia «Por agora ficam só guardados na sua conta». Aqui ficam,
 * num só sítio, os textos e as três regras que o painel e a app CLYON Pro
 * mostram a quem faz mudanças:
 *
 *   1. o interruptor «Aparecer na lista» NASCE LIGADO na primeira gravação
 *      (quem já gravou e o desligou fica como está);
 *   2. sem preço para 3 pessoas, um aviso: fica fora dos T3 ou maiores;
 *   3. o estado («por preencher», «fora da lista», «na lista») na linha do
 *      menu, e a falta no cartão do perfil enquanto não houver preços.
 *
 * Lib PURA (sem base, sem rede, sem imports): a rota dos preços, a rota do
 * perfil, o painel e a app lêem todos daqui.
 */

export type EstadoDosPrecosDasMudancas = "por_preencher" | "fora_da_lista" | "na_lista";

/** O que basta saber da tarifa gravada para dizer o estado. */
type TarifaGravada = { aparecerNaLista: boolean } | null | undefined;

export const TEXTOS_DOS_PRECOS_DAS_MUDANCAS = Object.freeze({
  titulo: "Preços das mudanças",
  abertura:
    "Os seus preços para mudanças, sem IVA. Com «Aparecer na lista» ligado, os clientes da sua zona vêem-no com estes preços " +
    "e podem escolhê-lo. Quando um cliente o escolher, o trabalho fica com os preços desse dia.",
  interruptor: "Aparecer na lista das mudanças",
  interruptorLigado: "Ligado: aparece na lista das mudanças com estes preços.",
  interruptorDesligado: "Desligado: os preços ficam guardados, mas os clientes não o vêem.",
  interruptorSemMudancas: "Só com o serviço «Mudanças» nos seus serviços.",
  gravadoNaLista: "Guardado. Aparece na lista das mudanças com estes preços.",
  gravadoForaDaLista: "Guardado. Ainda não aparece na lista: ligue «Aparecer na lista das mudanças».",
  gravadoSemMudancas: "Preços gravados.",
  semTresPessoas: "Sem preço para 3 pessoas não aparece nas mudanças de T3 ou maiores.",
  faltaRotulo: "Preços das mudanças",
  faltaPorque: "Sem eles não aparece na lista que os clientes vêem.",
});

/** O estado, como se lê na linha do menu. */
export const ROTULO_DO_ESTADO_DOS_PRECOS: Readonly<Record<EstadoDosPrecosDasMudancas, string>> = Object.freeze({
  por_preencher: "por preencher",
  fora_da_lista: "fora da lista",
  na_lista: "na lista",
});

/** Sem tarifa: por preencher. Com tarifa: na lista, ou fora dela. */
export function estadoDosPrecosDasMudancas(tarifa: TarifaGravada): EstadoDosPrecosDasMudancas {
  if (!tarifa) return "por_preencher";
  return tarifa.aparecerNaLista ? "na_lista" : "fora_da_lista";
}

/**
 * Como o interruptor aparece ao abrir o ecrã: o que está gravado; e, sem nada
 * gravado, LIGADO para quem tem «Mudanças» nos serviços.
 */
export function interruptorAoAbrir(tarifa: TarifaGravada, temMudancas: boolean): boolean {
  if (!temMudancas) return false;
  return tarifa ? tarifa.aparecerNaLista === true : true;
}

/**
 * O que se grava em «aparecer na lista».
 *
 * Quem diz sim ou não, fica com o que disse. Quem não diz nada (`enviado`
 * por definir): na PRIMEIRA gravação nasce ligado, se tiver «Mudanças»; nas
 * seguintes fica como estava. Sem «Mudanças» nunca se liga por omissão.
 */
export function aparecerNaListaAoGravar(e: {
  enviado: boolean | null | undefined;
  gravada: TarifaGravada;
  temMudancas: boolean;
}): boolean {
  if (typeof e.enviado === "boolean") return e.enviado;
  if (e.gravada) return e.gravada.aparecerNaLista === true;
  return e.temMudancas;
}

/** A linha por baixo do interruptor. */
export function dicaDoInterruptor(ligado: boolean, temMudancas: boolean): string {
  if (!temMudancas) return TEXTOS_DOS_PRECOS_DAS_MUDANCAS.interruptorSemMudancas;
  return ligado ? TEXTOS_DOS_PRECOS_DAS_MUDANCAS.interruptorLigado : TEXTOS_DOS_PRECOS_DAS_MUDANCAS.interruptorDesligado;
}

/** O que se diz depois de gravar: nunca «guardado» a quem ficou fora da lista sem o saber. */
export function mensagemDeGravado(naLista: boolean, temMudancas: boolean): string {
  if (!temMudancas) return TEXTOS_DOS_PRECOS_DAS_MUDANCAS.gravadoSemMudancas;
  return naLista ? TEXTOS_DOS_PRECOS_DAS_MUDANCAS.gravadoNaLista : TEXTOS_DOS_PRECOS_DAS_MUDANCAS.gravadoForaDaLista;
}

/** O aviso por baixo da «Hora com 3 pessoas» quando fica vazia; null com preço. */
export function avisoDasTresPessoas(precoHora3: string | number | null | undefined): string | null {
  const vazio = precoHora3 == null || String(precoHora3).trim() === "";
  return vazio ? TEXTOS_DOS_PRECOS_DAS_MUDANCAS.semTresPessoas : null;
}

export type FaltaDosPrecosDasMudancas = { chave: "precos-das-mudancas"; rotulo: string; porque: string };

/** A falta no cartão «Falta terminar o seu perfil»: só a quem tem Mudanças e ainda não pôs preços. */
export function faltaDosPrecosDasMudancas(
  temMudancas: boolean,
  estado: EstadoDosPrecosDasMudancas | null | undefined,
): FaltaDosPrecosDasMudancas | null {
  if (!temMudancas || estado !== "por_preencher") return null;
  return {
    chave: "precos-das-mudancas",
    rotulo: TEXTOS_DOS_PRECOS_DAS_MUDANCAS.faltaRotulo,
    porque: TEXTOS_DOS_PRECOS_DAS_MUDANCAS.faltaPorque,
  };
}

export type PrecosDasMudancasNaConta = {
  estado: EstadoDosPrecosDasMudancas;
  /** «por preencher», «fora da lista» ou «na lista». */
  rotulo: string;
  falta: FaltaDosPrecosDasMudancas | null;
};

/** O que a rota do perfil devolve para o menu e para o cartão; null a quem não tem Mudanças. */
export function precosDasMudancasNaConta(tarifa: TarifaGravada, temMudancas: boolean): PrecosDasMudancasNaConta | null {
  if (!temMudancas) return null;
  const estado = estadoDosPrecosDasMudancas(tarifa);
  return { estado, rotulo: ROTULO_DO_ESTADO_DOS_PRECOS[estado], falta: faltaDosPrecosDasMudancas(true, estado) };
}
