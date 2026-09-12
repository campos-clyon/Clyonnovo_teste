import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  oQueFaltaNoPerfil,
  resumoDoPerfil,
  faltasDaSeccao,
  faltaPelaChave,
  type PerfilParaCompletar,
} from "./perfil-por-completar";
import { PASSOS_DO_PROFISSIONAL, passoDaSeccao } from "./como-funciona-para-o-profissional";
import { MAX_PROPOSTAS_POR_LADO, PRAZO_DA_PROPOSTA_HORAS } from "./negociacao";
import { A_PLATAFORMA_COBRA, PROMESSA } from "./pagamento-na-plataforma";
import { RAIO_POR_OMISSAO_KM } from "./inscricao-profissional";

/**
 * O perfil a meio, e o triângulo que o diz.
 *
 * "Crie sugestões para os pros concluírem os perfis e responderem/preencherem
 * todos os campos; coloque um ! com borda triangular sugerindo que falta
 * finalizar." — 10-09-2026.
 *
 * O que estes testes guardam é a diferença entre um travão e uma dica. Se um
 * dia a margem por escolher passar a gritar como o IBAN em falta, o cartão
 * deixa de se ler — e no dia em que faltar mesmo o IBAN já ninguém olha.
 */

const CHEIO: PerfilParaCompletar = {
  nome: "Uma empresa",
  telefone: "912345678",
  cidade: "Seixal",
  baseLat: 38.6,
  baseLng: -9.1,
  nif: "500000000",
  moradaFiscal: "Rua de cima, 3",
  codigoPostalFiscal: "2845-000",
  localidadeFiscal: "Amora",
  categorias: ["recolha_moveis"],
  raioKm: 30,
  custoKm: 0.5,
  custoHoraPessoa: 8,
  pessoasNaEquipa: 2,
  horasPorTrabalho: 2,
  custosFixosAnuais: { viaVerde: 3000, manutencao: 1000, iuc: 100, inspecao: 100, seguro: 700 },
  trabalhosPorMes: 20,
  margemPercent: 40,
  riscoPercent: 5,
  emiteGuiaTransporte: false,
  numeroTransportador: "",
  temIban: true,
  ibanTitular: "Uma empresa",
  mbway: "",
};

const chaves = (p: PerfilParaCompletar) => oQueFaltaNoPerfil(p).map((f) => f.chave);

describe("um perfil inteiro não tem nada a dizer", () => {
  it("sem faltas, e a cem por cento", () => {
    const r = resumoDoPerfil(CHEIO);
    expect(r.faltas).toEqual([]);
    expect(r.completo).toBe(true);
    expect(r.percentagem).toBe(100);
  });
});

describe("o que trava vem primeiro", () => {
  const vazio = resumoDoPerfil({});

  it("sem categorias não chega pedido nenhum, e isso é um travão", () => {
    const f = faltaPelaChave(vazio.faltas, "categorias");
    expect(f?.peso).toBe("essencial");
    expect(f?.porque).toContain("não lhe chega pedido nenhum");
  });

  it("a base sem ponto no mapa também — é dela que se medem as distâncias", () => {
    expect(faltaPelaChave(vazio.faltas, "base-no-mapa")?.peso).toBe("essencial");
  });

  it("sem raio não chega pedido nenhum, e o cartão tem de o dizer", () => {
    /*
     * `avaliarElegibilidade` trata raio nulo exactamente como «longe demais»:
     * exclui. Uma conta sem raio não recebe pedido nenhum, para sempre.
     *
     * Custou sete profissionais aprovados e pedidos a chegar a três
     * (12-09-2026): as contas criadas a partir de candidaturas nasciam sem
     * raio, porque a candidatura não o pergunta — e este cartão, que existe
     * para dizer o que trava, também não.
     */
    const f = faltaPelaChave(vazio.faltas, "raio");
    expect(f?.peso).toBe("essencial");
    expect(f?.porque).toContain("não lhe chega pedido nenhum");
    expect(faltaPelaChave(oQueFaltaNoPerfil({ ...CHEIO, raioKm: 125 }), "raio")).toBeUndefined();
  });

  it("uma conta nova nasce com raio, e não com nulo", () => {
    // A aprovação de uma candidatura grava `RAIO_POR_OMISSAO_KM`. Se voltar a
    // gravar nulo, a conta é aprovada e não recebe nada — em silêncio.
    // Lido aqui em vez de pelo `ler` lá de baixo: este bloco corre antes dele
    // no ficheiro, e uma referência para a frente lê-se mal.
    const ROTA = readFileSync(
      join(process.cwd(), "src/app/api/admin/candidaturas/route.ts"),
      "utf8",
    );
    expect(ROTA).toContain("raioKm: RAIO_POR_OMISSAO_KM");
    expect(ROTA).not.toContain("raioKm: null");
    expect(RAIO_POR_OMISSAO_KM).toBeGreaterThan(0);
  });

  it("os essenciais estão todos à frente das melhorias na lista", () => {
    const pesos = vazio.faltas.map((f) => f.peso);
    const ultimoEssencial = pesos.lastIndexOf("essencial");
    const primeiraMelhora = pesos.indexOf("melhora");
    expect(ultimoEssencial).toBeLessThan(primeiraMelhora);
  });

  it("os custos por preencher NÃO são travão: a conta funciona com a referência", () => {
    for (const chave of ["custo-km", "custo-hora", "pessoas", "horas", "margem", "risco"]) {
      expect(faltaPelaChave(vazio.faltas, chave)?.peso, chave).toBe("melhora");
    }
  });
});

