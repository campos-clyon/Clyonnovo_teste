import { registarSemFalhar } from "./db";
import { trabalhoVistoPeloBackoffice } from "./acesso-ao-pagamento";
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
import { dividaDoProfissional, temDividaDoProfissional, type DividaDoProfissional } from "./divida-do-profissional";

/**
 * A REFERÊNCIA COM QUE O PROFISSIONAL PAGA À CLYON O IVA E A COMISSÃO DE UM
 * TRABALHO PAGO EM DINHEIRO — 01-10-2026.
 *
 * "O profissional fica a DEVER à CLYON o IVA + a comissão e paga essa dívida
 *  por REFERÊNCIA MB WAY/Multibanco, gerada quando o trabalho em dinheiro é
 *  confirmado (pelo cliente ou pelo prazo dos 7 dias)." — decisão do dono.
 *
 * Três portas, e a mesma função:
 *
 *   · AUTOMÁTICA, na confirmação — `avisarProfissionalTrabalhoConfirmado`, por
 *     onde passam os quatro caminhos que confirmam (o cliente pelo link, pela
 *     conta, a CLYON no backoffice, e o prazo). Gera uma Multibanco, que vale
 *     dias e não precisa de ninguém ao telemóvel naquele minuto;
 *   · O PROFISSIONAL, na carteira — Multibanco nova se a de antes expirou, ou
 *     MB WAY para o telemóvel dele;
 *   · O BACKOFFICE — o cartão «Gerar referência» do trabalho, que já sabe que
 *     quem paga é o profissional (`quantoSePedeNesteTrabalho`).
 *
 * REUTILIZA A CASA TODA: a linha em `pagamentos` é igual à de um cliente (o
 * webhook dá-a por paga sem saber quem pagou, e `negociacaoPaga` fecha a
 * dívida pelo mesmo índice único), a porta é a do backoffice
 * (`podeCobrarPeloBackoffice` — basta haver chave), e a ida ao euPago é a de
 * sempre. NÃO É `A_PLATAFORMA_COBRA`: esse interruptor fecha a porta ao
 * CLIENTE que paga sozinho pelo link («fica só o backoffice», 21-09-2026); a
 * dívida do profissional nasce de uma decisão do dono de 01-10-2026 que manda
 * gerá-la sozinha na confirmação.
 *
 * Nunca lança: quem chama está a meio de outra coisa (uma confirmação, um
 * email). Devolve o que aconteceu, para o email e o ecrã o poderem dizer.
 *
 * O QUE ACONTECE SE O PROFISSIONAL NÃO PAGAR — «Abater no saldo + bloquear»,
 * decisão do dono de 01-10-2026:
 *
 *   · o que deve fica reservado no disponível dele (só levanta o resto —
 *     `levantavelDe` em `carteira.ts`), e quando a CLYON marca um levantamento
 *     como pago as dívidas que cabem no saldo que ficou são dadas por pagas
 *     com ele, por escrito (`abater-dividas-no-saldo.ts`);
 *   · passados `DIAS_PARA_PAGAR_A_DIVIDA` dias sem pagar, deixa de poder
 *     propor e aceitar trabalhos em dinheiro, e a distribuição deixa de lhos
 *     mandar (`bloqueio-por-divida.ts`).
 *
 * Não há lembretes nem suspensão da conta; os pela plataforma continuam.
 */

export type ResultadoDaDivida =
  | {
      ok: true;
      pagamento: Pagamento;
      divida: DividaDoProfissional;
      /** Já havia uma Multibanco viva para esta dívida, e é essa que vale. */
      reaproveitada: boolean;
    }
  | { ok: false; porque: string; divida?: DividaDoProfissional; jaPaga?: boolean };

