/**
 * OS CAMPOS DA CANDIDATURA, E O NOME DE CADA UM — 12-11-2026 (decisão d9).
 *
 * Quem carregava em «Enviar candidatura» sem a fotografia da carrinha lia
 * «Falta preencher o que está assinalado acima» — e o assinalado estava fora
 * do ecrã, no meio do formulário. Num telemóvel ficava a ideia de que o botão
 * não fazia nada. Agora o aviso por baixo do botão diz o NOME de cada campo
 * («Falta: fotografia da carrinha»), e o ecrã desce até ao primeiro.
 *
 * A mesma lista serve à rota (`/api/parceiros/candidatura`): um erro de um
 * campo que não está aqui não tem sítio no ecrã — nem no do site, nem no da
 * app — e vai como mensagem geral, que os dois mostram.
 *
 * A ordem é a do formulário, de cima para baixo: é por ela que se escolhe o
 * primeiro campo com erro.
 */

export const CAMPOS_DA_CANDIDATURA = [
  { campo: "nome", nome: "nome ou empresa" },
  { campo: "telefone", nome: "telemóvel" },
  { campo: "email", nome: "email" },
  { campo: "cidade", nome: "de onde trabalha" },
  { campo: "fotografias", nome: "fotografia da carrinha" },
  { campo: "servicos", nome: "o que faz" },
] as const;

export type CampoDaCandidatura = (typeof CAMPOS_DA_CANDIDATURA)[number]["campo"];

export type ErroDaCandidatura = { campo: string; mensagem: string };

export function campoConhecido(campo: string): campo is CampoDaCandidatura {
  return CAMPOS_DA_CANDIDATURA.some((c) => c.campo === campo);
}

/**
 * Separa os erros que têm sítio no ecrã dos que não têm. Os que não têm
 * juntam-se numa só mensagem geral (ou `null`, se não houver nenhum).
 */
export function separarErrosDaCandidatura(erros: readonly ErroDaCandidatura[]): {
  porCampo: ErroDaCandidatura[];
  geral: string | null;
} {
  const porCampo = erros.filter((e) => campoConhecido(e.campo));
  const soltos = erros.filter((e) => !campoConhecido(e.campo)).map((e) => e.mensagem);
  return { porCampo, geral: soltos.length > 0 ? soltos.join(" ") : null };
}

/** Os campos com erro, pela ordem do formulário. */
export function camposComErro(erros: readonly ErroDaCandidatura[]): CampoDaCandidatura[] {
  return CAMPOS_DA_CANDIDATURA.filter((c) => erros.some((e) => e.campo === c.campo)).map((c) => c.campo);
}

/** «Falta: fotografia da carrinha.» — ou `null`, quando nenhum campo tem erro. */
export function resumoDoQueFalta(erros: readonly ErroDaCandidatura[]): string | null {
  const nomes = CAMPOS_DA_CANDIDATURA.filter((c) => erros.some((e) => e.campo === c.campo)).map((c) => c.nome);
  return nomes.length > 0 ? `Falta: ${nomes.join(", ")}.` : null;
}

/** O id do campo no formulário, para o ecrã descer até ele. */
export function idDoCampo(campo: CampoDaCandidatura): string {
  return `candidatura-${campo}`;
}