describe("as perguntas que só existem depois de uma resposta", () => {
  it("o número de transportador só se pergunta a quem disse que emite guia", () => {
    expect(chaves({ ...CHEIO, emiteGuiaTransporte: false })).not.toContain("numero-transportador");
    expect(chaves({ ...CHEIO, emiteGuiaTransporte: true, numeroTransportador: "" })).toContain(
      "numero-transportador",
    );
  });

  it("o titular só se pergunta a quem tem IBAN", () => {
    expect(chaves({ ...CHEIO, temIban: false, mbway: "912345678", ibanTitular: "" })).not.toContain(
      "titular",
    );
    expect(chaves({ ...CHEIO, ibanTitular: "" })).toContain("titular");
  });

  it("os trabalhos por mês só fazem falta depois de haver custos fixos", () => {
    const semCustos = { ...CHEIO, custosFixosAnuais: null, trabalhosPorMes: null };
    expect(chaves(semCustos)).toContain("custos-fixos");
    expect(chaves(semCustos)).not.toContain("trabalhos-por-mes");
    expect(chaves({ ...CHEIO, trabalhosPorMes: null })).toContain("trabalhos-por-mes");
  });

  it("e o denominador cresce com elas — responder «sim» não sobe a percentagem", () => {
    const naoEmite = resumoDoPerfil({ ...CHEIO, emiteGuiaTransporte: false });
    const emite = resumoDoPerfil({ ...CHEIO, emiteGuiaTransporte: true, numeroTransportador: "" });
    expect(emite.total).toBe(naoEmite.total + 1);
    expect(emite.percentagem).toBeLessThan(100);
  });
});

describe("zero é uma resposta, vazio não é", () => {
  it("«não pago IUC» conta como preenchido", () => {
    const so = { ...CHEIO, custosFixosAnuais: { iuc: 0 } };
    expect(chaves(so)).not.toContain("custos-fixos");
  });

  it("uma margem de 0 % é uma decisão dele, e não uma falta", () => {
    expect(chaves({ ...CHEIO, margemPercent: 0 })).not.toContain("margem");
    expect(chaves({ ...CHEIO, margemPercent: null })).toContain("margem");
  });

  it("um seguro de risco a 0 % também", () => {
    expect(chaves({ ...CHEIO, riscoPercent: 0 })).not.toContain("risco");
    expect(chaves({ ...CHEIO, riscoPercent: null })).toContain("risco");
  });

  it("mas um custo por km a zero não é um custo — é um campo por preencher", () => {
    expect(chaves({ ...CHEIO, custoKm: 0 })).toContain("custo-km");
  });
});

