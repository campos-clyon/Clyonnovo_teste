import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { paraOCampoDeData, doCampoParaInstante } from "./agenda-dos-trabalhos";

/**
 * ABRIR O PEDIDO A PARTIR DA AGENDA — e corrigi-lo ali.
 *
 * "Me dê acesso ao pedido, deixe-me abrir os detalhes dele como nome, número,
 * valor, profissional, data de agendamento — e a opção de editar essas
 * informações, inclusive a agenda com data e hora."
 *
 * A agenda foi feita para NÃO abrir nada: dois telefones por linha, porque
 * quem lá chega já sabe que vai ligar. Isso continua certo para a chamada e
 * ficou errado para o que vem a seguir — ele desliga com uma data nova na mão
 * e não tinha onde a pôr sem sair do ecrã e perder o sítio onde estava.
 */

const semComentarios = (f: string) =>
  f.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const lerNu = (p: string) => semComentarios(ler(p));

const FICHA = ler("src/components/admin/FichaDaAgenda.tsx");
const FICHA_NUA = lerNu("src/components/admin/FichaDaAgenda.tsx");
const PAINEL = ler("src/components/admin/AdminAgendaPanel.tsx");
const PAINEL_NU = lerNu("src/components/admin/AdminAgendaPanel.tsx");
const ROTA = ler("src/app/api/admin/agenda/route.ts");

describe("a linha da agenda abre a ficha", () => {
  it("toca-se em qualquer parte da linha, e também com o teclado", () => {
    expect(PAINEL_NU).toContain("onClick={() => setAVer(t.negociacaoId)}");
    expect(PAINEL_NU).toContain('e.key === "Enter"');
    expect(PAINEL_NU).toContain("tabIndex={0}");
  });

  it("os dois telefones continuam a UM toque", () => {
    /*
     * A razão de existir da lista não mudou: quem chega já sabe que vai ligar.
     * Sem o `stopPropagation`, tocar no telefone abria a ficha por cima da
     * chamada — a ficha teria roubado o lugar ao gesto principal.
     */
    const telefones = PAINEL_NU.split("href={`tel:").length - 1;
    expect(telefones).toBe(2);
    expect(PAINEL_NU.split("onClick={(e) => e.stopPropagation()}").length - 1).toBe(2);
  });

  it("a ficha lê-se da lista recarregada e não de uma cópia do clique", () => {
    // Guardar o objecto do momento do clique deixava a ficha a dizer 135 €
    // depois de ela própria os ter corrigido para 230 €.
    expect(PAINEL_NU).toContain("useState<number | null>(null)");
    expect(PAINEL_NU).toContain("trabalhos.find((x) => x.negociacaoId === aVer)");
  });

  it("gravar recarrega a lista sem a fazer piscar", () => {
    expect(PAINEL_NU).toContain("if (!silencioso) setACarregar(true)");
    expect(PAINEL_NU).toContain("onMudou={() => carregar(true)}");
  });

  it("a lista e a ficha partilham o tipo, em vez de o copiarem", () => {
    // Duas cópias divergem à primeira coluna nova, e a ficha abre sem ela.
    expect(PAINEL_NU).toContain("type Trabalho = TrabalhoDaAgenda");
  });
});

describe("a ficha mostra o que ele pediu para ver", () => {
  it("o número do pedido, o nome e o número do cliente", () => {
    expect(FICHA_NUA).toContain("#{t.pedidoId}");
    expect(FICHA_NUA).toContain("{t.clienteNome ?? \"Sem nome\"}");
    expect(FICHA_NUA).toContain("href={`tel:${t.clienteTelefone}`}");
  });

  it("o valor — e os dois números que saem dele", () => {
    /*
     * Do valor acordado saem outros dois que não são iguais a ele: o que o
     * profissional recebe (menos 5 %) e o que o cliente paga (mais a taxa e o
     * IVA). Sem os três à vista, corrige-se 135 para 230 sem reparar que a
     * transferência passou a ser de 218,50 €.
     */
    expect(FICHA_NUA).toContain("euros(t.valorAcordado)");
    expect(FICHA_NUA).toContain("euros(t.recebe)");
    expect(FICHA_NUA).toContain("euros(t.clientePaga)");
    expect(ROTA).toContain("quantoOProfissionalRecebe(Number(l.valorAcordado))");
    expect(ROTA).toContain("contaDoCliente(Number(l.valorAcordado), regimeDeIva(l.regimeIva))");
  });

  it("o profissional e o dia marcado", () => {
    expect(FICHA_NUA).toContain("{t.profissionalNome}");
    expect(FICHA_NUA).toContain("quandoPorExtenso(situacao, agora)");
  });

  it("diz quando o cliente pediu um dia e ficou combinado outro", () => {
    // É metade da razão de existir da agenda, e não se perde na ficha.
    expect(FICHA_NUA).toContain("O cliente tinha pedido");
  });
});

