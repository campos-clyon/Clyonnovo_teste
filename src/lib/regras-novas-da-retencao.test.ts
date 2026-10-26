import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  COMO_SE_ANONIMIZA_O_PEDIDO,
  COLUNAS_QUE_A_ANONIMIZACAO_REESCREVE,
  DIAS_ATE_ANONIMIZAR_OS_TRABALHOS,
  DIAS_DOS_CONTACTOS,
  DIAS_DOS_FICHEIROS_ORFAOS,
  DIAS_DOS_REJEITADOS,
  DIAS_DO_TELEMOVEL_NAS_REGRAS_NOVAS,
  ajustesSemFotografias,
  apagariaHoje,
  decidirComAsRegrasNovas,
  ficheirosDoPedido,
  formularioAnonimizado,
  jsonSoComNumeros,
  negociacaoFechada,
  primeiroNome,
  provaAnonimizada,
  valoresDoPedidoAnonimizado,
  zonaDoCodigoPostal,
  type NegociacaoParaRetencao,
  type PedidoParaRetencao,
} from "./regras-novas-da-retencao";
import { carteiraDe, type TrabalhoNaCarteira } from "./carteira";
import { comissoesPorPeriodo, type LinhaQueConta } from "./assistentes";

/**
 * AS REGRAS NOVAS DA RETENÇÃO — d32, 26-10-2026 (versão 2: fica o primeiro nome).
 *
 * *«Aprovo todas»*, com *«90 dias depois de fechado»*. E: *«fica o primeiro
 * nome do cliente, junto com a localidade — para a equipa conseguir encontrar o
 * pedido se houver um problema de pagamentos.»*
 *
 * Este ficheiro guarda as decisões, com linhas escritas à mão. O que fala com a
 * base (e o ensaio que não muda nada) está em `regras-novas-na-base.test.ts`.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const DB = ler("src/lib/db.ts");

const DIA = 86_400_000;
const NOVO = "2026-10-10T10:00:00Z"; // negociação aberta depois do corte de 01-10 (a carteira pergunta pelo pagamento)
const ANTIGO = "2026-09-10T10:00:00Z"; // antes do corte (a carteira assume pago)

const neg = (extra: Partial<NegociacaoParaRetencao> = {}): NegociacaoParaRetencao => ({
  id: 1,
  estado: "acordada",
  valorAcordado: 200,
  execucaoEnviadaEm: "2026-10-12T10:00:00Z",
  confirmadoEm: "2026-10-13T10:00:00Z",
  pagoEm: null,
  formaDePagamento: null,
  ofertaClyon: null,
  negociacaoCriadaEm: NOVO,
  clientePagouEm: "2026-10-12T12:00:00Z",
  comoEntrou: "mbway",
  referenciasVivas: 0,
  pagamentosRecebidos: 1,
  pagamentosDevolvidos: 0,
  movimentos: 1,
  ...extra,
});

const pedido = (extra: Partial<PedidoParaRetencao> = {}): PedidoParaRetencao => ({
  id: 500,
  status: "concluido",
  diasParado: 120,
  dataMarcadaPassou: true,
  temPreco: false,
  anonimizado: false,
  negociacoes: [neg()],
  ...extra,
});

/* ──────────────────────────────────────────────────────────────────────── */

describe("o primeiro nome (versão 2 da d32)", () => {
  it("fica só a primeira palavra, tal como está", () => {
    expect(primeiroNome("Maria Joana Exemplo")).toBe("Maria");
    expect(primeiroNome("Maria")).toBe("Maria");
    expect(primeiroNome("  joão   da Silva ")).toBe("joão");
    expect(primeiroNome("Dr. António Costa")).toBe("Dr.");
  });

  it("sem nome, ou um email no lugar do nome, não fica nada", () => {
    expect(primeiroNome("")).toBeNull();
    expect(primeiroNome("   ")).toBeNull();
    expect(primeiroNome(null)).toBeNull();
    expect(primeiroNome("maria@exemplo.pt")).toBeNull();
  });
});

