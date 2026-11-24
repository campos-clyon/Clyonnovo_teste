import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pedidosMostrados, pedidosSemBloco, SEM_BLOCO_TITULO } from "./mesa-sem-bloco";
import {
  ESTADO_DE_VOLTA_DO_PRECISA_INFO_SQL,
  SAIU_DO_PRECISA_INFO,
  eRespostaDeParceiro,
} from "./precisa-info-ao-avancar";
import { estadoDeVoltaDoPrecisaInfo } from "./resposta-ao-que-falta";

/**
 * d110 (24-11-2026) — o #658: em «precisa info» com dez negociações abertas e o
 * orçamento no cliente, e a Mesa a dizer «1 pedido em toda a mesa» com todos os
 * blocos a 0.
 *
 * (a) nenhum pedido contado fica sem bloco: os blocos mais a linha «Sem bloco
 *     — ver» mostram tudo o que se contou, e o «Geral» conta-os;
 * (b) o «precisa info» com negociações abertas cai num bloco (a Mesa não olha
 *     para o estado, só para as negociações) e, a procurar, não fica escondido
 *     num bloco fechado;
 * (c) enviar aos parceiros, a primeira resposta de um parceiro e o orçamento
 *     ao cliente tiram o pedido de «precisa info».
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
/** Sem os comentários de linha e de bloco, para as frases das notas não contarem. */
const semComentarios = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");
const PAINEL = ler("src/components/admin/AdminNegociacoesPanel.tsx");
const DB = ler("src/lib/db.ts");
const DISTRIBUIR = ler("src/lib/distribuir-pedido.ts");

/** O corpo de uma função, do nome até à próxima função de topo. */
function corpo(fonte: string, inicio: RegExp): string {
  const i = fonte.search(inicio);
  expect(i).toBeGreaterThan(-1);
  const resto = fonte.slice(i + 1);
  const fim = resto.search(/\r?\n(export )?(async )?function /);
  return fim > -1 ? resto.slice(0, fim) : resto;
}

describe("(a) a Mesa nunca esconde um pedido", () => {
  it("os blocos e a linha «Sem bloco» somam o que se contou, sem repetidos", () => {
    const casos: Array<{ contados: number[]; porBloco: Record<string, number[]> }> = [
      { contados: [658], porBloco: { n1: [], n2: [], aguardaCliente: [] } },
      { contados: [658, 657, 650], porBloco: { n1: [657], n2: [650] } },
      { contados: [1, 2, 3, 3], porBloco: { porEnviar: [1, 2, 3] } },
      { contados: [], porBloco: { n2: [] } },
    ];
    for (const { contados, porBloco } of casos) {
      const fora = pedidosSemBloco(contados, porBloco);
      const nosBlocos = new Set(Object.values(porBloco).flat());
      for (const id of new Set(contados)) expect(nosBlocos.has(id) || fora.includes(id)).toBe(true);
      expect(pedidosMostrados(contados, porBloco)).toBe(new Set([...contados, ...nosBlocos]).size);
    }
    expect(pedidosSemBloco([658, 659, 600], { n2: [659] })).toEqual([658, 600]);
  });

  it("o painel compara o que conta com as mesmas listas que os blocos desenham", () => {
    const codigo = semComentarios(PAINEL);
    expect(codigo).toMatch(/const semBloco =\s+mostrar !== "tudo"\s+\? \[\]\s+: pedidosSemBloco\(/);
    const rede = codigo.slice(codigo.indexOf("const semBloco ="), codigo.indexOf("const semBloco =") + 2500);
    // O que se conta: o que a busca deixou passar nas três listas da Mesa.
    expect(rede).toContain("idsDe(pedidosNaMesa.filter((p) => aProcurar || !pedidoArrumado(p.status)))");
    expect(rede).toContain("...idsDe(porPromoverNaMesa)");
    expect(rede).toContain("...clyonNaMesa");
    // O que se desenha: as listas dos blocos, todas.
    for (const chave of ["porEnviar", "porConfirmar", "n1", "aguardaCliente", "n2", "n3", "concluidos", "cancelados"]) {
      expect(rede).toContain(`${chave}: `);
    }
    expect(rede).toContain("...idsDe(outrosSemPropostas)");
    expect(rede).toContain("porNivel.n2");
  });

  it("a linha «Sem bloco — ver» desenha-se, abre o pedido, e entra no «Geral»", () => {
    expect(SEM_BLOCO_TITULO).toBe("Sem bloco — ver");
    const codigo = semComentarios(PAINEL);
    expect(codigo).toContain("{semBloco.length > 0 && (");
    expect(codigo).toContain("{SEM_BLOCO_TITULO}");
    expect(codigo).toContain("if (p) return cartaoDoPedido(p);");
    expect(codigo).toContain("onClick={() => setAEditar(id)}");
    expect(codigo).toContain("soma + quantosNoBloco(b.chave), 0) + semBloco.length}");
  });
});

describe("(b) o «precisa info» com negociações abertas cai num bloco", () => {
  it("o nível de um pedido com negociações vem só das negociações, e há sempre um", () => {
    const i = PAINEL.indexOf("function nivelDe(p: Pedido)");
    const j = PAINEL.indexOf("const porNivel:", i);
    expect(i).toBeGreaterThan(-1);
    expect(j).toBeGreaterThan(i);
    const nivel = PAINEL.slice(i, j);
    expect(nivel).not.toMatch(/status/);
    // A última linha não tem condição: um pedido em negociação nunca fica sem nível.
    expect(semComentarios(nivel)).toMatch(/return "n2";\s*\}\s*$/);
    // Fora dos blocos vivos, só os arrumados (pelo estado) e os concluídos (pelo trabalho).
    expect(PAINEL).toContain("(p) => !pedidoArrumado(p.status) && !pedidoConcluido(p),");
    expect(semComentarios(PAINEL)).not.toContain("precisa_info");
  });

  it("a procurar, o «Precisa de si» só com os em seguimento abre — contava 0 e fechava-se", () => {
    expect(PAINEL).toContain(
      '? quantosNoBloco(b.chave) === 0 && !(b.chave === "n1" && emSeguimentoNoN1.length > 0)',
    );
    expect(PAINEL).toContain("+ {emSeguimentoNoN1.length} em seguimento");
  });
});

