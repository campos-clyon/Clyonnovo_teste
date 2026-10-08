import {
  appendOrderHistory,
  atribuirOfertaClyon,
  gravarRespostaAOfertaClyon,
  negociacoesDoPedido,
  reabrirOsOutrosDoTrabalhoClyon,
  registarSemFalhar,
} from "./db";
import { avisarValorNovoDoTrabalhoClyon } from "./avisar-trabalho-clyon";
import { quantoOProfissionalRecebe, taxasDaNegociacao } from "./taxas-plataforma";
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
 *   · RECUSAR — fica «desistida», como quem desiste de um pedido normal. E
 *     se era o último a quem a pergunta estava feita — o escolhido a quem
 *     se perguntou um valor novo —, o trabalho volta aos que tinham ficado
 *     de fora, no valor de agora (`reabrirOsOutrosDoTrabalhoClyon`, 08-10-2026);
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
  /** O valor que o ecrã dele mostrava ao carregar — ver `gravarRespostaAOfertaClyon`. */
  valorVisto?: unknown;
}): Promise<{ status: number; corpo: Record<string, unknown> }> {
  const r = responderAOferta(a.estadoActual, a.accao, a.agora);
  if (!r.ok) return { status: 409, corpo: { ok: false, error: r.erro } };
  const nova = r.negociacao;

  /*
   * SÓ SE O VALOR QUE ELE VIU AINDA É O DA MESA — 08-10-2026. O valor de um
   * Trabalho CLYON pode ter mudado com o ecrã dele aberto: aceitar ali era
   * aceitar um número que nunca leu. O que o ecrã mandou, ou — sem isso — o
   * que estava pendente quando a rota leu a negociação.
   */
  const visto = Number(a.valorVisto);
  const pendenteLido = [...a.estadoActual.propostas].reverse().find((p) => p.estado === "pendente");
  const valorQueViu = Number.isFinite(visto) && a.valorVisto != null && a.valorVisto !== ""
    ? visto
    : pendenteLido
      ? Number(pendenteLido.valor)
      : null;
  const gravou = await gravarRespostaAOfertaClyon(a.negociacaoId, valorQueViu, {
    estado: nova.estado,
    valorAcordado: nova.valorAcordado ?? null,
    propostasJson: JSON.stringify(nova.propostas),
  });
  if (!gravou) {
    return {
      status: 409,
      corpo: {
        ok: false,
        error: "O valor deste trabalho mudou entretanto. Veja o valor novo antes de responder.",
        valorMudou: true,
      },
    };
  }

  const valor = nova.valorAcordado ?? null;
  /*
   * O QUE LHE FICA, e não o valor do trabalho — 08-10-2026. Com a taxa de
   * um Trabalho CLYON, 350 € são 280 € para ele: é isso que o registo diz
   * em `valorProfissional`.
   */
  const linha = (await negociacoesDoPedido(a.pedidoId).catch(() => [])).find(
    (n) => Number(n.id) === a.negociacaoId,
  );
  const ganhos = valor != null ? quantoOProfissionalRecebe(valor, taxasDaNegociacao(linha)) : null;
  const emEuros = valor != null ? `${valor.toFixed(2).replace(".", ",")} €` : "o valor do trabalho";
  let estado: string = nova.estado;
  let mensagem: string;

  if (a.accao === "aceitar") {
    if (aceitarFechaLogo(a.modo)) {
      const at = await atribuirOfertaClyon(a.negociacaoId);
      if (at.ok) {
        estado = "acordada";
        mensagem = `${a.nome} aceitou o trabalho CLYON de ${emEuros} e ficou com ele — era só para ele.`;
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
          `${a.nome} aceitou o trabalho CLYON de ${emEuros}, mas não ficou com ele: ` +
          (at.porque === "ja_atribuida" ? "o trabalho já tinha profissional." : "a atribuição falhou.");
      }
    } else {
      mensagem = `${a.nome} aceitou o trabalho CLYON de ${emEuros} — falta a CLYON escolher.`;
    }
  } else {
    mensagem = `${a.nome} recusou o trabalho CLYON.`;
    const deVolta = await reabrirOsOutrosDoTrabalhoClyon(a.pedidoId).catch(() => null);
    if (deVolta && deVolta.quem.length > 0) {
      const avisados = await avisarValorNovoDoTrabalhoClyon({
        pedidoId: a.pedidoId,
        valor: deVolta.valor,
        taxa: deVolta.taxa,
        quem: deVolta.quem,
        motivo: "de_novo",
        baseUrl: a.baseUrl,
      });
      mensagem +=
        ` Voltou a ser oferecido a ${deVolta.quem.map((q) => q.profissional).join(", ")}` +
        ` (${avisados} avisado${avisados === 1 ? "" : "s"} por WhatsApp).`;
    }
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
    valorProfissional: ganhos,
    resumo: mensagem,
  });

  return {
    status: 200,
    corpo: { ok: true, estado, valorAcordado: valor, propostas: nova.propostas },
  };
}