describe("a localidade fica; a rua, a porta e o código inteiro saem", () => {
  it("do código postal ficam os quatro primeiros algarismos", () => {
    expect(zonaDoCodigoPostal("2750-123")).toBe("2750");
    expect(zonaDoCodigoPostal("1000")).toBe("1000");
    expect(zonaDoCodigoPostal("sem código")).toBeNull();
    expect(zonaDoCodigoPostal(null)).toBeNull();
  });
});

/* ──────────────────────────────────────────────────────────────────────── */

/** As colunas de `simulatorOrders`, como a tabela é criada e como cresce. */
const COLUNAS_DOS_PEDIDOS = (() => {
  const i = DB.indexOf("CREATE TABLE IF NOT EXISTS simulatorOrders (");
  expect(i).toBeGreaterThan(-1);
  const bloco = DB.slice(i, DB.indexOf("\n    )", i));
  const doCreate = bloco
    .split("\n")
    .slice(1)
    .map((l) => l.match(/^\s*(\w+)\s+(?:INT|VARCHAR|TEXT|LONGTEXT|DECIMAL|TIMESTAMP|DATETIME|DATE|TINYINT)\b/i)?.[1])
    .filter((c): c is string => c != null);
  const dosAlter = [...DB.matchAll(/ALTER TABLE simulatorOrders ADD COLUMN (\w+)/g)].map((m) => m[1]);
  return [...new Set([...doCreate, ...dosAlter])];
})();

describe("cada coluna do pedido tem decisão na anonimização", () => {
  it("há colunas para comparar — se a leitura falhar, o resto não vale nada", () => {
    expect(COLUNAS_DOS_PEDIDOS.length).toBeGreaterThan(70);
    expect(COLUNAS_DOS_PEDIDOS).toEqual(
      expect.arrayContaining(["contactName", "contactPhone", "address", "filesJson", "anonimizadoEm", "motivoTaxaClyon"]),
    );
  });

  it("nenhuma coluna da tabela fica sem decisão", () => {
    const porDecidir = COLUNAS_DOS_PEDIDOS.filter((c) => !(c in COMO_SE_ANONIMIZA_O_PEDIDO));
    expect(
      porDecidir,
      `Colunas novas em simulatorOrders sem decisão na anonimização (d32): ${porDecidir.join(", ")}. ` +
        "Decida em COMO_SE_ANONIMIZA_O_PEDIDO (regras-novas-da-retencao.ts): fica, nulo, ou o que se guarda dela.",
    ).toEqual([]);
  });

  it("e a lista não fala de colunas que não existem", () => {
    for (const c of Object.keys(COMO_SE_ANONIMIZA_O_PEDIDO)) expect(COLUNAS_DOS_PEDIDOS).toContain(c);
  });

  it("o que identifica sai — e do nome fica o primeiro", () => {
    for (const c of [
      "contactPhone",
      "contactEmail",
      "address",
      "floor",
      "description",
      "notasInternas",
      "mensagemCliente",
      "chatJson",
      "historyJson",
      "filesJson",
      "nifFactura",
      "calendarNotes",
      "acessoTokenHash",
    ]) {
      expect(COMO_SE_ANONIMIZA_O_PEDIDO[c], c).toBe("nulo");
    }
    expect(COMO_SE_ANONIMIZA_O_PEDIDO.contactName).toBe("primeiro_nome");
    expect(COMO_SE_ANONIMIZA_O_PEDIDO.city).toBe("fica");
  });

  it("o dinheiro, as datas, o estado e quem tratou ficam", () => {
    for (const c of [
      "serviceType",
      "city",
      "status",
      "createdAt",
      "updatedAt",
      "concluidoEm",
      "precoFinal",
      "precoFinalIva",
      "valorFixoClyon",
      "precoClienteClyon",
      "taxaClyon",
      "lucroManual",
      "valorDesejadoCliente",
      "estimateTotal",
      "assignedToId",
      "assignedToName",
      "providerId",
      "formaDePagamento",
      "scheduledDate",
    ]) {
      expect(COMO_SE_ANONIMIZA_O_PEDIDO[c], c).toBe("fica");
    }
  });
});

