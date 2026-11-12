import { describe, it, expect, beforeEach } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  falhasDoEnvio,
  FalhaDoFicheiro,
  limparFalhasDoEnvio,
  MAXIMO_DO_REGISTO,
  MENSAGEM_DO_FICHEIRO_QUE_FALHOU,
  MENSAGEM_DO_FICHEIRO_SEM_REDE,
  recuperarDoEnvio,
  registarOPrazo,
  corpoDeTexto,
  type FalhaDoEnvio,
} from "../../app-pro/src/lib/envio-de-ficheiro";
import { fraseDoQueFalta, primeiroCampoComErro } from "../../app-pro/src/lib/campos-em-falta";
import { errosDaCandidatura, MENSAGENS_DA_CANDIDATURA, ROTULOS_DA_CANDIDATURA } from "../../app-pro/src/lib/candidatura";
import { contaSemPalavraPasse, eDaPalavraPasse, quatrocentosEUmComCodigo } from "../../app-pro/src/lib/palavra-passe-no-corpo";
import { CAMPO_DA_PALAVRA_PASSE, CODIGOS_DA_PALAVRA_PASSE, camposDePagamentoMudados } from "./dados-de-pagamento-mudados";
import { MENSAGEM_SEM_FOTOGRAFIA } from "../../app-pro/src/lib/fotografias-da-carrinha";
import { CAMPOS_DA_CANDIDATURA, resumoDoQueFalta } from "./campos-da-candidatura";
import * as GUIA from "./guia-de-residuos";

/**
 * A PARTE DA ENGENHARIA — APPS DAS DECISÕES d9 E d1 DE 12-11-2026.
 *
 *   · d9 (2) — o envio de um ficheiro só diz «sem ligação» sem rede: guarda o
 *     erro real, tenta pelo `uploadAsync` do expo-file-system, e pergunta à rede;
 *   · d9 (3) — o formulário que não passa pinta, rola até ao primeiro e diz o
 *     quê («Falta: …»), com o ajudante comum de componentes/ui.tsx;
 *   · d1 — mudar o IBAN, o titular ou o MB WAY pede a palavra-passe
 *     (`palavraPasse` no corpo; um 401 com `codigo` não faz sair).
 *
 * As partes puras correm aqui; os ecrãs (React Native) lêem-se, como nos
 * outros testes da app.
 */

const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const semComentarios = (s: string) =>
  s.replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "").replace(/^[ \t]*\/\/.*$/gm, "");

function ficheirosEm(pasta: string): string[] {
  const saida: string[] = [];
  for (const nome of readdirSync(join(process.cwd(), pasta))) {
    const rel = `${pasta}/${nome}`;
    if (statSync(join(process.cwd(), rel)).isDirectory()) saida.push(...ficheirosEm(rel));
    else if (/\.tsx?$/.test(nome) && !/\.test\.tsx?$/.test(nome)) saida.push(rel);
  }
  return saida;
}

