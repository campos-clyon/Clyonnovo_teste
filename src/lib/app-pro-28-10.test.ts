import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  avisoDaEtapa,
  CLIENTE_AVISADO_POR_WHATSAPP,
  CLIENTE_SEM_AVISO_POR_WHATSAPP,
  type MeusPedidos,
  type RespostaDoFeito,
  type Trabalho,
} from "../../app-pro/src/lib/trabalhos";
import { pedirEmDemo } from "../../app-pro/src/lib/demo";
import { mensagemDepoisDeFeito } from "./trabalho";
import { ondeEstaODinheiro, tituloDoConfirmado } from "./fim-do-trabalho";
import { ROTULOS_DA_CARTEIRA } from "./rotulos-da-carteira";
import { SE_O_CLIENTE_NAO_RESPONDER } from "./prazo-do-cliente-clyon";

/**
 * O EAS UPDATE DE 29-10-2026 — a parte da app CLYON Pro das decisões d4, d5,
 * d7, d8, d11 e d12 de 28-10-2026, sobre a build 13 (sem build nova).
 *
 * O site mudou primeiro e deixou as frases e as regras puras em src/lib; aqui
 * guarda-se que a app as usa, e não cópias nem números escritos à mão. Os
 * textos da d7 (`valor-que-muda-no-local.test.ts`), da carteira
 * (`fim-do-trabalho.test.ts`) e do «está feito»
 * (`app-pro-feito-sem-fotografias.test.ts`) têm os seus testes.
 */

/** Sem comentários, com a regra ancorada ao início da linha. */
const ler = (p: string) =>
  readFileSync(join(process.cwd(), p), "utf8")
    .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
    .replace(/^\s*\/\/.*$/gm, "");

const CONTRATADO = ler("app-pro/src/componentes/TrabalhoContratado.tsx");
const DETALHE = ler("app-pro/src/app/trabalho/[id].tsx");

describe("d4 — o fim do trabalho, como no painel", () => {
  it("à espera, confirmado ou pago: as frases de src/lib, e não as da app", () => {
    expect(CONTRATADO).toContain("aEsperaDaConfirmacao({");
    expect(CONTRATADO).toContain(
      "tituloDoConfirmado({ confirmadoPor: t.confirmadoPor, confirmadoEm: t.confirmadoEm, ofertaClyon: Boolean(t.ofertaClyon) })",
    );
    expect(CONTRATADO).toContain("ondeEstaODinheiro(t)");
    expect(CONTRATADO).toContain("{dinheiro.frase}");
    for (const antiga of ["O trabalho está confirmado.", "Este trabalho está pago.", "Enviou a prova. Falta {quem} confirmar"]) {
      expect(CONTRATADO, antiga).not.toContain(antiga);
    }
  });

  it("um trabalho da app (o tipo dela) dá a frase e o título do painel", () => {
    const t = {
      fase: "confirmado",
      formaDePagamento: "na_plataforma",
      clientePagou: true,
      valorAcordado: 350,
      taxas: { cliente: 0, profissional: 0.11 },
      criadaEm: "2026-10-20T10:00:00.000Z",
      pagoEm: null,
      confirmadoPor: "cliente",
      confirmadoEm: "2026-10-28T10:00:00.000Z",
      ofertaClyon: null,
    } satisfies Partial<Trabalho>;
    const d = ondeEstaODinheiro(t);
    expect(d?.caso).toBe("disponivel");
    expect(d?.frase).toContain("311,50 €");
    expect(tituloDoConfirmado({ ...t, ofertaClyon: Boolean(t.ofertaClyon) })).toBe("Confirmado pelo cliente a 28/10/2026");
    // Os de antes de 28-10-2026 não sabem quem: «Confirmado», sem inventar.
    expect(tituloDoConfirmado({ confirmadoPor: null, confirmadoEm: t.confirmadoEm })).toBe("Confirmado");
  });

  it("o histórico mostra o que ele recebe, e sabe se havia fotografias", () => {
    const H = ler("app-pro/src/componentes/Historico.tsx");
    expect(H).toContain("valorQueRecebe: t.recebeSeFechado,");
    expect(H).toContain("provaJson: t.provaJson,");
  });

  it("a carteira lê o mapa dos rótulos, e não escreve nenhum à mão", () => {
    const C = ler("app-pro/src/app/(app)/carteira.tsx");
    expect(C).toContain('import { ROTULOS_DA_CARTEIRA as R } from "../../../../src/lib/rotulos-da-carteira";');
    for (const r of Object.values(ROTULOS_DA_CARTEIRA)) {
      expect(C, r.rotulo).not.toMatch(new RegExp(`>\\s*${r.rotulo}\\s*<|["\`]${r.rotulo}["\`:]`));
    }
    for (const k of ["aReceberJaFeito", "pago", "porReceber", "disponivel", "porCobrar", "recebidoEmMao", "aPagarAClyon", "pagoAClyonComOSaldo", "totalGanho"]) {
      expect(C, k).toContain(`R.${k}.rotulo`);
    }
    for (const antigo of ["Para receber", "Cativo", "O cativo inclui"]) expect(C, antigo).not.toContain(antigo);
  });

  it("o modo de demonstração diz a frase do caminho certo, como a rota", async () => {
    const r = await pedirEmDemo<RespostaDoFeito>("/api/profissionais/trabalho", "POST", {
      negociacaoId: 906,
      fotos: ["https://x.public.blob.vercel-storage.com/a.jpg"],
      nota: "",
    });
    const { pedidos } = await pedirEmDemo<MeusPedidos>("/api/profissionais/meus-pedidos", "GET", undefined);
    const t = pedidos.find((p) => p.negociacaoId === 906);
    expect(r.mensagem).toBe(mensagemDepoisDeFeito({ comFotografias: true, ofertaClyon: t?.ofertaClyon != null }));
  });
});

