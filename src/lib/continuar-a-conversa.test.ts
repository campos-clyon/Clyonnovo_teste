import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  podeContinuar,
  ultimaDoCliente,
  oQueVaiFazer,
  type EstadoDaFala,
} from "./continuar-a-conversa";

/**
 * "Cliquei em Reler e continuar e ele me deu essa resposta." — 13-09-2026.
 *
 * A conversa: a cliente do #311 escreveu «Não» às 14:22 e o assistente não
 * respondeu nada. O botão, carregado a seguir, recusou-se a agir: «Este número
 * já tem o pedido #311 a andar. A conversa dele é a das propostas, não a da
 * recolha.»
 *
 * A recusa estava certa e era inútil. Quem carrega não está a pedir uma
 * releitura da recolha — está a pedir que o assistente CONTINUE.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

const TUDO_BEM: EstadoDaFala = { ligado: true, bloqueado: false, entregue: false };
const NAO = { texto: "Não", quando: "2026-09-13T14:22:00.000Z" };

describe("quando é que o assistente pode continuar", () => {
  it("com tudo ligado e uma mensagem dele por responder, pode", () => {
    const v = podeContinuar(TUDO_BEM, NAO);
    expect(v.pode).toBe(true);
    if (v.pode) expect(v.ultima.texto).toBe("Não");
  });

  it("a última palavra sendo nossa, não há nada a continuar", () => {
    const v = podeContinuar(TUDO_BEM, null);
    expect(v.pode).toBe(false);
    if (!v.pode) expect(v.porque).toContain("A última palavra é nossa");
  });

  it("uma mensagem só com espaços não conta como palavra dele", () => {
    expect(podeContinuar(TUDO_BEM, { texto: "   ", quando: "x" }).pode).toBe(false);
  });
});

describe("o porquê vai junto com o não", () => {
  /*
   * Um botão que não faz nada e não diz porquê manda a pessoa procurar uma
   * avaria que não existe. Cada recusa diz o que se passa E como se desfaz.
   */
  it("bloqueado", () => {
    const v = podeContinuar({ ...TUDO_BEM, bloqueado: true }, NAO);
    expect(v.pode).toBe(false);
    if (!v.pode) {
      expect(v.porque).toContain("bloqueado");
      expect(v.comoSeResolve).toContain("Desbloqueie");
    }
  });

  it("entregue a uma pessoa", () => {
    const v = podeContinuar({ ...TUDO_BEM, entregue: true }, NAO);
    expect(v.pode).toBe(false);
    if (!v.pode) expect(v.comoSeResolve).toContain("Devolver ao assistente");
  });

  /*
   * O CASO QUE NÃO SE VÊ NA LINHA.
   *
   * O estado de cada conversa lê-se dos bloqueados, das arquivadas e das
   * entregues — nunca do interruptor geral. Com o WhatsApp desligado, a linha
   * continua a dizer «assistente» e a oferecer «Assumir», e a conversa está
   * muda: a mensagem do cliente é gravada, o cérebro é chamado, e cala-se à
   * entrada sem deixar rasto.
   */
  it("o interruptor geral desligado — o que a linha da conversa não mostra", () => {
    const v = podeContinuar({ ...TUDO_BEM, ligado: false }, NAO);
    expect(v.pode).toBe(false);
    if (!v.pode) {
      expect(v.porque).toContain("DESLIGADO");
      expect(v.porque).toContain("«assistente»");
      expect(v.comoSeResolve).toContain("Ligar outra vez");
    }
  });

  it("bloqueado manda sobre o resto — desligar o geral não o desbloqueia", () => {
    const v = podeContinuar({ ligado: false, bloqueado: true, entregue: true }, NAO);
    expect(v.pode).toBe(false);
    if (!v.pode) expect(v.porque).toContain("bloqueado");
  });
});

describe("qual é a última coisa que ele escreveu", () => {
  const FIO = [
    { direccao: "out", texto: "Manuel Martins propõe 148,57 €…", criadoEm: "2026-09-13T11:40:00Z" },
    { direccao: "in", texto: "Ok, obrigada", criadoEm: "2026-09-13T12:12:00Z" },
    { direccao: "out", texto: "Pedido #311 — …", criadoEm: "2026-09-13T12:12:30Z" },
    { direccao: "in", texto: "Não", criadoEm: "2026-09-13T14:22:00Z" },
  ];

  it("a dele, e não a nossa", () => {
    expect(ultimaDoCliente(FIO)?.texto).toBe("Não");
  });

  it("salta as nossas que vieram depois", () => {
    const comRespostaNossa = [
      ...FIO,
      { direccao: "out", texto: "Certo — a proposta foi recusada.", criadoEm: "2026-09-13T14:23:00Z" },
    ];
    expect(ultimaDoCliente(comRespostaNossa)?.texto).toBe("Não");
  });

  it("sem nada dele, não inventa", () => {
    expect(ultimaDoCliente([FIO[0]])).toBeNull();
    expect(ultimaDoCliente([])).toBeNull();
  });
});

describe("o que vai acontecer, dito antes de o cliente ouvir", () => {
  it("nomeia a mensagem e o pedido, e não promete o que não faz", () => {
    const t = oQueVaiFazer(311, "Não");
    expect(t).toContain("«Não»");
    expect(t).toContain("#311");
    expect(t).toContain("Não inventa nada nem repete o que já disse");
  });
});

describe("está ligado ao botão que dava a recusa", () => {
  const ROTA = ler("src/app/api/admin/whatsapp/route.ts");
  const PAINEL = ler("src/components/admin/AdminWhatsAppPanel.tsx");

  it("a recusa deu lugar à continuação", () => {
    expect(ROTA).not.toContain("A conversa dele é a das propostas, não a da recolha.");
    expect(ROTA).toContain("podeContinuar");
    expect(ROTA).toContain("tratarMensagemDoCliente(telefone, {");
  });

  it("continua a haver duas fases — ver primeiro, enviar depois", () => {
    // A mesma decisão da releitura: quem carrega VÊ o que vai acontecer antes
    // de o cliente ouvir.
    expect(ROTA).toContain("if (corpo.confirmar !== true) {");
    expect(ROTA).toContain("propostas: true");
  });

  it("o painel diz que é a conversa das propostas, e não fala de campos", () => {
    expect(PAINEL).toContain("Conversa das propostas");
    expect(PAINEL).toContain("Continuar a conversa");
  });

  it("o que correu bem não aparece em vermelho", () => {
    expect(PAINEL).toContain("const [notaDaResposta, setNotaDaResposta] = useState(\"\");");
    expect(PAINEL).toContain("text-emerald-300\">{notaDaResposta}");
  });
});
