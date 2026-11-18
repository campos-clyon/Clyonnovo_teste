import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FILTRO_DA_ORIGEM_VAZIO,
  conferirRegistoAMao,
  contarSemComprovativo,
  origemDoPagamento,
  passaNoFiltroDaOrigem,
  semComprovativo,
  type RegistoDoDinheiro,
} from "./origem-do-pagamento";
import { contasGuardadas, lerContasDeDestino, pareceUmNumeroDeConta, rotuloDaConta, type ContaDeDestino } from "./contas-de-destino";
import { conferirComprovativo, TAMANHO_MAXIMO_DO_COMPROVATIVO } from "./comprovativo-do-pagamento";
import { assistenteComSeccoesPodeChamar, assistentePodeChamar } from "./papel-do-painel";

/**
 * D66 (CEO e dono, 18-11-2026) — rastrear cada pagamento: de onde veio e a
 * prova. Valores e contas de exemplo, nunca reais (o repositório é público).
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
/** Sem comentários de linha nem de bloco — o que conta é o código. */
const semComentarios = (s: string) => s.replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, "").replace(/^\s*\/\/.*$/gm, "");

const CONTAS: ContaDeDestino[] = [
  { id: "conta-a", nome: "Conta A", ultimos4: "0001" },
  { id: "conta-b", nome: "Conta B", ultimos4: null },
];

describe("a origem do euPago é automática", () => {
  it("MB WAY: o id do euPago, sem comprovativo", () => {
    const o = origemDoPagamento({ metodo: "mbway", trid: "9990001" });
    expect(o.chave).toBe("eupago_mbway");
    expect(o.automatica).toBe(true);
    expect(o.precisaDeComprovativo).toBe(false);
    expect(o.detalhe).toContain("euPago 9990001");
  });

  it("Multibanco: entidade, referência e o id da criação quando o trid ainda não veio", () => {
    const o = origemDoPagamento({ metodo: "multibanco", entidade: "12345", referencia: "000 111 222", transacaoId: "T-1" });
    expect(o.chave).toBe("eupago_multibanco");
    expect(o.detalhe).toBe("Ent. 12345 · Ref. 000 111 222 · euPago T-1");
    expect(semComprovativo({ origem: o, comprovativos: [] })).toBe(false);
  });

  it("as chaves internas das linhas à parte não passam por id do euPago", () => {
    const o = origemDoPagamento({ metodo: "multibanco", trid: "abatimento-mao-7" });
    expect(o.detalhe ?? "").not.toContain("abatimento");
  });

  it("à mão: transferência com a conta; abatimento e acerto não pedem prova", () => {
    const t = origemDoPagamento({ metodo: "pro_transferencia", contaDeDestino: "Conta A ·· 0001" });
    expect(t.chave).toBe("transferencia");
    expect(t.detalhe).toBe("Entrou em Conta A ·· 0001");
    expect(t.precisaDeComprovativo).toBe(true);
    expect(origemDoPagamento({ metodo: "pro_mbway" }).chave).toBe("mbway_directo");
    expect(origemDoPagamento({ metodo: "ao_profissional" }).chave).toBe("pago_ao_profissional");
    expect(origemDoPagamento({ metodo: "abatimento" }).precisaDeComprovativo).toBe(false);
    expect(origemDoPagamento({ metodo: "quitacao" }).chave).toBe("acerto");
  });
});