describe("o pedido anonimizado tem o primeiro nome e a localidade, e nada mais que identifique", () => {
  const linha: Record<string, unknown> = {
    id: 412,
    serviceType: "recolha-moveis",
    city: "Cascais",
    contactName: "Maria Joana Exemplo",
    contactPhone: "912345678",
    contactEmail: "maria.joana@exemplo.pt",
    address: "Rua das Flores 12, 3.º Esq",
    floor: "3",
    postalCode: "2750-123",
    description: "Sofá velho na garagem, ligar ao vizinho Joaquim",
    notasInternas: "A D. Maria paga por transferência",
    mensagemCliente: "Olá Maria Joana",
    chatJson: '[{"de":"cliente","texto":"sou a Maria Exemplo"}]',
    historyJson: '[{"type":"note","text":"falei com a Maria Joana"}]',
    calendarNotes: "Tocar à campainha Exemplo",
    clientRatingComment: "Obrigada, Maria",
    analysisJsonExtended: '{"resumo":"garagem da Maria"}',
    filesJson: '[{"url":"https://abc.public.blob.vercel-storage.com/simulador/casa-1.jpg"}]',
    rawOrderJson: JSON.stringify({
      contactEmail: "maria.joana@exemplo.pt",
      contactPhone: "912345678",
      address: { street: "Rua das Flores", number: "12" },
      description: "Sofá velho",
      files: [{ url: "https://abc.public.blob.vercel-storage.com/simulador/casa-1.jpg" }],
      origemPedido: "simulador",
      origemDaVisita: { utm_source: "google", utm_medium: "cpc", utm_campaign: "recolhas", gclid: "Cj0KCQ-abc" },
    }),
    estimateJson: JSON.stringify({ total: 180, iva: 41.4, internalNotes: ["morada da Maria em Cascais"] }),
    reviewJson: JSON.stringify({ precoFinal: 200, mensagemCliente: "Olá Maria", reviewedAt: "2026-07-01 10:00:00" }),
    nifFactura: "123456789",
    acessoTokenHash: "abc123",
    acessoTokenExpiraEm: "2026-12-01",
    orcamentoToken: "tok-1",
    precoFinal: "200.00",
    status: "concluido",
    concluidoEm: "2026-07-01 10:00:00",
  };
  const novos = valoresDoPedidoAnonimizado(linha);
  const depois = { ...linha, ...novos };
  const texto = JSON.stringify(depois);

  it("fica o primeiro nome e a localidade", () => {
    expect(depois.contactName).toBe("Maria");
    expect(depois.city).toBe("Cascais");
    expect(depois.postalCode).toBe("2750");
  });

  it("não sobra nada que identifique — nem dentro dos JSON", () => {
    for (const pessoal of [
      "Joana",
      "Exemplo",
      "912345678",
      "maria.joana@exemplo.pt",
      "Rua das Flores",
      "2750-123",
      "Joaquim",
      "garagem",
      "blob.vercel-storage.com",
      "123456789",
      "Cj0KCQ",
      "abc123",
      "tok-1",
      "transferência",
    ]) {
      expect(texto, pessoal).not.toContain(pessoal);
    }
  });

  it("e o resto da linha não mexe: valores, estado, datas", () => {
    expect(depois.precoFinal).toBe("200.00");
    expect(depois.status).toBe("concluido");
    expect(depois.concluidoEm).toBe("2026-07-01 10:00:00");
    // As colunas que ficam nem entram no UPDATE.
    for (const c of ["precoFinal", "status", "concluidoEm", "city", "serviceType", "updatedAt"]) {
      expect(COLUNAS_QUE_A_ANONIMIZACAO_REESCREVE).not.toContain(c);
    }
  });

  it("o canal por onde chegou fica para as contas do Google Ads", () => {
    const raw = JSON.parse(String(depois.rawOrderJson));
    expect(raw.origemPedido).toBe("simulador");
    expect(raw.origemDaVisita).toEqual({
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "recolhas",
      gclid: "anonimizado",
    });
  });

  it("da estimativa e da revisão ficam os números", () => {
    expect(JSON.parse(String(depois.estimateJson))).toEqual({ total: 180, iva: 41.4 });
    expect(JSON.parse(String(depois.reviewJson))).toEqual({ precoFinal: 200, reviewedAt: "2026-07-01 10:00:00" });
  });

  it("duas vezes dá o mesmo", () => {
    expect(valoresDoPedidoAnonimizado(depois)).toEqual(novos);
  });

  it("um JSON estragado não deixa passar nada", () => {
    expect(formularioAnonimizado("{ isto não é json maria@exemplo.pt")).toBeNull();
    expect(jsonSoComNumeros("não é json")).toBeNull();
  });
});

