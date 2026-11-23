import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AS_TRES_OPCOES,
  comValidade,
  datasDoCiclo,
  diaDaValidade,
  jaFalouHoje,
  lerRespostaAoLembrete,
  linhaDaMesa,
  linhaDaValidade,
  melhorProposta,
  proximoPasso,
  rotuloDoLembrarAgora,
  SE_NAO_TIVERMOS_RESPOSTA,
  textoDoFechoAoCliente,
  textoDoFechoAoParceiro,
  textoDoLembrete,
  textoDoUltimoAviso,
  valorDoLembrete,
  clienteRespondeuNoCiclo,
  aUltimaSaidaE,
  DIAS_ATE_ANONIMIZAR_O_CANCELADO,
  eConfirmacaoDoCancelamento,
  mesmoTelefoneEstrito,
  textoDaConfirmacaoDoCancelamento,
} from "./validade-do-orcamento";
import { traducaoFixa } from "./traducoes-fixas-da-vitoria";
import { FONTES_DO_CANCELAMENTO } from "./cancelar-pelo-lembrete";
import {
  ETIQUETA_DO_FECHO_SEM_RESPOSTA,
  fechadoSemResposta,
  PORQUE_A_NEGOCIACAO_TERMINOU,
  porqueTerminou,
} from "./textos-dos-avisos-ao-profissional";
import { mensagemDaPropostaClyon, precoDaPropostaClyon } from "./proposta-clyon-ao-cliente";
import { ROTINAS } from "./rotinas";
import { avisoSemOTrabalho } from "./textos-dos-avisos-ao-profissional";

/*
 * O ORÇAMENTO TEM VALIDADE — d62 (CEO e dono, 18-11-2026). As datas com dias
 * fixos e em hora de Lisboa (esta máquina não está em Lisboa), a escolha da
 * melhor proposta, as três respostas, a anonimização, o não-repetir e o
 * interruptor desligado por omissão.
 */
const ler = (f: string) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const BASE = ler("src/lib/validade-do-orcamento-na-base.ts");
const VITORIA = ler("src/lib/whatsapp-negociacao.ts");
const MESA = ler("src/components/admin/AdminNegociacoesPanel.tsx");
const CONFIGS = ler("src/components/admin/LegacyAdminClient.tsx");
const ARQUIVAR = ler("src/lib/arquivar-sem-resposta.ts");
const PONTE = ler("src/app/api/whatsapp/ponte/route.ts");
const ROTA_TC = ler("src/app/api/admin/trabalhos-clyon/route.ts");
const CRON = ler("src/app/api/cron/validade-dos-orcamentos/route.ts");
const COMUM = ler("src/lib/cancelar-pelo-lembrete.ts");
const VERCEL = JSON.parse(ler("vercel.json")) as { crons: Array<{ path: string; schedule: string }> };

/** 17-11-2026 (terça), 10h de Lisboa — no Inverno, Lisboa = UTC. */
const ENVIO = new Date("2026-11-17T10:00:00Z");
const em = (iso: string) => new Date(iso);