export async function gerarReferenciaDaDivida(
  negociacaoId: number,
  opcoes: {
    metodo?: MetodoDePagamento;
    /** Só MB WAY. Sem ele, o telemóvel do profissional. */
    telemovel?: string | null;
    /** Quem pediu, para o registo permanente. */
    autor: { tipo: "sistema" | "profissional" | "clyon"; nome: string };
  },
): Promise<ResultadoDaDivida> {
  try {
    const acesso = await trabalhoVistoPeloBackoffice(negociacaoId);
    if (!acesso.ok) return { ok: false, porque: acesso.erro };
    const t = acesso.trabalho;

    if (!temDividaDoProfissional(t.formaDePagamento, t.modelo)) {
      return { ok: false, porque: "Este trabalho não tem nada a pagar pelo profissional." };
    }
    const divida = dividaDoProfissional(t.acordado, t.taxas);
    /*
     * SÓ DEPOIS DE FEITO. Antes da confirmação o cliente ainda não pagou nada
     * ao profissional — pedir-lhe o IVA de um dinheiro que não recebeu era
     * cobrar adiantado.
     */
    if (!t.libertado) {
      return { ok: false, porque: "O trabalho ainda não foi confirmado.", divida };
    }

    const metodo: MetodoDePagamento = opcoes.metodo ?? "multibanco";
    const recusa = porqueNaoPodeCobrar(metodo, divida.total);
    if (recusa) return { ok: false, porque: recusa, divida };

    const conf = configuracaoDoEupago(process.env);
    if (!conf.ok) return { ok: false, porque: conf.falta, divida };
    const porta = podeCobrarPeloBackoffice(conf.config);
    if (!porta.pode) return { ok: false, porque: porta.porque, divida };

    const jaHa = await pagamentosDaNegociacao(negociacaoId);
    if (jaHa.some((l) => l.estado === "pago")) {
      return { ok: false, porque: "Já está paga.", divida, jaPaga: true };
    }

    /*
     * UMA MULTIBANCO VIVA CHEGA — a mesma regra do backoffice: a que ele já
     * tem continua válida no homebanking, e uma segunda é como se paga duas
     * vezes. O MB WAY é o contrário: pede-se outro e fecha-se o anterior.
     */
    if (metodo === "multibanco") {
      const viva = jaHa.find(
        (l) =>
          l.estado === "pendente" &&
          l.metodo === "multibanco" &&
          l.valor === divida.total &&
          l.referencia != null &&
          (!l.expiraEm || new Date(l.expiraEm).getTime() > Date.now()),
      );
      if (viva) return { ok: true, pagamento: viva, divida, reaproveitada: true };
    } else {
      for (const l of jaHa) {
        if (l.estado === "pendente" && l.metodo === "mbway") {
          await fecharSemPagar(l.id, "cancelado", { motivo: "Pedido outro MB WAY para a dívida." });
        }
      }
    }

    const telemovel =
      metodo === "mbway" ? (opcoes.telemovel ?? "").trim() || t.telefoneDoProfissional : null;
    const agora = Date.now();
    const expiraEm =
      metodo === "mbway"
        ? new Date(agora + MINUTOS_DO_MBWAY * 60_000)
        : new Date(agora + DIAS_DE_PRAZO_DA_REFERENCIA * 86_400_000);

    const pagamentoId = await abrirPagamento({
      negociacaoId,
      pedidoId: t.pedidoId,
      providerId: t.providerId,
      metodo,
      ambiente: conf.config.ambiente,
      valor: divida.total,
      // A factura da venda é ao cliente e é do preço inteiro; esta linha não
      // é uma venda. Fica sem factura.
      comFactura: false,
      telemovel,
      expiraEm,
    });

    const r = await pedirPagamento(conf.config, metodo, {
      pagamentoId,
      valor: divida.total,
      telemovel,
      prazo: metodo === "multibanco" ? expiraEm : null,
    });

    if (!r.ok) {
      await marcarFalhado(pagamentoId, r.recusa.paraNos);
      await registarSemFalhar({
        acontecimento: "pagamento_falhado",
        pedidoId: t.pedidoId,
        negociacaoId,
        providerId: t.providerId,
        autorTipo: opcoes.autor.tipo,
        autorNome: opcoes.autor.nome,
        resumo: `Dívida do profissional — ${NOME_DO_METODO[metodo]} recusado: ${r.recusa.paraNos}`,
        detalhe: { pagamentoId, metodo, valor: divida.total, codigo: r.recusa.codigo },
      });
      return { ok: false, porque: r.recusa.paraOCliente, divida };
    }

    await marcarPedido(pagamentoId, {
      referencia: r.referencia,
      entidade: r.entidade,
      transacaoId: r.trid,
    });

    await registarSemFalhar({
      acontecimento: "pagamento_pedido",
      pedidoId: t.pedidoId,
      negociacaoId,
      providerId: t.providerId,
      autorTipo: opcoes.autor.tipo,
      autorNome: opcoes.autor.nome,
      resumo:
        `${NOME_DO_METODO[metodo]}: gerados ${divida.total.toFixed(2).replace(".", ",")} € de IVA e ` +
        `comissão, a pagar pelo profissional (trabalho pago em dinheiro). Ainda não está pago.`,
      detalhe: {
        pagamentoId,
        metodo,
        valor: divida.total,
        iva: divida.iva,
        comissao: divida.comissao,
        ambiente: conf.config.ambiente,
      },
    });

    const linha = (await pagamentosDaNegociacao(negociacaoId)).find((l) => l.id === pagamentoId);
    if (!linha) return { ok: false, porque: "A referência foi gerada mas não se leu de volta.", divida };
    return { ok: true, pagamento: linha, divida, reaproveitada: false };
  } catch (e) {
    console.error("[cobrar-divida-do-profissional]", e);
    return { ok: false, porque: e instanceof Error ? e.message : String(e) };
  }
}