describe("a transferência exige a conta e o comprovativo", () => {
  const base = { contas: CONTAS, comprovativoObrigatorio: true };
  it("sem conta não grava", () => {
    const r = conferirRegistoAMao({ ...base, metodo: "transferencia", contaId: "", temComprovativo: true });
    expect(r.ok).toBe(false);
  });
  it("uma conta fora da lista não grava", () => {
    expect(conferirRegistoAMao({ ...base, metodo: "transferencia", contaId: "outra", temComprovativo: true }).ok).toBe(false);
  });
  it("sem comprovativo não grava", () => {
    const r = conferirRegistoAMao({ ...base, metodo: "transferencia", contaId: "conta-a", temComprovativo: false });
    expect(r.ok).toBe(false);
  });
  it("com as duas, grava o rótulo do momento (nome e últimos 4)", () => {
    const r = conferirRegistoAMao({ ...base, metodo: "transferencia", contaId: "conta-a", temComprovativo: true });
    expect(r).toEqual({ ok: true, contaDeDestino: "Conta A ·· 0001" });
  });
  it("numerário: sem comprovativo não grava; com ele, sem conta", () => {
    expect(conferirRegistoAMao({ ...base, metodo: "numerario", contaId: null, temComprovativo: false }).ok).toBe(false);
    expect(conferirRegistoAMao({ ...base, metodo: "numerario", contaId: null, temComprovativo: true })).toEqual({
      ok: true,
      contaDeDestino: null,
    });
  });
  it("pago ao profissional em mão grava sem ficheiro (junta-se depois)", () => {
    expect(conferirRegistoAMao({ ...base, metodo: "ao_profissional", contaId: null, temComprovativo: false }).ok).toBe(true);
  });
  it("nas partes da cobrança: a conta continua obrigatória, o ficheiro não", () => {
    const parte = { contas: CONTAS, comprovativoObrigatorio: false };
    expect(conferirRegistoAMao({ ...parte, metodo: "pro_transferencia", contaId: "", temComprovativo: false }).ok).toBe(false);
    expect(conferirRegistoAMao({ ...parte, metodo: "pro_transferencia", contaId: "conta-b", temComprovativo: false })).toEqual({
      ok: true,
      contaDeDestino: "Conta B",
    });
  });

  it("a rota do «Já recebemos» confere antes de registar, e com o comprovativo obrigatório", () => {
    const rota = semComentarios(ler("src/app/api/admin/pagamentos/recebido/route.ts"));
    const confere = rota.indexOf("conferirRegistoAMao(");
    const regista = rota.indexOf("registarRecebimentoAMao(");
    expect(confere).toBeGreaterThan(0);
    expect(confere).toBeLessThan(regista);
    expect(rota).toContain("comprovativoObrigatorio: true");
    // O ficheiro sobe antes do registo: sem prova guardada, não há registo.
    expect(rota.indexOf("subirComprovativo(")).toBeLessThan(regista);
  });
});

describe("as contas de destino: só nome e últimos 4", () => {
  it("recusa o IBAN no nome e mais de 4 algarismos", () => {
    expect(pareceUmNumeroDeConta("PT50 0000 0000 0000 0000 0000 0")).toBe(true);
    expect(pareceUmNumeroDeConta("Conta 123456")).toBe(true);
    expect(pareceUmNumeroDeConta("Conta CLYON")).toBe(false);
    expect(lerContasDeDestino([{ nome: "PT50000000000000000000000" }]).ok).toBe(false);
    expect(lerContasDeDestino([{ nome: "Conta A", ultimos4: "12345" }]).ok).toBe(false);
  });
  it("lê, dá ids estáveis e o rótulo", () => {
    const r = lerContasDeDestino([{ nome: "Conta A", ultimos4: "0001" }, { nome: "Conta A" }]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.contas.map((c) => c.id)).toEqual(["conta-a", "conta-a-2"]);
    expect(rotuloDaConta(r.contas[0])).toBe("Conta A ·· 0001");
  });
  it("sem nada guardado, a lista de origem — só nomes, sem dígitos", () => {
    const c = contasGuardadas(null);
    expect(c.length).toBeGreaterThan(0);
    expect(c.every((x) => x.ultimos4 === null)).toBe(true);
  });
});

describe("o filtro pela origem e «sem comprovativo»", () => {
  const reg = (metodo: string, comFicheiro: boolean): RegistoDoDinheiro => {
    const origem = origemDoPagamento({ metodo });
    const comprovativos = comFicheiro ? [{ id: 1, nome: "x.pdf", em: null, por: null }] : [];
    return { alvo: "pagamento", alvoId: 1, oQue: "", valor: 10, em: null, origem, comprovativos, semComprovativo: semComprovativo({ origem, comprovativos }) };
  };
  const eupago = [reg("mbway", false)];
  const transf = [reg("transferencia", false)];
  const comProva = [reg("numerario", true)];

  it("sem filtro passa tudo, também os que não têm registos", () => {
    expect(passaNoFiltroDaOrigem(undefined, FILTRO_DA_ORIGEM_VAZIO)).toBe(true);
  });
  it("pela origem", () => {
    const f = { origem: "transferencia" as const, soSemComprovativo: false };
    expect(passaNoFiltroDaOrigem(transf, f)).toBe(true);
    expect(passaNoFiltroDaOrigem(eupago, f)).toBe(false);
  });
  it("só sem comprovativo: o euPago e os que já têm ficheiro ficam de fora", () => {
    const f = { origem: "todas" as const, soSemComprovativo: true };
    expect(passaNoFiltroDaOrigem(transf, f)).toBe(true);
    expect(passaNoFiltroDaOrigem(eupago, f)).toBe(false);
    expect(passaNoFiltroDaOrigem(comProva, f)).toBe(false);
    expect(contarSemComprovativo([eupago, transf, comProva, undefined])).toBe(1);
  });
});