describe("as datas — D+1, D+3, D+4 às 18h, em Lisboa", () => {
  it("a validade é 3 dias depois do envio, com o dia da semana", () => {
    expect(diaDaValidade(ENVIO)).toBe("2026-11-20");
    expect(linhaDaValidade(ENVIO)).toBe("Esta proposta é válida até sexta-feira, 20/11.");
  });

  it("conta o dia de Lisboa, e não o do relógio de quem corre (Verão: 23h30 UTC já é amanhã)", () => {
    expect(diaDaValidade(em("2026-07-10T23:30:00Z"))).toBe("2026-07-14");
    expect(diaDaValidade(em("2026-11-17T23:30:00Z"))).toBe("2026-11-20");
  });

  it("lembrete no D+1, último aviso no D+3, fecho às 18h do D+4", () => {
    const d = datasDoCiclo({ desde: ENVIO });
    expect(d.diaDoLembrete).toBe("2026-11-18");
    expect(d.diaDoUltimoAviso).toBe("2026-11-20");
    expect(d.fecho.toISOString()).toBe("2026-11-21T18:00:00.000Z");
  });

  it("o fecho às 18h de Lisboa também depois da mudança da hora (Verão: 17h UTC)", () => {
    const d = datasDoCiclo({ desde: em("2026-03-27T22:30:00Z") });
    expect(d.diaDoUltimoAviso).toBe("2026-03-30");
    expect(d.fecho.toISOString()).toBe("2026-03-31T17:00:00.000Z");
  });

  it("um lembrete atrasado empurra o último aviso e o fecho (nunca dois no mesmo dia)", () => {
    const d = datasDoCiclo({ desde: ENVIO, lembrete1Em: em("2026-11-20T11:00:00Z") });
    expect(d.diaDoUltimoAviso).toBe("2026-11-22");
    expect(d.fecho.toISOString()).toBe("2026-11-23T18:00:00.000Z");
  });

  it("o passo de cada dia, só das 9h às 21h", () => {
    const c = { desde: ENVIO };
    expect(proximoPasso(c, em("2026-11-17T15:00:00Z"))).toBeNull();
    expect(proximoPasso(c, em("2026-11-18T08:59:00Z"))).toBeNull();
    expect(proximoPasso(c, em("2026-11-18T09:00:00Z"))).toBe("lembrete1");
    expect(proximoPasso(c, em("2026-11-18T21:00:00Z"))).toBeNull();
    const comLembrete = { desde: ENVIO, lembrete1Em: em("2026-11-18T09:05:00Z") };
    expect(proximoPasso(comLembrete, em("2026-11-19T12:00:00Z"))).toBeNull();
    expect(proximoPasso(comLembrete, em("2026-11-20T09:00:00Z"))).toBe("ultimo_aviso");
    const comAviso = { ...comLembrete, ultimoAvisoEm: em("2026-11-20T09:05:00Z") };
    expect(proximoPasso(comAviso, em("2026-11-21T17:59:00Z"))).toBeNull();
    expect(proximoPasso(comAviso, em("2026-11-21T18:00:00Z"))).toBe("fechar");
  });

  it("sem o último aviso, não se fecha; parado ou fechado, nada", () => {
    expect(proximoPasso({ desde: ENVIO, lembrete1Em: em("2026-11-18T09:05:00Z") }, em("2026-11-25T12:00:00Z"))).toBe("ultimo_aviso");
    expect(proximoPasso({ desde: ENVIO, paradoEm: em("2026-11-18T10:00:00Z") }, em("2026-11-25T12:00:00Z"))).toBeNull();
    expect(proximoPasso({ desde: ENVIO, fechadoEm: em("2026-11-21T18:00:00Z") }, em("2026-11-25T12:00:00Z"))).toBeNull();
  });
});

describe("não repetir", () => {
  it("nunca duas mensagens automáticas ao mesmo cliente no mesmo dia, mesmo com dois pedidos", () => {
    const hoje = em("2026-11-20T15:00:00Z");
    const outroPedido = { desde: ENVIO, lembrete1Em: em("2026-11-20T09:10:00Z") };
    expect(jaFalouHoje([outroPedido, { desde: ENVIO }], hoje)).toBe(true);
    expect(jaFalouHoje([{ desde: ENVIO, lembrete1Em: em("2026-11-19T09:10:00Z") }], hoje)).toBe(false);
  });

  it("o «Lembrar agora» salta a janela, mas não manda o último aviso no dia do lembrete, nem fecha", () => {
    const c = { desde: ENVIO, lembrete1Em: em("2026-11-18T09:05:00Z") };
    expect(proximoPasso({ desde: ENVIO }, em("2026-11-17T22:00:00Z"), { manual: true })).toBe("lembrete1");
    expect(proximoPasso(c, em("2026-11-18T15:00:00Z"), { manual: true })).toBeNull();
    expect(rotuloDoLembrarAgora(c, em("2026-11-18T15:00:00Z"))).toBeNull();
    expect(rotuloDoLembrarAgora(c, em("2026-11-19T22:00:00Z"))).toBe("Lembrar agora (último aviso)");
    const comAviso = { ...c, ultimoAvisoEm: em("2026-11-20T09:00:00Z") };
    expect(proximoPasso(comAviso, em("2026-11-22T12:00:00Z"), { manual: true })).toBeNull();
  });

  it("na base: a fila reserva antes de enviar, e o fecho marca-se uma vez", () => {
    expect(BASE).toContain("WHERE pedidoId = ? AND porEnviar IS NULL AND paradoEm IS NULL AND fechadoEm IS NULL");
    expect(BASE).toContain("UPDATE validadeDosOrcamentos SET porEnviar = NULL, porEnviarDesde = NULL WHERE pedidoId = ? AND porEnviar = ?");
    expect(BASE).toContain('"UPDATE validadeDosOrcamentos SET fechadoEm = NOW(), porEnviar = NULL WHERE pedidoId = ? AND fechadoEm IS NULL"');
    // 20 a 45 s entre WhatsApp, como as outras filas.
    expect(BASE).toContain("intervaloAoAcaso()");
    expect(PONTE).toContain("await passagemDaValidade();");
  });

  it("uma mensagem do cliente depois do início pára a contagem", () => {
    expect(clienteRespondeuNoCiclo(ENVIO, em("2026-11-18T12:00:00Z"))).toBe(true);
    expect(clienteRespondeuNoCiclo(ENVIO, em("2026-11-17T09:00:00Z"))).toBe(false);
    expect(clienteRespondeuNoCiclo(ENVIO, null)).toBe(false);
  });
});

