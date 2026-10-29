import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { historicoDaNegociacao } from "./historico-negociacao";
import { quantoOProfissionalRecebe } from "./taxas-plataforma";
import {
  DIAS_ATE_LIBERTAR_SOZINHO,
  OBRIGADO_DEPOIS_DE_FEITO,
  QUEM_CONFIRMA_COM_E_SEM_FOTOS,
  QUEM_CONFIRMA_O_TRABALHO,
  aEsperaDaConfirmacao,
  lerQuemConfirmou,
  mensagemDepoisDeFeito,
  prazoEmPalavras,
  quemConfirmaAntesDeMarcar,
  quemConfirmaOTrabalho,
} from "./trabalho";
import {
  avisoDoConfirmado,
  casoDoDestino,
  ondeEstaODinheiro,
  tituloDoConfirmado,
} from "./fim-do-trabalho";
import { ROTULOS_DA_CARTEIRA } from "./rotulos-da-carteira";
import { PROMESSA } from "./pagamento-na-plataforma";

/*
 * O FIM DO TRABALHO E O DINHEIRO, VERDADEIROS E IGUAIS — 28-10-2026 (d4).
 *
 * O painel e a app diziam ao profissional coisas diferentes, e às vezes
 * erradas, sobre o fim do trabalho: «Transferido 350 €» a quem recebeu
 * 311,50 €, «um colega da CLYON vai confirmar» a quem juntou fotografias,
 * «Confirmado pelo cliente — disponível na sua carteira» a todos, e dois
 * nomes para o mesmo dinheiro na carteira.
 */

const ler = (p: string) =>
  readFileSync(join(process.cwd(), p), "utf8")
    .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
    .replace(/^\s*\/\/.*$/gm, "");

const ONZE = { cliente: 0, profissional: 0.11 };
const FOTO = JSON.stringify({ fotos: ["https://x.public.blob.vercel-storage.com/a.jpg"], nota: "", em: "2026-10-20T10:00:00Z" });
const SEM_FOTO = JSON.stringify({ fotos: [], nota: "", em: "2026-10-20T10:00:00Z" });