describe("(c) o pedido que avançou sai de «precisa info»", () => {
  it("volta ao estado de um pedido em negociação — a regra do d86", () => {
    // O SQL diz o mesmo que `estadoDeVoltaDoPrecisaInfo`, para os dois casos.
    expect(estadoDeVoltaDoPrecisaInfo(7)).toBe("atribuido");
    expect(estadoDeVoltaDoPrecisaInfo(null)).toBe("sem_assistente");
    expect(ESTADO_DE_VOLTA_DO_PRECISA_INFO_SQL).toBe(
      "CASE WHEN COALESCE(assignedToId, 0) > 0 THEN 'atribuido' ELSE 'sem_assistente' END",
    );
    const sair = corpo(DB, /export async function sairDoPrecisaInfo\(/);
    expect(sair).toContain("SET status = ${ESTADO_DE_VOLTA_DO_PRECISA_INFO_SQL}");
    expect(sair).toContain("WHERE id = ? AND status = 'precisa_info'");
    // Uma linha no histórico, só quando saiu mesmo.
    expect(sair).toMatch(/if \(saiu\) \{\s*await appendOrderHistory\(pedidoId, \{ type: "note", by: null, message: SAIU_DO_PRECISA_INFO\[porque\] \}\)/);
    for (const texto of Object.values(SAIU_DO_PRECISA_INFO)) expect(texto).toMatch(/^Saiu de «precisa info»: /);
  });

  it("enviar, redistribuir e recomeçar: `distribuirPedido`, quando chegou a alguém", () => {
    const d = semComentarios(DISTRIBUIR);
    expect(d).toMatch(/if \(receberam \+ jaTinham > 0\) \{\s*try \{\s*await sairDoPrecisaInfo\(pedido\.id, "enviado"\);/);
    // Os três caminhos passam por ela.
    expect(ler("src/lib/enviar-aos-profissionais.ts")).toContain("await distribuirPedido(");
    expect(ler("src/lib/recomecar-do-zero.ts")).toContain("await distribuirPedido(");
    expect(ler("src/app/api/admin/negociacoes/redistribuir/route.ts")).toContain("await distribuirPedido(");
  });

  it("a primeira resposta de um parceiro: `gravarNegociacao`, por todos os caminhos", () => {
    const g = corpo(DB, /export async function gravarNegociacao\(/);
    expect(g).toContain('if (r.ok && eRespostaDeParceiro(dados)) await sairDoPrecisaInfoPelaNegociacao(id, "proposta")');
    expect(eRespostaDeParceiro({ estado: "aberta", propostasJson: JSON.stringify([{ por: "profissional", valor: 120 }]) })).toBe(true);
    expect(eRespostaDeParceiro({ estado: "aguarda_contratacao", propostasJson: "[]" })).toBe(true);
    expect(eRespostaDeParceiro({ estado: "aberta", propostasJson: JSON.stringify([{ por: "cliente", valor: 90 }]) })).toBe(false);
    expect(eRespostaDeParceiro({ estado: "aberta", propostasJson: "[]" })).toBe(false);
    expect(eRespostaDeParceiro({ estado: "aberta", propostasJson: "não é json" })).toBe(false);
  });

  it("o orçamento ao cliente: `marcarOrcamentoEnviado` e `marcarPropostaEnviada`", () => {
    for (const nome of ["marcarOrcamentoEnviado", "marcarPropostaEnviada"]) {
      const f = corpo(DB, new RegExp(`export async function ${nome}\\(`));
      expect(f).toContain('await sairDoPrecisaInfo(pedidoId, "orcamento")');
    }
  });
});
