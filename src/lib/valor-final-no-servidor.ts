import { Resend } from "resend";
import { appendOrderHistory, numeroBloqueadoWhatsApp, registarSemFalhar, retomarNumeroWhatsApp } from "./db";
import { trabalhoVistoPeloBackoffice, type TrabalhoAPagar } from "./acesso-ao-pagamento";
import {
  DIAS_DE_PRAZO_DA_REFERENCIA,
  MINUTOS_DO_MBWAY,
  NOME_DO_METODO,
  configuracaoDoEupago,
  podeCobrarPeloBackoffice,
  porqueNaoPodeCobrar,
  type MetodoDePagamento,
} from "./eupago";
import { pedirPagamento } from "./pedir-ao-eupago";
import {
  abrirPagamento,
  fecharSemPagar,
  marcarFalhado,
  marcarPedido,
  pagamentosDaNegociacao,
  type Pagamento,
} from "./pagamentos-na-base";
import { eDoCliente } from "./parte-do-pagamento";
import { avisarOClienteDoPedido } from "./avisos-ao-cliente";
import { folhasFinaisDe } from "./folha-final-na-base";
import { legivelNoResumo } from "./email-legivel-no-resumo";
import { e } from "./escapar-html";
import { BUSINESS_EMAIL } from "./seo-data";
import {
  assuntoDoValorFinal,
  canaisEmPalavras,
  contaDoValorFinal,
  lerCanal,
  mensagemDoValorFinal,
  oQueMudouDaFolha,
  totalEmPalavras,
  type ContaDoValorFinal,
  type ParaPagarAoParceiro,
} from "./valor-final-ao-cliente";
import { registarEnvioDoValorFinal, enviosDoValorFinal, type EnvioDoValorFinal } from "./valor-final-na-base";
import type { RegimeDoProfissional } from "./pagamento-directo";

/**
 * «ENVIAR O VALOR FINAL AO CLIENTE», NO SERVIDOR — d38 v2, commit d. A rota das
 * horas (`/api/admin/negociacoes/horas`, accao «valor_final_ao_cliente», só
 * administradores) chama isto. A conta e as mensagens são de
 * `valor-final-ao-cliente.ts`; aqui gera-se a referência, envia-se e regista-se.
 *
 * NADA SAI SEM O BOTÃO: `previsualizar` só lê. Ao enviar, por esta ordem —
 * conferir (o cliente está «por receber», o canal tem para onde ir), gerar a
 * Multibanco e o MB WAY novos (modelo antigo e Trabalhos CLYON) e cancelar as
 * referências antigas da mesma parte, enviar, e escrever o histórico (quem,
 * quando, que valor, por onde). O pagamento entra sozinho pelo webhook.
 */

type Resposta = { status: number; corpo: Record<string, unknown> };

/** Os passos com efeito lá fora — à parte, para os testes os simularem. */
export type PortasDoValorFinal = {
  enviarWhatsApp: (telefone: string, texto: string) => Promise<boolean>;
  enviarEmail: (para: string, assunto: string, texto: string) => Promise<boolean>;
  agora: () => Date;
};

async function enviarWhatsAppDeVerdade(telefone: string, texto: string): Promise<boolean> {
  const { enviarTextoManualWhatsApp } = await import("./whatsapp-cloud");
  return enviarTextoManualWhatsApp(telefone, texto);
}

async function enviarEmailDeVerdade(para: string, assunto: string, texto: string): Promise<boolean> {
  const chave = process.env.RESEND_API_KEY_clyonsite ?? process.env.RESEND_API_KEY;
  if (!chave) return false;
  const html = legivelNoResumo(
    `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#0f172a">${texto
      .split("\n\n")
      .map((p) => `<p>${e(p).replace(/\n/g, "<br>")}</p>`)
      .join("")}</div>`,
  );
  const { error } = await new Resend(chave).emails.send({
    from: "CLYON <noreply@clyon.pt>",
    to: para,
    replyTo: BUSINESS_EMAIL,
    subject: assunto,
    html,
    text: texto,
  });
  return !error;
}