describe("o histórico mostra ao profissional o que ele recebe", () => {
  const marcos = {
    execucaoEnviadaEm: "2026-10-20T10:00:00Z",
    confirmadoEm: "2026-10-21T10:00:00Z",
    pagoEm: "2026-10-22T10:00:00Z",
    valorAcordado: 350,
    valorQueRecebe: quantoOProfissionalRecebe(350, ONZE),
    provaJson: FOTO,
  };

  it("um trabalho de 350 € a 11 % dá «Transferido 311,50 €»", () => {
    const h = historicoDaNegociacao([], marcos, "profissional");
    const transferido = h.find((e) => e.texto === "Transferido");
    expect(transferido?.valor).toBe(311.5);
    expect(h.find((e) => e.texto === "Trabalho confirmado")?.valor).toBe(311.5);
  });

  it("sem o líquido, fica o acordado (as chamadas de antes)", () => {
    const h = historicoDaNegociacao([], { ...marcos, valorQueRecebe: undefined }, "profissional");
    expect(h.find((e) => e.texto === "Transferido")?.valor).toBe(350);
  });

  it("o cliente não vê a linha «Transferido», e vê o confirmado no valor dele", () => {
    const h = historicoDaNegociacao([], marcos, "cliente");
    expect(h.map((e) => e.texto)).not.toContain("Transferido");
    expect(h.find((e) => e.texto === "Trabalho confirmado")?.valor).toBe(350);
  });

  it("«Trabalho confirmado», e nunca «O cliente confirmou» nem «disponível»", () => {
    for (const oferta of [false, true]) {
      const textos = historicoDaNegociacao([], marcos, "profissional", oferta).map((e) => e.texto).join(" | ");
      expect(textos).toContain("Trabalho confirmado");
      expect(textos).not.toContain("O cliente confirmou");
      expect(textos).not.toContain("disponível");
    }
  });

  it("«à espera do cliente» só quando é o cliente que confirma", () => {
    const feito = (provaJson: string | null | undefined, oferta = false) =>
      historicoDaNegociacao([], { execucaoEnviadaEm: "2026-10-20T10:00:00Z", provaJson }, "profissional", oferta)[0]
        .texto;
    expect(feito(FOTO)).toBe("Trabalho marcado como feito, à espera do cliente");
    expect(feito(SEM_FOTO)).toBe("Trabalho marcado como feito, a CLYON confirma com o cliente");
    expect(feito(null)).toBe("Trabalho marcado como feito, a CLYON confirma com o cliente");
    expect(feito(FOTO, true)).toBe("Trabalho marcado como feito, à espera da CLYON");
    // Sem a prova carregada, a regra de antes (com fotografias).
    expect(feito(undefined)).toBe("Trabalho marcado como feito, à espera do cliente");
  });

  it("o painel e a página do link passam o líquido; a página do cliente não passa o pagoEm", () => {
    const PAINEL = ler("src/app/profissionais/painel/Trabalhos.tsx");
    expect(PAINEL).toContain("valorQueRecebe: pedido.recebeSeFechado,");
    expect(PAINEL).toContain("provaJson: pedido.provaJson,");
    const LINK = ler("src/app/profissionais/pedidos/[token]/page.tsx");
    expect(LINK).toMatch(/valorQueRecebe:\s*negociacao\.valorAcordado != null\s*\?\s*quantoOProfissionalRecebe\(/);
    // Desde 28-10-2026 (d10) o histórico do cliente faz-se no servidor (`negociacao-no-ecra.ts`).
    const CLIENTE = ler("src/lib/negociacao-no-ecra.ts").replace(/^[ \t]*\/\/.*$/gm, "");
    const i = CLIENTE.indexOf("historicoDaNegociacao(");
    expect(i).toBeGreaterThan(-1);
    expect(CLIENTE.slice(i, CLIENTE.indexOf("\"cliente\"", i))).not.toContain("pagoEm");
  });
});

describe("o «Está feito» diz quem confirma", () => {
  it("quem confirma: o cliente só com fotografias e fora de um Trabalho CLYON", () => {
    expect(quemConfirmaOTrabalho({ comFotografias: true })).toBe("cliente");
    expect(quemConfirmaOTrabalho({ comFotografias: false })).toBe("clyon");
    expect(quemConfirmaOTrabalho({ comFotografias: true, ofertaClyon: true })).toBe("clyon");
  });

  it("com fotografias a rota nunca dá a frase do colega da CLYON", () => {
    const comFotos = mensagemDepoisDeFeito({ comFotografias: true });
    expect(comFotos).not.toContain("colega da CLYON");
    expect(comFotos).toContain("cliente que confirma");
    expect(comFotos).toContain(`${DIAS_ATE_LIBERTAR_SOZINHO} dias`);
    const clyon = mensagemDepoisDeFeito({ comFotografias: true, ofertaClyon: true });
    expect(clyon).toContain("A CLYON confirma");
    expect(clyon).not.toContain("cliente que confirma");
    expect(mensagemDepoisDeFeito({ comFotografias: false })).toBe(OBRIGADO_DEPOIS_DE_FEITO);
    expect(mensagemDepoisDeFeito({ comFotografias: false, ofertaClyon: true })).toBe(OBRIGADO_DEPOIS_DE_FEITO);
  });

  it("a rota responde pela função, com o Trabalho CLYON do próprio trabalho", () => {
    const ROTA = ler("src/app/api/profissionais/trabalho/route.ts");
    expect(ROTA).toContain("mensagem: mensagemDepoisDeFeito({");
    expect(ROTA).not.toContain("mensagem: OBRIGADO_DEPOIS_DE_FEITO");
  });

  it("antes de marcar, os dois caminhos numa linha (a frase do Produto)", () => {
    expect(QUEM_CONFIRMA_COM_E_SEM_FOTOS).toBe(
      "Com fotografias, o trabalho fecha sozinho 7 dias depois se o cliente não disser nada. " +
        "Sem elas, espera que um colega da CLYON fale com o cliente.",
    );
    expect(quemConfirmaAntesDeMarcar(false)).toBe(QUEM_CONFIRMA_COM_E_SEM_FOTOS);
    expect(quemConfirmaAntesDeMarcar(true)).toContain("se a CLYON não o confirmar antes");
    expect(ler("src/app/profissionais/painel/Trabalhos.tsx")).toContain(
      "{quemConfirmaAntesDeMarcar(Boolean(pedido.ofertaClyon))}",
    );
  });

  it("«hoje», e nunca «ao fim de 0 dias»", () => {
    expect(prazoEmPalavras(0)).toBe("hoje");
    expect(prazoEmPalavras(-0.4)).toBe("hoje");
    expect(prazoEmPalavras(0.3)).toBe("ao fim de 1 dia");
    expect(prazoEmPalavras(6.2)).toBe("ao fim de 7 dias");
    expect(prazoEmPalavras(null)).toBeNull();
    expect(aEsperaDaConfirmacao({ semFotografias: false, diasAteLibertar: 0 }).texto).toBe(
      "Enviou a prova. Falta o cliente confirmar — e fica confirmado sozinho hoje se ele não disser nada.",
    );
    expect(aEsperaDaConfirmacao({ semFotografias: true, diasAteLibertar: 3 })).toEqual({
      titulo: "À espera da confirmação",
      texto: QUEM_CONFIRMA_O_TRABALHO,
    });
    expect(aEsperaDaConfirmacao({ semFotografias: false, ofertaClyon: true, diasAteLibertar: 2 }).titulo).toBe(
      "À espera da CLYON",
    );
    const PAINEL = ler("src/app/profissionais/painel/Trabalhos.tsx");
    expect(PAINEL).not.toMatch(/ao fim de \{Math\.ceil/);
    expect(PAINEL).toContain("aEsperaDaConfirmacao({");
  });
});

describe("num trabalho confirmado: quem confirmou, e onde está o dinheiro", () => {
  it("quem confirmou, quando a base o sabe; «Confirmado» quando não", () => {
    const em = "2026-10-28T13:00:00Z";
    expect(tituloDoConfirmado({ confirmadoPor: "cliente", confirmadoEm: em })).toBe("Confirmado pelo cliente a 28/10/2026");
    expect(tituloDoConfirmado({ confirmadoPor: "clyon", confirmadoEm: em })).toBe(
      "Confirmado pela CLYON, com o cliente, a 28/10/2026",
    );
    expect(tituloDoConfirmado({ confirmadoPor: "clyon", confirmadoEm: em, ofertaClyon: true })).toBe(
      "Confirmado pela CLYON a 28/10/2026",
    );
    expect(tituloDoConfirmado({ confirmadoPor: "prazo", confirmadoEm: em })).toBe(
      "Confirmado sozinho a 28/10/2026, 7 dias depois das fotografias",
    );
    expect(tituloDoConfirmado({ confirmadoPor: null, confirmadoEm: em })).toBe("Confirmado");
    expect(lerQuemConfirmou("outro")).toBeNull();
  });

  it("o dia é o de Lisboa", () => {
    // 23:30 UTC de 1/8 já é dia 2 em Lisboa (Verão, UTC+1) — e não o dia do servidor.
    expect(tituloDoConfirmado({ confirmadoPor: "cliente", confirmadoEm: "2026-08-01T23:30:00Z" })).toBe(
      "Confirmado pelo cliente a 02/08/2026",
    );
  });

  const base = {
    valorAcordado: 350,
    taxas: ONZE,
    criadaEm: "2026-10-10T10:00:00Z",
  };

  it("nunca «disponível» num trabalho em dinheiro", () => {
    for (const fase of ["confirmado", "pago"]) {
      const d = ondeEstaODinheiro({ ...base, fase, formaDePagamento: "dinheiro", clientePagou: null, pagoEm: "2026-10-22T10:00:00Z" });
      expect(d?.caso).toBe("em_mao_com_divida");
      expect(d?.frase).not.toMatch(/dispon[ií]vel|transferir|transferidos/);
    }
    // Antes do IVA incluído não há dívida: «em mão».
    const antigo = ondeEstaODinheiro({ ...base, criadaEm: "2026-09-10T10:00:00Z", fase: "confirmado", formaDePagamento: "dinheiro" });
    expect(antigo?.caso).toBe("em_mao");
    expect(antigo?.frase).toBe("Foi pago em dinheiro no local: os 311,50 € já estão consigo.");
  });

  it("os cinco casos, com as frases do Produto", () => {
    expect(ondeEstaODinheiro({ ...base, fase: "confirmado", clientePagou: true })?.frase).toBe(
      "311,50 € estão na sua carteira, prontos a transferir — o pedido de transferência é tratado em menos de 24 horas.",
    );
    expect(ondeEstaODinheiro({ ...base, fase: "confirmado", clientePagou: null })?.caso).toBe("disponivel");
    expect(ondeEstaODinheiro({ ...base, fase: "confirmado", clientePagou: false })?.frase).toBe(
      "Os 311,50 € passam para a sua carteira assim que o pagamento do cliente entrar.",
    );
    expect(ondeEstaODinheiro({ ...base, fase: "pago", pagoEm: "2026-10-22T10:00:00Z" })?.frase).toBe(
      "Pago a 22/10/2026: 311,50 € transferidos para a sua conta.",
    );
    const divida = ondeEstaODinheiro({ ...base, fase: "confirmado", formaDePagamento: "dinheiro" });
    expect(divida?.frase).toMatch(/^Dos 430,50 € que recebeu, 311,50 € são seus; 119,00 € de IVA e taxa da plataforma são da CLYON\.$/);
    expect(ondeEstaODinheiro({ ...base, fase: "a_confirmar" })).toBeNull();
  });

  it("o painel diz o título e a linha do dinheiro pelas funções, e não as frases de antes", () => {
    const PAINEL = ler("src/app/profissionais/painel/Trabalhos.tsx");
    expect(PAINEL).not.toContain("Confirmado pelo cliente");
    expect(PAINEL).not.toContain("O valor está disponível na sua carteira.");
    expect(PAINEL).toContain("tituloDoConfirmado({");
    expect(PAINEL).toContain("ondeEstaODinheiro(pedido)");
  });

  it("o aviso «Trabalho confirmado» diz o caso", () => {
    expect(avisoDoConfirmado({ pedidoId: 9, caso: "disponivel", liquido: 311.5 }).body).toBe(
      "O pedido #9 ficou confirmado. 311,50 € na sua carteira — pode pedir a transferência.",
    );
    expect(avisoDoConfirmado({ pedidoId: 9, caso: "por_cobrar", liquido: 311.5 }).body).toContain(
      "ficam na carteira quando o cliente pagar",
    );
    expect(avisoDoConfirmado({ pedidoId: 9, caso: "em_mao_com_divida", liquido: 311.5, aPagarAClyon: 119 }).body).toBe(
      "O pedido #9 ficou confirmado. Pago em dinheiro: entregue à CLYON 119,00 €.",
    );
    expect(avisoDoConfirmado({ pedidoId: 9, caso: "em_mao", liquido: 311.5 }).body).not.toContain("carteira");
    expect(casoDoDestino("em_mao", true)).toBe("em_mao_com_divida");
    const AVISO = ler("src/lib/avisar-confirmacao.ts");
    expect(AVISO).toMatch(/caso: destino \? casoDoDestino\(destino, temDivida\) : null/);
    expect(ler("src/lib/avisar-por-push.ts")).toContain("avisoDoConfirmado({");
  });
});

describe("a base guarda quem confirmou", () => {
  const DB = ler("src/lib/db.ts");

  it("a coluna nova, nula por omissão, e a versão subiu", () => {
    expect(DB).toContain("`ALTER TABLE negociacoes ADD COLUMN confirmadoPor VARCHAR(12) NULL DEFAULT NULL`,");
    expect(Number(DB.match(/const VERSAO_DAS_NEGOCIACOES = (\d+);/)?.[1])).toBeGreaterThanOrEqual(11);
  });

  it("cada caminho grava quem: o cliente, a CLYON e o prazo", () => {
    const confirma = DB.slice(DB.indexOf("export async function confirmarExecucao("), DB.indexOf("export async function libertarTrabalhosPorPrazo"));
    expect(confirma).toContain("SET confirmadoEm = NOW(), confirmadoPor = ?");
    expect(confirma).toContain("motivoSemFactura = ?, confirmadoPor = ?");
    const prazo = DB.slice(DB.indexOf("export async function libertarTrabalhosPorPrazo"));
    expect(prazo.slice(0, 4000)).toContain("SET confirmadoEm = NOW(), confirmadoPor = 'prazo'");
    expect(ler("src/lib/agir-como-cliente.ts")).toContain('confirmarExecucao(negociacaoId, pedidoId, undefined, "cliente")');
    expect(ler("src/app/api/admin/trabalhos-clyon/confirmar/route.ts")).toContain(
      'confirmarExecucao(negociacaoId, pedidoId, undefined, "clyon")',
    );
    expect(ler("src/app/api/admin/negociacoes/agir/route.ts")).toMatch(/motivoSemFactura,\s*\}, "clyon"\);/);
  });

  it("e o painel recebe-o", () => {
    expect(DB).toContain("n.confirmadoEm, n.confirmadoPor, n.pagoEm,");
    expect(ler("src/app/api/profissionais/meus-pedidos/route.ts")).toContain("confirmadoPor: l.confirmadoPor ?? null,");
  });
});