describe("a melhor proposta", () => {
  const p = (id: number, total: number, media: number | null) => ({
    negociacaoId: id,
    parceiro: `Parceiro ${id}`,
    semIva: Math.round((total / 1.23) * 100) / 100,
    total,
    nota: media == null ? null : { media, quantas: 3 },
  });

  it("a mais barata", () => {
    expect(melhorProposta([p(1, 200, 4), p(2, 150, 4), p(3, 180, null)])?.negociacaoId).toBe(2);
  });

  it("até 10 % mais cara e mais bem avaliada, essa", () => {
    expect(melhorProposta([p(1, 100, 3.5), p(2, 110, 4.8), p(3, 108, 4.2)])?.negociacaoId).toBe(2);
  });

  it("mais de 10 % mais cara, não", () => {
    expect(melhorProposta([p(1, 100, 3.5), p(2, 111, 5)])?.negociacaoId).toBe(1);
  });

  it("sem avaliações, a mais barata; sem propostas, nenhuma", () => {
    expect(melhorProposta([p(1, 100, null), p(2, 105, null)])?.negociacaoId).toBe(1);
    expect(melhorProposta([])).toBeNull();
  });
});

describe("os textos", () => {
  const dados = { pedidoId: 701, nome: "maria exemplo", servico: "recolha de monos", semIva: 105, total: 129.15, parceiro: "Recolhas Exemplo" };

  it("o lembrete, com o valor e o IVA ao lado (nunca sozinho), o parceiro e as três opções", () => {
    expect(textoDoLembrete(dados)).toBe(
      "Olá, Maria! O orçamento do seu pedido #701 (recolha de monos) é de 105 € + IVA (129,15 € com IVA), com o parceiro Recolhas Exemplo. " +
        AS_TRES_OPCOES,
    );
    expect(valorDoLembrete(50, 61.5, "hora")).toBe("50 € + IVA (61,50 € com IVA) por hora");
  });

  it("o último aviso diz até quando", () => {
    const t = textoDoUltimoAviso(dados);
    expect(t).toContain(SE_NAO_TIVERMOS_RESPOSTA);
    expect(t).toContain("Responda 1 para avançar, 2 se tiver dúvidas ou quiser outra data, ou 3 se já não precisar.");
  });

  it("o fecho, ao cliente e aos parceiros, palavra por palavra", () => {
    expect(textoDoFechoAoCliente(701)).toBe("Fechámos o pedido #701. Se ainda precisar, responda aqui e reabrimos.");
    expect(textoDoFechoAoParceiro(701)).toBe("Pedido #701 fechado: o cliente não respondeu ao orçamento. Saiu da sua lista de pedidos.");
    expect(avisoSemOTrabalho({ pedidoId: 701, porque: "fechado_sem_resposta" }).body).toBe(textoDoFechoAoParceiro(701));
  });

  it("ao cliente diz-se «parceiro», nunca «profissional»; no máximo um emoji", () => {
    for (const t of [textoDoLembrete(dados), textoDoUltimoAviso(dados), textoDoFechoAoCliente(701)]) {
      expect(t).not.toMatch(/profissional/i);
      expect((t.match(/\p{Extended_Pictographic}/gu) ?? []).length).toBeLessThanOrEqual(1);
    }
  });

  it("a mensagem do orçamento leva a validade, uma vez", () => {
    const uma = comValidade("Olá!\nO orçamento é 100 € + IVA = 123 €.", ENVIO);
    expect(uma.endsWith("Esta proposta é válida até sexta-feira, 20/11.")).toBe(true);
    expect(comValidade(uma, ENVIO)).toBe(uma);
    const preco = precoDaPropostaClyon({ valorFixo: 100, taxa: 0.1, precoAoCliente: null })!;
    const t = { cliente: "Cliente Teste", servico: "recolha_monos", localidade: "Almada", quando: null, preco };
    expect(mensagemDaPropostaClyon({ ...t, comValidade: true }, ENVIO)).toContain("Esta proposta é válida até sexta-feira, 20/11.");
    expect(mensagemDaPropostaClyon(t, ENVIO)).not.toContain("válida até");
    // O «Enviar pela CLYON» dos Trabalhos CLYON e o «Enviar orçamento» das negociações.
    expect(ROTA_TC).toContain("comValidade: true,");
    // d88: a mensagem do orçamento da Mesa, num sítio só (a mesma da Vitória quando envia sozinha).
    expect(MESA).toContain("return textoDoOrcamentoDaMesa(p, new Date(), propostas);");
    expect(ler("src/lib/texto-do-orcamento-da-mesa.ts")).toContain("return comPropostas ? comValidade(texto, agora) : texto;");
  });
});