const PORTAS_DE_VERDADE: PortasDoValorFinal = {
  enviarWhatsApp: enviarWhatsAppDeVerdade,
  enviarEmail: enviarEmailDeVerdade,
  agora: () => new Date(),
};

/** O regime e os dados para pagar ao parceiro (modelo de 15-11) — o mesmo bloco que o cliente vê no pedido. */
async function doParceiro(t: TrabalhoAPagar): Promise<{ regime: RegimeDoProfissional; parceiro: ParaPagarAoParceiro }> {
  const { oQueOClienteVeDoParceiro } = await import("./pagar-ao-parceiro-para-o-cliente");
  const v = await oQueOClienteVeDoParceiro(t);
  return {
    regime: v.perfilFiscal.regimeParaAConta,
    parceiro: {
      nome: v.parceiro ?? null,
      iban: v.paraPagar?.iban ?? null,
      titular: v.paraPagar?.titular ?? null,
      mbway: v.paraPagar?.mbway ?? null,
      faturas: { doTrabalho: v.faturas.doTrabalho?.url ?? null, daTaxa: v.faturas.daTaxa?.url ?? null },
    },
  };
}

function resumoDoEnvio(c: ContaDoValorFinal): string {
  if (c.modo === "referencia" && c.parte === "diferenca") {
    return `valor final ${totalEmPalavras(c)}, diferença das horas a pagar ${c.aPedir.toFixed(2).replace(".", ",")} €`;
  }
  return `valor final ${totalEmPalavras(c)}`;
}