describe("o ficheiro do comprovativo: imagem ou PDF, até 10 MB", () => {
  const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
  it("aceita um PDF e uma fotografia de verdade", () => {
    expect(conferirComprovativo({ nome: "talao.pdf", tipoDeclarado: "application/pdf", tamanho: 1000, primeirosBytes: PDF }).ok).toBe(true);
    expect(conferirComprovativo({ nome: "foto.png", tipoDeclarado: "", tamanho: 1000, primeirosBytes: PNG }).ok).toBe(true);
  });
  it("recusa o que passa de 10 MB, o que não é imagem nem PDF, e o disfarçado", () => {
    expect(conferirComprovativo({ nome: "a.pdf", tipoDeclarado: "application/pdf", tamanho: TAMANHO_MAXIMO_DO_COMPROVATIVO + 1, primeirosBytes: PDF })).toMatchObject({ ok: false, status: 413 });
    expect(conferirComprovativo({ nome: "v.mp4", tipoDeclarado: "video/mp4", tamanho: 1000, primeirosBytes: PDF })).toMatchObject({ ok: false, status: 415 });
    expect(conferirComprovativo({ nome: "falso.pdf", tipoDeclarado: "application/pdf", tamanho: 1000, primeirosBytes: PNG })).toMatchObject({ ok: false, status: 415 });
    expect(conferirComprovativo({ nome: "vazio.pdf", tipoDeclarado: "application/pdf", tamanho: 0, primeirosBytes: PDF })).toMatchObject({ ok: false, status: 400 });
  });
});

describe("as permissões", () => {
  const SUBIR = "/api/admin/pagamentos/comprovativos";
  const VER = "/api/admin/pagamentos/rasto/comprovativo/12";
  it("juntar o comprovativo: o assistente com os Pagamentos, e só ele", () => {
    expect(assistentePodeChamar(SUBIR, "POST")).toBe(true);
    expect(assistenteComSeccoesPodeChamar(["pagamentos"], SUBIR, "POST")).toBe(true);
    expect(assistenteComSeccoesPodeChamar(["carteiras"], SUBIR, "POST")).toBe(false);
    expect(assistenteComSeccoesPodeChamar(["negociacoes_clyon", "trabalhos_clyon"], SUBIR, "POST")).toBe(false);
    expect(assistentePodeChamar(SUBIR, "DELETE")).toBe(false);
  });
  it("abrir: a equipa dos Pagamentos, da Mesa e das Carteiras; ninguém mais", () => {
    expect(assistenteComSeccoesPodeChamar(["pagamentos"], VER, "GET")).toBe(true);
    expect(assistenteComSeccoesPodeChamar(["trabalhos_clyon"], VER, "GET")).toBe(true);
    expect(assistenteComSeccoesPodeChamar(["carteiras"], VER, "GET")).toBe(true);
    expect(assistenteComSeccoesPodeChamar(["leads"], VER, "GET")).toBe(false);
  });
  it("registar o que entrou e mudar as contas continua só do administrador", () => {
    expect(assistentePodeChamar("/api/admin/pagamentos/recebido", "POST")).toBe(false);
    expect(assistentePodeChamar("/api/admin/contas-de-destino", "PUT")).toBe(false);
    expect(assistenteComSeccoesPodeChamar(["configs"], "/api/admin/contas-de-destino", "GET")).toBe(true);
  });
  it("as rotas pedem a sessão do backoffice, e nunca a um pagamento do euPago", () => {
    for (const r of [
      "src/app/api/admin/pagamentos/comprovativos/route.ts",
      "src/app/api/admin/pagamentos/rasto/route.ts",
      "src/app/api/admin/pagamentos/rasto/comprovativo/[id]/route.ts",
    ]) {
      expect(semComentarios(ler(r))).toContain("await requireAdmin(req)");
    }
    expect(semComentarios(ler("src/app/api/admin/contas-de-destino/route.ts"))).toContain("requireAdminGeral(req)");
    expect(semComentarios(ler("src/lib/rasto-do-pagamento-na-base.ts"))).toContain(".automatica)");
  });
  it("o endereço do armazenamento nunca sai do servidor: lê-se pela rota", () => {
    const ecra = ler("src/components/admin/RastoDoPagamento.tsx");
    expect(ecra).toContain("/api/admin/pagamentos/rasto/comprovativo/");
    expect(ecra).not.toMatch(/blob\.vercel-storage\.com/);
    const base = semComentarios(ler("src/lib/rasto-do-pagamento-na-base.ts"));
    // A lista dos registos não leva o url.
    expect(base).toMatch(/SELECT id, alvo, alvoId, nome, criadoEm, carregadoPor FROM comprovativosDosPagamentos/);
  });
});
