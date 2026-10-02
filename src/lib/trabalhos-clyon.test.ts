import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SO_ACEITAR_OU_RECUSAR,
  TAXAS_DA_OFERTA,
  aceitarFechaLogo,
  lerValorFixo,
  modoDaOferta,
  propostasDaOferta,
  responderAOferta,
  resumoDaOferta,
  type NegociacaoDaOferta,
} from "./oferta-clyon";
import { avisoDeEscolhaAoProfissional, avisoDeOfertaAoProfissional } from "./aviso-de-oferta-clyon";
import { contratar, type Negociacao } from "./negociacao";
import { quantoOProfissionalRecebe } from "./taxas-plataforma";
import { destinoDoValorConcluido, type TrabalhoNaCarteira } from "./carteira";
import { historicoDaNegociacao } from "./historico-negociacao";
import { COMO_SE_SAI } from "./aviso-de-pedido-ao-profissional";

/**
 * OS TRABALHOS CLYON DE VALOR FIXO.
 *
 * *«Quero criar uma função no site para gerar trabalhos nas contas dos
 * profissionais (…) já negociámos e já temos os valores, só precisamos de
 * alguém para realizar (…) "pedido oferecido pela CLYON, valor fixo"; os pros
 * podem aceitar ou recusar, como se fosse uma venda.»* — 02-10-2026.
 *
 * As decisões do dono nesse dia: o valor fixo é o que o profissional recebe;
 * distribuído a vários, a CLYON escolhe entre os que aceitarem; paga a CLYON,
 * na carteira; o cliente não recebe mensagens automáticas além do aviso da
 * data. Ver `oferta-clyon.ts`.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
/* Só os comentários que começam a linha — ver a memória dos testes que lêem o código. */
function semNotas(s: string): string {
  return s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");
}

const AGORA = new Date("2026-10-02T14:00:00Z");

function ofertaNova(valor = 250): Negociacao {
  return { estado: "aberta", valorAcordado: null, propostas: propostasDaOferta(valor, AGORA) };
}

describe("o valor fixo", () => {
  it("lê-se como se escreve", () => {
    expect(lerValorFixo("250")).toEqual({ ok: true, valor: 250 });
    expect(lerValorFixo("250,5")).toEqual({ ok: true, valor: 250.5 });
    expect(lerValorFixo(" 250.50 € ")).toEqual({ ok: true, valor: 250.5 });
    expect(lerValorFixo(180)).toEqual({ ok: true, valor: 180 });
  });

  it("recusa o que não é um valor, o que é pouco e o que é de mais", () => {
    for (const v of ["", "abc", null, "5", "30000"]) {
      expect(lerValorFixo(v).ok, String(v)).toBe(false);
    }
  });

  it("é o que o profissional recebe — as taxas da oferta são zero", () => {
    expect(TAXAS_DA_OFERTA).toEqual({ cliente: 0, profissional: 0 });
    expect(quantoOProfissionalRecebe(250, TAXAS_DA_OFERTA)).toBe(250);
  });
});

describe("o profissional responde", () => {
  it("a oferta nasce com a proposta da CLYON pendente, do lado de quem paga", () => {
    expect(propostasDaOferta(250, AGORA)).toEqual([
      { por: "cliente", valor: 250, criadaEm: AGORA, estado: "pendente" },
    ]);
  });

  it("não há propostas: só aceitar ou recusar", () => {
    expect(responderAOferta(ofertaNova(), "propor", AGORA)).toEqual({ ok: false, erro: SO_ACEITAR_OU_RECUSAR });
  });

  it("aceitar deixa-o à espera da escolha, com o valor fixo como acordado", () => {
    const r = responderAOferta(ofertaNova(250), "aceitar", AGORA);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.negociacao.estado).toBe("aguarda_contratacao");
    expect(r.negociacao.valorAcordado).toBe(250);
    // E a escolha da CLYON é o «contratar» de sempre.
    const escolhido = contratar(r.negociacao, AGORA);
    expect(escolhido.ok && escolhido.negociacao.estado).toBe("acordada");
  });

  it("recusar é desistir", () => {
    for (const accao of ["desistir", "recusar"]) {
      const r = responderAOferta(ofertaNova(), accao, AGORA);
      expect(r.ok && r.negociacao.estado).toBe("desistida");
    }
  });

  it("só a directa fecha ao aceitar — a escolha já estava feita", () => {
    expect(aceitarFechaLogo("directa")).toBe(true);
    expect(aceitarFechaLogo("distribuida")).toBe(false);
    expect(modoDaOferta("directa")).toBe("directa");
    expect(modoDaOferta("outra")).toBeNull();
    expect(modoDaOferta(null)).toBeNull();
  });
});