describe("as três respostas", () => {
  it("«1», «sim», «avançar» avançam", () => {
    for (const t of ["1", "1.", " Sim ", "sim, obrigada", "Avançar", "quero avançar", "aceito", "Opção 1"]) {
      expect(lerRespostaAoLembrete(t), t).toBe("avancar");
    }
  });

  it("«2» e «outra data» vão à equipa", () => {
    for (const t of ["2", "tenho uma dúvida", "Outra data"]) expect(lerRespostaAoLembrete(t), t).toBe("duvidas");
  });

  it("«3», «já não preciso», «cancelar» cancelam", () => {
    for (const t of ["3", "Já não preciso", "cancelar", "pode cancelar, obrigado", "já resolvi"]) {
      expect(lerRespostaAoLembrete(t), t).toBe("cancelar");
    }
  });

  it("o que não é claro não decide nada (passa à equipa)", () => {
    for (const t of ["sim, mas só na sexta", "quanto fica com 2 sofás?", "olá", "12", ""]) {
      expect(lerRespostaAoLembrete(t), t).toBeNull();
    }
  });

  it("a Vitória trata-as antes do aviso da data, pelos caminhos de sempre", () => {
    const i = VITORIA.indexOf("A RESPOSTA AO LEMBRETE DO ORÇAMENTO");
    expect(i).toBeGreaterThan(-1);
    expect(i).toBeLessThan(VITORIA.indexOf("RESPONDEU AO AVISO DA DATA"));
    const corpo = VITORIA.slice(VITORIA.indexOf("async function responderAoLembreteDoOrcamento("));
    // «1» numa negociação: o mesmo fecho do SIM; num valor único, o aceite de sempre.
    expect(corpo).toContain("await fecharPeloCliente(telefone, alvo);");
    expect(corpo).toContain('await tratarOValorUnico(telefone, { tipo: "aceite", pedidoId: c.pedidoId });');
    expect(corpo).toContain("aceitarTrabalhoClyonPeloLembrete(");
    // «2» e o resto: a uma pessoa; «3»: pergunta, com o texto do cliente (d2); o CANCELAR cancela.
    expect(corpo).toContain("await passarAUmaPessoa(");
    expect(corpo).toContain("base.cancelarPeloLembrete(c.pedidoId, telefone, texto)");
    // Num Trabalho CLYON, a escolha é a de sempre (a transacção que encerra as outras ofertas).
    expect(BASE).toContain("await atribuirOfertaClyon(negociacaoId)");
  });
});