describe("as fotografias do pedido, da prova e dos ajustes", () => {
  it("encontra os ficheiros no filesJson e no formulário", () => {
    const u1 = "https://abc.public.blob.vercel-storage.com/simulador/a.jpg";
    const u2 = "https://abc.public.blob.vercel-storage.com/simulador/b.pdf";
    expect(ficheirosDoPedido(JSON.stringify([{ url: u1 }]), JSON.stringify({ files: [{ url: u2 }, { url: u1 }] }))).toEqual([
      u1,
      u2,
    ]);
  });

  it("a prova perde as fotografias e a nota, e guarda a data e quantas eram", () => {
    const p = JSON.parse(
      provaAnonimizada(JSON.stringify({ fotos: ["https://x/trabalhos/1/a.jpg", "https://x/trabalhos/1/b.jpg"], nota: "na porta da Maria", em: "2026-07-01T10:00:00Z" }))!,
    );
    expect(p).toEqual({ fotos: [], nota: null, em: "2026-07-01T10:00:00Z", anonimizado: true, quantasFotografias: 2 });
    expect(provaAnonimizada(null)).toBeNull();
  });

  it("os ajustes perdem as fotografias e guardam o valor", () => {
    const a = JSON.parse(
      ajustesSemFotografias(JSON.stringify([{ valorAntigo: 100, valorNovo: 130, motivo: "mais 2 móveis", fotos: ["https://x/a.jpg"], estado: "aceite" }]))!,
    );
    expect(a).toEqual([{ valorAntigo: 100, valorNovo: 130, motivo: "mais 2 móveis", fotos: [], estado: "aceite" }]);
  });
});

/* ──────────────────────────────────────────────────────────────────────── */

