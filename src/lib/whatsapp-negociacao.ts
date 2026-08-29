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
import { contaDoCliente, regimeDeIva } from "@/lib/taxas-plataforma";
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
export async function pedidosDoTelefone(telefone: string): Promise<number[]> {
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
  /** O regime de quem factura: decide se o total leva IVA por cima. */
  regimeIva: string | null;
  estado: Negociacao;
};

async function alvoDe(pedidoId: number, negociacaoId: number): Promise<Alvo | null> {
  const linhas = await negociacoesDoPedido(pedidoId);
  const n = linhas.find((x) => Number(x.id) === negociacaoId);
  if (!n) return null;
  return {
    pedidoId,
    regimeIva: n.regimeIva ?? null,
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

/**
 * Fechar pelo cliente: as duas metades do aperto de mão — aceitar o valor
 * pendente (se o houver) e contratar. É o mesmo caminho do botão «Fechar» e
 * da palavra SIM: um só corpo, para nunca haver dois comportamentos.
 */
async function fecharPeloCliente(telefone: string, alvo: Alvo): Promise<void> {
  const agora = new Date();
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
  await gravarNegociacao(alvo.negociacaoId, {
    estado: r2.negociacao.estado,
    valorAcordado: r2.negociacao.valorAcordado ?? null,
    propostasJson: JSON.stringify(r2.negociacao.propostas),
  });
  const encerradas = await encerrarOutrasNegociacoes(alvo.pedidoId, alvo.negociacaoId);
  await registarAccao(
    alvo.pedidoId,
    alvo.negociacaoId,
    `Cliente contratou ${alvo.profissionalNome} por WhatsApp — negociação #${alvo.negociacaoId}.` +
      (encerradas > 0 ? ` ${encerradas} outra(s) encerrada(s).` : ""),
  );
  const valor = r2.negociacao.valorAcordado ?? 0;
  // O TOTAL, com o IVA de quem factura ja somado. O valor acordado e a base a
  // partir de 29-08-2026, e mandar-lhe so a base por mensagem era prometer-lhe
  // um numero que ele nao ia pagar.
  const conta = contaDoCliente(valor, regimeDeIva(alvo.regimeIva));
  await enviarTextoWhatsApp(
    telefone,
    `Fechado com ${alvo.profissionalNome} por ${euros(valor)} sem IVA (total a pagar: ${euros(conta.total)}).\n\n` +
      `O profissional recebeu a morada e o seu contacto. Se já tem data pensada, responda por exemplo: 27/08 14:30 — fica logo marcada.`,
  );
}

/** Recusar pelo cliente — o corpo do botão «Recusar» e da palavra NÃO. */
async function recusarPeloCliente(telefone: string, alvo: Alvo): Promise<void> {
  const r = desistir(alvo.estado, "cliente", new Date());
  if (!r.ok) {
    await enviarTextoWhatsApp(telefone, `Não deu para recusar: ${r.erro}`);
    return;
  }
  await gravarNegociacao(alvo.negociacaoId, {
    estado: r.negociacao.estado,
    valorAcordado: r.negociacao.valorAcordado ?? null,
    propostasJson: JSON.stringify(r.negociacao.propostas),
  });
  await registarAccao(
    alvo.pedidoId,
    alvo.negociacaoId,
    `Cliente recusou a proposta de ${alvo.profissionalNome} por WhatsApp — negociação #${alvo.negociacaoId}.`,
  );
  await enviarTextoWhatsApp(
    telefone,
    `Certo — a proposta de ${alvo.profissionalNome} foi recusada. As outras continuam de pé.`,
  );
}

type AlvoComValor = Alvo & { valorNaMesa: number | null };

/**
 * As negociações onde um SIM ou um NÃO fazem sentido AGORA: proposta do
 * profissional pendente, ou aceitação à espera de fecho. Cada uma com o
 * valor em cima da mesa — é por ele que se desambigua quando há várias.
 */
async function alvosAccionaveis(pedidos: number[]): Promise<AlvoComValor[]> {
  const lista: AlvoComValor[] = [];
  for (const pedidoId of pedidos) {
    const linhas = await negociacoesDoPedido(pedidoId);
    for (const n of linhas) {
      const propostas = propostasDe(n.propostasJson);
      const invertidas = [...propostas].reverse();
      const pendenteDoPro = propostas.some(
        (p) => p.estado === "pendente" && p.por === "profissional",
      );
      if (!pendenteDoPro && n.estado !== "aguarda_contratacao") continue;
      const valorNaMesa =
        n.valorAcordado != null
          ? Number(n.valorAcordado)
          : (invertidas.find((p) => p.estado === "pendente" && p.por === "profissional")?.valor ??
            invertidas.find((p) => p.estado === "aceite")?.valor ??
            invertidas[0]?.valor ??
            null);
      lista.push({
        pedidoId,
        negociacaoId: Number(n.id),
        profissionalNome: n.profissionalNome,
        regimeIva: n.regimeIva ?? null,
        estado: {
          estado: n.estado as Negociacao["estado"],
          valorAcordado: n.valorAcordado != null ? Number(n.valorAcordado) : null,
          propostas,
        },
        valorNaMesa,
      });
    }
  }
  return lista;
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
    const total = contaDoCliente(
      Number(acordada.valorAcordado ?? 0),
      regimeDeIva(acordada.regimeIva),
    ).total;
    return (
      `Pedido #${pedidoId}: fechado com ${acordada.profissionalNome} por ${euros(Number(acordada.valorAcordado ?? 0))} sem IVA ` +
      `(total a pagar: ${euros(total)}).` +
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
  // O painel manda primeiro: desligado, bloqueado ou entregue a uma pessoa,
  // o cérebro não diz UMA palavra — nem sequer a de "não o conheço".
  const { podeOWhatsAppFalarCom } = await import("@/lib/db");
  if (!(await podeOWhatsAppFalarCom(telefone))) return;

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

    if (accao === "ct") await fecharPeloCliente(telefone, alvo);
    else await recusarPeloCliente(telefone, alvo);
    return;
  }

  // ── Texto livre: sim/não, uma data, um valor, ou um ponto de situação ───
  const texto = conteudo.texto.trim();

  // SIM e NÃO — o caminho de quem fala pela ponte, onde não há botões. Sem
  // acentos nem pontuação: "Não!" e "nao" têm de ser a mesma palavra.
  const chave = texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[!.,…]+$/, "")
    .trim();
  const simSo = /^(sim|fechar|aceito|aceitar|pode fechar)$/.test(chave);
  const naoSo = /^(nao|recusar|recuso|nao quero)$/.test(chave);
  const simValor = chave.match(/^(?:sim|fechar|aceito|aceitar)\s+(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:€|eur|euros)?$/);
  const naoValor = chave.match(/^(?:nao|recusar|recuso)\s+(\d{1,4}(?:[.,]\d{1,2})?)\s*(?:€|eur|euros)?$/);

  if (simSo || naoSo || simValor || naoValor) {
    const alvos = await alvosAccionaveis(pedidos);
    const eDeFechar = simSo || Boolean(simValor);
    const valorDito = simValor ?? naoValor;
    const valorPedido = valorDito ? Number(valorDito[1].replace(",", ".")) : null;

    const listaDeAlvos = () =>
      alvos
        .map(
          (a) =>
            `• ${a.profissionalNome}: ${a.valorNaMesa != null ? euros(a.valorNaMesa) : "sem valor ainda"}`,
        )
        .join("\n");

    let alvo: AlvoComValor | undefined;
    if (valorPedido != null) {
      alvo = alvos.find(
        (a) => a.valorNaMesa != null && Math.abs(a.valorNaMesa - valorPedido) < 0.005,
      );
      if (!alvo && !eDeFechar) {
        await enviarTextoWhatsApp(
          telefone,
          `Não há nenhuma proposta de ${euros(valorPedido)} em cima da mesa.` +
            (alvos.length > 0 ? `\n${listaDeAlvos()}` : ""),
        );
        return;
      }
      // "aceito 300" sem 300 na mesa segue para baixo e vira contraproposta
      // de 300 — que é o que a frase quer dizer nesse caso.
    } else if (alvos.length === 1) {
      alvo = alvos[0];
    } else if (alvos.length === 0) {
      await enviarTextoWhatsApp(telefone, await ecraDoPedido(pedidos[0]));
      return;
    } else {
      // Várias em cima da mesa: um SIM sozinho fecharia a que ele não queria.
      const exemplo = alvos[0].valorNaMesa != null ? Math.round(alvos[0].valorNaMesa) : 300;
      await enviarTextoWhatsApp(
        telefone,
        `Tem ${alvos.length} propostas em cima da mesa:\n${listaDeAlvos()}\n\n` +
          `Diga qual pelo valor — por exemplo: ${eDeFechar ? "fechar" : "recusar"} ${exemplo}`,
      );
      return;
    }

    if (alvo) {
      if (eDeFechar) await fecharPeloCliente(telefone, alvo);
      else await recusarPeloCliente(telefone, alvo);
      return;
    }
  }

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
  const valorTexto = texto.match(/^(?:aceito\s+|aceitar\s+|proponho\s+|contraproponho\s+|fechar\s+|sim\s+)?(\d{1,4})(?:[.,](\d{1,2}))?\s*€?$/i);
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
/**
 * Uma fotografia do cliente — vai parar às fotos do pedido dele.
 *
 * No Winapp as fotos morriam num aviso "não consegui abrir"; aqui fazem o
 * caminho inteiro: API da Meta → Blob da CLYON → filesJson do pedido, com
 * linha no histórico. Só funciona pela Cloud API (é dela que se descarrega o
 * media) e só para números com pedido activo — uma foto de um desconhecido
 * não se guarda: não é nossa para guardar.
 */
export async function tratarFotoDoCliente(
  telefone: string,
  mediaId: string,
  mime: string | null,
): Promise<void> {
  const { podeOWhatsAppFalarCom } = await import("@/lib/db");
  if (!(await podeOWhatsAppFalarCom(telefone))) return;
  if (!process.env.WHATSAPP_TOKEN) return;

  const pedidos = await pedidosDoTelefone(telefone);
  if (pedidos.length === 0) return;
  const pedidoId = pedidos[0];

  try {
    const auth = { headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}` } };
    const meta = (await (
      await fetch(`https://graph.facebook.com/v21.0/${mediaId}`, auth)
    ).json()) as { url?: string; mime_type?: string };
    if (!meta.url) return;
    const resposta = await fetch(meta.url, auth);
    if (!resposta.ok) return;
    const bytes = Buffer.from(await resposta.arrayBuffer());
    // 10 MB chegam para qualquer fotografia; acima disso é outra coisa.
    if (bytes.length === 0 || bytes.length > 10 * 1024 * 1024) return;

    const tipo = mime ?? meta.mime_type ?? "image/jpeg";
    const extensao = tipo.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
    const { put } = await import("@vercel/blob");
    const { obterTokenDoBlob } = await import("@/lib/blob-token");
    const tokenBlob = obterTokenDoBlob();
    if (!tokenBlob.ok) return;
    const nome = `whatsapp-${Date.now()}.${extensao}`;
    const blob = await put(`simulador/${nome}`, bytes, {
      access: "public",
      contentType: tipo,
      addRandomSuffix: true,
      ...(tokenBlob.modo === "token" ? { token: tokenBlob.token } : { storeId: tokenBlob.storeId }),
    });

    const pedido = await getSimulatorOrderById(pedidoId);
    if (!pedido) return;
    let ficheiros: unknown[] = [];
    try {
      const lidos = JSON.parse(pedido.filesJson ?? "[]");
      if (Array.isArray(lidos)) ficheiros = lidos;
    } catch {
      /* filesJson ilegível: recomeça a lista em vez de perder a foto nova */
    }
    ficheiros.push({ url: blob.url, name: nome, size: bytes.length, type: tipo });
    await updateSimulatorOrder(
      pedidoId,
      { filesJson: JSON.stringify(ficheiros) } as unknown as Parameters<
        typeof updateSimulatorOrder
      >[1],
    );
    await appendOrderHistory(pedidoId, {
      type: "created",
      by: null,
      message: "Cliente enviou uma fotografia por WhatsApp — anexada ao pedido.",
    });
    await enviarTextoWhatsApp(
      telefone,
      `Recebi a fotografia — ficou anexada ao pedido #${pedidoId}.`,
    );
  } catch (e) {
    console.error("[whatsapp] foto falhou", e);
  }
}