describe("em que pé está cada trabalho", () => {
  const neg = (o: Partial<NegociacaoDaOferta>): NegociacaoDaOferta => ({
    negociacaoId: 1,
    providerId: 1,
    profissional: "João",
    estado: "aberta",
    modo: "distribuida",
    atribuidaEm: null,
    execucaoEnviadaEm: null,
    confirmadoEm: null,
    pagoEm: null,
    ...o,
  });

  it("ninguém respondeu", () => {
    expect(resumoDaOferta([neg({}), neg({ negociacaoId: 2 })]).fase).toBe("a_espera");
  });

  it("há quem aceite: falta escolher", () => {
    const r = resumoDaOferta([
      neg({}),
      neg({ negociacaoId: 2, estado: "aguarda_contratacao" }),
      neg({ negociacaoId: 3, estado: "desistida" }),
    ]);
    expect(r.fase).toBe("escolher");
    expect(r.interessados.map((n) => n.negociacaoId)).toEqual([2]);
    expect(r.recusaram).toBe(1);
    expect(r.enviados).toBe(3);
  });

  it("todos recusaram", () => {
    expect(resumoDaOferta([neg({ estado: "desistida" }), neg({ negociacaoId: 2, estado: "desistida" })]).fase).toBe(
      "sem_ninguem",
    );
  });

  it("do atribuído ao pago", () => {
    const dia = "2026-10-02T10:00:00Z";
    expect(resumoDaOferta([neg({ estado: "acordada" }), neg({ negociacaoId: 2, estado: "morta" })]).fase).toBe(
      "atribuida",
    );
    expect(resumoDaOferta([neg({ estado: "acordada", execucaoEnviadaEm: dia })]).fase).toBe("por_confirmar");
    expect(resumoDaOferta([neg({ estado: "acordada", execucaoEnviadaEm: dia, confirmadoEm: dia })]).fase).toBe(
      "confirmada",
    );
    expect(
      resumoDaOferta([neg({ estado: "acordada", execucaoEnviadaEm: dia, confirmadoEm: dia, pagoEm: dia })]).fase,
    ).toBe("paga");
  });
});

describe("a carteira: quem paga é a CLYON", () => {
  const trabalho = (o: Partial<TrabalhoNaCarteira> = {}): TrabalhoNaCarteira => ({
    negociacaoId: 1,
    estado: "acordada",
    valorAcordado: 250,
    taxaCliente: 0,
    taxaProfissional: 0,
    formaDePagamento: "na_plataforma",
    execucaoEnviadaEm: "2026-10-03T10:00:00Z",
    confirmadoEm: "2026-10-03T12:00:00Z",
    pagoEm: null,
    clientePagouEm: null,
    // Depois do corte: a carteira pergunta se o cliente pagou.
    negociacaoCriadaEm: "2026-10-02T09:00:00Z",
    ...o,
  });

  it("sem a marca, um trabalho novo confirmado e não pago fica por cobrar", () => {
    expect(destinoDoValorConcluido(trabalho(), { aPlataformaCobra: false })).toBe("por_cobrar");
  });

  it("um trabalho CLYON confirmado fica disponível — não há pagamento do cliente por esperar", () => {
    expect(destinoDoValorConcluido(trabalho({ pagoPelaClyon: true }), { aPlataformaCobra: false })).toBe("disponivel");
  });
});