describe("A — anonimizar 90 dias depois de fechado", () => {
  it("os prazos são os da d32", () => {
    expect(DIAS_ATE_ANONIMIZAR_OS_TRABALHOS).toBe(90);
    expect(DIAS_DOS_FICHEIROS_ORFAOS).toBe(30);
    expect(DIAS_DOS_CONTACTOS).toBe(60);
    expect(DIAS_DOS_REJEITADOS).toBe(60);
    expect(DIAS_DO_TELEMOVEL_NAS_REGRAS_NOVAS).toBe(60);
  });

  it("concluído, confirmado e pago pelo cliente: anonimiza aos 90, não aos 89", () => {
    expect(decidirComAsRegrasNovas(pedido({ diasParado: 90 }))).toEqual({ faz: "anonimizar" });
    expect(decidirComAsRegrasNovas(pedido({ diasParado: 89 }))).toEqual({ faz: "fica", porque: "no_prazo" });
  });

  it("o cliente ainda não pagou (trabalho do regime novo): fica, com o dinheiro por acertar", () => {
    const p = pedido({ negociacoes: [neg({ clientePagouEm: null, comoEntrou: null, pagamentosRecebidos: 0 })] });
    expect(decidirComAsRegrasNovas(p)).toEqual({ faz: "fica", porque: "dinheiro_por_acertar" });
  });

  it("um trabalho de antes de 01-10 (a carteira não pergunta pelo pagamento) fecha com a confirmação", () => {
    const p = pedido({
      negociacoes: [neg({ negociacaoCriadaEm: ANTIGO, clientePagouEm: null, comoEntrou: null, pagamentosRecebidos: 0 })],
    });
    expect(decidirComAsRegrasNovas(p)).toEqual({ faz: "anonimizar" });
  });

  it("entregue mas por confirmar: fica — o prazo dos 7 dias depende das fotografias que se apagariam", () => {
    const p = pedido({ negociacoes: [neg({ confirmadoEm: null })] });
    expect(decidirComAsRegrasNovas(p)).toEqual({ faz: "fica", porque: "dinheiro_por_acertar" });
  });

  it("com uma referência por pagar ainda válida: fica", () => {
    expect(negociacaoFechada(neg({ referenciasVivas: 1 }))).toBe(false);
  });

  it("em dinheiro com IVA incluído: só depois de o profissional entregar o que deve à CLYON", () => {
    const deve = neg({ formaDePagamento: "dinheiro", clientePagouEm: null, comoEntrou: null, pagamentosRecebidos: 0 });
    expect(negociacaoFechada(deve)).toBe(false);
    expect(negociacaoFechada({ ...deve, clientePagouEm: "2026-10-20T10:00:00Z", comoEntrou: "abatimento" })).toBe(true);
  });

  it("um Trabalho CLYON confirmado está fechado (quem paga ao profissional é a CLYON)", () => {
    expect(negociacaoFechada(neg({ ofertaClyon: "fixo", clientePagouEm: null, comoEntrou: null, pagamentosRecebidos: 0 }))).toBe(true);
  });

  it("um cancelado com o pagamento devolvido anonimiza; com o pagamento por devolver fica", () => {
    const semTrabalho = { execucaoEnviadaEm: null, confirmadoEm: null, estado: "morta", movimentos: 0 };
    const devolvido = pedido({
      status: "cancelado",
      negociacoes: [neg({ ...semTrabalho, clientePagouEm: null, pagamentosRecebidos: 0, pagamentosDevolvidos: 1 })],
    });
    expect(decidirComAsRegrasNovas(devolvido)).toEqual({ faz: "anonimizar" });
    const porDevolver = pedido({ status: "cancelado", negociacoes: [neg({ ...semTrabalho })] });
    expect(decidirComAsRegrasNovas(porDevolver)).toEqual({ faz: "fica", porque: "dinheiro_por_acertar" });
  });

  it("já anonimizado, ou com a data marcada por passar: fica", () => {
    expect(decidirComAsRegrasNovas(pedido({ anonimizado: true }))).toEqual({ faz: "fica", porque: "ja_anonimizado" });
    expect(decidirComAsRegrasNovas(pedido({ dataMarcadaPassou: false }))).toEqual({ faz: "fica", porque: "data_marcada" });
  });
});

