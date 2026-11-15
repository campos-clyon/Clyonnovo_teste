import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { acertoAFavorDe, carteiraDe, jaTransferidoDe, type TrabalhoNaCarteira } from "./carteira";
import { carteiraDoLivro, livroDe } from "./livro-da-carteira";
import { acertoEmPalavras, contaDaCarteira } from "./trabalhos-da-carteira";
import { quantoOProfissionalRecebe } from "./taxas-plataforma";

/**
 * d38 v2, commit c (15-11-2026) — A DIFERENÇA A FAVOR DO PROFISSIONAL JÁ PAGO.
 *
 * Um trabalho pago ao profissional (`pagoEm`) e corrigido depois pela folha
 * final: se ela lhe dá mais, o «pago ao profissional» sai pelo que se lhe
 * transferiu, e a diferença fica-lhe disponível na carteira, com o nome
 * «acerto da folha final do pedido #N». Se lhe dá menos, a carteira não lhe
 * tira nada por aqui (a diferença contra ele é uma dívida, à parte).
 */

const agora = new Date("2026-11-15T12:00:00Z");
const haDias = (d: number) => new Date(agora.getTime() - d * 86_400_000);
const T = { cliente: 0, profissional: 0.15 };
const pago = (p: Partial<TrabalhoNaCarteira> = {}): TrabalhoNaCarteira & { pedidoId: number } => ({
  negociacaoId: 900,
  pedidoId: 524,
  estado: "acordada",
  valorAcordado: 548,
  taxaCliente: T.cliente,
  taxaProfissional: T.profissional,
  execucaoEnviadaEm: haDias(5),
  confirmadoEm: haDias(4),
  pagoEm: haDias(3),
  pagoPelaClyon: true,
  ...p,
});
const vale = quantoOProfissionalRecebe(548, T); // 465,80

describe("o que já saiu e o acerto", () => {
  it("sem folha final depois do pagamento, tudo como sempre", () => {
    const t = pago();
    expect(jaTransferidoDe(t, vale)).toBe(vale);
    expect(acertoAFavorDe(t)).toBe(0);
    const c = carteiraDe([t], [], agora);
    expect(c.disponivel).toBe(0);
    expect(c.levantado).toBe(vale);
  });

  it("a folha final deu-lhe mais: a diferença fica disponível", () => {
    const t = pago({ pagoAoProfissionalValor: 425 });
    expect(acertoAFavorDe(t)).toBe(40.8);
    const c = carteiraDe([t], [], agora);
    expect(c.disponivel).toBe(40.8);
    expect(c.levantado).toBe(425);
    expect(c.totalGanho).toBe(vale);
  });

  it("a folha final deu-lhe menos: a carteira não lhe tira nada por aqui", () => {
    const t = pago({ pagoAoProfissionalValor: 500 });
    expect(acertoAFavorDe(t)).toBe(0);
    expect(carteiraDe([t], [], agora).disponivel).toBe(0);
  });

  it("o livro dá o mesmo que a carteira, ao cêntimo", () => {
    const trabalhos = [pago({ pagoAoProfissionalValor: 425 }), pago({ negociacaoId: 901 }), pago({ negociacaoId: 902, pagoAoProfissionalValor: 600 })];
    const livro = livroDe(9, trabalhos, []);
    expect(carteiraDoLivro(livro, agora)).toEqual(carteiraDe(trabalhos, [], agora));
  });
});

describe("o que ele lê", () => {
  it("a linha do trabalho fica por receber com o nome do acerto", () => {
    const { linhas, resumo } = contaDaCarteira([pago({ pagoAoProfissionalValor: 425 })], [], agora);
    expect(linhas).toHaveLength(1);
    expect(linhas[0].grupo).toBe("por_receber");
    expect(linhas[0].falta).toBe(40.8);
    expect(linhas[0].razao).toContain(acertoEmPalavras(524));
    expect(acertoEmPalavras(524)).toBe("acerto da folha final do pedido #524");
    expect(resumo.podePedir).toBe(40.8);
    expect(resumo.recebidoTotal).toBe(425);
  });

  it("depois de lhe transferirem o acerto, a linha passa a recebida", () => {
    const { linhas } = contaDaCarteira(
      [pago({ pagoAoProfissionalValor: 425 })],
      [{ id: 3, valor: 40.8, estado: "pago", processadoEm: agora }],
      agora,
    );
    expect(linhas[0].grupo).toBe("recebido");
  });
});

describe("de onde vem o transferido", () => {
  it("a carteira lê-o das folhas finais (a primeira gravada já pago), e os Pagamentos e as Carteiras também", () => {
    const base = readFileSync("src/lib/folha-final-na-base.ts", "utf8");
    expect(base).toContain("WHERE jaPago = 1 AND profissionalAntes IS NOT NULL");
    expect(base).toContain("MIN(id) AS id");
    expect(readFileSync("src/lib/carteira-do-profissional.ts", "utf8")).toContain("pagoAoProfissionalValor: l.pagoEm != null");
    expect(readFileSync("src/app/api/admin/carteiras/route.ts", "utf8")).toContain("transferidos.get(Number(l.negociacaoId)) ?? recebe");
  });
});