describe("a anonimização do «já não preciso» (d2: pela purga, 7 dias depois)", () => {
  const entre = (a: string, b: string) => BASE.slice(BASE.indexOf(a), BASE.indexOf(b, BASE.indexOf(a) + 1));
  it("o CANCELAR cancela, avisa e manda o texto aprovado — e NÃO anonimiza no momento: marca para a purga", () => {
    // d85 (fase 0): a validade chama o caminho comum, e só depois de conferir que é o CANCELAR.
    const daValidade = entre("export async function confirmarCancelamentoPeloLembrete(", "export async function cancelarPeloLembrete(");
    expect(daValidade.indexOf("if (!eConfirmacaoDoCancelamento(texto))")).toBeGreaterThan(-1);
    expect(daValidade.indexOf("cancelarPeloLembreteComum(FONTES_DO_CANCELAMENTO.validade")).toBeGreaterThan(
      daValidade.indexOf("if (!eConfirmacaoDoCancelamento(texto))"),
    );
    expect(daValidade).not.toContain("cancelarPedido(");
    const corpo = COMUM.slice(COMUM.indexOf("export async function cancelarPeloLembreteComum("), COMUM.indexOf("export async function responderAoCancelamento("));
    const cancelar = corpo.indexOf("await cancelarPedido(pedidoId"); // d94: com o motivo para a notificação
    const texto = corpo.indexOf("mensagemDeCancelamento()");
    expect(cancelar).toBeGreaterThan(-1);
    expect(texto).toBeGreaterThan(cancelar);
    expect(corpo).not.toContain("anonimizarPedido");
    expect(corpo).toContain("anonimizarAPartirDe = NOW() + INTERVAL ${DIAS_ATE_ANONIMIZAR_O_CANCELADO} DAY");
    expect(corpo).toContain('gravarMotivoDoFecho(pedidoId, "ja_nao_precisa"');
    expect(corpo.indexOf("if (Number(reserva.affectedRows) !== 1)")).toBeLessThan(cancelar);
    expect(BASE).not.toMatch(/DELETE FROM simulatorOrders/);
    expect(COMUM).not.toMatch(/DELETE FROM/);
  });

  it("o «3» (cancelarPeloLembrete) nunca chama anonimizarPedido nem cancela à primeira", () => {
    const daValidade = entre("export async function cancelarPeloLembrete(", "export async function desfazerAPurgaDoCancelamento(");
    expect(daValidade).toContain("responderAoCancelamento(FONTES_DO_CANCELAMENTO.validade");
    expect(daValidade).not.toContain("cancelarPedido(");
    // d85 (fase 0): o caminho comum — sem a pergunta feita, pergunta; sem o texto, não cancela.
    const corpo = COMUM.slice(COMUM.indexOf("export async function responderAoCancelamento("));
    expect(corpo).not.toContain("anonimizarPedido");
    expect(corpo).not.toContain("cancelarPedido(");
    expect(corpo).toContain("if (!estado.aEspera) return perguntarSeCancela(f, pool, pedidoId, telefone);");
    expect(corpo).toContain('if (textoDoCliente == null) return { ok: false');
    // Com «pergunta», o cancelamento só depois de conferir o CANCELAR (o primeiro é o da «logo», da d71).
    expect(corpo.indexOf("if (!eConfirmacaoDoCancelamento(textoDoCliente))")).toBeLessThan(corpo.lastIndexOf("cancelarPeloLembreteComum("));
    expect(corpo.indexOf('if (f.confirmacao === "logo")')).toBeLessThan(corpo.indexOf("cancelarPeloLembreteComum("));
    expect(FONTES_DO_CANCELAMENTO.validade.confirmacao).toBe("pergunta");
    const pedir = COMUM.slice(COMUM.indexOf("export async function perguntarSeCancela("), COMUM.indexOf("export async function estadoDaPergunta("));
    expect(pedir).not.toContain("cancelarPedido(");
    expect(pedir).toContain("textoDaConfirmacaoDoCancelamento(pedidoId)");
    expect(pedir).toContain("if (Number(marca.affectedRows) !== 1)");
  });

  it("a purga da noite anonimiza os que passaram dos 7 dias, ainda cancelados — com o PURGA_ARMADA, e reaberto sai", () => {
    const corpo = BASE.slice(BASE.indexOf("export async function anonimizarOsCanceladosPeloLembrete("));
    expect(corpo).toContain("v.anonimizarAPartirDe <= NOW()");
    expect(corpo).toContain('String(r.status ?? "") === "cancelado"');
    expect(corpo).toContain("if (!opcoes.aSerio) continue;");
    expect(corpo).toContain("semNome: true");
    const PURGA = ler("src/app/api/cron/purgar-pedidos/route.ts");
    expect(PURGA).toContain("anonimizarOsCanceladosPeloLembrete({ aSerio: armada })");
    expect(ler("src/lib/regras-novas-na-base.ts")).toContain("if (aPedido.semNome) novos.contactName = null;");
    expect(DIAS_ATE_ANONIMIZAR_O_CANCELADO).toBe(7);
  });

  it("o fecho arquiva (nunca apaga), com o motivo «sem resposta»", () => {
    const corpo = BASE.slice(BASE.indexOf("async function fecharPorFaltaDeResposta("));
    // d94: com o motivo que vai na notificação a cada parceiro.
    expect(corpo).toContain('await updateSimulatorOrder(pedidoId, { status: "arquivado" }, { motivo: FECHADO_SEM_RESPOSTA });');
    expect(corpo).toContain('gravarMotivoDoFecho(pedidoId, "sem_resposta"');
    expect(corpo).toContain('porque: "fechado_sem_resposta"');
  });
});