describe("editar a data e a hora", () => {
  it("o campo é o do selector nativo", () => {
    expect(FICHA_NUA).toContain('type="datetime-local"');
  });

  it("o campo é lido e escrito em hora de LISBOA, e não na de quem olha", () => {
    /*
     * Apanhou-se no ecrã, com o browser em Paris: o mesmo trabalho dizia
     * «hoje, às 08:30» no rótulo e 09:30 no campo logo por baixo — e bastava
     * carregar em Guardar sem lhe tocar para o adiantar uma hora a sério.
     *
     * `d.getHours()` dá a hora do relógio de quem está a olhar;
     * `toISOString().slice(0,16)` dá Greenwich. Nenhuma das duas é Lisboa, que
     * é onde o trabalho acontece e onde o resto da agenda toda é lida.
     */
    expect(FICHA).not.toContain("toISOString().slice(0, 16)");
    expect(FICHA).not.toContain("d.getHours()");
    expect(FICHA_NUA).toContain("paraOCampoDeData(t.dataCombinada ?? t.dataDoCliente)");
    expect(FICHA_NUA).toContain("doCampoParaInstante(quando)");
    // Sai daqui um instante exacto: o Node da Vercel lê "09:30" em Greenwich.
    expect(FICHA_NUA).toContain("instante.toISOString()");
  });

  it("dá para desmarcar o dia, e não só mudá-lo", () => {
    expect(FICHA_NUA).toContain("Desmarcar o dia");
    expect(FICHA_NUA).toContain("gravarData(true)");
  });

  it("escreve na MESMA data que o profissional marca — não numa segunda", () => {
    // Uma "data da CLYON" e uma "data do pro" acabavam a discordar no mesmo
    // ecrã, e nenhuma das duas seria a data do trabalho.
    expect(ROTA).toContain("UPDATE negociacoes SET dataCombinada = ? WHERE id = ?");
  });

  it("o que o cliente pediu no formulário fica intocado", () => {
    expect(ROTA).not.toContain("UPDATE simulatorOrders SET dataAgendada");
  });
});

describe("a rota que grava o dia pelo backoffice", () => {
  it("é só para quem entrou no backoffice", () => {
    expect(ROTA).toContain("const { err, colab } = await requireAdmin(req);");
  });

  it("recusa marcar o dia de um trabalho que ainda não é de ninguém", () => {
    // Enquanto se negoceia não há dia para marcar: há uma proposta à espera.
    expect(ROTA).toContain('linha.estado !== "acordada"');
    expect(ROTA).toContain("Só se marca o dia de um trabalho já contratado.");
  });

  it("vazio desmarca, em vez de dar erro", () => {
    expect(ROTA).toContain("let quando: Date | null = null;");
    expect(ROTA).toContain('Number.isNaN(d.getTime())');
  });

  it("tem tecto de dois anos — o ano 2206 escreve-se sem se dar por isso", () => {
    expect(ROTA).toContain("2 * 365 * 86_400_000");
    expect(ROTA).toContain("Confirme o ano.");
  });

  it("fica escrito quem mudou, e o profissional vê-o", () => {
    /*
     * Foi-lhe mudado o dia de trabalho por alguém que não é ele. Descobri-lo
     * ao chegar à porta não serve.
     */
    expect(ROTA).toContain('acontecimento: "agenda_marcada"');
    expect(ROTA).toContain("visivelProfissional: true");
    expect(ROTA).toContain("autorTipo: \"clyon\"");
    expect(ROTA).toContain("appendOrderHistory(linha.pedidoId");
  });

  it("um trabalho já fechado ainda se corrige — mas não em silêncio", () => {
    /*
     * Ao profissional recusa-se: depois da prova enviada, a data deixou de ser
     * um plano e passou a ser o registo do que aconteceu. O backoffice é
     * precisamente quem corrige o registo quando ficou errado.
     */
    expect(ROTA).toContain("ATENÇÃO: o trabalho já estava fechado.");
    expect(FICHA_NUA).toContain("é o registo do");
  });
});