describe("d9 (2) — o envio de um ficheiro: a segunda via e a frase certa", () => {
  beforeEach(() => limparFalhasDoEnvio());
  const agora = () => new Date("2026-11-12T15:00:00Z");
  const respostaBoa = { estado: 200, corpo: { url: "https://exemplo/fotografia.jpg" } };

  it("o fetch falha e o uploadAsync chega ao site: devolve a resposta, e o erro do fetch fica no registo", async () => {
    const vistas: FalhaDoEnvio[] = [];
    let perguntouARede = false;
    const r = await recuperarDoEnvio({
      caminho: "/api/parceiros/candidatura/fotografias",
      erroDoFetch: new TypeError("Network request failed"),
      porUpload: async () => respostaBoa,
      haRede: async () => {
        perguntouARede = true;
        return true;
      },
      aoRegistar: (f) => vistas.push(f),
      agora,
    });
    expect(r).toEqual(respostaBoa);
    expect(perguntouARede).toBe(false);
    expect(falhasDoEnvio()).toEqual([
      {
        quando: "2026-11-12T15:00:00.000Z",
        caminho: "/api/parceiros/candidatura/fotografias",
        tentativa: "fetch",
        erro: "TypeError: Network request failed",
        rede: "por saber",
      },
    ]);
    expect(vistas).toHaveLength(1);
  });

  it("as duas vias falham COM rede: não diz «sem ligação», diz que o envio falhou", async () => {
    const e = await recuperarDoEnvio({
      caminho: "/x",
      erroDoFetch: new TypeError("Network request failed"),
      porUpload: async () => {
        throw new Error("Unable to read file");
      },
      haRede: async () => true,
      agora,
    }).catch((x: unknown) => x);
    expect(e).toBeInstanceOf(FalhaDoFicheiro);
    expect((e as FalhaDoFicheiro).message).toBe(MENSAGEM_DO_FICHEIRO_QUE_FALHOU);
    expect((e as FalhaDoFicheiro).message).not.toMatch(/sem ligação/i);
    expect((e as FalhaDoFicheiro).rede).toBe("com rede");
    // Os dois erros reais ficam guardados, cada um com a sua via.
    expect(falhasDoEnvio().map((f) => [f.tentativa, f.erro, f.rede])).toEqual([
      ["fetch", "TypeError: Network request failed", "por saber"],
      ["uploadAsync", "Unable to read file", "com rede"],
    ]);
  });

  it("só sem rede confirmada diz «sem ligação»", async () => {
    const falhar = async () => {
      throw new Error("x");
    };
    const semRede = await recuperarDoEnvio({ caminho: "/x", erroDoFetch: new Error("a"), porUpload: falhar, haRede: async () => false }).catch((x: unknown) => x);
    expect((semRede as Error).message).toBe(MENSAGEM_DO_FICHEIRO_SEM_REDE);
    expect(MENSAGEM_DO_FICHEIRO_SEM_REDE).toMatch(/sem ligação/i);
    // Sem saber (a prova esgotou ou rebentou), não se acusa a rede.
    const porSaber = await recuperarDoEnvio({ caminho: "/x", erroDoFetch: new Error("a"), porUpload: falhar, haRede: async () => null }).catch((x: unknown) => x);
    expect((porSaber as Error).message).toBe(MENSAGEM_DO_FICHEIRO_QUE_FALHOU);
    const rebentou = await recuperarDoEnvio({
      caminho: "/x",
      erroDoFetch: new Error("a"),
      porUpload: falhar,
      haRede: async () => {
        throw new Error("b");
      },
    }).catch((x: unknown) => x);
    expect((rebentou as Error).message).toBe(MENSAGEM_DO_FICHEIRO_QUE_FALHOU);
  });

  it("o registo não cresce sem fim, e o prazo também lá fica", () => {
    for (let i = 0; i < MAXIMO_DO_REGISTO + 5; i++) registarOPrazo("/x", new Error(`n${i}`));
    expect(falhasDoEnvio()).toHaveLength(MAXIMO_DO_REGISTO);
    expect(falhasDoEnvio().at(-1)?.erro).toBe(`prazo: n${MAXIMO_DO_REGISTO + 4}`);
  });

  it("o corpo em texto do uploadAsync lê-se como o do fetch", () => {
    expect(corpoDeTexto('{"url":"u"}')).toEqual({ url: "u" });
    expect(corpoDeTexto("<html>")).toEqual({});
    expect(corpoDeTexto("[1]")).toEqual({});
    expect(corpoDeTexto(null)).toEqual({});
  });

  it("api.ts liga as duas vias: o mesmo campo `file`, os mesmos cabeçalhos, a prova da rede e o erro-da-app", () => {
    const API = semComentarios(ler("app-pro/src/lib/api.ts"));
    expect(API).toContain('import { FileSystemUploadType, uploadAsync } from "expo-file-system/legacy";');
    expect(API).toMatch(/uploadType: FileSystemUploadType\.MULTIPART,\s*fieldName: "file",\s*mimeType: ficheiro\.tipo,\s*parameters: campos,\s*headers: cabecalhos,/);
    expect(API).toMatch(/porUpload: \(\) => enviarPeloSistemaDeFicheiros\(caminho, campos, ficheiro, cabecalhos\),\s*haRede: confirmarARede,\s*aoRegistar: contarAFalhaDoEnvio,/);
    expect(API).toContain("return tratarResposta<T>(segunda.estado, segunda.corpo, semSessao, tokenUsado);");
    expect(API).toContain('await fetch(`${SITE}/robots.txt`, { method: "HEAD", signal: sinal });');
    expect(API).toContain("contadorDeErros((corpo) => enviarErroDaApp(SITE, corpo))");
    // A frase «sem ligação» do ficheiro já não está escrita no envio: vem de envio-de-ficheiro.ts, só sem rede.
    const i = API.indexOf("export async function enviarFicheiro<T>(");
    const FICHEIRO = API.slice(i, API.indexOf("export function errosPorCampo("));
    expect(FICHEIRO).not.toMatch(/sem ligação/i);
  });

  it("sem módulo nativo novo: as dependências da app são as de antes (a fingerprint não muda por isto)", () => {
    const pacote = JSON.parse(ler("app-pro/package.json")) as { dependencies: Record<string, string>; scripts: Record<string, string> };
    expect(Object.keys(pacote.dependencies).sort()).toEqual(
      [
        "@expo/vector-icons",
        "expo",
        "expo-constants",
        "expo-device",
        "expo-file-system",
        "expo-font",
        "expo-image-manipulator",
        "expo-image-picker",
        "expo-linking",
        "expo-notifications",
        "expo-router",
        "expo-secure-store",
        "expo-splash-screen",
        "expo-status-bar",
        "expo-updates",
        "react",
        "react-dom",
        "react-native",
        "react-native-safe-area-context",
        "react-native-screens",
        "react-native-web",
      ].sort(),
    );
    expect(pacote.dependencies["@react-native-community/netinfo"]).toBeUndefined();
    // O expo-file-system da app já traz o módulo antigo (o do uploadAsync), nos dois sistemas.
    const modulo = ler("app-pro/node_modules/expo-file-system/expo-module.config.json");
    expect(modulo).toContain("expo.modules.filesystem.legacy.FileSystemLegacyModule");
  });
});