describe("d5 — «Negociação terminada» diz porquê, como o aviso", () => {
  it("o título e a razão vêm de textos-dos-avisos-ao-profissional.ts", () => {
    expect(DETALHE).toContain("<TituloDaCaixa>{NEGOCIACAO_TERMINADA}</TituloDaCaixa>");
    expect(DETALHE).toContain("porqueTerminou({ estado: t.estado, pedidoCancelado: t.pedidoCancelado })");
    expect(DETALHE).toContain("{PORQUE_A_NEGOCIACAO_TERMINOU[porque]}");
    expect(DETALHE).not.toContain("Este trabalho já não está em aberto.");
  });
});

describe("d11 — a app diz só o que é verdade", () => {
  const normal = { ofertaClyon: null } as const;
  const clyon = { ofertaClyon: "distribuida" } as const;

  it("«avisado» só com primeiraVez e whatsapp; sem WhatsApp, «ligue»", () => {
    expect(avisoDaEtapa({ ok: true, primeiraVez: true, whatsapp: true }, normal)).toBe("avisado");
    expect(avisoDaEtapa({ ok: true, primeiraVez: true, whatsapp: false }, normal)).toBe("ligue");
    // Um segundo toque não avisa outra vez: nada a dizer.
    expect(avisoDaEtapa({ ok: true, primeiraVez: false, whatsapp: false }, normal)).toBeNull();
    expect(avisoDaEtapa(null, normal)).toBeNull();
    // Num Trabalho CLYON o WhatsApp nunca sai, de propósito: não se promete nada.
    expect(avisoDaEtapa({ ok: true, primeiraVez: true, whatsapp: false }, clyon)).toBeNull();
    expect(CLIENTE_AVISADO_POR_WHATSAPP).toBe("O cliente foi avisado por WhatsApp.");
    expect(CLIENTE_SEM_AVISO_POR_WHATSAPP).toBe("Não conseguimos avisar o cliente pelo WhatsApp — ligue-lhe.");
  });

  it("o ecrã lê a resposta da rota, com o botão Ligar, e já não promete antes", () => {
    expect(CONTRATADO).toContain('pedir<RespostaDaEtapa>("/api/profissionais/trabalho/etapa"');
    expect(CONTRATADO).toContain("setAviso(avisoDaEtapa(resposta, t));");
    expect(CONTRATADO).toContain("texto={CLIENTE_AVISADO_POR_WHATSAPP}");
    expect(CONTRATADO).toContain("texto={CLIENTE_SEM_AVISO_POR_WHATSAPP}");
    expect(CONTRATADO).toContain('<Botao titulo="Ligar" aoCarregar={() => abrir(`tel:${ligar}`)} />');
    expect(CONTRATADO).not.toContain("O cliente recebe um WhatsApp na hora");
  });

  it("a margem de referência vem da rota do perfil, e não um «40» escrito", () => {
    const S = ler("app-pro/src/app/conta/servicos.tsx");
    expect(S).toContain("perfil.margemDeReferenciaPercent");
    expect(S).not.toMatch(/\b40\b/);
    expect(ler("src/app/api/profissionais/perfil/route.ts")).toContain("margemDeReferenciaPercent: margemDeReferencia,");
  });
});

describe("d12 — quem aceita um Trabalho CLYON a vários sabe o prazo", () => {
  it("a oferta a vários diz a frase do painel e do email", () => {
    expect(DETALHE).toContain(
      "a CLYON escolhe e avisa-o. ${SE_O_CLIENTE_NAO_RESPONDER}",
    );
    expect(SE_O_CLIENTE_NAO_RESPONDER).toBe("Se o cliente não responder em 3 dias, avisamo-lo.");
  });
});