describe("o resto do pedido abre o editor a sério", () => {
  it("o botão existe e leva o número do pedido", () => {
    expect(FICHA_NUA).toContain("onEditarPedido(t.pedidoId)");
    expect(PAINEL_NU).toContain("editarId={aEditarPedido}");
  });

  it("o editor abre POR CIMA da ficha, e fechá-lo devolve-a", () => {
    // Substituir a ficha pelo editor fazia perder o sítio de onde se saiu.
    expect(PAINEL_NU).toContain("z-[60]");
    expect(PAINEL_NU).toContain("setAEditarPedido(null)");
  });

  it("guardar ali não volta a pôr um trabalho contratado a circular", () => {
    // `recomecarDoZero` recusa quando há alguém contratado — e tudo o que
    // entra na agenda está contratado. A ficha diz isso a quem vai carregar.
    const RECOMECO = ler("src/lib/recomecar-do-zero.ts");
    expect(RECOMECO).toContain('porque: "trabalho_fechado"');
    expect(FICHA_NUA).toContain("não o volta a mandar aos");
  });
});

describe("nada disto fecha com um clique ao lado", () => {
  it("nem a ficha, nem o editor por cima dela", () => {
    /*
     * "Ao clicar sem querer fora dessa tela ela fecha e perco o que estava a
     * fazer." Há um campo de data e um campo de valor por gravar aqui dentro,
     * e a margem escura à volta é grande de propósito.
     */
    expect(FICHA).not.toContain("e.target === e.currentTarget");
    expect(PAINEL).not.toContain("e.target === e.currentTarget");
  });

  it("mas continua a haver por onde sair", () => {
    expect(FICHA_NUA).toContain("onClick={onFechar}");
    expect(FICHA_NUA).toContain("Fechar");
  });
});

/**
 * O FUSO DO CAMPO — as duas funções, a correr a sério.
 *
 * O resto deste ficheiro lê código; isto executa-o. É uma conta de horas, e
 * uma conta de horas ou dá o número certo ou não dá.
 */
describe("o campo da data vive em Lisboa", () => {
  it("mostra a hora de Lisboa, não a de quem está a olhar", () => {
    // 08:30 em Lisboa no Verão são 07:30 em Greenwich. Um portátil em Paris
    // (UTC+2) via 09:30 no campo e 08:30 no rótulo, no mesmo ecrã.
    expect(paraOCampoDeData("2026-08-31T07:30:00.000Z")).toBe("2026-08-31T08:30");
  });

  it("no Inverno, Lisboa é Greenwich", () => {
    expect(paraOCampoDeData("2026-01-15T09:00:00.000Z")).toBe("2026-01-15T09:00");
  });

  it("sem data, campo vazio — e não uma data inventada", () => {
    expect(paraOCampoDeData(null)).toBe("");
    expect(paraOCampoDeData("")).toBe("");
    expect(paraOCampoDeData("isto não é uma data")).toBe("");
  });

  it("o que se escreve às 09:30 fica gravado às 09:30 de Lisboa", () => {
    expect(doCampoParaInstante("2026-08-31T09:30")?.toISOString()).toBe(
      "2026-08-31T08:30:00.000Z",
    );
    expect(doCampoParaInstante("2026-01-15T09:00")?.toISOString()).toBe(
      "2026-01-15T09:00:00.000Z",
    );
  });

  it("ida e volta não mexe na hora", () => {
    // A garantia que interessa: abrir o campo e gravar sem lhe tocar tem de
    // deixar o trabalho exactamente onde estava.
    for (const iso of [
      "2026-08-31T07:30:00.000Z",
      "2026-01-15T09:00:00.000Z",
      "2026-03-29T02:30:00.000Z",
      "2026-10-25T01:30:00.000Z",
    ]) {
      expect(doCampoParaInstante(paraOCampoDeData(iso))?.toISOString(), iso).toBe(iso);
    }
  });

  it("nas mudanças da hora, a segunda passagem apanha o desvio certo", () => {
    /*
     * Em 2026 Lisboa adianta os relógios a 29 de março (01:00 → 02:00) e
     * atrasa-os a 25 de outubro. Uma passagem só deixava uma hora de erro no
     * único fim-de-semana do ano em que ninguém ia desconfiar dela.
     */
    expect(doCampoParaInstante("2026-03-29T10:00")?.toISOString()).toBe(
      "2026-03-29T09:00:00.000Z",
    );
    expect(doCampoParaInstante("2026-10-25T10:00")?.toISOString()).toBe(
      "2026-10-25T10:00:00.000Z",
    );
  });

  it("campo vazio não inventa um instante — é isso que desmarca o dia", () => {
    expect(doCampoParaInstante("")).toBeNull();
    expect(doCampoParaInstante("   ")).toBeNull();
    expect(doCampoParaInstante("qualquer coisa")).toBeNull();
  });
});
