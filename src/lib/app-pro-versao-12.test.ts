import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { outrosAnexosDe, sugestaoComOutraEquipa, imagensDe, type Sugestao } from "../../app-pro/src/lib/trabalhos";
import { sugestaoComOutroTempo } from "./sugestao-ajustada";
import type { SugestaoParaOProfissional } from "./sugestao-tipo";

/**
 * A VERSÃO 12 DA CLYON PRO — o que faltava do painel, 21-10-2026.
 *
 * O dono: «começa a versão 12 com o que falta do painel». A lista saiu da
 * comparação ecrã a ecrã de 20-10. Cada teste lê o painel e a app e exige o
 * mesmo: as frases e as regras vêm do site, a app não as reescreve.
 */

const ler = (f: string) => readFileSync(join(process.cwd(), f), "utf8").replace(/\s+/g, " ");
const PAINEL = ler("src/app/profissionais/painel/Trabalhos.tsx");
const DETALHE = ler("app-pro/src/app/trabalho/[id].tsx");
const CONTRATADO = ler("app-pro/src/componentes/TrabalhoContratado.tsx");

describe("o histórico da negociação", () => {
  it("é o do painel: as mesmas frases, de historico-negociacao.ts, com as estrelas", () => {
    const HISTORICO = ler("app-pro/src/componentes/Historico.tsx");
    expect(HISTORICO).toContain('from "../../../src/lib/historico-negociacao"');
    expect(HISTORICO).toContain("historicoDaNegociacao(");
    expect(HISTORICO).toContain("estrelas: t.estrelas");
    expect(DETALHE).toContain("<Historico t={t} />");
    // Os campos de que precisa vêm na resposta da rota (o teste da app confere-os todos).
    const ROTA = ler("src/app/api/profissionais/meus-pedidos/route.ts");
    for (const campo of ["avaliadoEm", "estrelas", "clientePagou", "cargaNaSuaCarrinha"]) {
      expect(ROTA).toContain(`${campo}:`);
    }
  });
});

describe("«O trabalho é seu — combine já»", () => {
  it("diz o mesmo que o painel: ligar já, valores só com a CLYON, e se o cliente já pagou", () => {
    /*
     * O valor que muda no local saiu daqui a 28-10-2026 (d7): no painel é
     * `VALOR_QUE_MUDA_NO_LOCAL` (ajuste-no-local.ts), e a app passa a usá-la
     * no próximo EAS Update — ver valor-que-muda-no-local.test.ts.
     */
    const frases = [
      "o mais depressa possível para acertar o dia e a hora. É a parte que ele está à espera, e quanto mais cedo ficar marcado, menos hipóteses há de o trabalho se atrasar.",
      "O cliente já pagou à CLYON. O valor está cá e é seu assim que ele confirmar que o trabalho está feito.",
      "Pode ir fazer o trabalho — mas o valor só passa a seu quando o pagamento entrar. Se preferir esperar, diga-nos e falamos com ele.",
    ];
    for (const f of frases) {
      expect(PAINEL).toContain(f);
      expect(CONTRATADO).toContain(f);
    }
    // `null` não mostra nada: só true e false têm frase.
    expect(CONTRATADO).toContain("t.clientePagou === true");
    expect(CONTRATADO).toContain("t.clientePagou === false");
    expect(CONTRATADO).toContain("<CombineJa t={t} />");
  });

  it("tem os quatro botões do painel: Google Maps, Waze, Ligar e WhatsApp", () => {
    expect(PAINEL).toContain("https://waze.com/ul?q=");
    expect(CONTRATADO).toContain("https://waze.com/ul?q=");
    expect(CONTRATADO).toContain("https://www.google.com/maps/dir/?api=1&destination=");
    expect(CONTRATADO).toContain('titulo="WhatsApp"');
    expect(CONTRATADO).toContain("linkDeWhatsApp(t.contactoTelefone");
  });
});

describe("os avisos do valor", () => {
  it("são os do painel — por carga ou à hora, a carrinha dele e os itens a mais — nos dois ecrãs", () => {
    const AVISOS = ler("app-pro/src/componentes/AvisosDoValor.tsx");
    expect(PAINEL).toContain("avisoDaBase(lerBase(pedido.baseDoPreco))");
    expect(PAINEL).toContain('avisoDosItens(lerBase(pedido.baseDoPreco), "profissional")');
    expect(AVISOS).toContain("avisoDaBase(base)");
    expect(AVISOS).toContain('avisoDosItens(base, "profissional")');
    expect(AVISOS).toContain("carga.titulo");
    expect(DETALHE).toContain("<AvisosDoValor t={t} />");
    expect(CONTRATADO).toContain("<AvisosDoValor t={t} />");
  });
});