export async function aceitacaoParaOWhatsApp(dados: {
  telefone: string;
  pedidoId: number;
  negociacaoId: number;
  profissionalNome: string;
  valor: number;
  /**
   * O regime de IVA de quem factura -- OBRIGATORIO de proposito.
   *
   * Deixa-lo opcional daria "isento" a quem esquecesse de o passar, e uma
   * mensagem a prometer 371 EUR de um trabalho que custa 451,50 EUR. Sendo
   * obrigatorio, o compilador nao deixa ninguem esquecer-se.
   */
  regimeIva: string | null;
}): Promise<boolean> {
  // O profissional aceitou o valor DO CLIENTE — falta só o cliente fechar.
  // Sem este aviso, o "sim" do profissional morria no painel: o cliente de
  // telefone propunha um valor e nunca sabia que tinha sido aceite.
  const conta = contaDoCliente(dados.valor, regimeDeIva(dados.regimeIva));
  return enviarBotoesWhatsApp(
    dados.telefone,
    `Boas notícias: ${dados.profissionalNome} aceitou os ${euros(dados.valor)} que propôs para o pedido #${dados.pedidoId}.\n` +
      `${euros(dados.valor)} é sem IVA. Total a pagar: ${euros(conta.total)}, já com o imposto e a taxa CLYON.\n` +
      `Só paga depois de o trabalho estar feito e confirmado.\n\n` +
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
  /**
   * O regime de IVA de quem factura -- OBRIGATORIO de proposito.
   *
   * Deixa-lo opcional daria "isento" a quem esquecesse de o passar, e uma
   * mensagem a prometer 371 EUR de um trabalho que custa 451,50 EUR. Sendo
   * obrigatorio, o compilador nao deixa ninguem esquecer-se.
   */
  regimeIva: string | null;
}): Promise<boolean> {
  const conta = contaDoCliente(dados.valor, regimeDeIva(dados.regimeIva));
  return enviarBotoesWhatsApp(
    dados.telefone,
    `${dados.profissionalNome} propõe ${euros(dados.valor)} para o seu pedido #${dados.pedidoId}` +
      `${dados.servico ? ` (${dados.servico})` : ""}.\n` +
      `${euros(dados.valor)} é sem IVA. Total a pagar: ${euros(conta.total)}, já com o imposto e a taxa CLYON.\n` +
      `Só paga depois de o trabalho estar feito e confirmado.\n\n` +
      `Para contrapropor, responda só com o valor (ex.: 300).`,
    [
      { id: `ct:${dados.pedidoId}:${dados.negociacaoId}`, titulo: `Fechar ${Math.round(dados.valor)} €` },
      { id: `rc:${dados.pedidoId}:${dados.negociacaoId}`, titulo: "Recusar" },
    ],
  );
}
