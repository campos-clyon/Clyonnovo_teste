/**
 * OS DADOS DE PAGAMENTO DE UM PROFISSIONAL — quando mudam — d1 de 12-11-2026.
 *
 * O IBAN, o titular da conta e o MB WAY dizem para onde vai o dinheiro dele.
 * Quem apanhasse uma sessão aberta (um telemóvel desbloqueado em cima da mesa,
 * um computador partilhado) trocava-os e o levantamento seguinte ia para outra
 * pessoa — sem nada no ecrã a dizê-lo a ninguém.
 *
 * Por isso, desde 12-11-2026:
 *   · mudar qualquer um dos três pede a palavra-passe da conta (a rota do
 *     perfil responde 401 sem ela, ou com ela errada);
 *   · a data da mudança fica gravada (`providers.ibanMudadoEm`);
 *   · o profissional recebe um email («se não reconhece a mudança, fale connosco»);
 *   · os Levantamentos do backoffice e o painel dizem «IBAN mudado há X dias»,
 *     com marca forte nos primeiros 7, e se o titular não bate com o nome.
 *
 * As regras vivem aqui, sem base nem rede, para a rota, o backoffice, o painel
 * e a app lerem a mesma conta — e para os testes as guardarem.
 */

/** Os campos do perfil que, mudados, pedem a palavra-passe. */
export const CAMPOS_DE_PAGAMENTO = ["iban", "ibanTitular", "mbway"] as const;
export type CampoDePagamento = (typeof CAMPOS_DE_PAGAMENTO)[number];

/** Os nomes que o email e o ecrã dão a cada campo. */
export const NOME_DO_CAMPO: Record<CampoDePagamento, string> = {
  iban: "IBAN",
  ibanTitular: "titular da conta",
  mbway: "MB WAY",
};

/** Os dias em que a mudança ainda é recente — e a marca é forte. */
export const DIAS_DE_ALERTA = 7;

/**
 * O contrato com o painel e com a app Pro: o campo do corpo e os códigos que a
 * rota devolve, com o 401, quando a palavra-passe falta ou não confere. O 401
 * sem `codigo` continua a ser a sessão que expirou.
 */
export const CAMPO_DA_PALAVRA_PASSE = "palavraPasse";
export const CODIGOS_DA_PALAVRA_PASSE = {
  emFalta: "palavra_passe_em_falta",
  errada: "palavra_passe_errada",
  semPalavraPasse: "conta_sem_palavra_passe",
} as const;

const vazioANulo = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  return t ? t : null;
};

/**
 * Os campos de pagamento que a gravação muda DE FACTO, contra o que está na
 * base. Gravar o mesmo valor (o painel e a app mandam o titular e o MB WAY em
 * cada gravação da conta) não é mudar, e não pede a palavra-passe.
 */
export function camposDePagamentoMudados(
  guardado: Record<string, unknown> | null | undefined,
  mudancas: Record<string, unknown>,
): CampoDePagamento[] {
  return CAMPOS_DE_PAGAMENTO.filter(
    (c) => c in mudancas && vazioANulo(mudancas[c]) !== vazioANulo(guardado?.[c]),
  );
}

/** «IBAN, titular da conta e MB WAY» — para o email. */
export function listaDosCampos(campos: readonly CampoDePagamento[]): string {
  const nomes = campos.map((c) => NOME_DO_CAMPO[c]);
  if (nomes.length <= 1) return nomes.join("");
  return `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
}

/**
 * Há quanto tempo mudaram os dados de pagamento. `null` quando não se sabe (as
 * contas de antes de 12-11-2026 não têm data) — e aí não há marca nenhuma,
 * porque não é recente.
 *
 * `dias` conta dias inteiros passados (0 = há menos de um dia); `recente` é a
 * marca forte: menos de `DIAS_DE_ALERTA` × 24 horas.
 */
export function mudancaDosDadosDePagamento(
  em: Date | null | undefined,
  agora: Date = new Date(),
): { dias: number; recente: boolean } | null {
  if (!em || Number.isNaN(em.getTime())) return null;
  const ms = Math.max(0, agora.getTime() - em.getTime());
  const dias = Math.floor(ms / 86_400_000);
  return { dias, recente: ms < DIAS_DE_ALERTA * 86_400_000 };
}

/** «hoje», «há 1 dia», «há 12 dias». */
export function haQuantoTempo(dias: number): string {
  if (dias <= 0) return "hoje";
  return dias === 1 ? "há 1 dia" : `há ${dias} dias`;
}

/* Palavras que não dizem quem é: as partículas dos nomes e a forma da empresa. */
const PALAVRAS_QUE_NAO_CONTAM = new Set([
  "de", "da", "do", "das", "dos", "e", "d",
  "lda", "limitada", "unipessoal", "sa", "sociedade", "comercial",
]);

function palavrasDoNome(nome: string): string[] {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter((p) => p.length > 1 && !PALAVRAS_QUE_NAO_CONTAM.has(p));
}

/**
 * O TITULAR BATE COM O NOME DA CONTA?
 *
 * Um nome que não bate com o IBAN é transferência devolvida — ou dinheiro para
 * outra pessoa. Bate quando um dos nomes (o da conta, ou o do responsável de
 * uma empresa) e o titular têm as mesmas palavras, ou todas as do mais curto
 * estão no outro, com pelo menos duas («João Silva» bate com «João Rui
 * Silva»). Acentos, maiúsculas, «de/da/dos» e «Lda»/«Unipessoal» não contam.
 *
 * Sem titular: não bate (não há com que conferir). Sem nome nenhum: `null` —
 * não se sabe, e não se marca.
 */
export function titularBateComONome(
  titular: string | null | undefined,
  ...nomes: Array<string | null | undefined>
): boolean | null {
  const candidatos = nomes.map((n) => palavrasDoNome(n ?? "")).filter((p) => p.length > 0);
  if (candidatos.length === 0) return null;
  const doTitular = palavrasDoNome(titular ?? "");
  if (doTitular.length === 0) return false;
  return candidatos.some((nome) => {
    const [curto, longo] = nome.length <= doTitular.length ? [nome, doTitular] : [doTitular, nome];
    const todas = curto.every((p) => longo.includes(p));
    return todas && (curto.length >= 2 || curto.length === longo.length);
  });
}