describe("a sugestão com outro tempo e outra equipa", () => {
  const completa: SugestaoParaOProfissional = {
    horas: 2,
    pessoas: 2,
    custoHoraPessoa: 15,
    custoKm: 0.4,
    kmDeCarro: 28,
    custoCombustivel: 11.2,
    custoPessoal: 60,
    custosFixos: 15,
    seguroDeRisco: 3.56,
    riscoPercent: 5,
    custoMinimo: 89.76,
    margem: 0.45,
    precoSugerido: 130.15,
    recebeSePropuser: 122.34,
    lucroEstimado: 32.58,
    taxas: { cliente: 0.05, profissional: 0.06 },
    porCarga: false,
    comOsSeusCustos: false,
    semDistancia: false,
    pressupostos: [
      "Pessoal: 2 h × 2 pessoas × 15,00 €/h = 60,00 € (tempo estimado pela CLYON)",
      "Seguro de risco: 5 % de 71,20 € = 3,56 €",
    ],
  };

  it("dá exactamente a conta do painel", () => {
    const app = sugestaoComOutraEquipa(completa as Sugestao, 3.5, 3);
    expect(app).toEqual(sugestaoComOutroTempo(completa, { horas: 3.5, pessoas: 3 }));
    expect(app!.precoSugerido).toBeGreaterThan(completa.precoSugerido);
  });

  it("sem as parcelas (uma resposta antiga) não refaz nada, e o ecrã esconde os campos", () => {
    const curta: Sugestao = { horas: 2, pessoas: 2, custoMinimo: 95, precoSugerido: 140, recebeSePropuser: 131.6, lucroEstimado: 36.6, porCarga: false };
    expect(sugestaoComOutraEquipa(curta, 3, 3)).toBeNull();
    expect(DETALHE).toContain("podeMudarAConta ?");
    expect(DETALHE).toContain("Repor a nossa conta");
    expect(ler("src/app/profissionais/pedidos/[token]/NegociacaoProfissional.tsx")).toContain("Repor a nossa conta");
  });

  it("a cadeia da conta já não passa pelo ficheiro do servidor", () => {
    expect(ler("src/lib/sugestao-ajustada.ts")).toContain('import type { SugestaoParaOProfissional } from "./sugestao-tipo"');
    expect(ler("src/lib/sugestao-tipo.ts")).not.toMatch(/from "@\//);
  });
});

describe("os vídeos e os PDF do cliente", () => {
  it("aparecem à parte das fotografias, e abrem no telemóvel", () => {
    const json = JSON.stringify([
      { url: "https://x/1.jpg" },
      { url: "https://x/a", name: "sala.mp4" },
      { url: "https://x/lista.pdf" },
      { url: "https://x/b.mov" },
    ]);
    expect(imagensDe(json)).toEqual(["https://x/1.jpg"]);
    expect(outrosAnexosDe(json)).toEqual([
      { url: "https://x/a", especie: "video", nome: "Vídeo 1" },
      { url: "https://x/lista.pdf", especie: "pdf", nome: "PDF 1" },
      { url: "https://x/b.mov", especie: "video", nome: "Vídeo 2" },
    ]);
    expect(DETALHE).toContain("<OutrosAnexos t={t} />");
    expect(DETALHE).toContain("Linking.openURL(a.url)");
  });
});

describe("repor a palavra-passe, desmarcar o dia e desligar os avisos", () => {
  it("repor pede-se dentro da app, à rota do painel, com o botão do painel", () => {
    const REPOR = ler("app-pro/src/app/repor.tsx");
    expect(REPOR).toContain('"/api/profissionais/esqueci-palavra-passe"');
    expect(REPOR).toContain("semSessao: true");
    expect(REPOR).toContain('titulo="Enviar link"');
    expect(ler("src/app/profissionais/entrar/EntrarForm.tsx")).toContain("Enviar link");
    const ENTRAR = ler("app-pro/src/app/entrar.tsx");
    expect(ENTRAR).toContain('pathname: "/repor"');
    expect(ENTRAR).not.toContain("Abra o painel no site");
  });

  it("desmarcar manda o dia vazio, que a rota da agenda aceita como «por combinar»", () => {
    expect(CONTRATADO).toContain('corpo: { negociacaoId: t.negociacaoId, quando: "" }');
    const AGENDA = ler("src/app/api/profissionais/agenda/route.ts");
    expect(AGENDA).toContain('const cru = typeof corpo.quando === "string" ? corpo.quando.trim() : "";');
    expect(AGENDA).toContain("let quando: Date | null = null;");
  });

  it("desligar fica guardado: a app não os volta a ligar sozinha ao abrir", () => {
    const SESSAO = ler("app-pro/src/estado/Sessao.tsx");
    expect(SESSAO).not.toMatch(/void ligarAvisos\(\)/);
    expect((SESSAO.match(/void ligarAvisosSeQuiser\(\)/g) ?? []).length).toBe(3);
    const CONTA = ler("app-pro/src/app/(app)/conta.tsx");
    expect(CONTA).toContain('titulo="Desligar os avisos"');
    expect(CONTA).toContain("desligarAvisosPorEscolha()");
  });
});

describe("o link de um pedido abre esse pedido", () => {
  it("a app pergunta ao site qual é o trabalho, e mostra o porquê quando não dá", () => {
    const ABRIR = ler("app-pro/src/app/abrir/[token].tsx");
    expect(ABRIR).toContain('"/api/profissionais/pedido-do-link"');
    expect(ABRIR).toContain("router.replace(`/trabalho/${r.negociacaoId}`)");
    expect(ABRIR).toContain("Ver os meus trabalhos");
    // Dentro da sessão: sem ela, o link leva à entrada.
    expect(ler("app-pro/src/app/_layout.tsx")).toMatch(/guard=\{ligado\}>[\s\S]*?name="abrir\/\[token\]"[\s\S]*?<\/Stack\.Protected>/);
  });
});