describe("o interruptor — desligado por omissão", () => {
  it("sem linha, ou com a base a falhar, desligado; para ligar escreve-se LIGAR", () => {
    const corpo = BASE.slice(BASE.indexOf("export async function interruptorDaValidade("), BASE.indexOf("export async function mudarInterruptorDaValidade("));
    expect(corpo).toContain("if (!l) return desligado;");
    expect(corpo).toContain("return desligado;");
    expect(ler("src/app/api/admin/interruptor-da-validade/route.ts")).toContain('!== "LIGAR"');
    expect(CONFIGS).toContain("<InterruptorDaValidadeDosOrcamentos />");
  });

  it("desligado, nada sai e nada fecha: a rotina, a passagem, o «Lembrar agora» e as respostas param à porta", () => {
    const rotina = BASE.slice(BASE.indexOf("export async function rotinaDaValidade("));
    expect(rotina.slice(0, 400)).toContain("if (!ligado) return r;");
    const passagem = BASE.slice(BASE.indexOf("export async function passagemDaValidade("));
    expect(passagem.slice(0, 700)).toContain('if (!(await interruptorDaValidade()).ligado) return "desligado";');
    const lembrar = BASE.slice(BASE.indexOf("export async function lembrarAgora("));
    expect(lembrar.slice(0, 300)).toContain("if (!(await interruptorDaValidade()).ligado)");
    const respostas = BASE.slice(BASE.indexOf("export async function ciclosComLembreteDoTelefone("));
    expect(respostas.slice(0, 300)).toContain("if (!(await interruptorDaValidade()).ligado) return [];");
  });

  it("desligada, a Mesa diz «fecharia»; ligada, «fecha»", () => {
    expect(linhaDaMesa({ desde: ENVIO }, false)).toBe(
      "orçamento enviado 17/11 · lembrete 1 a 18/11 · último aviso a 20/11 · fecharia a 21/11 às 18h",
    );
    expect(linhaDaMesa({ desde: ENVIO, lembrete1Em: em("2026-11-18T09:05:00Z") }, true)).toBe(
      "orçamento enviado 17/11 · lembrete 1 enviado a 18/11 · último aviso a 20/11 · fecha a 21/11 às 18h",
    );
    expect(MESA).toContain("<PassoDaValidade");
  });

  it("ligada, a regra das 72 h dos Trabalhos CLYON não arquiva (quem fecha é a validade)", () => {
    expect(ARQUIVAR).toContain("if ((await interruptorDaValidade()).ligado) return r;");
  });

  it("a rotina de hora a hora está nas Rotinas e no vercel.json", () => {
    expect(ROTINAS.find((r) => r.nome === "validade-dos-orcamentos")?.horario).toBe("0 * * * *");
    expect(VERCEL.crons.find((c) => c.path === "/api/cron/validade-dos-orcamentos")?.schedule).toBe("0 * * * *");
    expect(CRON).toContain('carimbarPassagem("validade-dos-orcamentos"');
  });
});

/*
 * d2 (CEO e dono, 18-11-2026) — antes do 1.º fecho de 21/11, com a validade
 * LIGADA: o «3» pede confirmação, só o CANCELAR cancela; nada se anonimiza no
 * momento; a resposta é do pedido certo do telefone certo; o passo reserva-se
 * antes de o WhatsApp sair; e o fecho diz o mesmo no push e no ecrã.
 */
