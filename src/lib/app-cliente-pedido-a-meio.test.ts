import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { rascunhoValido, rascunhoVazio, type Rascunho } from "../../app-cliente/src/lib/novo-pedido";
import {
  AUSENCIA_QUE_FECHA_A_SESSAO_MS,
  COMECAR_DO_ZERO,
  CONTINUAR_O_PEDIDO,
  copiasParaApagar,
  linhaDoPedidoAMeio,
  perguntarPeloPedidoAMeio,
  quandoFoiGuardado,
  sessaoNovaAoVoltar,
  temPedidoAMeio,
  TITULO_DO_PEDIDO_A_MEIO,
} from "../../app-cliente/src/lib/pedido-a-meio";

/**
 * O PEDIDO A MEIO NA APP DE CLIENTE — d5 de 03-11-2026, ordem do CEO com o
 * sim do dono: quem fecha a app com um pedido por enviar e volta, ao entrar no
 * Pedir, vê «Tem um pedido a meio — <serviço>, guardado <hoje às 22:24 /
 * ontem / dd/mm>», com «Continuar» (primário) e «Começar do zero» (apaga o
 * rascunho e as fotografias). Rascunho vazio, já enviado, ou trocar de
 * separador na mesma sessão: não pergunta nada.
 */

const RAIZ = process.cwd();
const ler = (p: string) => readFileSync(join(RAIZ, p), "utf8").replace(/\r\n/g, "\n");

/** Um rascunho com o serviço escolhido, como fica no telemóvel (passa pela leitura do ficheiro). */
function guardadoNoTelemovel(p: Partial<Rascunho>): Rascunho | null {
  return rascunhoValido(JSON.parse(JSON.stringify({ ...rascunhoVazio(), ...p })));
}

describe("perguntar ou não pelo pedido a meio", () => {
  const comPedido = guardadoNoTelemovel({ servico: "recolha-moveis", ecra: "fotos", descricao: "Um sofá e uma mesa" });

  it("abrir a app com um rascunho com o serviço escolhido: pergunta", () => {
    expect(comPedido).not.toBeNull();
    expect(perguntarPeloPedidoAMeio({ rascunho: comPedido, sessao: 1, vistoNaSessao: null })).toBe(true);
  });

  it("um rascunho vazio não pergunta — nem com o que a app põe sozinha (a morada da barra, o nome e o telefone da conta)", () => {
    expect(perguntarPeloPedidoAMeio({ rascunho: null, sessao: 1, vistoNaSessao: null })).toBe(false);
    expect(perguntarPeloPedidoAMeio({ rascunho: rascunhoVazio(), sessao: 1, vistoNaSessao: null })).toBe(false);
    const soOQueAAppPos = guardadoNoTelemovel({ morada: { formattedAddress: "Rua Augusta 1, Lisboa" }, nome: "Ana", telefone: "912 345 678" });
    expect(perguntarPeloPedidoAMeio({ rascunho: soOQueAAppPos, sessao: 1, vistoNaSessao: null })).toBe(false);
    expect(temPedidoAMeio({ servico: "  " })).toBe(false);
  });

  it("depois de enviar não pergunta: o envio apaga o rascunho, e o que fica não tem serviço", () => {
    // O ficheiro apagado lê-se como nada; o que fica na memória é o rascunho vazio (com a morada que a app volta a pôr).
    expect(perguntarPeloPedidoAMeio({ rascunho: rascunhoValido(null), sessao: 2, vistoNaSessao: 1 })).toBe(false);
    const depoisDoEnvio = { ...rascunhoVazio(), morada: { formattedAddress: "Rua Augusta 1, Lisboa" } };
    expect(perguntarPeloPedidoAMeio({ rascunho: depoisDoEnvio, sessao: 2, vistoNaSessao: 1 })).toBe(false);

    const fonte = ler("app-cliente/src/componentes/NovoPedido.tsx");
    const envio = fonte.slice(fonte.indexOf("async function enviar()"));
    expect(envio.indexOf("async function enviar()")).toBe(0);
    const apaga = envio.indexOf("apagarRascunho();");
    expect(apaga).toBeGreaterThan(-1);
    expect(apaga).toBeLessThan(envio.indexOf("setEnviado({ id, aviso })"));
    expect(envio.slice(apaga, envio.indexOf("setEnviado({ id, aviso })"))).toContain("rascunho.current = rascunhoVazio();");
  });

  it("trocar de separador na mesma sessão não pergunta outra vez; abrir a app de novo volta a perguntar", () => {
    expect(perguntarPeloPedidoAMeio({ rascunho: comPedido, sessao: 1, vistoNaSessao: null })).toBe(true);
    // Depois de o Pedir se ver na sessão 1 (com «Continuar»), ir ao Início e voltar ao Pedir:
    expect(perguntarPeloPedidoAMeio({ rascunho: comPedido, sessao: 1, vistoNaSessao: 1 })).toBe(false);
    // Fechou a app e voltou: sessão 2.
    expect(perguntarPeloPedidoAMeio({ rascunho: comPedido, sessao: 2, vistoNaSessao: 1 })).toBe(true);
  });

  it("quem volta do link do email para enviar o pedido não é interrompido", () => {
    expect(perguntarPeloPedidoAMeio({ rascunho: comPedido, sessao: 1, vistoNaSessao: null, vemDeEntrar: true })).toBe(false);
  });
});