describe("o que se diz ao profissional", () => {
  const base = {
    pedidoId: 410,
    localidade: "Sintra",
    servico: "recolha_entulho",
    descricao: "Dez sacos de entulho na garagem.",
    urgencia: null,
    distanciaKm: 12,
    valor: 250,
    link: "https://clyon.pt/profissionais/pedidos/abc",
  };

  it("a oferta distribuída: valor fixo, só aceitar ou recusar, e a CLYON escolhe", () => {
    const t = avisoDeOfertaAoProfissional("João Lima", { ...base, modo: "distribuida" }, AGORA);
    expect(t).toContain("trabalho oferecido pela CLYON");
    expect(t).toContain("Valor fixo: recebe 250,00 €. Não há propostas — só aceitar ou recusar.");
    expect(t).toContain("a CLYON escolhe e avisa");
    expect(t).toContain("#410");
    expect(t).toContain(base.link);
    expect(t).toContain(COMO_SE_SAI);
    expect(t).not.toContain("Lima");
  });

  it("a directa: se aceitar, é seu", () => {
    const t = avisoDeOfertaAoProfissional("João", { ...base, modo: "directa" }, AGORA);
    expect(t).toContain("Foi escolhido pela CLYON para este trabalho: se aceitar, é seu.");
  });

  it("a escolha: o trabalho é seu", () => {
    const t = avisoDeEscolhaAoProfissional(
      "João",
      { pedidoId: 410, servico: "recolha_entulho", localidade: "Sintra", valor: 250, link: "https://clyon.pt/profissionais/painel" },
      AGORA,
    );
    expect(t).toContain("O trabalho é seu");
    expect(t).toContain("250,00 €");
  });

  it("o histórico diz que foi a CLYON a oferecer, e a confirmar", () => {
    const h = historicoDaNegociacao(propostasDaOferta(250, AGORA), { confirmadoEm: "2026-10-03T12:00:00Z", valorAcordado: 250 }, "profissional", true);
    expect(h.map((e) => e.texto)).toEqual(["A CLYON ofereceu (valor fixo)", "A CLYON confirmou. O valor ficou disponível"]);
    const normal = historicoDaNegociacao(propostasDaOferta(250, AGORA), {}, "profissional");
    expect(normal[0].texto).toBe("O cliente propôs");
  });
});

