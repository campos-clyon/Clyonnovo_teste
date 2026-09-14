import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  FICHA_DO_AVISO,
  comoFicaRegistado,
  porGravidade,
  precisaDeConfirmacao,
} from "./avisos-antes-de-cotar";
import { avisosDoTrabalho } from "./profissional-elegivel";

/**
 * A FATURA E A GUIA DEIXARAM DE ESCONDER O PEDIDO.
 *
 * "Muitos pedidos não estão a aparecer para todos por causa da fatura e da
 * guia. Que tal usarmos apenas o raio de acção e as categorias como
 * referência para o pedido aparecer, e caso ele não emita fatura e o pedido
 * tenha essa opção, antes de enviar aparece a mensagem em amarelo." —
 * 14-09-2026.
 *
 * Eram filtros cegos: quem não tinha a caixa marcada nunca via o pedido e nem
 * sabia que ele existira. A maioria emite fatura e simplesmente nunca passou
 * por aquele campo do perfil — e o cliente ficava com menos propostas, às
 * vezes com nenhuma, por causa de uma caixa por marcar.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const ROTA = ler("src/app/api/profissionais/negociacao/route.ts");
const ECRA = ler("src/app/profissionais/pedidos/[token]/NegociacaoProfissional.tsx");
const ELEGIVEL = ler("src/lib/profissional-elegivel.ts");

const pro = (x: Partial<Parameters<typeof avisosDoTrabalho>[1]> = {}) => ({
  emiteFatura: true,
  emiteGuiaTransporte: true,
  guiaVerificadaEm: new Date("2026-08-01"),
  ...x,
});

describe("quando é que se avisa", () => {
  it("o cliente pediu fatura e ele não a marcou", () => {
    expect(
      avisosDoTrabalho({ precisaFatura: true, precisaGuiaTransporte: false }, pro({ emiteFatura: false })),
    ).toEqual(["cliente_quer_fatura"]);
  });

  it("quem a emite não leva aviso nenhum", () => {
    expect(
      avisosDoTrabalho({ precisaFatura: true, precisaGuiaTransporte: false }, pro()),
    ).toEqual([]);
  });

  it("a guia declarada mas POR VERIFICAR conta como em falta", () => {
    // A declaração sozinha não vale nada — e é pior do que não existir,
    // porque o cliente confia nela.
    expect(
      avisosDoTrabalho(
        { precisaFatura: false, precisaGuiaTransporte: true },
        pro({ guiaVerificadaEm: null }),
      ),
    ).toEqual(["trabalho_exige_guia"]);
  });

  it("os dois ao mesmo tempo, com o mais sério em cima", () => {
    const avisos = avisosDoTrabalho(
      { precisaFatura: true, precisaGuiaTransporte: true },
      pro({ emiteFatura: false, emiteGuiaTransporte: false }),
    );
    expect(avisos).toHaveLength(2);
    expect(porGravidade(avisos)[0]).toBe("trabalho_exige_guia");
  });

  it("um pedido que não pede nada não avisa nada", () => {
    expect(
      avisosDoTrabalho(
        { precisaFatura: false, precisaGuiaTransporte: false },
        pro({ emiteFatura: false, emiteGuiaTransporte: false, guiaVerificadaEm: null }),
      ),
    ).toEqual([]);
    expect(precisaDeConfirmacao([])).toBe(false);
    expect(precisaDeConfirmacao(null)).toBe(false);
  });
});

describe("a frase — o que ela tem de responder", () => {
  /*
   * "Pode melhorar a frase para ser mais completa e informativa." Melhorar
   * aqui não é escrever mais bonito: é responder às três perguntas que a frase
   * curta deixa em aberto, e que ele ia ter de responder ao telefone.
   */
  const fatura = FICHA_DO_AVISO.cliente_quer_fatura;
  const guia = FICHA_DO_AVISO.trabalho_exige_guia;

  it("1. diz o que o cliente pediu", () => {
    expect(fatura.corpo).toContain("fatura com NIF");
    expect(guia.corpo).toContain("guia de acompanhamento");
  });

  it("2. diz o que acontece se continuar", () => {
    // Não basta perguntar «deseja continuar?»: continuar tem consequências,
    // e quem decide tem de as saber antes e não depois.
    expect(fatura.corpo).toContain("o cliente vai esperar fatura no fim");
    expect(guia.corpo).toContain("a coima é sua");
  });

  it("3. diz ONDE se corrige — porque quase sempre é só a caixa por marcar", () => {
    /*
     * Sem isto ele carrega em «continuar» todas as vezes e o campo do perfil
     * fica errado para sempre — e o aviso passa a ser ruído que se despacha
     * sem ler, que é o pior fim de um aviso.
     */
    expect(fatura.ondeSeCorrige).toContain("Faturação e IVA");
    expect(guia.ondeSeCorrige).toContain("Guia de transporte");
  });

  it("o botão diz o que faz, e não «OK»", () => {
    expect(fatura.botao).toBe("Emito fatura — continuar");
    expect(guia.botao).toBe("Sou transportador registado — continuar");
  });

  it("as duas NÃO pesam o mesmo, e o texto não finge que sim", () => {
    /*
     * A fatura é uma preferência comercial do cliente. A guia é uma exigência
     * legal de quem transporta resíduos — continuar sem ela não é um risco de
     * negócio, é um risco de coima, e para o cliente também.
     */
    expect(fatura.gravidade).toBe("aviso");
    expect(guia.gravidade).toBe("serio");
    expect(guia.corpo).toContain("fica registado no pedido");
  });
});