describe("o que conta como fechar a app e voltar", () => {
  const saiu = Date.parse("2026-11-03T22:00:00Z");

  it("ir à câmara, à galeria ou ao WhatsApp por uns minutos não é fechar", () => {
    expect(sessaoNovaAoVoltar({ saiuEm: saiu, voltouEm: saiu + 40_000, voltarSemDestinoEm: null })).toBe(false);
    expect(sessaoNovaAoVoltar({ saiuEm: saiu, voltouEm: saiu + 10 * 60_000, voltarSemDestinoEm: null })).toBe(false);
  });

  it("30 minutos fora já é outra sessão", () => {
    expect(AUSENCIA_QUE_FECHA_A_SESSAO_MS).toBe(30 * 60_000);
    expect(sessaoNovaAoVoltar({ saiuEm: saiu, voltouEm: saiu + 30 * 60_000, voltarSemDestinoEm: null })).toBe(true);
    expect(sessaoNovaAoVoltar({ saiuEm: saiu, voltouEm: saiu + 26 * 3_600_000, voltarSemDestinoEm: null })).toBe(true);
  });

  it("fechar com o «voltar» do Android (sem ecrã para onde voltar) é fechar, mesmo voltando logo", () => {
    expect(sessaoNovaAoVoltar({ saiuEm: saiu, voltouEm: saiu + 5_000, voltarSemDestinoEm: saiu - 300 })).toBe(true);
    // Um «voltar» de há muito, seguido de uma ida à câmara, não fechou nada.
    expect(sessaoNovaAoVoltar({ saiuEm: saiu, voltouEm: saiu + 40_000, voltarSemDestinoEm: saiu - 60_000 })).toBe(false);
  });

  it("voltar a «activa» sem ter ido para segundo plano (o centro de controlo do iPhone) não muda nada", () => {
    expect(sessaoNovaAoVoltar({ saiuEm: null, voltouEm: saiu, voltarSemDestinoEm: null })).toBe(false);
  });

  it("a sessão vigia o segundo plano e o «voltar», e só anota (o «voltar» segue para a navegação)", () => {
    const s = ler("app-cliente/src/lib/sessao-da-app.ts");
    expect(s).toContain("sessaoNovaAoVoltar({ saiuEm, voltouEm: agora, voltarSemDestinoEm })");
    expect(s).toMatch(/if \(!router\.canGoBack\(\)\) voltarSemDestinoEm = Date\.now\(\);\s*\}[\s\S]*?return false;/);
    expect(s).toContain("useSyncExternalStore(subscrever, lerSessao, lerSessao)");
  });
});

