import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, requireAdminGeral } from "@/lib/admin-auth-helper";
import { assumirPedidoSeLivre } from "@/lib/assistentes";
import { folhaDaNegociacao, getSimulatorOrderById, gravarHorasDoTrabalho, negociacoesDoPedido } from "@/lib/db";
import { confirmarAsHoras, preencherPelaEquipa, resumoDaLinha } from "@/lib/horas-no-servidor";
import { lerBase } from "@/lib/base-do-preco";

import {
  aDevolverEmPalavras,
  diaDoInicio,
  fimPelasHoras,
  estadoDasHorasParaQuemFez,
  horasConfirmadas,
  horasContestadas,
  horasMarcadas,
  intervaloDasHoras,
  lerQuemConfirmouAsHoras,
  totalDasHoras,
  valorPorHoraDe,
} from "@/lib/horas-do-trabalho";
import { lerMateriaisDaProposta, lerQuantidadesUsadas, materiaisParaOProfissional, materiaisUsados } from "@/lib/materiais-da-proposta";
import { trabalhoVistoPeloBackoffice } from "@/lib/acesso-ao-pagamento";
import { pagamentosDaNegociacao } from "@/lib/pagamentos-na-base";
import { acertoDasHoras } from "@/lib/pagamento-para-o-cliente";
import { diaEmLisboa, instanteDaBase } from "@/lib/hora-de-lisboa";
import { corrigirAFolhaPelaClyon } from "@/lib/folha-no-servidor";
import {
  camposDaFolha,
  contextoDaFolha,
  estadoDaFolha,
  folhaDeJson,
  folhaNoEcra,
  historicoParaVer,
  lerHistoricoDaFolha,
  regraDaFolha,
} from "@/lib/folha-da-mudanca";
import { tarifaCongeladaDeJson } from "@/lib/conta-da-mudanca";
import { marcaDaFolha } from "@/lib/o-que-o-cliente-viu";
import { contextoDaFolhaFinal, folhaFinalParaOEcra, folhaFinalPelaEquipa } from "@/lib/folha-final-no-servidor";
import { valorFinalAoCliente } from "@/lib/valor-final-no-servidor";

export const runtime = "nodejs";

/**
 * AS HORAS DE UM TRABALHO POR HORA, NO BACKOFFICE — 31-10-2026.
 *
 * GET `?pedidoId&negociacaoId`: o resumo (início, fim, horas, total, quem
 * confirmou e quando, o «Não concordo» do cliente) e o acerto do dinheiro — a
 * diferença que o cliente ainda paga, ou o «a devolver ao cliente», que a
 * equipa trata à mão (nunca se devolve sozinho).
 *
 * POST `{ pedidoId, negociacaoId, accao }`, só administradores (muda o valor
 * do trabalho, como o ajuste):
 *   · «confirmar» — confirma as horas como estão, pela CLYON; numa folha da
 *     mudança leva `marcaDaFolha` (a `folha.marca` do GET) e, se o parceiro a
 *     corrigiu entretanto, responde 409 «A folha mudou — veja a nova e confirme.»;
 *   · «corrigir» — a CLYON escreve outras horas (`dia`, `inicio`, `fim`,
 *     `materiais`) e confirma-as no mesmo passo: é assim que se resolve um
 *     «Não concordo» falado com os dois;
 *   · «preencher» (d26, 15-11-2026) — quem fez o trabalho não usa a app e pede
 *     à equipa que preencha a folha: `dia`, `inicio` e `fim` (ou `horas`,
 *     o total), e numa folha da mudança `pessoas`, `km`, `motivoDosKm`,
 *     `pausas` e `materiais`. A MESMA conta da app (`preencherPelaEquipa`),
 *     sem confirmar: o cliente valida como sempre. Fica no histórico «preenchida
 *     pela equipa (<quem>), a pedido do profissional» (`textosDaFolhaPelaEquipa`);
 *   · «validar_telefone» (d26) — o cliente não usa a app e validou a folha por
 *     telefone: confirma-a em nome dele, com quem o registou no histórico;
 *   · «folha_final» (d38 v2, 15-11-2026) — numa mudança, o valor final pela
 *     equipa, antes ou depois de dado por feito: `pessoas`, `horas`,
 *     `precoHora`, a deslocação (`deslocacaoTipo` «km» com `km`/`precoKm`,
 *     ou «euros» com `deslocacaoEuros`), `materiais` [{descricao, valor}] e
 *     `motivo` (obrigatório se o profissional já foi pago). Com
 *     `previsualizar: true` só devolve a conta. Ver folha-final.ts;
 *   · «valor_final_ao_cliente» (d38 v2, commit d) — o «Enviar o valor final ao
 *     cliente»: com `previsualizar: true` a conta e a mensagem; sem ele envia
 *     pelo `canal` («whatsapp», «email», «ambos»), com `oQueMudou` se a equipa o
 *     juntar. Ver valor-final-no-servidor.ts.
 */

