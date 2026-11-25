/**
 * AS CHAVES DAS PROPOSTAS DITAS AO CLIENTE — d114 (25-11-2026). PURO, mas fica
 * à parte de `propostas-curtas.ts`: precisa das chaves do assistente
 * (`assistente-automatico.ts`), que o painel não pode trazer.
 */
import { chaveDaAceitacao, chaveDaProposta, propostasDe } from "./assistente-automatico";
import { estaExpirada } from "./negociacao";

type NegociacaoParaAChave = {
  id: number | string;
  estado: string;
  profissionalNome?: string | null;
  propostasJson: string | null;
  valorAcordado?: number | string | null;
};

/**
 * AS CHAVES DAS PROPOSTAS VIVAS DE UM PEDIDO — uma por proposta, a mesma nos
 * três caminhos: a proposta de um parceiro à espera do cliente
 * (`chaveDaProposta`, pelo número de propostas da negociação) e o parceiro que
 * aceitou o valor do cliente (`chaveDaAceitacao`, pelo valor). Pura.
 */
export function chavesDasPropostasVivas(
  negociacoes: readonly NegociacaoParaAChave[],
  agora: Date,
): Array<{ chave: string; negociacaoId: number; parceiro: string; aceitou: boolean }> {
  const out: Array<{ chave: string; negociacaoId: number; parceiro: string; aceitou: boolean }> = [];
  for (const n of negociacoes) {
    const id = Number(n.id);
    if (!Number.isInteger(id) || id <= 0) continue;
    const propostas = propostasDe(n.propostasJson);
    const parceiro = String(n.profissionalNome ?? "").trim();
    if (n.estado === "aguarda_contratacao") {
      const aceite = [...propostas].reverse().find((x) => x.estado === "aceite");
      const valor = n.valorAcordado != null && Number.isFinite(Number(n.valorAcordado)) ? Number(n.valorAcordado) : aceite?.valor;
      if (typeof valor === "number" && Number.isFinite(valor)) out.push({ chave: chaveDaAceitacao(id, valor), negociacaoId: id, parceiro, aceitou: true });
      continue;
    }
    if (n.estado !== "aberta") continue;
    const pendente = [...propostas].reverse().find((x) => x.estado === "pendente");
    if (!pendente || pendente.por !== "profissional" || estaExpirada(pendente, agora)) continue;
    out.push({ chave: chaveDaProposta(id, propostas.length), negociacaoId: id, parceiro, aceitou: false });
  }
  return out;
}