describe("a caixa: o texto, em hora de Lisboa", () => {
  it("hoje às HH:MM, ontem, ou o dia e o mês — sempre na hora de Lisboa, seja qual for o fuso do telemóvel", () => {
    // Novembro: Lisboa = UTC.
    expect(quandoFoiGuardado("2026-11-03T22:24:00Z", new Date("2026-11-03T22:40:00Z"))).toBe("hoje às 22:24");
    // Julho: Lisboa = UTC+1 (em Paris seriam 23:24).
    expect(quandoFoiGuardado("2026-07-10T21:24:00Z", new Date("2026-07-10T21:50:00Z"))).toBe("hoje às 22:24");
    // 00:30 de 11/07 em Lisboa (23:30 UTC de 10/07) é hoje no dia 11.
    expect(quandoFoiGuardado("2026-07-10T23:30:00Z", new Date("2026-07-11T10:00:00Z"))).toBe("hoje às 00:30");
    expect(quandoFoiGuardado("2026-11-02T23:30:00Z", new Date("2026-11-03T08:00:00Z"))).toBe("ontem");
    expect(quandoFoiGuardado("2026-10-28T10:00:00Z", new Date("2026-11-03T08:00:00Z"))).toBe("28/10");
    expect(quandoFoiGuardado(undefined)).toBeNull();
    expect(quandoFoiGuardado("não é uma data")).toBeNull();
  });

  it("«Tem um pedido a meio» — «<serviço>, guardado …», e os dois botões", () => {
    const agora = new Date("2026-11-03T22:40:00Z");
    expect(TITULO_DO_PEDIDO_A_MEIO).toBe("Tem um pedido a meio");
    expect(linhaDoPedidoAMeio("Recolha de móveis", "2026-11-03T22:24:00Z", agora)).toBe("Recolha de móveis, guardado hoje às 22:24.");
    expect(linhaDoPedidoAMeio("Recolha de entulho", "2026-11-02T20:00:00Z", agora)).toBe("Recolha de entulho, guardado ontem.");
    expect(linhaDoPedidoAMeio("Mudanças", "2026-10-28T10:00:00Z", agora)).toBe("Mudanças, guardado 28/10.");
    expect(linhaDoPedidoAMeio("Recolha de móveis", undefined, agora)).toBe("Recolha de móveis.");
    expect(linhaDoPedidoAMeio(null, "2026-11-02T20:00:00Z", agora)).toBe("Guardado ontem.");
    expect(CONTINUAR_O_PEDIDO).toBe("Continuar");
    expect(COMECAR_DO_ZERO).toBe("Começar do zero");
  });

  it("o rascunho guarda quando mudou (e uma data que não se lê não fica)", () => {
    expect(guardadoNoTelemovel({ servico: "recolha-moveis", guardadoEm: "2026-11-03T22:24:00.000Z" })?.guardadoEm).toBe("2026-11-03T22:24:00.000Z");
    expect(guardadoNoTelemovel({ servico: "recolha-moveis", guardadoEm: "ontem" })?.guardadoEm).toBeUndefined();
    const fonte = ler("app-cliente/src/componentes/NovoPedido.tsx");
    expect(fonte).toContain("const novo = { ...antes, ...f(antes), guardadoEm: new Date().toISOString() };");
    // Um rascunho de antes desta versão vale a hora do ficheiro.
    expect(ler("app-cliente/src/lib/guardado.ts")).toMatch(/if \(r && !r\.guardadoEm\)[\s\S]*?ficheiro\(RASCUNHO\)\?\.lastModified/);
  });
});