/** As frases do histórico da folha preenchida pela equipa (d26): a que a equipa lê e a que o cliente lê. */
function textosDaFolhaPelaEquipa(nome: string): { textoDaEquipa: string; textoAoCliente: string } {
  return {
    textoDaEquipa: `preenchida pela equipa (${nome}), a pedido do profissional`,
    textoAoCliente: `preenchida pela equipa da CLYON (${nome}), a pedido do parceiro`,
  };
}

/** Onde fica escrita a validação por telefone (d26). */
const validadaPorTelefone = (nome: string) => `validada por telefone, registada no backoffice por ${nome}`;

async function oTrabalho(pedidoId: number, negociacaoId: number) {
  if (!Number.isInteger(pedidoId) || pedidoId <= 0 || !Number.isInteger(negociacaoId) || negociacaoId <= 0) return null;
  return (await negociacoesDoPedido(pedidoId)).find((n) => Number(n.id) === negociacaoId) ?? null;
}

export async function GET(req: NextRequest) {
  const { err } = await requireAdmin(req);
  if (err) return err;
  const p = req.nextUrl.searchParams;
  const linha = await oTrabalho(Number(p.get("pedidoId")), Number(p.get("negociacaoId")));
  if (!linha) return NextResponse.json({ error: "Trabalho não encontrado." }, { status: 404 });
  try {
    const resumo = resumoDaLinha(linha as never);
    let acerto: ReturnType<typeof acertoDasHoras> = null;
    const acesso = await trabalhoVistoPeloBackoffice(Number(linha.id));
    if (acesso.ok) acerto = acertoDasHoras(acesso.trabalho, await pagamentosDaNegociacao(Number(linha.id)));
    const m = lerMateriaisDaProposta((linha as { materiaisJson?: string | null }).materiaisJson ?? null);
    return NextResponse.json({
      marcadas: horasMarcadas(linha as never),
      confirmadas: horasConfirmadas(linha as never),
      confirmadasPor: lerQuemConfirmouAsHoras((linha as { horasConfirmadasPor?: unknown }).horasConfirmadasPor),
      contestadas: horasContestadas(linha as never),
      contestacao: (linha as { horasContestacao?: string | null }).horasContestacao ?? null,
      estadoTexto: estadoDasHorasParaQuemFez(linha as never),
      resumo,
      materiaisTexto: materiaisParaOProfissional(m),
      // A folha da mudança (11-11-2026), como o parceiro a vê (com o que recebe), e o histórico.
      folha: (() => {
        const l = linha as { folhaJson?: string | null; folhaHistoricoJson?: string | null; tarifaCongeladaJson?: string | null };
        const fo = folhaDeJson(l.folhaJson ?? null);
        if (!fo) return null;
        const t = tarifaCongeladaDeJson(l.tarifaCongeladaJson ?? null);
        return {
          ...folhaNoEcra(fo, "parceiro", t?.minimoHoras ?? 3),
          estado: estadoDaFolha(linha as never),
          historico: historicoParaVer(lerHistoricoDaFolha(l.folhaHistoricoJson ?? null)),
          // A marca desta folha: o «Confirmar» devolve-a em `marcaDaFolha` (o-que-o-cliente-viu.ts).
          marca: marcaDaFolha(l.folhaJson ?? null),
        };
      })(),
      // Para preencher a folha pela equipa (d26): o que se mostra no formulário e a conta da app.
      preencher: await (async () => {
        const l = linha as unknown as { estado?: string; confirmadoEm?: unknown; chegouEm?: Date | string | null };
        const pode = l.estado === "acordada" && l.confirmadoEm == null && !horasConfirmadas(linha as never);
        const agora = new Date();
        const daFolha = await folhaDaNegociacao(Number(linha.id)).catch(() => null);
        const contexto = daFolha
          ? {
              tarifaCongeladaJson: daFolha.tarifaCongeladaJson,
              pessoasEscolhidas: daFolha.pessoasEscolhidas,
              kmDoPercurso: daFolha.kmPercurso,
              valorPorHoraAcordado: valorPorHoraDe(linha as never),
              diaPorOmissao: diaDoInicio(l.chegouEm ?? null, agora),
            }
          : null;
        const ctx = contexto ? contextoDaFolha(contexto) : null;
        const inicioGravado = instanteDaBase((linha as { horasInicioEm?: Date | string | null }).horasInicioEm ?? null);
        return {
          pode,
          valorPorHora: valorPorHoraDe(linha as never),
          dia: inicioGravado ? diaEmLisboa(inicioGravado) : diaDoInicio(l.chegouEm ?? null, agora),
          inicio: resumo?.inicio ?? "",
          fim: resumo?.fim ?? "",
          folha:
            contexto && ctx
              ? {
                  contexto,
                  campos: camposDaFolha(folhaDeJson((linha as { folhaJson?: string | null }).folhaJson ?? null), ctx),
                  regra: regraDaFolha(ctx.tarifa.minimoHoras),
                }
              : null,
          materiais: m && !m.incluidos ? m.itens.map((i) => ({ id: i.id, nome: i.nome, preco: i.preco, unidade: i.unidade })) : [],
          quantidades: lerQuantidadesUsadas(
            (() => {
              try {
                return JSON.parse(String((linha as { materiaisUsadosJson?: string | null }).materiaisUsadosJson ?? "{}"));
              } catch {
                return {};
              }
            })(),
            m,
          ),
        };
      })(),
      // A folha final pela equipa (d38 v2): o que o formulário precisa para abrir.
      folhaFinal: await contextoDaFolhaFinal(Number(linha.pedidoId), linha as never).then(folhaFinalParaOEcra).catch(() => null),
      acerto: acerto
        ? {
            ...acerto,
            aDevolverTexto: acerto.aDevolver > 0 ? aDevolverEmPalavras(acerto.aDevolver) : null,
          }
        : null,
    });
  } catch (e) {
    console.error("[admin/negociacoes/horas GET]", e);
    return NextResponse.json({ error: "Não foi possível ler as horas." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { err, colab } = await requireAdminGeral(req);
  if (err) return err;
  let corpo: {
    pedidoId?: unknown;
    negociacaoId?: unknown;
    accao?: unknown;
    dia?: unknown;
    inicio?: unknown;
    fim?: unknown;
    materiais?: unknown;
    /** A marca da folha que a equipa tem no ecrã (`folha.marca` do GET). */
    marcaDaFolha?: unknown;
    /** «preencher» (d26): o total de horas, em vez do fim. */
    horas?: unknown;
    pausas?: unknown;
    pessoas?: unknown;
    km?: unknown;
    motivoDosKm?: unknown;
    /** d70: `true` = «O cliente concordou com as pessoas a mais» (obrigatório acima de 3). */
    acordoDasPessoasAMais?: unknown;
    /** «folha_final» (d38 v2). */
    precoHora?: unknown;
    deslocacaoTipo?: unknown;
    precoKm?: unknown;
    deslocacaoEuros?: unknown;
    previsualizar?: unknown;
    motivo?: unknown;
    /** «valor_final_ao_cliente» (d38 v2, commit d). */
    canal?: unknown;
    oQueMudou?: unknown;
  };
  try {
    corpo = (await req.json()) as typeof corpo;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const pedidoId = Number(corpo.pedidoId);
  const negociacaoId = Number(corpo.negociacaoId);
  const linha = await oTrabalho(pedidoId, negociacaoId);
  if (!linha) return NextResponse.json({ error: "Trabalho não encontrado." }, { status: 404 });
  if (corpo.accao !== "confirmar" && corpo.accao !== "corrigir" && corpo.accao !== "preencher" && corpo.accao !== "validar_telefone" && corpo.accao !== "folha_final" && corpo.accao !== "valor_final_ao_cliente") {
    return NextResponse.json({ error: "Acção desconhecida." }, { status: 400 });
  }
  await assumirPedidoSeLivre(pedidoId, colab);
  const porQuem = colab?.nome ?? "a CLYON";
  const papel = colab?.papel === "assistente" ? ("assistente" as const) : ("admin" as const);

  /*
   * O VALOR FINAL AO CLIENTE — d38 v2, commit d. Só administradores (a porta já
   * o exige); nada sai sem `previsualizar` a falso, que é o botão «Enviar».
   */
  if (corpo.accao === "valor_final_ao_cliente") {
    try {
      const r = await valorFinalAoCliente({
        pedidoId,
        negociacaoId,
        previsualizar: corpo.previsualizar === true,
        canal: corpo.canal,
        oQueMudou: corpo.oQueMudou,
        porQuem,
        colabId: colab?.id ?? null,
      });
      return NextResponse.json(r.corpo, { status: r.status });
    } catch (e) {
      console.error("[admin/negociacoes/horas POST valor_final_ao_cliente]", e);
      return NextResponse.json({ error: "Não foi possível enviar o valor final." }, { status: 500 });
    }
  }

  /*
   * A FOLHA FINAL PELA EQUIPA — d38 v2. Só administradores (a porta já o
   * exige): passa a ser o valor final, com histórico (folha-final-no-servidor.ts).
   */
  if (corpo.accao === "folha_final") {
    try {
      const r = await folhaFinalPelaEquipa({
        pedidoId,
        negociacaoId,
        linha: linha as never,
        corpo: {
          pessoas: corpo.pessoas,
          horas: corpo.horas,
          precoHora: corpo.precoHora,
          deslocacaoTipo: corpo.deslocacaoTipo,
          km: corpo.km,
          precoKm: corpo.precoKm,
          deslocacaoEuros: corpo.deslocacaoEuros,
          materiais: corpo.materiais,
          acordoDasPessoasAMais: corpo.acordoDasPessoasAMais,
          previsualizar: corpo.previsualizar,
          motivo: corpo.motivo,
        },
        porQuem,
        papel,
      });
      return NextResponse.json(r.corpo, { status: r.status });
    } catch (e) {
      console.error("[admin/negociacoes/horas POST folha_final]", e);
      return NextResponse.json({ error: "Não foi possível gravar a folha final." }, { status: 500 });
    }
  }

  /*
   * PREENCHER PELA EQUIPA — d26, 15-11-2026. Só administradores (a porta já o
   * exige). Grava a folha como quem fez o trabalho a gravaria, e não confirma.
   */
  if (corpo.accao === "preencher") {
    try {
      const pedido = (await getSimulatorOrderById(pedidoId)) as { baseDoPreco?: unknown; valorFixoClyon?: unknown } | undefined;
      const porHora = lerBase(pedido?.baseDoPreco) === "hora";
      const trabalhoClyon = (linha as { ofertaClyon?: unknown }).ofertaClyon != null || pedido?.valorFixoClyon != null;
      const temFim = typeof corpo.fim === "string" && corpo.fim.trim() !== "";
      const temHoras = corpo.horas != null && String(corpo.horas).trim() !== "";
      const fim = temFim ? corpo.fim : temHoras ? fimPelasHoras(corpo.inicio, corpo.horas) : undefined;
      if (!temFim && temHoras && fim == null) {
        return NextResponse.json({ error: "Indique o início (HH:MM) e o total de horas (por exemplo 4,5)." }, { status: 400 });
      }
      const r = await preencherPelaEquipa({
        linha: linha as never,
        porHora,
        trabalhoClyon,
        pelaEquipa: { nome: porQuem, papel, ...textosDaFolhaPelaEquipa(porQuem) },
        corpo: {
          dia: corpo.dia,
          inicio: corpo.inicio,
          fim: fim ?? undefined,
          pausas: corpo.pausas,
          pessoas: corpo.pessoas,
          km: corpo.km,
          motivoDosKm: corpo.motivoDosKm,
          materiais: corpo.materiais,
          acordoDasPessoasAMais: corpo.acordoDasPessoasAMais,
        },
      });
      return NextResponse.json(r.corpo, { status: r.status });
    } catch (e) {
      console.error("[admin/negociacoes/horas POST preencher]", e);
      return NextResponse.json({ error: "Não foi possível gravar a folha." }, { status: 500 });
    }
  }

  /*
   * VALIDADA PELO CLIENTE POR TELEFONE — d26. O cliente não usa a app: a
   * equipa confirma em nome dele a folha que tem no ecrã (a marca, como no
   * «Confirmar»), e fica no histórico quem o registou.
   */
  if (corpo.accao === "validar_telefone") {
    try {
      const r = await confirmarAsHoras({
        negociacaoId,
        pedidoId,
        providerId: Number(linha.providerId),
        por: "cliente",
        onde: validadaPorTelefone(porQuem),
        autorNome: porQuem,
        linha: linha as never,
        marcaVista: corpo.marcaDaFolha,
      });
      return NextResponse.json(r.corpo, { status: r.status });
    } catch (e) {
      console.error("[admin/negociacoes/horas POST validar_telefone]", e);
      return NextResponse.json({ error: "Não foi possível gravar a validação." }, { status: 500 });
    }
  }

  try {
    let comHoras = linha as Record<string, unknown>;
    // «Confirmar»: a folha que a equipa viu. «Corrigir»: a que ela própria acabou de escrever.
    let marcaVista: unknown = corpo.marcaDaFolha;
    if (corpo.accao === "corrigir") {
      if (horasConfirmadas(linha as never)) {
        return NextResponse.json({ error: "As horas já estão confirmadas." }, { status: 409 });
      }
      // A folha da mudança (11-11-2026): corrige-se pela folha, com a tarifa congelada.
      const pelaFolha = await corrigirAFolhaPelaClyon({
        negociacaoId,
        providerId: Number(linha.providerId),
        linha: linha as never,
        corpo: corpo as never,
        porQuem,
        papel,
      });
      if (pelaFolha && pelaFolha.status !== 200) return NextResponse.json(pelaFolha.corpo, { status: pelaFolha.status });
      if (pelaFolha) {
        marcaVista = pelaFolha.corpo.marca;
        comHoras = { ...comHoras, horasMarcadasEm: new Date(), valorDasHoras: pelaFolha.corpo.valorDasHoras, horasContestadasEm: null, horasContestacao: null };
      } else {
      const inicioGravado = instanteDaBase((linha as { horasInicioEm?: Date | string | null }).horasInicioEm ?? null);
      const dia =
        typeof corpo.dia === "string" && /^\d{4}-\d{2}-\d{2}$/.test(corpo.dia)
          ? corpo.dia
          : diaEmLisboa(inicioGravado ?? instanteDaBase((linha as { chegouEm?: Date | string | null }).chegouEm ?? null) ?? new Date());
      const lido = intervaloDasHoras({ dia, inicio: corpo.inicio, fim: corpo.fim });
      if (!lido.ok) return NextResponse.json({ error: lido.erro }, { status: 400 });
      const valorPorHora = valorPorHoraDe(linha as never);
      if (valorPorHora == null || valorPorHora <= 0) {
        return NextResponse.json({ error: "Este trabalho não tem valor por hora acordado." }, { status: 409 });
      }
      const m = lerMateriaisDaProposta((linha as { materiaisJson?: string | null }).materiaisJson ?? null);
      const quantidades = lerQuantidadesUsadas(corpo.materiais, m);
      const usados = materiaisUsados(m, quantidades);
      const valorDasHoras = totalDasHoras(valorPorHora, lido.intervalo.horasFaturadas, usados.total);
      const materiaisUsadosJson = Object.keys(quantidades).length > 0 ? JSON.stringify(quantidades) : null;
      const gravou = await gravarHorasDoTrabalho(negociacaoId, Number(linha.providerId), {
        inicioEm: lido.intervalo.inicioEm,
        fimEm: lido.intervalo.fimEm,
        minutos: lido.intervalo.minutos,
        horasFaturadas: lido.intervalo.horasFaturadas,
        valorPorHora,
        valorDasHoras,
        materiaisUsadosJson,
      });
      if (!gravou) return NextResponse.json({ error: "As horas já não se podem mudar." }, { status: 409 });
      comHoras = {
        ...comHoras,
        horasInicioEm: lido.intervalo.inicioEm,
        horasFimEm: lido.intervalo.fimEm,
        horasMinutos: lido.intervalo.minutos,
        horasFaturadas: lido.intervalo.horasFaturadas,
        valorPorHora,
        valorDasHoras,
        materiaisUsadosJson,
        horasMarcadasEm: new Date(),
        horasContestadasEm: null,
        horasContestacao: null,
      };
      }
    }
    const r = await confirmarAsHoras({
      negociacaoId,
      pedidoId,
      providerId: Number(linha.providerId),
      por: "clyon",
      onde: corpo.accao === "corrigir" ? `corrigidas no backoffice por ${porQuem}` : `no backoffice por ${porQuem}`,
      autorNome: porQuem,
      linha: comHoras as never,
      marcaVista,
    });
    return NextResponse.json(r.corpo, { status: r.status });
  } catch (e) {
    console.error("[admin/negociacoes/horas POST]", e);
    return NextResponse.json({ error: "Não foi possível gravar as horas." }, { status: 500 });
  }
}
