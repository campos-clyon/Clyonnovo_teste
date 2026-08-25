import {
  getPool,
  getSimulatorOrderById,
  negociacoesDoPedido,
  gravarNegociacao,
  encerrarOutrasNegociacoes,
  appendOrderHistory,
  registarSemFalhar,
  updateSimulatorOrder,
} from "@/lib/db";
import {
  propor,
  aceitar,
  contratar,
  desistir,
  type Negociacao,
  type Proposta,
} from "@/lib/negociacao";
import { quantoOClientePaga } from "@/lib/taxas-plataforma";
import { enviarBotoesWhatsApp, enviarTextoWhatsApp, telefoneParaWhatsApp } from "@/lib/whatsapp-cloud";
import { avisarDaProposta } from "@/lib/avisar-da-proposta";

/**
 * O WhatsApp como ecrã da negociação — o cérebro.
 *
 * A IDENTIDADE É A POSSE DO NÚMERO. Cada mensagem chega do número de
 * telefone que está no pedido (`contactPhone`) — o mesmo grau de confiança
 * do link por email: quem tem o canal, fala pelo pedido. Um número que não
 * bate com nenhum pedido activo recebe uma explicação e nada mais.
 *
 * O MOTOR NÃO MUDOU. As acções são as mesmas do ecrã do site e do
 * backoffice — propor, aceitar, contratar, desistir, com `lado: "cliente"`.
 * Este ficheiro só traduz: botão "ct:9:12" → contratar a negociação #12 do
 * pedido #9; texto "300" → contraproposta de 300 €; "27/08 14:30" → data
 * marcada. Tudo fica no histórico como "por WhatsApp".
 */

function euros(v: number): string {
  return v.toFixed(2).replace(".", ",") + " €";
}

function propostasDe(json: string | null): Proposta[] {
  if (!json) return [];
  try {
    const l = JSON.parse(json);
    return Array.isArray(l) ? (l as Proposta[]) : [];
  } catch {
    return [];
  }
}

/** Os pedidos activos deste número — comparados pelos últimos 9 dígitos. */
async function pedidosDoTelefone(telefone: string): Promise<number[]> {
  const pool = await getPool();
  if (!pool) return [];
  const digitos = telefoneParaWhatsApp(telefone).slice(-9);
  if (digitos.length < 9) return [];
  const [rows] = (await pool.execute(
    `SELECT id FROM simulatorOrders
      WHERE RIGHT(REGEXP_REPLACE(COALESCE(contactPhone, ''), '[^0-9]', ''), 9) = ?
        AND (status IS NULL OR status NOT IN ('cancelado', 'concluido', 'arquivado'))
      ORDER BY createdAt DESC
      LIMIT 10`,
    [digitos],
  )) as any[];
  return (rows as Array<{ id: number }>).map((r) => Number(r.id));
}

type Alvo = {
  pedidoId: number;
  negociacaoId: number;
  profissionalNome: string;
  estado: Negociacao;
};

async function alvoDe(pedidoId: number, negociacaoId: number): Promise<Alvo | null> {
  const linhas = await negociacoesDoPedido(pedidoId);
  const n = linhas.find((x) => Number(x.id) === negociacaoId);
  if (!n) return null;
  return {
    pedidoId,
    negociacaoId,
    profissionalNome: n.profissionalNome,
    estado: {
      estado: n.estado as Negociacao["estado"],
      valorAcordado: n.valorAcordado != null ? Number(n.valorAcordado) : null,
      propostas: propostasDe(n.propostasJson),
    },
  };
}

async function registarAccao(
  pedidoId: number,
  negociacaoId: number,
  mensagem: string,
): Promise<void> {
  await appendOrderHistory(pedidoId, { type: "created", by: null, message: mensagem });
  await registarSemFalhar({
    acontecimento: "proposta_feita",
    pedidoId,
    negociacaoId,
    autorTipo: "cliente",
    autorNome: "WhatsApp",
    resumo: mensagem,
  });
}