describe("«Começar do zero» apaga as fotografias guardadas — só as da própria app", () => {
  const pastas = ["file:///data/user/0/pt.clyon.cliente/cache/", "file:///data/user/0/pt.clyon.cliente/files"];

  it("as cópias na cache ou nos documentos da app, sem repetir", () => {
    const fotos = [
      { uri: "file:///data/user/0/pt.clyon.cliente/cache/ImagePicker/a.jpg" },
      { uri: "file:///data/user/0/pt.clyon.cliente/files/b.jpg" },
      { uri: "file:///data/user/0/pt.clyon.cliente/cache/ImagePicker/a.jpg" },
    ];
    expect(copiasParaApagar(fotos, pastas)).toEqual([
      "file:///data/user/0/pt.clyon.cliente/cache/ImagePicker/a.jpg",
      "file:///data/user/0/pt.clyon.cliente/files/b.jpg",
    ]);
  });

  it("nunca a galeria, nada fora da app, nem caminhos com «..», nem a própria pasta", () => {
    const fotos = [
      { uri: "content://media/external/images/media/12" },
      { uri: "file:///storage/emulated/0/DCIM/Camera/c.jpg" },
      { uri: "file:///data/user/0/pt.clyon.cliente/cache/../../outra.app/d.jpg" },
      { uri: "file:///data/user/0/pt.clyon.cliente/cache/" },
      { uri: "file:///data/user/0/pt.clyon.cliente/cachefalsa/e.jpg" },
      { uri: 42 },
      {},
    ];
    expect(copiasParaApagar(fotos, pastas)).toEqual([]);
    expect(copiasParaApagar(null, pastas)).toEqual([]);
    expect(copiasParaApagar([{ uri: "file:///data/user/0/pt.clyon.cliente/cache/f.jpg" }], [null, "content://x"])).toEqual([]);
  });
});

describe("a caixa no Pedir", () => {
  const fonte = ler("app-cliente/src/componentes/NovoPedido.tsx");

  it("pergunta na primeira vez que o Pedir se vê nesta sessão, com o rascunho e o catálogo já lidos", () => {
    expect(fonte).toContain("const porDecidir = emFoco && r !== null && !!catalogo && vistoNaSessao !== sessao;");
    expect(fonte).toContain("perguntarPeloPedidoAMeio({ rascunho: r, sessao, vistoNaSessao, vemDeEntrar })");
    expect(fonte).toMatch(/marcarOPedirVisto\(sessao\);\s*setVistoNaSessao\(sessao\);/);
  });

  it("«Continuar» é o botão principal e o «voltar» do Android continua (nunca apaga)", () => {
    const caixa = fonte.slice(fonte.indexOf("titulo={TITULO_DO_PEDIDO_A_MEIO}"));
    expect(caixa.indexOf("titulo={TITULO_DO_PEDIDO_A_MEIO}")).toBe(0);
    const fim = caixa.indexOf("/>");
    expect(fim).toBeGreaterThan(-1);
    const so = caixa.slice(0, fim);
    expect(so).toContain("confirmar={CONTINUAR_O_PEDIDO}");
    expect(so).toContain("aoConfirmar={continuarOPedido}");
    expect(so).toContain("voltar={COMECAR_DO_ZERO}");
    expect(so).toContain("aoVoltar={comecarDoZero}");
    expect(so).toContain("aoFechar={continuarOPedido}");
    expect(ler("app-cliente/src/componentes/ui.tsx")).toContain("onRequestClose={aoFechar ?? aoVoltar}");
  });

  it("«Começar do zero» apaga o rascunho e as fotografias e volta a montar o formulário limpo", () => {
    const corpo = fonte.slice(fonte.indexOf("function comecarDoZero()"));
    expect(corpo.indexOf("function comecarDoZero()")).toBe(0);
    const bloco = corpo.slice(0, corpo.indexOf("\n  }\n"));
    expect(bloco).toContain("apagarRascunhoEFotografias(rascunho.current);");
    expect(bloco).toContain("recomecar();");
    expect(fonte).toContain("<Formulario key={geracao} deParte={deParte} recomecar={() => setGeracao((g) => g + 1)} />");
    // O que ainda chegar ao formulário que saiu já não grava o rascunho apagado.
    expect(fonte).toMatch(/const mudarCom = useCallback\(\(f: \(antes: Rascunho\) => Partial<Rascunho>\) => \{\s*if \(!montado\.current\) return;/);
  });

  it("enquanto pergunta, o serviço com que se chegou não se aplica por cima do pedido a meio", () => {
    expect(fonte).toContain("if (!r || !catalogo || porDecidir || aMeio) return;");
    expect(fonte).toContain("if (postosDeParte && postosDeParte.servico === params.servico && postosDeParte.morada === params.morada) return;");
  });
});
