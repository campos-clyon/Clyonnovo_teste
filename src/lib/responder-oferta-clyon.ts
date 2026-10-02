import {
  appendOrderHistory,
  atribuirOfertaClyon,
  gravarNegociacao,
  registarSemFalhar,
} from "./db";
import { aceitarFechaLogo, responderAOferta, type ModoDaOferta } from "./oferta-clyon";
import type { Negociacao } from "./negociacao";
import { avisarProfissionalEscolhido } from "./avisar-escolhido-da-oferta";

/**
 * O PROFISSIONAL RESPONDE A UM TRABALHO CLYON — pelo painel ou pelo link.
 *
 * Há duas portas até à negociação (a sessão do painel e o token do email), e
 * a regra de uma oferta tem de ser a mesma nas duas: só aceitar ou recusar.
 * Vive aqui para não ser escrita duas vezes.
 *
 *   · RECUSAR — fica «desistida», como quem desiste de um pedido normal;
 *   · ACEITAR, DISTRIBUÍDA — fica «à espera de contratação» e entra na lista
 *     do backoffice: a CLYON escolhe;
 *   · ACEITAR, DIRECTA — a escolha já estava feita: fica com o trabalho,
 *     pela mesma transacção da escolha (`atribuirOfertaClyon`).
 *
 * O CLIENTE NÃO É AVISADO de nada disto. Num pedido normal, o aceitar do
 * profissional manda ao cliente «aceitou, contrate-o»; aqui o cliente fala com
 * a CLYON (decisão do dono a 02-10-2026), e é por isso que esta função sai
 * antes de a rota chegar a esse código.
 */
export async function responderOfertaClyon(a: {
  negociacaoId: number;
  pedidoId: number;
  providerId: number;
  nome: string;
  estadoActual: Negociacao;
  accao: unknown;
  modo: ModoDaOferta;
  baseUrl: string;
  agora: Date;
}): Promise<{ status: number; corpo: Record<string, unknown> }> {
  const r = responderAOferta(a.estadoActual, a.accao, a.agora);
  if (!r.ok) return { status: 409, corpo: { ok: false, error: r.erro } };
  const nova = r.negociacao;

  await gravarNegociacao(a.negociacaoId, {
    estado: nova.estado,
    valorAcordado: nova.valorAcordado ?? null,
    propostasJson: JSON.stringify(nova.propostas),
  });

  const valor = nova.valorAcordado ?? null;
  const emEuros = valor != null ? `${valor.toFixed(2).replace(".", ",")} €` : "o valor fixo";
  let estado: string = nova.estado;
  let mensagem: string;

  if (a.accao === "aceitar") {
    if (aceitarFechaLogo(a.modo)) {
      const at = await atribuirOfertaClyon(a.negociacaoId);
      if (at.ok) {
        estado = "acordada";
        mensagem = `${a.nome} aceitou o trabalho CLYON de valor fixo (${emEuros}) e ficou com ele — era só para ele.`;
        // O email com a morada e o contacto, como a quem é contratado. Sem
        // WhatsApp: acabou de carregar no botão.
        await avisarProfissionalEscolhido({
          negociacaoId: a.negociacaoId,
          pedidoId: a.pedidoId,
          providerId: a.providerId,
          baseUrl: a.baseUrl,
          whatsapp: false,
        });
      } else {
        mensagem =
          `${a.nome} aceitou o trabalho CLYON de valor fixo (${emEuros}), mas não ficou com ele: ` +
          (at.porque === "ja_atribuida" ? "o trabalho já tinha profissional." : "a atribuição falhou.");
      }
    } else {
      mensagem = `${a.nome} aceitou o trabalho CLYON de valor fixo (${emEuros}) — falta a CLYON escolher.`;
    }
  } else {
    mensagem = `${a.nome} recusou o trabalho CLYON de valor fixo.`;
  }

  await appendOrderHistory(a.pedidoId, { type: "created", by: null, message: mensagem });
  await registarSemFalhar({
    acontecimento:
      a.accao === "aceitar"
        ? estado === "acordada"
          ? "negociacao_fechada"
          : "proposta_aceite"
        : "negociacao_desistida",
    pedidoId: a.pedidoId,
    negociacaoId: a.negociacaoId,
    providerId: a.providerId,
    providerNome: a.nome,
    autorTipo: "profissional",
    autorNome: a.nome,
    valor,
    valorProfissional: valor,
    resumo: mensagem,
  });

  return {
    status: 200,
    corpo: { ok: true, estado, valorAcordado: valor, propostas: nova.propostas },
  };
}
