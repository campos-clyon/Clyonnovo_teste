import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dadosDoArquivoAnonimizados, motivoQueFicaNoArquivo, DADOS_JA_ANONIMOS } from "./arquivo-anonimo";
import { COMO_SE_ANONIMIZA_O_PEDIDO } from "./regras-novas-da-retencao";

/**
 * C — O ARQUIVO NASCE ANÓNIMO, E O REGISTO DA PURGA DEIXA O CLIENTE — d32.
 *
 * *«O arquivo dos apagados é anónimo desde o início (sem nome nem email nem
 * texto da prova) e guarda o estado e o preço final. O registo permanente
 * deixa de guardar nome e email do cliente nas linhas da purga.»* E, na
 * versão 2: fica o primeiro nome.
 *
 * Com as regras novas em ensaio, `deleteSimulatorOrder` escreve como sempre;
 * ligadas, escreve a cópia já anónima. Lido do código, porque é a função que
 * apaga a sério e não se corre num teste.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const DB = ler("src/lib/db.ts");
const corpoDe = (inicio: string) => {
  const i = DB.indexOf(inicio);
  expect(i, inicio).toBeGreaterThan(-1);
  const fim = DB.indexOf("\nexport ", i + 1);
  return DB.slice(i, fim === -1 ? undefined : fim);
};
const APAGAR = corpoDe("export async function deleteSimulatorOrder");

describe("o arquivo dos apagados com as regras novas", () => {
  it("só nasce anónimo com as regras novas a valer (purga armada E interruptor ligado)", () => {
    expect(APAGAR).toContain("const anonimoDesdeOInicio = await regrasNovasValem();");
    const valem = corpoDe("export async function regrasNovasValem");
    expect(valem).toContain("if (!purgaArmada()) return false;");
    expect(valem).toContain("(await interruptorDasRegrasNovas()).ligado");
  });

  it("ligadas: primeiro nome, sem email, e o `dados` pela lista do que fica", () => {
    const i = APAGAR.indexOf("INSERT INTO arquivoDePedidos");
    const insert = APAGAR.slice(i, APAGAR.indexOf("registarNaTransaccao(conn", i));
    const ramoAnonimo = insert.slice(insert.indexOf("anonimoDesdeOInicio"), insert.indexOf(": ["));
    expect(ramoAnonimo).toContain("motivoQueFicaNoArquivo(contexto.motivo)");
    expect(ramoAnonimo).toContain("primeiroNome(pedido?.contactName)");
    expect(ramoAnonimo).toMatch(/primeiroNome\(pedido\?\.contactName\),\s*null,/);
    expect(ramoAnonimo).toContain("dadosDoArquivoAnonimizados(JSON.stringify({ pedido, negociacoes, fotografias: fotos }))");
  });

  it("e o registo da PURGA deixa de levar o email e o nome inteiro (as linhas do retrato e as dos profissionais)", () => {
    expect(APAGAR).toContain('const daPurga = (contexto.acontecimento ?? "pedido_apagado") === "pedido_expurgado";');
    expect(APAGAR).toContain("const semClienteNoRegisto = anonimoDesdeOInicio && daPurga;");
    const emails = [...APAGAR.matchAll(/clienteEmail: ([^\n]+)/g)].map((m) => m[1]);
    expect(emails.length).toBe(2);
    for (const e of emails) expect(e).toMatch(/^semClienteNoRegisto \? null :/);
    expect(APAGAR).toMatch(/clienteNome: semClienteNoRegisto \? primeiroNome\(pedido\?\.contactName\)/);
  });

  it("a cópia anónima tem o estado e o preço final, e não tem o cliente", () => {
    const pedido = {
      id: 77,
      serviceType: "recolha-entulho",
      city: "Seixal",
      contactName: "Maria Joana Exemplo",
      contactEmail: "maria@exemplo.pt",
      status: "cancelado",
      precoFinal: "120.00",
      concluidoEm: null,
      filesJson: '[{"url":"https://x.public.blob.vercel-storage.com/simulador/a.jpg"}]',
    };
    const dados = dadosDoArquivoAnonimizados(JSON.stringify({ pedido, negociacoes: [], fotografias: ["https://x/a.jpg"] }));
    expect(dados.startsWith(DADOS_JA_ANONIMOS)).toBe(true);
    const lido = JSON.parse(dados);
    expect(lido.pedido.status).toBe("cancelado");
    expect(lido.pedido.precoFinal).toBe("120.00");
    expect(lido.pedido.city).toBe("Seixal");
    expect(dados).not.toMatch(/Maria|Exemplo|maria@exemplo|blob\.vercel/);
    expect(lido.quantasFotografias).toBe(1);
  });

  it("o motivo do sistema fica; o escrito à mão sai (o registo guarda-o)", () => {
    expect(motivoQueFicaNoArquivo("retenção de 60 dias")).toBe("retenção de 60 dias");
    expect(motivoQueFicaNoArquivo("retenção de 90 dias")).toBe("retenção de 90 dias");
    expect(motivoQueFicaNoArquivo("a cliente Maria pediu para apagar")).toBeNull();
    expect(motivoQueFicaNoArquivo(null)).toBeNull();
  });
});

describe("A reaproveita o apagar da conta de cliente — e vai mais longe, nunca menos", () => {
  it("cada coluna que o apagar da conta limpa também sai (ou fica só o primeiro nome) na anonimização", () => {
    const conta = corpoDe("export async function apagarContaDeCliente");
    const i = conta.indexOf("UPDATE simulatorOrders");
    expect(i).toBeGreaterThan(-1);
    const sets = conta.slice(i, conta.indexOf("WHERE", i));
    const limpas = [...sets.matchAll(/(\w+) = NULL/g)].map((m) => m[1]);
    expect(limpas.length).toBeGreaterThan(8);
    for (const c of limpas) {
      expect(COMO_SE_ANONIMIZA_O_PEDIDO[c], c).not.toBe("fica");
      expect(COMO_SE_ANONIMIZA_O_PEDIDO[c], c).toBeDefined();
    }
  });
});