describe("a carteira com os mesmos nomes no painel e na app", () => {
  const PAINEL = ler("src/app/profissionais/painel/Carteira.tsx");

  it("«Por receber» é o cativo, em todo o lado", () => {
    expect(ROTULOS_DA_CARTEIRA.porReceber.rotulo).toBe("Por receber");
    expect(PROMESSA.proRotuloDoCativo).toBe(ROTULOS_DA_CARTEIRA.porReceber.rotulo);
    // O número de cima da app tem outro nome, que não se confunde com ele.
    expect(ROTULOS_DA_CARTEIRA.aReceberJaFeito.rotulo).toBe("A receber, já feito");
    const nomes = Object.values(ROTULOS_DA_CARTEIRA).map((r) => r.rotulo);
    expect(new Set(nomes).size).toBe(nomes.length);
    expect(nomes).not.toContain("Para receber");
    expect(nomes).not.toContain("Cativo");
  });

  it("a ajuda explica os nomes que o ecrã mostra", () => {
    for (const k of ["porReceber", "recebidoEmMao", "aPagarAClyon"] as const) {
      expect(PROMESSA.proCorpo).toContain(`«${ROTULOS_DA_CARTEIRA[k].rotulo}»`);
    }
  });

  it("o painel não escreve nenhum rótulo à mão: vêm do mapa", () => {
    expect(PAINEL).toContain('from "@/lib/rotulos-da-carteira"');
    for (const r of Object.values(ROTULOS_DA_CARTEIRA)) {
      // Nem como texto de JSX nem como texto entre aspas.
      expect(PAINEL, r.rotulo).not.toMatch(new RegExp(`>\\s*${r.rotulo}\\s*<|["\`]${r.rotulo}["\`:]`));
    }
    for (const k of ["porCobrar", "recebidoEmMao", "aPagarAClyon", "porReceber", "disponivel", "totalGanho"]) {
      expect(PAINEL).toContain(`R.${k}.rotulo`);
    }
  });

  /*
   * A APP MUDOU pela Engenharia — Apps (EAS Update de 29-10-2026): os nomes
   * vêm todos do mapa, e a lista ficou vazia. Fica vazia — um nome escrito à
   * mão na app volta a chumbar aqui.
   */
  const AINDA_A_MAO_NA_APP: string[] = [];

  it("a app: só os nomes da lista de espera ficam à mão, e a lista só encolhe", () => {
    const APP = ler("app-pro/src/app/(app)/carteira.tsx");
    const aMao = new Set<string>();
    for (const m of APP.matchAll(/<(?:Caixinha|Linha) rotulo="([^"]+)"|>\s*(Para receber|Cativo)\s*</g)) aMao.add(m[1] ?? m[2]);
    for (const nome of aMao) expect(AINDA_A_MAO_NA_APP, `«${nome}» à mão na app`).toContain(nome);
    for (const nome of AINDA_A_MAO_NA_APP) expect(aMao, `«${nome}» já saiu da app: tire-o da lista`).toContain(nome);
  });
});
