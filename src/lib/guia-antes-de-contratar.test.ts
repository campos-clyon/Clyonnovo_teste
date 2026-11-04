import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  GUIA_POR_VERIFICAR,
  GUIA_POR_VERIFICAR_FRASE,
  guiaImpedeContratar,
  guiaVerificada,
  servicoExigeGuia,
  trabalhoExigeGuia,
} from "./guia-antes-de-contratar";
import { avisosDoTrabalho } from "./profissional-elegivel";
import { FICHA_DO_AVISO } from "./avisos-antes-de-cotar";
import { negociacaoParaAVista } from "./negociacao-na-vista";
import { negociacaoParaAApp } from "./pedido-para-a-app";

/**
 * GUIA DE RESÍDUOS VERIFICADA ANTES DE CONTRATAR — 04-11-2026 (d10.1).
 *
 * Num trabalho que exige a guia (o entulho, sempre, e o pedido com a guia
 * pedida), um parceiro com a guia por verificar pode propor, mas não pode ser
 * contratado nem escolhido para um Trabalho CLYON. O cliente e a Mesa vêem
 * porquê. Estes testes guardam a regra e as portas onde ela se cumpre.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const semComentarios = (t: string) => t.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^\s*\/\/.*$/gm, "");

const VERIFICADA = { emiteGuiaTransporte: 1, guiaVerificadaEm: "2026-10-01T10:00:00Z" };
const POR_VERIFICAR = { emiteGuiaTransporte: 1, guiaVerificadaEm: null };

describe("a regra", () => {
  it("a frase é a da ordem, palavra por palavra", () => {
    expect(GUIA_POR_VERIFICAR).toBe("Este parceiro ainda não tem a guia de resíduos verificada");
    expect(GUIA_POR_VERIFICAR_FRASE).toBe(`${GUIA_POR_VERIFICAR}.`);
  });

  it("o entulho exige a guia sempre; o pedido com a guia pedida também; o resto não", () => {
    expect(servicoExigeGuia("recolha_entulho")).toBe(true);
    expect(trabalhoExigeGuia({ serviceType: "recolha_entulho", precisaGuiaTransporte: 0 })).toBe(true);
    expect(trabalhoExigeGuia({ serviceType: "recolha_moveis", precisaGuiaTransporte: 1 })).toBe(true);
    expect(trabalhoExigeGuia({ serviceType: "recolha_moveis", precisaGuiaTransporte: true })).toBe(true);
    expect(trabalhoExigeGuia({ serviceType: "recolha_moveis", precisaGuiaTransporte: 0 })).toBe(false);
    expect(trabalhoExigeGuia({ serviceType: "mudanca", precisaGuiaTransporte: null })).toBe(false);
    expect(trabalhoExigeGuia({})).toBe(false);
  });

  it("só conta a guia verificada — declarar não chega, e uma data estragada não vale", () => {
    expect(guiaVerificada(VERIFICADA)).toBe(true);
    expect(guiaVerificada({ emiteGuiaTransporte: true, guiaVerificadaEm: new Date("2026-10-01") })).toBe(true);
    expect(guiaVerificada(POR_VERIFICAR)).toBe(false);
    expect(guiaVerificada({ emiteGuiaTransporte: 0, guiaVerificadaEm: "2026-10-01" })).toBe(false);
    expect(guiaVerificada({ emiteGuiaTransporte: 1, guiaVerificadaEm: "isto-nao-e-data" })).toBe(false);
    // Sem a declaração na linha (as consultas do cliente só lêem a data), vale a data.
    expect(guiaVerificada({ guiaVerificadaEm: "2026-10-01" })).toBe(true);
  });

  it("impede contratar só quando o trabalho a exige e a guia está por verificar", () => {
    const entulho = { serviceType: "recolha_entulho" };
    expect(guiaImpedeContratar(entulho, POR_VERIFICAR)).toBe(true);
    expect(guiaImpedeContratar(entulho, { emiteGuiaTransporte: 0, guiaVerificadaEm: null })).toBe(true);
    expect(guiaImpedeContratar(entulho, VERIFICADA)).toBe(false);
    expect(guiaImpedeContratar({ serviceType: "recolha_moveis" }, POR_VERIFICAR)).toBe(false);
  });

  it("propor continua: o entulho avisa antes de propor, mesmo sem a caixa da guia marcada", () => {
    expect(
      avisosDoTrabalho({ serviceType: "recolha_entulho", precisaGuiaTransporte: false }, { emiteGuiaTransporte: false, guiaVerificadaEm: null }),
    ).toEqual(["trabalho_exige_guia"]);
    expect(
      avisosDoTrabalho({ serviceType: "recolha_entulho", precisaGuiaTransporte: false }, { emiteGuiaTransporte: true, guiaVerificadaEm: new Date("2026-10-01") }),
    ).toEqual([]);
    // E o aviso diz-lhe a verdade nova: pode propor, mas só é contratado depois da verificação.
    expect(FICHA_DO_AVISO.trabalho_exige_guia.corpo).toContain("só pode ser contratado depois de a CLYON");
  });
});

describe("as portas que fecham um trabalho perguntam à guia, no servidor", () => {
  it("o cliente (link, conta, app): aceitar e contratar param antes do motor", () => {
    const f = semComentarios(ler("src/lib/agir-como-cliente.ts"));
    const portao = f.search(/\(accao === "aceitar" \|\| accao === "contratar"\) && \(await guiaImpedeANegociacao\(negociacaoId\)\)/);
    expect(portao).toBeGreaterThan(-1);
    expect(portao).toBeLessThan(f.indexOf('case "contratar":'));
    expect(f.slice(portao, portao + 300)).toContain("GUIA_POR_VERIFICAR_FRASE");
  });

  it("a Mesa, em nome do cliente", () => {
    const f = semComentarios(ler("src/app/api/admin/negociacoes/agir/route.ts"));
    const portao = f.search(/\(accao === "aceitar" \|\| accao === "contratar"\) && \(await guiaImpedeANegociacao\(negociacaoId\)\)/);
    expect(portao).toBeGreaterThan(-1);
    expect(portao).toBeLessThan(f.indexOf('case "contratar":'));
  });

  it("a escolha de um Trabalho CLYON, antes da transacção", () => {
    const f = semComentarios(ler("src/app/api/admin/trabalhos-clyon/escolher/route.ts"));
    const portao = f.indexOf("await guiaImpedeANegociacao(negociacaoId)");
    expect(portao).toBeGreaterThan(-1);
    expect(portao).toBeLessThan(f.indexOf("await atribuirOfertaClyon(negociacaoId)"));
  });

  it("o «aceitar» de uma oferta directa não lhe dá o trabalho com a guia por verificar", () => {
    const f = semComentarios(ler("src/lib/responder-oferta-clyon.ts"));
    const portao = f.indexOf("aceitarFechaLogo(a.modo) && (await guiaImpedeANegociacao(a.negociacaoId))");
    expect(portao).toBeGreaterThan(-1);
    expect(portao).toBeLessThan(f.indexOf("await atribuirOfertaClyon(a.negociacaoId)"));
  });

  it("passar o trabalho a outro e fechar pelo WhatsApp também", () => {
    const trocar = semComentarios(ler("src/app/api/admin/negociacoes/trocar-profissional/route.ts"));
    expect(trocar.indexOf("guiaImpedeOProfissional(pedidoId, providerId)")).toBeGreaterThan(-1);
    expect(trocar.indexOf("guiaImpedeOProfissional(pedidoId, providerId)")).toBeLessThan(
      trocar.indexOf("passarOTrabalhoAOutroProfissional(pedidoId, providerId)"),
    );
    const wa = ler("src/lib/whatsapp-negociacao.ts");
    const fechar = wa.slice(wa.indexOf("async function fecharPeloCliente"));
    expect(fechar.indexOf("guiaImpedeANegociacao(alvo.negociacaoId)")).toBeGreaterThan(-1);
    expect(fechar.indexOf("guiaImpedeANegociacao(alvo.negociacaoId)")).toBeLessThan(fechar.indexOf("contratar(estado, agora)"));
  });

  it("o comentário da rota dos profissionais já não promete o que não acontece", () => {
    const f = ler("src/app/api/admin/profissionais/[id]/route.ts");
    expect(f).not.toContain("só não recebe os\n * pedidos que a exigem");
    expect(f).toContain("NÃO PODE SER CONTRATADO");
  });
});

describe("o cliente e a Mesa vêem porquê", () => {
  const agora = new Date("2026-11-04T10:00:00Z");
  const linha = (x: Record<string, unknown> = {}) => ({
    id: 7,
    estado: "aberta",
    propostasJson: JSON.stringify([{ por: "profissional", valor: 100, criadaEm: "2026-11-04T09:00:00Z", estado: "pendente" }]),
    profissionalNome: "Parceiro",
    guiaVerificadaEm: null,
    createdAt: "2026-11-04T08:00:00Z",
    ...x,
  });

  it("o cliente: a negociação diz que a guia está por verificar, e a frase vai escrita", () => {
    const n = negociacaoParaAVista(linha(), { porCarga: false, agora, exigeGuia: true });
    expect(n.guiaPorVerificar).toBe(true);
    expect(negociacaoParaAApp(n, "total", agora).naoSeContrata).toBe(GUIA_POR_VERIFICAR_FRASE);
    // Verificada, ou sem trabalho de resíduos, ou já contratado: nada.
    expect(negociacaoParaAVista(linha({ guiaVerificadaEm: "2026-10-01" }), { porCarga: false, agora, exigeGuia: true }).guiaPorVerificar).toBe(false);
    expect(negociacaoParaAVista(linha(), { porCarga: false, agora, exigeGuia: false }).guiaPorVerificar).toBe(false);
    expect(negociacaoParaAVista(linha({ estado: "acordada" }), { porCarga: false, agora, exigeGuia: true }).guiaPorVerificar).toBe(false);
  });

  it("as três vistas do cliente dizem se o pedido exige a guia", () => {
    expect(ler("src/lib/vista-do-pedido.ts")).toContain("exigeGuia: trabalhoExigeGuia(pedido)");
    expect(ler("src/lib/pedidos-da-conta.ts")).toContain("exigeGuia: trabalhoExigeGuia(");
    const ecra = ler("src/app/pedido/[token]/PropostasRecebidas.tsx");
    expect(ecra).toContain("{n.naoSeContrata}");
    expect((ecra.match(/!!n\.naoSeContrata/g) ?? []).length).toBe(2);
  });

  it("a Mesa e os Trabalhos CLYON: o botão trava e diz porquê", () => {
    const mesa = ler("src/components/admin/AdminNegociacoesPanel.tsx");
    expect(mesa).toContain("negociacao.guiaPorVerificar");
    expect((mesa.match(/disabled=\{aEnviar !== "" \|\| negociacao\.guiaPorVerificar === true\}/g) ?? []).length).toBe(2);
    const trabalhos = ler("src/components/admin/TrabalhoClyon.tsx");
    expect(trabalhos).toContain("n.guiaPorVerificar === true");
    expect(ler("src/app/api/admin/negociacoes/route.ts")).toContain("confiancaDasNegociacoes(");
    expect(ler("src/app/api/admin/trabalhos-clyon/route.ts")).toContain("confiancaDasNegociacoes(");
  });
});