describe("d9 (3) — o formulário que não passa diz o quê", () => {
  it("«Falta: …» pela ordem do ecrã, com os nomes curtos", () => {
    expect(fraseDoQueFalta({ email: "x", telefone: "y" }, { telefone: "telemóvel (tem de ser português)", email: "email" })).toBe(
      "Falta: telemóvel (tem de ser português), email.",
    );
    expect(fraseDoQueFalta({}, { a: "a" })).toBeNull();
    // Um campo que o ecrã não conhece entra com a frase do erro.
    expect(fraseDoQueFalta({ outro: "Escolha um dia." }, { a: "a" })).toBe("Falta: escolha um dia.");
    expect(primeiroCampoComErro({ servicos: "x", nome: "y" }, ROTULOS_DA_CANDIDATURA)).toBe("nome");
  });

  it("a candidatura da app usa os nomes do site, e o aviso é o mesmo do formulário do site", () => {
    expect(Object.entries(ROTULOS_DA_CANDIDATURA)).toEqual(CAMPOS_DA_CANDIDATURA.map((c) => [c.campo, c.nome]));
    const erros = errosDaCandidatura({ nome: "", email: "", telefone: "", cidade: "", servicos: [], fotografias: [] });
    expect(fraseDoQueFalta(erros, ROTULOS_DA_CANDIDATURA)).toBe(
      resumoDoQueFalta(Object.entries(erros).map(([campo, mensagem]) => ({ campo, mensagem }))),
    );
  });

  it("paridade: as frases da candidatura são as da rota, e as regras dão o mesmo", () => {
    const ROTA = ler("src/app/api/parceiros/candidatura/route.ts");
    for (const [campo, mensagem] of Object.entries(MENSAGENS_DA_CANDIDATURA)) {
      expect(ROTA, campo).toContain(`erros.push({ campo: "${campo}", mensagem: "${mensagem}" });`);
    }
    expect(ROTA).toContain("if (!nome || nome.length < 2)");
    expect(ROTA).toContain("if (!email || !emailValido(email))");
    expect(ROTA).toContain("if (!telefone || !telefoneValido(telefone))");
    const bem = { nome: "Transportes Lda", email: "a@b.pt", telefone: "912 345 678", cidade: "Seixal", servicos: ["recolhas"], fotografias: ["u"] };
    expect(errosDaCandidatura(bem)).toEqual({});
    expect(errosDaCandidatura({ ...bem, telefone: "+33 6 12 34 56 78" })).toEqual({ telefone: MENSAGENS_DA_CANDIDATURA.telefone });
    expect(errosDaCandidatura({ ...bem, fotografias: [] })).toEqual({ fotografias: MENSAGEM_SEM_FOTOGRAFIA });
  });

  it("o registo da Pro rola até ao primeiro erro e diz o quê", () => {
    const REGISTO = semComentarios(ler("app-pro/src/app/registo.tsx"));
    expect(REGISTO).toContain("const formulario = useFormulario(ROTULOS_DA_CANDIDATURA);");
    expect(REGISTO).toContain("formulario.mostrarErros(locais);");
    expect(REGISTO).toContain("formulario.mostrarErros(porCampo);");
    expect(REGISTO).toContain("<FormularioComErros formulario={formulario}>");
    for (const campo of ["nome", "telefone", "email", "cidade"]) expect(REGISTO, campo).toContain(`campo="${campo}"`);
    expect(REGISTO).toContain('<CaixaComErro campo="servicos">');
    expect(REGISTO).toContain('<CaixaComErro campo="fotografias">');
    expect(REGISTO).toContain("<Mensagem texto={formulario.aviso} />");
    expect(REGISTO).not.toContain("assinalado acima");
  });

  it("o ajudante: pinta, mede todos, desce até ao mais acima e foca-o", () => {
    const UI = ler("app-pro/src/componentes/ui.tsx");
    expect(UI).toContain("export function useFormulario(rotulos: Record<string, string>): Formulario {");
    expect(UI).toContain("if (Object.keys(novos).length > 0) setTimeout(() => descerAoPrimeiro(novos), 60);");
    expect(UI).toContain("if (!melhor || y < melhor.y) melhor = { campo, y };");
    expect(UI).toMatch(/lugar\?\.mostrar\(\);\s*lugar\?\.focar\?\.\(\);/);
    expect(UI).toContain("aviso: fraseDoQueFalta(erros, rotulos)");
    expect(UI).toContain("export function CaixaComErro(");
    expect(UI).toContain("export function GrupoComErro(");
    const TECLADO = ler("app-pro/src/componentes/Teclado.tsx");
    expect(TECLADO).toContain("rolagem.current?.scrollTo({ y: Math.max(0, posicao.current + (y - yDaRolagem) - FOLGA), animated: true });");
  });

  it("todo o ecrã com erros por campo usa o ajudante (as duas apps)", () => {
    const ecras = ficheirosEm("app-pro/src/app").filter((f) => ler(f).includes("errosPorCampo("));
    expect(ecras.length).toBeGreaterThanOrEqual(7);
    for (const f of ecras) {
      const s = semComentarios(ler(f));
      expect(s, f).toMatch(/const formulario = useFormulario\(ROTULOS_\w+\);/);
      expect(s, f).toContain("<FormularioComErros formulario={formulario}>");
      expect(s, f).toContain("formulario.mostrarErros(porCampo);");
      expect(s, f).toContain("<Mensagem texto={formulario.aviso} />");
      // O erro só vai à mão a quem também diz o nome do campo (o opcional das mudanças, pelo aviso âmbar).
      expect(s, f).not.toMatch(/erro=\{erros\.\w+\}(?!\s*campo=)/);
      expect(s, f).not.toMatch(/setErros\(/);
      expect(s, f).not.toMatch(/\{erros\.\w+ \? <Text/);
      expect(s, f).not.toContain("assinalado acima");
      expect(s, f).not.toContain("Há campos por corrigir");
    }
    // Na app de cliente, o pedido desce pelo ajudante comum.
    expect(ler("app-cliente/src/componentes/NovoPedido.tsx")).toContain("descerAteOCampo(lugares.current.get(campo), conteudo.current, scroll.current);");
    expect(ler("app-cliente/src/componentes/ui.tsx")).toContain("export function descerAteOCampo(");
    expect(ficheirosEm("app-cliente/src").filter((f) => ler(f).includes("assinalado acima"))).toEqual([]);
  });
});

describe("d1 — a palavra-passe no ecrã do IBAN e do MB WAY (contrato do site, 3b731adb)", () => {
  const BANCO = semComentarios(ler("app-pro/src/app/conta/banco.tsx"));
  const ROTA = ler("src/app/api/profissionais/perfil/route.ts");
  const PAINEL = ler("src/app/profissionais/painel/Perfil.tsx");

  it("o campo aparece logo que o IBAN, o titular ou o MB WAY mudam de facto, e segue com o nome do site", () => {
    expect(BANCO).toContain("camposDePagamentoMudados({ ibanTitular: perfil.ibanTitular, mbway: perfil.mbway }, { ibanTitular: titular, mbway })");
    expect(BANCO).toContain("const pedeAPalavraPasse = mudados.length > 0;");
    expect(BANCO).toMatch(/\{pedeAPalavraPasse \? \(\s*<Caixa>\s*<CampoDeTexto\s*rotulo="A sua palavra-passe"/);
    expect(BANCO).toContain('campo="palavraPasse"');
    expect(BANCO).toContain("secureTextEntry");
    expect(BANCO).toContain("corpo: { ...mudancas, [CAMPO_DA_PALAVRA_PASSE]: palavraPasse }");
    expect(CAMPO_DA_PALAVRA_PASSE).toBe("palavraPasse");
    expect(BANCO).toContain("if (!palavraPasse) locais.palavraPasse = FALTA_A_PALAVRA_PASSE;");
    // Depois de gravar, a palavra-passe não fica no ecrã.
    expect(BANCO).toMatch(/setIban\(""\);\s*setPalavraPasse\(""\);/);
    // A mudança de facto é a conta do site: o mesmo valor não pede a palavra-passe.
    expect(camposDePagamentoMudados({ ibanTitular: "Ana", mbway: "" }, { ibanTitular: " Ana ", mbway: "" })).toEqual([]);
    expect(camposDePagamentoMudados({ ibanTitular: "Ana", mbway: "" }, { ibanTitular: "Rui", mbway: "912345678" })).toEqual(["ibanTitular", "mbway"]);
  });

  it("paridade: as frases são as da rota e do painel", () => {
    const frase = (nome: string) => {
      const m = new RegExp(`const ${nome} =\\s*"([^"]+)";`).exec(ler("app-pro/src/app/conta/banco.tsx"));
      expect(m, nome).not.toBeNull();
      return m![1];
    };
    expect(ROTA).toContain(frase("FALTA_A_PALAVRA_PASSE"));
    expect(PAINEL.replace(/\s+/g, " ")).toContain(frase("AJUDA_DA_PALAVRA_PASSE"));
    expect(PAINEL).toContain('etiqueta="A sua palavra-passe"');
    // O aviso dos dados mudados, à letra do painel.
    const painel = PAINEL.replace(/<[^>]+>/g, "").replace(/\{haQuantoTempo\(mudanca\.dias\)\}/g, "X").replace(/\s+/g, " ");
    expect(painel).toContain("IBAN mudado X (IBAN, titular ou MB WAY). Se não reconhece esta mudança, fale connosco já.");
    expect(painel).toContain("O titular não bate com o nome da conta. Confirme o nome tal como está no banco: uma transferência para um nome que não confere pode ser devolvida.");
    expect(ler("app-pro/src/app/conta/banco.tsx")).toContain(
      "O titular não bate com o nome da conta. Confirme o nome tal como está no banco: uma transferência para um nome que não confere pode ser devolvida.",
    );
    expect(BANCO).toContain("mudancaDosDadosDePagamento(data)");
    expect(BANCO).toContain("<AvisoDosDadosDePagamento em={perfil.ibanMudadoEm ?? null} titularBate={perfil.titularBateComONome ?? null} />");
  });

  it("o 401 com `codigo` nunca faz sair; só o 401 sem ele (a sessão) faz", () => {
    for (const codigo of Object.values(CODIGOS_DA_PALAVRA_PASSE)) {
      expect(eDaPalavraPasse({ error: "x", codigo })).toBe(true);
      expect(quatrocentosEUmComCodigo(401, { error: "x", codigo })).toBe(true);
    }
    expect(quatrocentosEUmComCodigo(401, { error: "Não autenticado" })).toBe(false);
    expect(quatrocentosEUmComCodigo(401, { codigo: "" })).toBe(false);
    expect(quatrocentosEUmComCodigo(403, { codigo: "x" })).toBe(false);
    expect(eDaPalavraPasse({ error: "Não autenticado" })).toBe(false);
    expect(contaSemPalavraPasse({ codigo: CODIGOS_DA_PALAVRA_PASSE.semPalavraPasse })).toBe(true);
    // A rota responde mesmo assim: 401 com codigo para a palavra-passe, 401 sem codigo para a sessão.
    expect(ROTA).toContain("codigo: CODIGOS_DA_PALAVRA_PASSE.emFalta");
    expect(ROTA).toContain('if (!sessao) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });');
    const API = semComentarios(ler("app-pro/src/lib/api.ts"));
    expect(API).toContain("const naoSai = semSessao || quatrocentosEUmComCodigo(estado, corpo);");
    expect(API).toContain("if (r.status === 401 && !naoSai) await perdeuASessao(tokenUsado);");
    expect(API).toContain("if (e instanceof ErroDaApi && e.estado === 401 && !quatrocentosEUmComCodigo(401, e.corpo)) aoPerderASessao?.();");
    // A frase do site vai para o campo, e a conta sem palavra-passe leva ao «Esqueci-me».
    expect(BANCO).toMatch(/if \(e instanceof ErroDaApi && e\.estado === 401 && eDaPalavraPasse\(e\.corpo\)\) \{\s*porCampo\.palavraPasse = e\.message;\s*setSemPalavraPasse\(contaSemPalavraPasse\(e\.corpo\)\);/);
    expect(BANCO).toContain('titulo="Esqueci-me da palavra-passe"');
  });
});

describe("d5 — a guia de resíduos na app, igual ao painel (contrato do site, 7275d556)", () => {
  const FAT = semComentarios(ler("app-pro/src/app/conta/faturacao.tsx"));

  it("o código APA com o exemplo do site e o aviso do formato, que não bloqueia", () => {
    expect(FAT).toContain("rotulo={ROTULO_DO_CODIGO_APA}");
    expect(FAT).toContain("placeholder={EXEMPLO_DO_CODIGO_APA}");
    expect(GUIA.EXEMPLO_DO_CODIGO_APA).toBe("Ex.: APA00000000");
    expect(FAT).not.toContain("APA-123456");
    expect(FAT).toContain("{avisoDoCodigoApa(transportador) ? (");
    // Não bloqueia: o aviso não entra nos erros nem trava o gravar.
    expect(FAT).not.toMatch(/avisoDoCodigoApa\([^)]*\)[^\n]*return/);
    expect(GUIA.avisoDoCodigoApa("APA-1234 5678")).toBeNull();
    expect(GUIA.avisoDoCodigoApa("APA-123456")).toBe(GUIA.AVISO_DO_FORMATO_DO_CODIGO_APA);
  });

  it("a prova do registo sobe e apaga-se pela rota do site, e o destino segue com o nome do site", () => {
    expect(FAT).toContain('enviarFicheiro<{ provaDaGuia?: unknown }>("/api/profissionais/prova-da-guia", {}, f)');
    expect(FAT).toContain('pedir("/api/profissionais/prova-da-guia", { metodo: "DELETE" })');
    expect(FAT).toContain("{ROTULO_DA_PROVA_DA_GUIA}");
    expect(FAT).toContain("{AJUDA_DA_PROVA_DA_GUIA}");
    expect(FAT).toContain("MENSAGENS_DA_PROVA.enviada");
    expect(FAT).toContain("rotulo={ROTULO_DO_DESTINO_DOS_RESIDUOS}");
    expect(FAT).toContain("placeholder={EXEMPLO_DO_DESTINO_DOS_RESIDUOS}");
    expect(FAT).toContain("maxLength={MAXIMO_DO_DESTINO_DOS_RESIDUOS}");
    expect(FAT).toContain('...(emiteGuia && destino.trim() !== (perfil.destinoDosResiduos ?? "").trim() ? { destinoDosResiduos: destino.trim() } : {}),');
    expect(FAT).toContain("AJUDA_DA_GUIA.passos.map");
    const ROTA = ler("src/app/api/profissionais/perfil/route.ts");
    expect(ROTA).toContain('if ("destinoDosResiduos" in corpo) {');
    expect(ROTA).toContain("provaDaGuia: p.provaDaGuiaEm");
    expect(ler("src/app/api/profissionais/prova-da-guia/route.ts")).toContain("export async function DELETE(");
    expect(ler("src/lib/prova-da-guia-no-servidor.ts")).toMatch(/get\("file"\)/);
  });
});