export async function valorFinalAoCliente(
  a: {
    pedidoId: number;
    negociacaoId: number;
    previsualizar: boolean;
    canal?: unknown;
    /** Juntar o que mudou e porquê (a equipa escolhe). */
    oQueMudou?: unknown;
    porQuem: string;
    colabId?: number | null;
  },
  portas: PortasDoValorFinal = PORTAS_DE_VERDADE,
): Promise<Resposta> {
  const acesso = await trabalhoVistoPeloBackoffice(a.negociacaoId);
  if (!acesso.ok) return { status: acesso.estado, corpo: { error: acesso.erro } };
  const t = acesso.trabalho;
  if (t.pedidoId !== a.pedidoId) return { status: 400, corpo: { error: "O trabalho não é deste pedido." } };

  const linhas = await pagamentosDaNegociacao(a.negociacaoId);
  const doParc = t.novoModelo ? await doParceiro(t) : null;
  const r = contaDoValorFinal(t, linhas, doParc?.regime ?? "normal");
  const historico = await enviosDoValorFinal(a.negociacaoId).catch(() => [] as EnvioDoValorFinal[]);
  const folhas = await folhasFinaisDe(a.negociacaoId).catch(() => []);
  const sugestao = oQueMudouDaFolha(folhas[0]?.entrada ?? null);
  const destinos = { whatsapp: Boolean(t.telefoneDoCliente), email: Boolean(t.emailDoCliente) };
  const base = { destinos, sugestaoDoQueMudou: sugestao, historico };
  if (!r.ok) return { status: 409, corpo: { error: r.porque, ...base } };
  const conta = r.conta;
  const oQueMudou = typeof a.oQueMudou === "string" ? a.oQueMudou.trim().slice(0, 600) : "";
  const agora = portas.agora();
  const comoMensagem = (extra: { multibanco?: { entidade: string | null; referencia: string | null } | null; mbway?: boolean }) =>
    mensagemDoValorFinal(
      { pedidoId: t.pedidoId, cliente: t.nomeDoCliente, conta, oQueMudou, parceiro: doParc?.parceiro ?? null, ...extra },
      agora,
    );

  if (a.previsualizar) {
    return {
      status: 200,
      corpo: { ok: true, conta, mensagem: comoMensagem({ mbway: destinos.whatsapp }), ...base },
    };
  }

  // ── Enviar: só com o botão ──
  const canal = lerCanal(a.canal);
  if (!canal) return { status: 400, corpo: { error: "Escolha por onde vai: WhatsApp, email ou os dois." } };
  const porWhatsApp = canal !== "email";
  const porEmail = canal !== "whatsapp";
  if (porWhatsApp && !t.telefoneDoCliente) return { status: 409, corpo: { error: "O pedido não tem telemóvel." } };
  if (porEmail && !t.emailDoCliente) return { status: 409, corpo: { error: "O pedido não tem email." } };
  if (porWhatsApp && (await numeroBloqueadoWhatsApp(t.telefoneDoCliente!))) {
    return { status: 409, corpo: { error: "Este número está bloqueado. Desbloqueie-o primeiro, no ecrã do WhatsApp." } };
  }

  let multibanco: { entidade: string | null; referencia: string | null } | null = null;
  let mbway = false;
  const geradas: number[] = [];
  if (conta.modo === "referencia") {
    const g = await gerarAsReferencias(t, conta, linhas, a);
    if (!g.ok) return { status: g.status, corpo: { error: g.porque } };
    multibanco = g.multibanco;
    mbway = g.mbway;
    geradas.push(...g.ids);
  }

  const texto = comoMensagem({ multibanco, mbway });
  const saiu: ("whatsapp" | "email")[] = [];
  if (porWhatsApp && (await portas.enviarWhatsApp(t.telefoneDoCliente!, texto).catch(() => false))) {
    saiu.push("whatsapp");
    await retomarNumeroWhatsApp(t.telefoneDoCliente!).catch(() => {});
  }
  if (porEmail && (await portas.enviarEmail(t.emailDoCliente!, assuntoDoValorFinal(t.pedidoId), texto).catch(() => false))) {
    saiu.push("email");
  }

  await registarEnvioDoValorFinal({
    negociacaoId: a.negociacaoId,
    pedidoId: t.pedidoId,
    modo: conta.modo,
    total: conta.total,
    semIva: conta.semIva,
    aPedir: conta.modo === "referencia" ? conta.aPedir : conta.total,
    canalPedido: canal,
    canaisQueSairam: saiu,
    pagamentoIds: geradas,
    porQuem: a.porQuem,
    enviadoEm: agora,
  }).catch((err) => console.error("[valor final] o histórico não ficou:", err));

  const resumo =
    saiu.length > 0
      ? `Valor final enviado ao cliente por ${canaisEmPalavras(saiu)}: ${resumoDoEnvio(conta)}` +
        (conta.modo === "referencia" ? `, com Multibanco${mbway ? " e MB WAY" : ""} novos` : ", com os dados para pagar ao parceiro e as duas faturas") +
        ` — por ${a.porQuem}.`
      : `Valor final por enviar ao cliente (não saiu por ${canaisEmPalavras(porWhatsApp && porEmail ? ["whatsapp", "email"] : porWhatsApp ? ["whatsapp"] : ["email"])}): ${resumoDoEnvio(conta)} — por ${a.porQuem}.`;
  await appendOrderHistory(t.pedidoId, { type: "note", by: null, message: resumo }).catch(() => {});

  if (saiu.length === 0) {
    return {
      status: 400,
      corpo: {
        error:
          "Não saiu. Ou não há canal configurado, ou a janela de 24 horas do WhatsApp já fechou — copie a mensagem e envie-a à mão." +
          (geradas.length > 0 ? " As referências novas ficaram geradas." : ""),
        texto,
      },
    };
  }
  return { status: 200, corpo: { ok: true, feito: resumo, saiu } };
}

/**
 * A MULTIBANCO E O MB WAY NOVOS — pela via do «Gerar referência» (`abrirPagamento`,
 * `pedirPagamento`, `marcarPedido`). As pendentes antigas da mesma parte ficam
 * canceladas: o ecrã do cliente deixa de as oferecer, e uma que ele pague na
 * mesma fica fora de vigor no webhook (a mais recente é a que vale).
 */
async function gerarAsReferencias(
  t: TrabalhoAPagar,
  conta: Extract<ContaDoValorFinal, { modo: "referencia" }>,
  linhas: Pagamento[],
  a: { porQuem: string; colabId?: number | null },
): Promise<
  | { ok: true; multibanco: { entidade: string | null; referencia: string | null }; mbway: boolean; ids: number[] }
  | { ok: false; status: number; porque: string }