describe("o IBAN e o MB WAY são dois caminhos para a mesma coisa", () => {
  it("ter um deles chega", () => {
    expect(chaves({ ...CHEIO, temIban: false, ibanTitular: "", mbway: "912345678" })).not.toContain(
      "onde-receber",
    );
  });

  it("não ter nenhum é um travão", () => {
    const f = faltaPelaChave(
      oQueFaltaNoPerfil({ ...CHEIO, temIban: false, ibanTitular: "", mbway: "" }),
      "onde-receber",
    );
    expect(f?.peso).toBe("essencial");
  });

  it("e a razão é a mesma que a carteira dá — não promete que a CLYON tem o dinheiro", () => {
    /*
     * Enquanto `A_PLATAFORMA_COBRA` for falso, o cliente paga ao profissional.
     * Um aviso a dizer «não temos para onde lhe enviar o dinheiro dos
     * trabalhos» punha a CLYON a receber o que não recebe.
     */
    const f = faltaPelaChave(
      oQueFaltaNoPerfil({ ...CHEIO, temIban: false, ibanTitular: "", mbway: "" }),
      "onde-receber",
    );
    expect(A_PLATAFORMA_COBRA).toBe(false);
    expect(f?.porque).toBe("Sem um destes não há para onde transferir o seu saldo.");
  });
});

describe("cada falta sabe onde se resolve", () => {
  it("as secções são as do menu, e nenhuma falta fica órfã", () => {
    const todas = oQueFaltaNoPerfil({});
    const seccoes = ["dados", "servicos", "faturacao", "banco"] as const;
    const arrumadas = seccoes.flatMap((s) => faltasDaSeccao(todas, s));
    expect(arrumadas).toHaveLength(todas.length);
  });

  it("nenhuma razão diz «é obrigatório» — diz o que acontece", () => {
    for (const f of oQueFaltaNoPerfil({})) {
      expect(f.porque.toLowerCase(), f.chave).not.toContain("obrigatório");
      // Uma razão que não cabe numa linha não é lida em telemóvel nenhum.
      expect(f.porque.length, f.chave).toBeLessThan(230);
    }
  });
});

describe("o «como funciona» diz o mesmo aos dois lados", () => {
  it("são seis passos, do pedido ao dinheiro", () => {
    expect(PASSOS_DO_PROFISSIONAL).toHaveLength(6);
    expect(PASSOS_DO_PROFISSIONAL[0].chave).toBe("chegam");
    expect(PASSOS_DO_PROFISSIONAL[PASSOS_DO_PROFISSIONAL.length - 1].chave).toBe("recebe");
  });

  it("os números vêm das constantes, e não escritos à mão", () => {
    const propostas = PASSOS_DO_PROFISSIONAL.find((p) => p.chave === "propostas");
    expect(propostas?.texto).toContain(`${MAX_PROPOSTAS_POR_LADO} propostas`);
    expect(propostas?.texto).toContain(`${PRAZO_DA_PROPOSTA_HORAS} horas`);
  });

  it("o passo do dinheiro lê a fonte única, e não uma frase escrita à mão", () => {
    /*
     * Assim o passo acompanha o interruptor: no dia em que a cobrança
     * existir, esta frase muda sozinha nos dois ecrãs e neste teste.
     */
    const recebe = PASSOS_DO_PROFISSIONAL.find((p) => p.chave === "recebe");
    expect(recebe?.texto).toContain(PROMESSA.proComoRecebe);
    if (!A_PLATAFORMA_COBRA) {
      expect(recebe?.texto).toContain("Quem lhe paga é o cliente");
      expect(recebe?.texto).not.toContain("fica retido");
    }
  });

  it("o passo da sugestão manda para os custos, que é onde se resolve", () => {
    expect(passoDaSeccao("servicos")?.chave).toBe("chegam");
    expect(PASSOS_DO_PROFISSIONAL.find((p) => p.chave === "sugestao")?.seccao).toBe("servicos");
  });
});

// ── O que os ecrãs fazem com isto ──────────────────────────────────────────

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const PORTAL = ler("src/components/portal/Portal.tsx");
const PAINEL = ler("src/app/profissionais/painel/PainelDoProfissional.tsx");
const PERFIL = ler("src/app/profissionais/painel/Perfil.tsx");
const CARTAO = ler("src/app/profissionais/painel/PerfilPorCompletar.tsx");
const PUBLICA = ler("src/app/quero-ser-parceiro/page.tsx");