/** O "ecrã" — o estado das negociações dele, reescrito em texto. */
async function ecraDoPedido(pedidoId: number): Promise<string> {
  const pedido = await getSimulatorOrderById(pedidoId);
  const linhas = await negociacoesDoPedido(pedidoId);
  const vivas = linhas.filter((n) => n.estado !== "morta" && n.estado !== "desistida");
  if (vivas.length === 0) {
    return `Pedido #${pedidoId}: ainda à espera de propostas dos profissionais. Avisamos assim que chegarem.`;
  }
  const acordada = vivas.find((n) => n.estado === "acordada");
  if (acordada) {
    const total = quantoOClientePaga(Number(acordada.valorAcordado ?? 0));
    return (
      `Pedido #${pedidoId}: fechado com ${acordada.profissionalNome} por ${euros(Number(acordada.valorAcordado ?? 0))} ` +
      `(total com taxa: ${euros(total)}).` +
      (pedido?.dataAgendada
        ? ""
        : ` Se já tem data pensada, responda por exemplo: 27/08 14:30`)
    );
  }
  const linhasTexto = vivas.map((n) => {
    const ultima = propostasDe(n.propostasJson).at(-1);
    const valor = n.valorAcordado ?? ultima?.valor ?? null;
    return `• ${n.profissionalNome}: ${valor != null ? euros(Number(valor)) : "sem valor ainda"}${
      ultima?.por === "profissional" && ultima.estado === "pendente" ? " (à sua espera)" : ""
    }`;
  });
  return (
    `Pedido #${pedidoId} — propostas em cima da mesa:\n${linhasTexto.join("\n")}\n\n` +
    `Use os botões da proposta para fechar ou recusar, ou responda com um valor (ex.: 300) para contrapropor.`
  );
}

/**
 * Trata UMA mensagem do cliente. Devolve sempre — as respostas seguem por
 * WhatsApp; quem chama só precisa de saber que foi tratada.
 */
