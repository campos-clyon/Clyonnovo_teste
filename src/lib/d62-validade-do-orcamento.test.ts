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
} from "./validade-do-orcamento";
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
    expect(clienteRespondeuNoCiclo(ENVIO, em("2026-11-18T12:00:00Z"), null)).toBe(true);
    expect(clienteRespondeuNoCiclo(ENVIO, em("2026-11-17T09:00:00Z"), null)).toBe(false);
    expect(clienteRespondeuNoCiclo(ENVIO, null, em("2026-11-19T12:00:00Z"))).toBe(true);
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
    expect(textoDoFechoAoParceiro(701)).toBe("O cliente não respondeu; o pedido #701 foi fechado e saiu do seu feed.");
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
    expect(MESA).toContain("return comPropostas ? comValidade(texto, new Date()) : texto;");
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
    // «2» e o resto: a uma pessoa; «3»: cancelar e anonimizar.
    expect(corpo).toContain("await passarAUmaPessoa(");
    expect(corpo).toContain("base.cancelarPeloLembrete(c.pedidoId, telefone)");
    // Num Trabalho CLYON, a escolha é a de sempre (a transacção que encerra as outras ofertas).
    expect(BASE).toContain("await atribuirOfertaClyon(negociacaoId)");
  });
});

describe("a anonimização do «já não preciso»", () => {
  it("reaproveita a da retenção, sem o nome, depois de cancelar, avisar e mandar o texto aprovado — sem apagar a linha", () => {
    const corpo = BASE.slice(BASE.indexOf("export async function cancelarPeloLembrete("));
    const cancelar = corpo.indexOf("await cancelarPedido(pedidoId)");
    const texto = corpo.indexOf("mensagemDeCancelamento()");
    const anonimizar = corpo.indexOf("await anonimizarPedido(pedidoId, {");
    expect(cancelar).toBeGreaterThan(-1);
    expect(texto).toBeGreaterThan(cancelar);
    expect(anonimizar).toBeGreaterThan(texto);
    expect(corpo).toContain("semNome: true");
    expect(corpo).toContain('gravarMotivoDoFecho(pedidoId, "ja_nao_precisa"');
    expect(BASE).not.toMatch(/DELETE FROM simulatorOrders/);
    expect(ler("src/lib/regras-novas-na-base.ts")).toContain("if (aPedido.semNome) novos.contactName = null;");
  });

  it("o fecho arquiva (nunca apaga), com o motivo «sem resposta»", () => {
    const corpo = BASE.slice(BASE.indexOf("async function fecharPorFaltaDeResposta("));
    expect(corpo).toContain('await updateSimulatorOrder(pedidoId, { status: "arquivado" });');
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