describe("D — um concluído com preço NUNCA é apagado (só anonimizado)", () => {
  it("fechado à mão, sem acordo nenhum, com 400 dias: anonimiza", () => {
    const p = pedido({ temPreco: true, negociacoes: [], diasParado: 400 });
    expect(decidirComAsRegrasNovas(p)).toEqual({ faz: "anonimizar" });
    expect(apagariaHoje(p)).toBe(false);
  });

  it("em nenhuma combinação de prazos, estados das negociações e dinheiro", () => {
    const estados = ["acordada", "morta", "aberta", "desistida", "aguarda_contratacao"];
    for (const dias of [0, 59, 60, 89, 90, 365, 3650]) {
      for (const estado of estados) {
        for (const comPreco of [true, false]) {
          for (const valor of [null, 150]) {
            if (!comPreco && valor == null) continue; // sem preço nenhum não é «com preço»
            const p = pedido({
              diasParado: dias,
              temPreco: comPreco,
              negociacoes: [
                neg({
                  estado,
                  valorAcordado: valor,
                  execucaoEnviadaEm: null,
                  confirmadoEm: null,
                  clientePagouEm: null,
                  pagamentosRecebidos: 0,
                  movimentos: 0,
                }),
              ],
            });
            expect(decidirComAsRegrasNovas(p).faz, JSON.stringify({ dias, estado, comPreco, valor })).not.toBe("apagar");
          }
        }
      }
    }
  });

  it("e a parte que protege já vale hoje, no SQL da purga (antes do interruptor)", () => {
    const i = DB.indexOf("export async function purgarPedidosTerminados(");
    const corpo = DB.slice(i, DB.indexOf("\nexport ", i + 1));
    expect(corpo).toContain("UM CONCLUÍDO COM PREÇO NUNCA SE APAGA");
    expect(corpo).toMatch(/AND NOT \(COALESCE\(o\.status, 'pendente'\) = 'concluido'\s+AND \(o\.precoFinal IS NOT NULL OR o\.lucroManual IS NOT NULL\s+OR o\.valorFixoClyon IS NOT NULL OR o\.precoClienteClyon IS NOT NULL\)\)/);
  });
});

describe("B — a guarda passa a ser o dinheiro e o trabalho, não o acordo", () => {
  const morta = { estado: "morta", execucaoEnviadaEm: null, confirmadoEm: null, pagoEm: null, clientePagouEm: null, comoEntrou: null, pagamentosRecebidos: 0, movimentos: 0 };

  it("cancelado com acordo mas sem trabalho nem dinheiro: sai aos 60 (hoje ficava para sempre)", () => {
    const p = pedido({ status: "cancelado", diasParado: 61, negociacoes: [neg(morta)] });
    expect(decidirComAsRegrasNovas(p)).toEqual({ faz: "apagar", regra: "sem_trabalho_nem_dinheiro" });
    expect(apagariaHoje(p)).toBe(false);
    expect(decidirComAsRegrasNovas({ ...p, diasParado: 59 })).toEqual({ faz: "fica", porque: "no_prazo" });
  });

  it("o mesmo arquivado", () => {
    expect(decidirComAsRegrasNovas(pedido({ status: "arquivado", diasParado: 61, negociacoes: [neg(morta)] })).faz).toBe("apagar");
  });

  it("com trabalho entregue, pagamento ou movimento na carteira, nunca se apaga", () => {
    for (const extra of [
      { execucaoEnviadaEm: "2026-07-01T10:00:00Z" },
      { pagoEm: "2026-07-01T10:00:00Z" },
      { pagamentosRecebidos: 1 },
      { pagamentosDevolvidos: 1 },
      { referenciasVivas: 1 },
      { movimentos: 1 },
    ]) {
      const p = pedido({ status: "cancelado", diasParado: 400, negociacoes: [neg({ ...morta, ...extra })] });
      expect(decidirComAsRegrasNovas(p).faz, JSON.stringify(extra)).not.toBe("apagar");
    }
  });

  it("um acordo ainda de pé num pedido arrumado não se apaga — fica, e conta-se", () => {
    const p = pedido({ status: "arquivado", diasParado: 400, negociacoes: [neg({ ...morta, estado: "acordada" })] });
    expect(decidirComAsRegrasNovas(p)).toEqual({ faz: "fica", porque: "acordo_vivo" });
  });

  it("um pedido aberto continua com a regra de hoje: nunca com acordo, e 90 dias sem", () => {
    expect(decidirComAsRegrasNovas(pedido({ status: "pendente", diasParado: 400 })).faz).toBe("fica");
    expect(decidirComAsRegrasNovas(pedido({ status: "pendente", diasParado: 90, negociacoes: [] }))).toEqual({ faz: "apagar", regra: "abandonado" });
    expect(decidirComAsRegrasNovas(pedido({ status: "pendente", diasParado: 89, negociacoes: [] })).faz).toBe("fica");
  });
});