describe("d2 — o «3» pede confirmação e só o CANCELAR cancela", () => {
  it("a pergunta, palavra por palavra, com tradução fixa (en, fr, es)", () => {
    expect(textoDaConfirmacaoDoCancelamento(612)).toBe("Confirma que quer cancelar o pedido #612? Responda CANCELAR.");
    for (const l of ["en", "fr", "es"] as const) {
      const t = traducaoFixa(textoDaConfirmacaoDoCancelamento(612), l);
      expect(t, l).not.toBeNull();
      expect(t).toContain("612");
      expect(t).toContain("CANCELAR");
    }
  });

  it("só o CANCELAR é o CANCELAR — um «3», um «sim» ou um «já não preciso» não", () => {
    for (const s of ["CANCELAR", "cancelar", "Cancelar.", "CANCELAR!", "cancelar o pedido", "cancelar #612", "Cancel", "annuler"]) {
      expect(eConfirmacaoDoCancelamento(s), s).toBe(true);
    }
    for (const s of ["3", "sim", "já não preciso", "não cancelar", "cancelar?", "quero cancelar mas", "1", "", null]) {
      expect(eConfirmacaoDoCancelamento(s as string), String(s)).toBe(false);
    }
  });

  it("um «3» de teste: a Vitória chama cancelarPeloLembrete, que sem pergunta feita só pergunta", () => {
    // A conversa (whatsapp-negociacao.ts) chama cancelarPeloLembrete no «3», com o texto do cliente…
    expect(VITORIA).toContain("base.cancelarPeloLembrete(c.pedidoId, telefone, texto)");
    // …e o «3» nunca chega a cancelarPedido: d85 — o único cancelarPedido do lembrete está no caminho comum, atrás da reserva.
    expect(BASE.split("await cancelarPedido(").length - 1).toBe(0);
    expect(COMUM.split("await cancelarPedido(").length - 1).toBe(1);
    const confirmar = COMUM.slice(COMUM.indexOf("export async function cancelarPeloLembreteComum("));
    expect(confirmar.indexOf("await cancelarPedido(")).toBeGreaterThan(confirmar.indexOf("if (Number(reserva.affectedRows) !== 1)"));
    // A pergunta só vale com cancelarPedidoEm marcado e dentro das 48 h (a validade com o NOW() de sempre).
    expect(COMUM).toContain("AND cancelarPedidoEm IS NOT NULL AND cancelarPedidoEm > ${agora} - INTERVAL ${HORAS_PARA_CONFIRMAR_O_CANCELAMENTO} HOUR");
    expect(FONTES_DO_CANCELAMENTO.validade.agoraSql).toBe("NOW()");
  });

  it("as colunas novas nascem aditivas, e um orçamento reenviado limpa-as", () => {
    expect(BASE).toContain("ALTER TABLE validadeDosOrcamentos ADD COLUMN cancelarPedidoEm DATETIME NULL DEFAULT NULL");
    expect(BASE).toContain("ALTER TABLE validadeDosOrcamentos ADD COLUMN canceladoEm DATETIME NULL DEFAULT NULL");
    expect(BASE).toContain("ALTER TABLE validadeDosOrcamentos ADD COLUMN anonimizarAPartirDe DATETIME NULL DEFAULT NULL");
    expect(BASE).toContain('if ((err as { code?: string })?.code !== "ER_DUP_FIELDNAME") throw err;');
    expect(BASE).toContain("cancelarPedidoEm = NULL, canceladoEm = NULL, anonimizarAPartirDe = NULL");
  });
});

describe("d2 — a resposta é do pedido certo, do telefone certo", () => {
  it("o telefone compara-se inteiro, não pelos últimos 9 dígitos", () => {
    expect(mesmoTelefoneEstrito("912345678", "351912345678")).toBe(true);
    expect(mesmoTelefoneEstrito("+351 912 345 678", "00351912345678")).toBe(true);
    expect(mesmoTelefoneEstrito("447912345678", "351912345678")).toBe(false);
    expect(mesmoTelefoneEstrito("", "")).toBe(false);
  });

  it("o «3» só responde se a última mensagem que lhe saiu é o lembrete DESTE pedido (ou a pergunta do CANCELAR dele)", () => {
    const lembrete = textoDoLembrete({ pedidoId: 612, nome: "Ana", servico: "recolha de monos", semIva: 100, total: 123, parceiro: null });
    expect(aUltimaSaidaE(lembrete, 612)).toBe("lembrete");
    expect(aUltimaSaidaE(textoDoUltimoAviso({ pedidoId: 612, nome: null, servico: "recolha", semIva: 100, total: 123, parceiro: null }), 612)).toBe("lembrete");
    expect(aUltimaSaidaE(textoDaConfirmacaoDoCancelamento(612), 612)).toBe("confirmacao");
    // Outro pedido do mesmo telefone, ou #61 dentro de #612: não.
    expect(aUltimaSaidaE(lembrete, 613)).toBeNull();
    expect(aUltimaSaidaE(lembrete, 61)).toBeNull();
    // Outra pergunta pelo meio (da Vitória ou da equipa): não.
    expect(aUltimaSaidaE("Qual é o andar? Responda 1, 2 ou 3.", 612)).toBeNull();
    expect(aUltimaSaidaE("[à mão] Pedido #612: prefere de manhã? 1 sim, 3 não", 612)).toBeNull();
    expect(aUltimaSaidaE(null, 612)).toBeNull();
  });

  it("ciclosComLembreteDoTelefone filtra pelo número inteiro e pela última saída", () => {
    const corpo = BASE.slice(BASE.indexOf("export async function ciclosComLembreteDoTelefone("));
    expect(corpo).toContain('mesmoTelefoneEstrito(String(r.contactPhone ?? ""), telefone)');
    expect(corpo).toContain("const responde = aUltimaSaidaE(ultima, Number(r.pedidoId));");
    expect(corpo).toContain('if (!(responde === "lembrete" || (aEsperaDeCancelar && responde === "confirmacao"))) continue;');
    expect(BASE).toContain("direccao = 'out'");
  });
});