describe("o rasto de quem foi avisado", () => {
  it("escreve quem, de quê, e que avançou", () => {
    // É por isto que o aviso da guia pode prometer que fica registado. Sem
    // rasto, a frase era só uma frase.
    const linha = comoFicaRegistado(["cliente_quer_fatura", "trabalho_exige_guia"], "Revolution");
    expect(linha).toContain("Revolution");
    expect(linha).toContain("exige guia de transporte");
    expect(linha).toContain("o cliente pediu fatura");
    expect(linha).toContain("avançou com a proposta");
  });
});

describe("as ligações — onde isto acontece de verdade", () => {
  it("o pedido deixa de ser escondido: só raio e categorias", () => {
    const i = ELEGIVEL.indexOf("export function avaliarElegibilidade");
    const corpo = ELEGIVEL.slice(i, ELEGIVEL.indexOf("export function avisosDoTrabalho"));
    // Os motivos que restam são os que dizem que o trabalho não lhe serve.
    expect(corpo).toContain("categoria_diferente");
    expect(corpo).toContain("fora_de_alcance");
    expect(corpo).not.toContain('motivos.push("nao_emite_fatura")');
    expect(corpo).not.toContain('motivos.push("nao_emite_guia")');
  });

  it("a conta dos avisos vive num sítio só, com dois chamadores", () => {
    /*
     * A distribuição mostra-os ao administrador; a rota da proposta pára o
     * envio com eles. Se um calculasse por sua conta, o ecrã do profissional
     * avisava de uma coisa e o do administrador de outra.
     */
    expect(ELEGIVEL).toContain("export function avisosDoTrabalho");
    expect(ROTA).toContain("avisosDoTrabalho");
  });

  it("o servidor manda — não se fia no que o browser diz", () => {
    // O `avisosAceites` só diz que o ecrã os mostrou. Quais eram, e se ainda
    // são, decide-se no servidor.
    expect(ROTA).toContain("perfilDoProfissional(sessao.providerId)");
    expect(ROTA).toContain('corpo.avisosAceites !== true');
    expect(ROTA).toContain("status: 409");
  });

  it("só pára ao propor e ao aceitar — desistir nunca se pergunta duas vezes", () => {
    expect(ROTA).toContain('corpo.accao === "propor" || corpo.accao === "aceitar"');
  });

  it("e fica no histórico do pedido quem avançou mesmo assim", () => {
    expect(ROTA).toContain("comoFicaRegistado");
    expect(ROTA).toContain("aviso_aceite_pelo_profissional");
  });

  it("o ecrã pinta a caixa e repete a acção com o MESMO valor", () => {
    /*
     * Voltar a escrever o número depois de ler o aviso é o género de passo em
     * que se engana um dígito — e o dígito enganado é uma proposta a sério.
     */
    expect(ECRA).toContain("setPorConfirmar({ accao, valor: valorProposto, avisos: dados.avisos })");
    expect(ECRA).toContain("agir(porConfirmar.accao, porConfirmar.valor, true)");
    expect(ECRA).toContain("Não avançar");
  });
});