describe("G — o «rejeitado» conta como terminado: 60 dias", () => {
  it("sai aos 60 com as regras novas; hoje esperava 90", () => {
    const p = pedido({ status: "rejeitado", diasParado: 61, negociacoes: [] });
    expect(decidirComAsRegrasNovas(p)).toEqual({ faz: "apagar", regra: "rejeitado" });
    expect(apagariaHoje(p)).toBe(false);
    expect(apagariaHoje({ ...p, diasParado: 90 })).toBe(true);
  });
});

/* ──────────────────────────────────────────────────────────────────────────
 * O DINHEIRO NÃO MEXE: carteiras, comissões e histórico iguais antes e depois.
 * ────────────────────────────────────────────────────────────────────────── */

describe("A não mexe no dinheiro: carteiras, comissões e histórico do profissional iguais", () => {
  it("a carteira do profissional dá o mesmo antes e depois de a prova perder as fotografias", () => {
    const agora = new Date("2026-12-31T10:00:00Z");
    const prova = JSON.stringify({ fotos: ["https://x/trabalhos/7/a.jpg"], nota: "feito", em: "2026-10-12T10:00:00Z" });
    const base = (provaJson: string | null): TrabalhoNaCarteira[] => [
      {
        negociacaoId: 7,
        estado: "acordada",
        valorAcordado: 200,
        execucaoEnviadaEm: "2026-10-12T10:00:00Z",
        confirmadoEm: "2026-10-13T10:00:00Z",
        pagoEm: null,
        provaJson,
        clientePagouEm: "2026-10-12T12:00:00Z",
        negociacaoCriadaEm: NOVO,
      } as TrabalhoNaCarteira,
      // E um já pago ao profissional.
      {
        negociacaoId: 8,
        estado: "acordada",
        valorAcordado: 350,
        execucaoEnviadaEm: "2026-10-02T10:00:00Z",
        confirmadoEm: "2026-10-03T10:00:00Z",
        pagoEm: "2026-10-05T10:00:00Z",
        provaJson,
        clientePagouEm: "2026-10-02T12:00:00Z",
        negociacaoCriadaEm: NOVO,
      } as TrabalhoNaCarteira,
    ];
    const antes = carteiraDe(base(prova), [], agora);
    const depois = carteiraDe(base(provaAnonimizada(prova)), [], agora);
    expect(depois).toEqual(antes);
    expect(antes.totalGanho).toBeGreaterThan(0);
  });

  it("as comissões dos assistentes dão o mesmo antes e depois de o pedido ser anonimizado", () => {
    const linhaDoPedido = {
      id: 431,
      status: "concluido",
      contactName: "Maria Joana Exemplo",
      contactPhone: "912345678",
      serviceType: "recolha-moveis",
      city: "Almada",
      assignedToId: 3,
      assignedToName: "MIRIAM",
      concluidoEm: "2026-10-20 10:00:00",
      precoFinal: "300.00",
      lucroManual: "60.00",
      valorFixoClyon: null,
      taxaClyon: null,
      precoClienteClyon: null,
      estimateTotal: "280.00",
      description: "três móveis",
    };
    const comoConta = (o: Record<string, unknown>): LinhaQueConta =>
      ({
        id: o.id,
        status: o.status,
        contactName: o.contactName,
        serviceType: o.serviceType,
        city: o.city,
        assignedToId: o.assignedToId,
        assignedToName: o.assignedToName,
        concluidoEm: o.concluidoEm,
        precoFinal: o.precoFinal,
        estimateTotal: o.estimateTotal,
        valorFixoClyon: o.valorFixoClyon,
        taxaClyon: o.taxaClyon,
        precoClienteClyon: o.precoClienteClyon,
        lucroManual: o.lucroManual,
        valorAcordado: null,
      }) as unknown as LinhaQueConta;
    const anonimizado = { ...linhaDoPedido, ...valoresDoPedidoAnonimizado(linhaDoPedido) };
    const conta = (o: Record<string, unknown>) =>
      comissoesPorPeriodo({ linhas: [comoConta(o)], pagamentos: [], minhaPercent: 40, hoje: "2026-12-31" });
    const antes = conta(linhaDoPedido);
    const depois = conta(anonimizado);
    expect(depois.totais).toEqual(antes.totais);
    const numeros = (r: typeof antes) =>
      r.periodos.map((p) => [p.inicio, p.fim, p.trabalhos, p.valorTrabalhos, p.lucro, p.comissaoAssistente]);
    expect(numeros(depois)).toEqual(numeros(antes));
    expect(antes.periodos.some((p) => p.lucro > 0)).toBe(true);
    expect(anonimizado.contactName).toBe("Maria");
  });

  /*
   * E PELA FONTE: as colunas do pedido que as comissões, os Pagamentos (e as
   * Finanças, que lêem os mesmos trabalhos) e a carteira usam para contar
   * dinheiro ficam todas. Lidas do SQL de cada um, e não de uma lista
   * escrita à mão — uma coluna nova lida por eles e apagada pela
   * anonimização chumba aqui.
   */
  const colunasDoPedidoLidasEm = (ficheiro: string, funcao: string) => {
    const fonte = ler(ficheiro);
    const i = fonte.indexOf(`export async function ${funcao}(`);
    expect(i, `${funcao} em ${ficheiro}`).toBeGreaterThan(-1);
    const corpo = fonte.slice(i, fonte.indexOf("\nexport ", i + 1));
    return [...new Set([...corpo.matchAll(/\bo\.(\w+)/g)].map((m) => m[1]))];
  };
  // Só para mostrar no ecrã: o nome passa ao primeiro, o telefone sai (é para isso que se anonimiza).
  const PARA_MOSTRAR = new Set(["contactName", "contactPhone"]);

  it.each([
    ["src/lib/assistentes.ts", "trabalhosQueContam"],
    ["src/lib/assistentes.ts", "trabalhosQueAindaNaoContam"],
    ["src/lib/trabalhos-para-gerir.ts", "trabalhosParaGerir"],
  ])("%s › %s só conta com colunas que ficam", (ficheiro, funcao) => {
    const lidas = colunasDoPedidoLidasEm(ficheiro, funcao);
    expect(lidas.length).toBeGreaterThan(3);
    const apagadas = lidas.filter((c) => !PARA_MOSTRAR.has(c) && COMO_SE_ANONIMIZA_O_PEDIDO[c] !== "fica");
    expect(apagadas, `${funcao} lê colunas que a anonimização reescreve: ${apagadas.join(", ")}`).toEqual([]);
  });

  it("e a anonimização não toca em nenhuma coluna de dinheiro das negociações", () => {
    const fonte = ler("src/lib/regras-novas-na-base.ts");
    const updates = [...fonte.matchAll(/UPDATE negociacoes SET ([^"`]+?) WHERE/g)].map((m) => m[1]);
    expect(updates).toEqual(["provaJson = ?, ajustesJson = ?, updatedAt = updatedAt"]);
  });
});

describe("o tempo conta-se como na purga de hoje", () => {
  it("o dia em que um pedido fica com 90 dias é o dia em que se anonimiza", () => {
    // Sem relógio de JavaScript na decisão: os dias vêm do MySQL (ver lerPedidosParaRetencao).
    const fonte = ler("src/lib/regras-novas-da-retencao.ts");
    expect(fonte).not.toMatch(/Date\.now\(\)|new Date\(\)/);
    expect(DIA).toBe(86_400_000);
  });
});