> {
  const conf = configuracaoDoEupago(process.env);
  if (!conf.ok) return { ok: false, status: 503, porque: conf.falta };
  const porta = podeCobrarPeloBackoffice(conf.config);
  if (!porta.pode) return { ok: false, status: 503, porque: porta.porque };
  const recusa = porqueNaoPodeCobrar("multibanco", conta.aPedir);
  if (recusa) return { ok: false, status: 400, porque: recusa };

  for (const l of linhas.filter(eDoCliente)) {
    if (l.estado === "pendente" && l.parte === conta.parte) {
      await fecharSemPagar(l.id, "cancelado", { motivo: "Substituída pelo valor final enviado ao cliente." });
    }
  }

  const ids: number[] = [];
  const uma = async (metodo: MetodoDePagamento, telemovel: string | null) => {
    const expiraEm =
      metodo === "mbway"
        ? new Date(Date.now() + MINUTOS_DO_MBWAY * 60_000)
        : new Date(Date.now() + DIAS_DE_PRAZO_DA_REFERENCIA * 86_400_000);
    const pagamentoId = await abrirPagamento({
      negociacaoId: t.negociacaoId,
      pedidoId: t.pedidoId,
      providerId: t.providerId,
      metodo,
      ambiente: conf.config.ambiente,
      valor: conta.aPedir,
      comFactura: conta.comFactura,
      telemovel,
      expiraEm,
      geradoPor: a.colabId ?? null,
      parte: conta.parte,
    });
    const r = await pedirPagamento(conf.config, metodo, {
      pagamentoId,
      valor: conta.aPedir,
      telemovel,
      prazo: metodo === "multibanco" ? expiraEm : null,
    });
    if (!r.ok) {
      await marcarFalhado(pagamentoId, r.recusa.paraNos);
      await registarSemFalhar({
        acontecimento: "pagamento_falhado",
        pedidoId: t.pedidoId,
        negociacaoId: t.negociacaoId,
        providerId: t.providerId,
        autorTipo: "clyon",
        autorNome: a.porQuem,
        resumo: `Valor final — ${NOME_DO_METODO[metodo]} recusado: ${r.recusa.paraNos}`,
        detalhe: { pagamentoId, metodo, valor: conta.aPedir, codigo: r.recusa.codigo },
      });
      return { ok: false as const, porque: r.recusa.paraNos };
    }
    await marcarPedido(pagamentoId, { referencia: r.referencia, entidade: r.entidade, transacaoId: r.trid });
    ids.push(pagamentoId);
    await registarSemFalhar({
      acontecimento: "pagamento_pedido",
      pedidoId: t.pedidoId,
      negociacaoId: t.negociacaoId,
      providerId: t.providerId,
      autorTipo: "clyon",
      autorNome: a.porQuem,
      resumo: `Valor final — ${NOME_DO_METODO[metodo]}: ${conta.aPedir.toFixed(2).replace(".", ",")} € pedidos ao cliente. Ainda não está pago.`,
      detalhe: { pagamentoId, metodo, valor: conta.aPedir, parte: conta.parte, ambiente: conf.config.ambiente },
    });
    return { ok: true as const, entidade: r.entidade ?? null, referencia: r.referencia ?? null };
  };

  const mb = await uma("multibanco", null);
  if (!mb.ok) return { ok: false, status: 502, porque: mb.porque };
  // O MB WAY vai ao telemóvel do pedido; se falhar, a mensagem segue só com a Multibanco.
  let mbway = false;
  if (t.telefoneDoCliente && !porqueNaoPodeCobrar("mbway", conta.aPedir)) {
    const w = await uma("mbway", t.telefoneDoCliente).catch(() => ({ ok: false as const, porque: "" }));
    mbway = w.ok;
  }
  await avisarOClienteDoPedido(t.pedidoId, "referencia", { negociacaoId: t.negociacaoId }).catch(() => {});
  return { ok: true, multibanco: { entidade: mb.entidade, referencia: mb.referencia }, mbway, ids };
}
