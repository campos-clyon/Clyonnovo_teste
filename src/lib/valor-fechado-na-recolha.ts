import { fraseDaBase } from "./frase-da-base";
import { semAcentos } from "./leitor-da-recolha";
import { juntarNota, type RespostaDaRecolha } from "./whatsapp-recolha";

/**
 * O VALOR FECHADO — 18-11-2026 (decisão d69).
 *
 *   VITÓRIA: Perfeito, fica anotado. Deseja fatura? (aplica-se IVA de 23%)
 *   CLIENTE: É indiferente, quero saber o valor final sem alterações posteriores
 *
 * Ele pediu um valor fechado. A Vitória anota-o no pedido (para a equipa e
 * para o parceiro) e diz-lhe o que o valor que lhe enviamos é: o total pelo
 * que está nas fotografias e na descrição — a frase única da base total (d63,
 * `frase-da-base.ts`), com o extra no local pela regra do serviço. Não promete
 * mais do que isso.
 */

export const NOTA_DO_VALOR_FECHADO = "Cliente quer valor fechado (total)";

/** «quero o valor final sem alterações posteriores», «preço fechado», «sem surpresas no dia». */
export function pedeValorFechado(texto: string): boolean {
  const t = semAcentos(texto);
  return (
    /\b(?:valor|preco|orcamento|custo)\s+(?:fechado|definitivo|fixo)\b/.test(t) ||
    /\bsem\s+(?:alteracoes|alteracao|surpresas|acrescimos|mudancas|extras)(?:\s+(?:posteriores|depois|no dia|a seguir|nenhumas?))?\b/.test(t) ||
    /\b(?:nao|sem)\s+(?:pode\s+)?(?:mudar|alterar|subir|aumentar)\s+(?:o\s+)?(?:valor|preco)\s+depois\b/.test(t)
  );
}

/** O que a Vitória diz a quem pediu o valor fechado. */
export function fraseDoValorFechado(servico: string | null | undefined): string {
  return `Fica anotado que quer o valor total. O valor que lhe enviamos é o total do trabalho. ${fraseDaBase("total", servico)}`;
}

/**
 * A NOTA E A FRASE — uma vez por recolha. Na resposta que ia sair, a frase vai
 * à frente; num registo ou numa passagem a uma pessoa, só a nota.
 */
export function comOValorFechado(r: RespostaDaRecolha, texto: string): RespostaDaRecolha {
  if (!pedeValorFechado(texto) || r.desistir) return r;
  const dados = { ...r.estado.dados };
  if ((dados.notas ?? []).includes(NOTA_DO_VALOR_FECHADO)) return r;
  juntarNota(dados, NOTA_DO_VALOR_FECHADO);
  const estado = { ...r.estado, dados };
  if (r.registar || r.pedirPessoa || !r.resposta.trim()) return { ...r, estado };
  return { ...r, estado, resposta: `${fraseDoValorFechado(dados.serviceType)}\n\n${r.resposta}` };
}