export async function tratarMensagemDoCliente(
  telefone: string,
  conteudo: { tipo: "botao"; id: string } | { tipo: "texto"; texto: string },
): Promise<void> {
  const pedidos = await pedidosDoTelefone(telefone);
  if (pedidos.length === 0) {
    await enviarTextoWhatsApp(
      telefone,
      "Olá! Este número não está ligado a nenhum pedido activo na CLYON. " +
        "Para pedir um orçamento: clyon.pt/simulador — ou responda aqui com o que precisa e a equipa regista o pedido.",
    );
    return;
  }

  // ── Botões: a acção e o alvo vêm no id — nada a interpretar ─────────────
  if (conteudo.tipo === "botao") {
    const m = conteudo.id.match(/^(ct|rc):(\d+):(\d+)$/);
    if (!m) return;
    const [, accao, pedidoStr, negStr] = m;
    const pedidoId = Number(pedidoStr);
    const negociacaoId = Number(negStr);
    // O alvo tem de ser DELE: um botão forjado com o pedido de outro número
    // morre aqui.
    if (!pedidos.includes(pedidoId)) return;
    const alvo = await alvoDe(pedidoId, negociacaoId);
    if (!alvo) return;

    const agora = new Date();
    if (accao === "ct") {
      // "Contratar" no WhatsApp quer dizer as duas metades do aperto de mão:
      // aceitar o valor pendente (se o houver) e fechar.
      let estado = alvo.estado;
      const pendenteDoPro = estado.propostas.some(
        (p) => p.estado === "pendente" && p.por === "profissional",
      );
      if (pendenteDoPro) {
        const r = aceitar(estado, "cliente", agora);
        if (!r.ok) {
          await enviarTextoWhatsApp(telefone, `Não deu para fechar: ${r.erro}`);
          return;
        }
        estado = r.negociacao;
      }
      const r2 = contratar(estado, agora);
      if (!r2.ok) {
        await enviarTextoWhatsApp(telefone, `Não deu para fechar: ${r2.erro}`);
        return;
      }
      await gravarNegociacao(negociacaoId, {
        estado: r2.negociacao.estado,
        valorAcordado: r2.negociacao.valorAcordado ?? null,
        propostasJson: JSON.stringify(r2.negociacao.propostas),
      });
      const encerradas = await encerrarOutrasNegociacoes(pedidoId, negociacaoId);
      await registarAccao(
        pedidoId,
        negociacaoId,
        `Cliente contratou ${alvo.profissionalNome} por WhatsApp — negociação #${negociacaoId}.` +
          (encerradas > 0 ? ` ${encerradas} outra(s) encerrada(s).` : ""),
      );
      const valor = r2.negociacao.valorAcordado ?? 0;
      await enviarTextoWhatsApp(
        telefone,
        `Fechado com ${alvo.profissionalNome} por ${euros(valor)} (total com taxa CLYON: ${euros(quantoOClientePaga(valor))}).\n\n` +
          `O profissional recebeu a morada e o seu contacto. Se já tem data pensada, responda por exemplo: 27/08 14:30 — fica logo marcada.`,
      );
      return;
    }

    // rc — recusar esta proposta
    const r = desistir(alvo.estado, "cliente", agora);
    if (!r.ok) {
      await enviarTextoWhatsApp(telefone, `Não deu para recusar: ${r.erro}`);
      return;
    }
    await gravarNegociacao(negociacaoId, {
      estado: r.negociacao.estado,
      valorAcordado: r.negociacao.valorAcordado ?? null,
      propostasJson: JSON.stringify(r.negociacao.propostas),
    });
    await registarAccao(
      pedidoId,
      negociacaoId,
      `Cliente recusou a proposta de ${alvo.profissionalNome} por WhatsApp — negociação #${negociacaoId}.`,
    );
    await enviarTextoWhatsApp(
      telefone,
      `Certo — a proposta de ${alvo.profissionalNome} foi recusada. As outras continuam de pé.`,
    );
    return;
  }

  // ── Texto livre: uma data, um valor, ou um pedido de ponto de situação ──
  const texto = conteudo.texto.trim();

  // Data: dd/mm hh:mm (ano opcional). Só faz sentido com trabalho fechado.
  const data = texto.match(/^(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?\s+(\d{1,2})[:hH](\d{2})?$/);
  if (data) {
    const [, dia, mes, anoStr, hora, minuto] = data;
    const agora = new Date();
    const ano = anoStr ? Number(anoStr.length === 2 ? `20${anoStr}` : anoStr) : agora.getFullYear();
    const d = new Date(ano, Number(mes) - 1, Number(dia), Number(hora), Number(minuto ?? 0));
    // Sem ano e já passou? É do ano que vem — ninguém marca para trás.
    if (!anoStr && d.getTime() < agora.getTime() - 3600_000) d.setFullYear(ano + 1);
    if (Number.isNaN(d.getTime()) || d.getTime() < agora.getTime() - 3600_000) {
      await enviarTextoWhatsApp(telefone, "Essa data já passou — confirme o dia e a hora (ex.: 27/08 14:30).");
      return;
    }
    for (const pedidoId of pedidos) {
      const linhas = await negociacoesDoPedido(pedidoId);
      const acordada = linhas.find((n) => n.estado === "acordada" && n.confirmadoEm == null);
      if (acordada) {
        await updateSimulatorOrder(
          pedidoId,
          { dataAgendada: d } as unknown as Parameters<typeof updateSimulatorOrder>[1],
        );
        await registarAccao(
          pedidoId,
          Number(acordada.id),
          `Cliente marcou ${d.toLocaleString("pt-PT")} por WhatsApp.`,
        );
        await enviarTextoWhatsApp(
          telefone,
          `Marcado: ${d.toLocaleDateString("pt-PT")} às ${d.toLocaleTimeString("pt-PT", { hour: "2-digit", minute: "2-digit" })}, com ${acordada.profissionalNome}. Ele vê a data na agenda dele.`,
        );
        return;
      }
    }
    await enviarTextoWhatsApp(
      telefone,
      "Ainda não há profissional contratado — escolha primeiro uma proposta, e depois mando-lhe marcar a data.",
    );
    return;
  }

  // Valor: contraproposta. Aplica-se à negociação mais recente que a espera.
  const valorTexto = texto.match(/^(?:aceito\s+|proponho\s+|contraproponho\s+)?(\d{1,4})(?:[.,](\d{1,2}))?\s*€?$/i);
  if (valorTexto) {
    const valor = Number(`${valorTexto[1]}.${valorTexto[2] ?? "0"}`);
    for (const pedidoId of pedidos) {
      const linhas = await negociacoesDoPedido(pedidoId);
      const candidatas = linhas
        .filter((n) => n.estado === "aberta" || n.estado === "aguarda_contratacao")
        .sort(
          (a, b) =>
            new Date(String((b as { updatedAt?: unknown }).updatedAt ?? 0)).getTime() -
            new Date(String((a as { updatedAt?: unknown }).updatedAt ?? 0)).getTime(),
        );
      for (const n of candidatas) {
        const estado: Negociacao = {
          estado: n.estado as Negociacao["estado"],
          valorAcordado: n.valorAcordado != null ? Number(n.valorAcordado) : null,
          propostas: propostasDe(n.propostasJson),
        };
        const r = propor(estado, "cliente", valor, new Date());
        if (!r.ok) continue;
        await gravarNegociacao(Number(n.id), {
          estado: r.negociacao.estado,
          valorAcordado: r.negociacao.valorAcordado ?? null,
          propostasJson: JSON.stringify(r.negociacao.propostas),
        });
        await registarAccao(
          pedidoId,
          Number(n.id),
          `Cliente contrapropôs ${euros(valor)} a ${n.profissionalNome} por WhatsApp.`,
        );
        // O profissional é avisado pelo caminho de sempre — email e painel.
        await avisarDaProposta({
          pedidoId,
          negociacaoId: Number(n.id),
          quemPropos: "cliente",
          valor,
        });
        await enviarTextoWhatsApp(
          telefone,
          `Contraproposta de ${euros(valor)} enviada a ${n.profissionalNome}. Aviso-o assim que responder.`,
        );
        return;
      }
    }
    await enviarTextoWhatsApp(
      telefone,
      "Não há nenhuma negociação à espera de valor neste momento. Escrevo-lhe assim que houver novidades.",
    );
    return;
  }

  // Nada reconhecido: reescreve-se o ecrã — o ponto de situação dele.
  await enviarTextoWhatsApp(telefone, await ecraDoPedido(pedidos[0]));
}

/**
 * A proposta de um profissional, entregue no WhatsApp do cliente — com os
 * botões que fecham ou recusam num toque. É o outbound que fazia o Wanderson
 * escrever à mão.
 */
export async function aceitacaoParaOWhatsApp(dados: {
  telefone: string;
  pedidoId: number;
  negociacaoId: number;
  profissionalNome: string;
  valor: number;
}): Promise<boolean> {
  // O profissional aceitou o valor DO CLIENTE — falta só o cliente fechar.
  // Sem este aviso, o "sim" do profissional morria no painel: o cliente de
  // telefone propunha um valor e nunca sabia que tinha sido aceite.
  const total = quantoOClientePaga(dados.valor);
  return enviarBotoesWhatsApp(
    dados.telefone,
    `Boas notícias: ${dados.profissionalNome} aceitou os ${euros(dados.valor)} que propôs para o pedido #${dados.pedidoId}.\n` +
      `Total com a taxa CLYON: ${euros(total)}. Só paga depois de o trabalho estar feito e confirmado.\n\n` +
      `Falta só fechar — é o botão em baixo.`,
    [
      { id: `ct:${dados.pedidoId}:${dados.negociacaoId}`, titulo: `Fechar ${Math.round(dados.valor)} €` },
      { id: `rc:${dados.pedidoId}:${dados.negociacaoId}`, titulo: "Afinal não" },
    ],
  );
}

export async function propostaParaOWhatsApp(dados: {
  telefone: string;
  pedidoId: number;
  negociacaoId: number;
  profissionalNome: string;
  valor: number;
  servico?: string | null;
}): Promise<boolean> {
  const total = quantoOClientePaga(dados.valor);
  return enviarBotoesWhatsApp(
    dados.telefone,
    `${dados.profissionalNome} propõe ${euros(dados.valor)} para o seu pedido #${dados.pedidoId}` +
      `${dados.servico ? ` (${dados.servico})` : ""}.\n` +
      `Total com a taxa CLYON: ${euros(total)}. Só paga depois de o trabalho estar feito e confirmado.\n\n` +
      `Para contrapropor, responda só com o valor (ex.: 300).`,
    [
      { id: `ct:${dados.pedidoId}:${dados.negociacaoId}`, titulo: `Fechar ${Math.round(dados.valor)} €` },
      { id: `rc:${dados.pedidoId}:${dados.negociacaoId}`, titulo: "Recusar" },
    ],
  );
}