describe("o sinal é um triângulo com um «!», e é o mesmo em todo o lado", () => {
  it("o portal exporta-o, e usa o ícone do triângulo", () => {
    expect(PORTAL).toContain("export function PorPreencher");
    expect(PORTAL).toContain("AlertTriangle");
    // Âmbar e não vermelho: isto está por acabar, não estragado.
    expect(PORTAL).toContain("text-amber-600");
  });

  it("não é só um desenho: quem ouve o ecrã recebe a mesma coisa", () => {
    expect(PORTAL).toContain("Por preencher: {dica}");
  });

  it("a linha do menu mostra quantos campos faltam naquela secção", () => {
    expect(PORTAL).toContain("porCompletar");
    for (const s of ["dados", "servicos", "faturacao", "banco"]) {
      expect(PAINEL, s).toContain(`porCompletar={quantasFaltam("${s}")}`);
    }
  });
});

describe("o painel conta uma vez e mostra em quatro sítios", () => {
  it("o cartão nasce do mesmo resumo que os triângulos", () => {
    expect(PAINEL).toContain("resumoDoPerfil(perfil)");
    expect(PAINEL).toContain("<PerfilPorCompletar");
  });

  it("sem perfil carregado não há cartão — nem um susto durante o carregamento", () => {
    expect(PAINEL).toContain("perfil ? resumoDoPerfil(perfil) : null");
  });

  it("o cartão desaparece sozinho quando não falta nada", () => {
    expect(CARTAO).toContain("if (resumo.completo) return null");
  });

  it("as melhorias nascem fechadas quando há travões por resolver", () => {
    expect(CARTAO).toContain("essenciais.length > 0 ? essenciais : melhorias.slice(0, 2)");
  });

  it("há um ecrã que explica, e chega-se lá pelo menu", () => {
    expect(PAINEL).toContain('rotulo="Como funciona"');
    expect(PAINEL).toContain("<ComoFunciona");
  });
});

describe("dentro do ecrã, o triângulo está no campo certo", () => {
  it("a conta corre sobre o que ele está a escrever, e não sobre o gravado", () => {
    expect(PERFIL).toContain("oQueFaltaNoPerfil(dados)");
  });

  it("os campos dos custos levam o sinal, um a um", () => {
    for (const chave of ["custo-km", "custo-hora", "pessoas", "horas", "trabalhos-por-mes"]) {
      expect(PERFIL, chave).toContain(`falta("${chave}")`);
    }
  });

  it("e os que travam também", () => {
    for (const chave of ["base-no-mapa", "nif", "morada-fiscal", "onde-receber"]) {
      expect(PERFIL, chave).toContain(`porque("${chave}")`);
    }
  });
});

describe("quem ainda não entrou lê os mesmos passos", () => {
  it("a página pública mostra o «como funciona» do mesmo ficheiro", () => {
    expect(PUBLICA).toContain("PASSOS_DO_PROFISSIONAL");
    expect(PUBLICA).toContain("O_QUE_A_CLYON_NAO_FAZ");
  });

  it("nenhum exemplo do formulário é o nome de uma empresa a sério", () => {
    // "Mudanças Jorge existe e ele pode ver isso" — 10-09-2026.
    const FORM = ler("src/app/quero-ser-parceiro/FormularioDeCandidatura.tsx");
    expect(FORM).toContain('placeholder="Ex.: Transportes e Mudanças, Lda."');
    expect(FORM).not.toContain('placeholder="Ex.: Mudanças Jorge"');
    /*
     * O PLACEHOLDER, e não o ficheiro todo: o comentário que explica a
     * mudança nomeia o exemplo antigo, e é suposto nomeá-lo — é assim que
     * quem o ler daqui a um ano percebe porque é que não se volta atrás.
     */
    const INSCRICAO = ler("src/app/profissionais/InscricaoForm.tsx");
    expect(INSCRICAO).not.toContain('placeholder="Ex: Transportes Silva Lda"');
    expect(INSCRICAO).toContain('placeholder="Ex.: Transportes e Mudanças, Lda."');
  });
});