describe("as peças estão ligadas", () => {
  const DB = semNotas(ler("src/lib/db.ts"));
  const ROTA = semNotas(ler("src/app/api/admin/trabalhos-clyon/route.ts"));

  it("oferecer não manda o link ao cliente, e distribui com a oferta", () => {
    expect(ROTA).not.toContain("enviarLinkDoPedido");
    expect(ROTA).toContain("{ soPara, oferta: { valor: valor.valor, modo } }");
    expect(ROTA).toContain('const modo: ModoDaOferta = soPara?.length === 1 ? "directa" : "distribuida";');
    expect(ROTA).toContain("marcarPedidoComoOfertaClyon(pedidoId, valor.valor)");
  });

  it("a negociação nasce com as taxas da oferta e o modo escrito", () => {
    const i = DB.indexOf("export async function criarNegociacao(");
    const corpo = DB.slice(i, DB.indexOf("export async function negociacaoPorTokenHash("));
    expect(corpo).toContain("const taxas = dados.oferta\n    ? dados.oferta.taxas");
    expect(corpo).toContain("dados.oferta?.modo ?? null");
    expect(semNotas(ler("src/lib/distribuir-pedido.ts"))).toContain(
      "oferta: oferta ? { modo: oferta.modo, taxas: TAXAS_DA_OFERTA } : undefined",
    );
  });

  it("a escolha é uma transacção que prende o pedido ANTES das negociações", () => {
    const i = DB.indexOf("export async function atribuirOfertaClyon(");
    const corpo = DB.slice(i, DB.indexOf("export type OfertaClyonNaBase"));
    const pedido = corpo.indexOf("SELECT id FROM simulatorOrders WHERE id = ? FOR UPDATE");
    const negociacoes = corpo.indexOf("WHERE pedidoId = ? FOR UPDATE");
    expect(corpo).toContain("await conn.beginTransaction();");
    expect(pedido).toBeGreaterThan(0);
    expect(negociacoes).toBeGreaterThan(pedido);
    expect(corpo).toContain('if (linhas.some((l) => l.estado === "acordada")) return await desistir("ja_atribuida");');
    expect(corpo).toContain("SET estado = 'acordada', atribuidaEm = NOW()");
    expect(corpo).toContain("SET estado = 'morta'");
    expect(corpo).toContain("await conn.commit();");
  });

  it("as duas portas do profissional respondem à oferta antes do motor das propostas", () => {
    for (const f of ["src/app/api/profissionais/negociacao/route.ts", "src/app/api/negociacao/[token]/route.ts"]) {
      const src = semNotas(ler(f));
      const oferta = src.indexOf("await responderOfertaClyon({");
      const motor = src.indexOf("switch (corpo.accao) {\n");
      expect(oferta, f).toBeGreaterThan(0);
      expect(oferta, f).toBeLessThan(motor);
    }
  });

  it("o lado do cliente não mexe num trabalho CLYON", () => {
    const TOKEN = semNotas(ler("src/app/api/negociacao/[token]/route.ts"));
    expect(TOKEN).toContain('if (modoOferta && lado === "cliente") {');
    expect(semNotas(ler("src/app/api/users/me/negociacao/route.ts"))).toContain("if (linha.ofertaClyon) {");
    const CONTA = semNotas(ler("src/app/api/users/me/orders/route.ts"));
    expect(CONTA).toContain("(o.valorFixoClyon IS NOT NULL) AS trabalhoClyon");
    // A coluna só entra como marca (IS NOT NULL) — nunca como valor que saia para o cliente.
    expect(CONTA).not.toMatch(/o\.valorFixoClyon\s*(,|AS\b)/);
    expect(CONTA).toContain("Number(r.trabalhoClyon) === 1 ? [] :");
    expect(CONTA).toContain("historyJson: Number(r.trabalhoClyon) === 1 ? null : r.historyJson");
  });

  it("o cliente não recebe o pedido de confirmação, nem o assistente", () => {
    const FEITO = semNotas(ler("src/app/api/profissionais/trabalho/route.ts"));
    expect(FEITO).toContain("if (doPedido?.contactEmail && !eOfertaClyon) {");
    expect(DB).toContain("AND o.valorFixoClyon IS NULL");
    const NEG = semNotas(ler("src/lib/whatsapp-negociacao.ts"));
    const corpo = NEG.slice(NEG.indexOf("export async function tratarMensagemDoCliente("));
    expect(corpo.indexOf("pedidoClyonActivoDoTelefone(telefone)")).toBeLessThan(
      corpo.indexOf("pedidosDoTelefone(telefone)"),
    );
  });

  it("a carteira recebe a marca", () => {
    expect(semNotas(ler("src/lib/carteira-do-profissional.ts"))).toContain(
      'pagoPelaClyon: typeof l.ofertaClyon === "string" && l.ofertaClyon !== "",',
    );
    expect(semNotas(ler("src/lib/carteira.ts"))).toContain("if (t.pagoPelaClyon) return true;");
  });

  it("o ecrã do profissional desvia antes de qualquer outro return, e a oferta não tem hooks", () => {
    const UI = semNotas(ler("src/app/profissionais/pedidos/[token]/NegociacaoProfissional.tsx"));
    const desvio = UI.indexOf("if (ofertaClyon) {");
    const primeiroReturn = UI.indexOf('if (negociacao.estado === "acordada") {');
    expect(desvio).toBeGreaterThan(0);
    expect(desvio).toBeLessThan(primeiroReturn);
    const filho = UI.slice(UI.indexOf("function OfertaDaClyon("));
    expect(filho).not.toMatch(/use(State|Effect|Memo|Callback)\(/);
    expect(filho).toContain("Aceitar por {v}");
    expect(filho).not.toContain("propor");
  });

  it("as Carteiras do backoffice não inventam o que o cliente pagou, nem o somam ao faturado", () => {
    const ROTA_CARTEIRAS = semNotas(ler("src/app/api/admin/carteiras/route.ts"));
    expect(ROTA_CARTEIRAS).toContain("n.ofertaClyon,");
    expect(ROTA_CARTEIRAS.match(/if \(!trabalhoClyon\) clyon\.faturado/g)?.length).toBe(3);
    expect(ROTA_CARTEIRAS).not.toMatch(/\n\s*clyon\.faturado = /);
    expect(ler("src/components/admin/AdminCarteirasPanel.tsx")).toContain('"trabalho CLYON · valor fixo"');
  });

  it("e a página está no menu do backoffice", () => {
    const LEGACY = ler("src/components/admin/LegacyAdminClient.tsx");
    expect(LEGACY).toContain('{ id: "trabalhos_clyon", icon: Briefcase }');
    expect(LEGACY).toContain('trabalhos_clyon: "Trabalhos CLYON"');
    expect(LEGACY).toContain("<AdminTrabalhosClyonPanel />");
  });
});