describe("d2 — o passo reserva-se antes de o WhatsApp sair; nunca duas automáticas no mesmo dia", () => {
  const passo = BASE.slice(BASE.indexOf("async function darOPasso("), BASE.indexOf("async function fecharPorFaltaDeResposta("));
  it("UPDATE … WHERE lembrete1Em IS NULL, affectedRows = 1, e repõe se o envio falhar", () => {
    expect(passo).toContain("WHERE pedidoId = ? AND lembrete1Em IS NULL AND fechadoEm IS NULL AND paradoEm IS NULL");
    expect(passo).toContain("WHERE pedidoId = ? AND ultimoAvisoEm IS NULL AND lembrete1Em IS NOT NULL");
    const reserva = passo.indexOf("if (Number(reserva.affectedRows) !== 1)");
    const envio = passo.indexOf("await enviarAvisoWhatsApp(telefone, texto, { semLinguaErrada: true })");
    const repor = passo.indexOf("SET ${coluna} = NULL WHERE pedidoId = ?");
    expect(reserva).toBeGreaterThan(-1);
    expect(envio).toBeGreaterThan(reserva);
    expect(repor).toBeGreaterThan(envio);
  });

  it("o «Lembrar agora» e a passagem contam os ciclos de todos os pedidos do mesmo telefone", () => {
    expect(passo).toContain("const doTelefone = await ciclosDoTelefone(pool, telefone);");
    expect(passo).toContain("jaFalouHoje(doTelefone.length ? doTelefone : [c], agora)");
    const lembrar = BASE.slice(BASE.indexOf("export async function lembrarAgora("), BASE.indexOf("/* ── A Mesa"));
    expect(lembrar).toContain("jaFalouHoje([c, ...doTelefone.filter((x) => x.pedidoId !== pedidoId)], agora)");
    // Um lembrete de outro pedido do mesmo telefone hoje bloqueia o deste.
    const hoje = em("2026-11-18T10:00:00Z");
    expect(jaFalouHoje([{ desde: ENVIO }, { desde: ENVIO, lembrete1Em: em("2026-11-18T09:00:00Z") }], hoje)).toBe(true);
  });
});

describe("d2 — o fecho pela validade diz o mesmo no push e no ecrã da Pro", () => {
  it("«fechado: o cliente não respondeu ao orçamento», e nunca «cancelado»", () => {
    expect(avisoSemOTrabalho({ pedidoId: 701, porque: "fechado_sem_resposta" }).body).toContain("fechado: o cliente não respondeu ao orçamento");
    expect(PORQUE_A_NEGOCIACAO_TERMINOU.sem_resposta).toBe("Fechado: o cliente não respondeu ao orçamento.");
    expect(ETIQUETA_DO_FECHO_SEM_RESPOSTA).toBe("fechado: o cliente não respondeu ao orçamento");
    expect(porqueTerminou({ estado: "morta", pedidoCancelado: true, pedidoFechadoSemResposta: true })).toBe("sem_resposta");
    expect(porqueTerminou({ estado: "morta", pedidoCancelado: true, pedidoFechadoSemResposta: false })).toBe("cancelado");
    expect(porqueTerminou({ estado: "morta", pedidoFechadoSemResposta: true })).toBe("outro");
  });

  it("a rota diz se fechou pela validade: arquivado, motivo «sem resposta», orçamento enviado", () => {
    expect(fechadoSemResposta({ estadoDoPedido: "arquivado", motivoDoFecho: "sem_resposta", propostaEnviada: true })).toBe(true);
    expect(fechadoSemResposta({ estadoDoPedido: "cancelado", motivoDoFecho: "ja_nao_precisa", propostaEnviada: true })).toBe(false);
    expect(fechadoSemResposta({ estadoDoPedido: "arquivado", motivoDoFecho: "sem_resposta", propostaEnviada: false })).toBe(false);
    expect(fechadoSemResposta({ estadoDoPedido: "arquivado", motivoDoFecho: null, propostaEnviada: true })).toBe(false);
    const rota = ler("src/app/api/profissionais/meus-pedidos/route.ts");
    expect(rota).toContain("pedidoFechadoSemResposta: fechadoSemResposta({");
    expect(ler("src/lib/db.ts")).toContain("o.motivoDoFecho AS motivoDoFechoDoPedido");
    expect(ler("src/app/profissionais/painel/Trabalhos.tsx")).toContain("p.pedidoFechadoSemResposta ? { ...recusa, texto: ETIQUETA_DO_FECHO_SEM_RESPOSTA }");
  });
});
