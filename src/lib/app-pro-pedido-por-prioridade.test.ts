import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { distanciaDe } from "../../app-pro/src/lib/trabalhos";

/**
 * O ECRÃ DO PEDIDO NA APP PRO, POR PRIORIDADE — ordem do CEO com o sim do
 * dono, 02-11-2026 (captura do #555). Três caixas diziam «o trabalho é seu»,
 * a regra do valor e o histórico ocupavam o meio do ecrã, «Ligue a
 * Wanderson», «cerca de 0,0 km», «Falta combinar o dia» com «A caminho às
 * 18:20», e cada botão do trajecto pedia «Sim, avisar / Cancelar».
 */
const ler = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
const semNotas = (p: string) =>
  ler(p)
    .replace(/^[ \t]*\{?\/\*[\s\S]*?\*\/\}?/gm, "")
    .replace(/^\s*\/\/.*$/gm, "");
const C = semNotas("app-pro/src/componentes/TrabalhoContratado.tsx");
const D = semNotas("app-pro/src/app/trabalho/[id].tsx");

describe("a ordem do ecrã", () => {
  it("o valor, um ajuste a decorrer, o dia por marcar, o trajecto e o «Está feito» em cima; o pedido, o dia marcado e o contacto depois", () => {
    const bloco = C.slice(C.indexOf("const viajando = !!t.aCaminhoEm;"));
    const ordem = [
      "<OTrabalhoESeu t={t} />",
      '<AjusteNoLocal t={t} modo="estado" />',
      "{!viajando && semDia ? <ODia t={t} /> : null}",
      "<Viagem t={t} />",
      "<EstaFeito t={t} aoMarcar={setObrigado} />",
      "{descricao}",
      "{!viajando && !semDia ? <ODia t={t} /> : null}",
      "<OndeEComQuem t={t} />",
    ].map((x) => bloco.indexOf(x));
    expect(ordem.every((i) => i >= 0)).toBe(true);
    expect([...ordem].sort((a, b) => a - b)).toEqual(ordem);
  });

  it("uma caixa só diz que o trabalho é seu: a «combine já» saiu, e com a viagem começada o «Falta combinar o dia» também", () => {
    expect(C).not.toContain("function CombineJa");
    expect(C).not.toContain("O trabalho é seu — combine já");
    expect(C.match(/O trabalho é seu/g)?.length).toBe(1);
  });

  it("«Ligue ao cliente», sem o nome com a preposição errada", () => {
    expect(C).toContain("Ligue ao cliente para combinar o dia e a hora.");
    expect(C).not.toMatch(/Ligue \{t\.contactoNome/);
  });

  it("«cerca de 0,0 km» não aparece: 0 é distância por medir", () => {
    expect(distanciaDe({ distanciaKm: 0, distanciaMedidaPor: null } as never)).toBeNull();
    expect(distanciaDe({ distanciaKm: 0.02, distanciaMedidaPor: "linha" } as never)).toBeNull();
    expect(distanciaDe({ distanciaKm: 3.4, distanciaMedidaPor: null } as never)).toBe("cerca de 3,4 km");
  });
});

describe("o dia, a hora e a duração num sítio", () => {
  it("«Mudar data e hora» com um dia marcado ou pedido; «Marcar o dia» só sem dia nenhum", async () => {
    // O componente importa React Native: lê-se a regra no código.
    expect(C).toContain('export const ACAO_DO_DIA = { marcar: "Marcar o dia", mudar: "Mudar data e hora" } as const;');
    expect(C).toContain("return t.dataCombinada || t.dataAgendada ? ACAO_DO_DIA.mudar : ACAO_DO_DIA.marcar;");
    expect(C).toContain("<Botao titulo={tituloDoBotaoDoDia(t)}");
  });

  it("a duração escolhe-se no mesmo seletor (o «Mudar» da duração saiu) e o dia só se regrava se mudou", () => {
    expect(C).toContain("Quanto tempo leva");
    expect(C).not.toContain('{aMudarDuracao ? "Fechar" : "Mudar"}');
    expect(C).toContain('pedir("/api/profissionais/agenda/duracao"');
    expect(C).toContain("if (mudouODia) {");
    expect(C).toContain("Se mudar o dia ou a hora, o cliente é avisado.");
  });

  it("mudar o dia avisa o cliente (no telemóvel e por WhatsApp quando a data assenta)", () => {
    const rota = ler("src/app/api/profissionais/agenda/route.ts");
    expect(rota).toContain('avisarOClienteDoPedido(linha.pedidoId, "dia"');
    expect(rota).toContain("registarMudancaDeData(");
  });
});

describe("o trajecto num toque, com «Desfazer»", () => {
  it("sem «Sim, avisar / Cancelar»: o toque fica 5 s à espera com «Desfazer» e depois segue", () => {
    expect(C).not.toContain("Sim, avisar");
    expect(C).not.toContain("Avisar o cliente de que");
    expect(C).toContain("export const ESPERA_PARA_DESFAZER_MS = 5000;");
    expect(C).toContain("<BotaoDaViagem etapa={seguinte} aoCarregar={() => tocar(seguinte)} />");
    expect(C).toContain("Desfazer");
    expect(C).toContain("A avisar o cliente de que vai a caminho…");
  });

  it("sair do ecrã durante a espera envia na mesma; o «Está feito» continua a pedir confirmação", () => {
    expect(C).toContain("if (pendente.current) void marcarEtapa(t, pendente.current).catch(() => {});");
    expect(C).toContain('titulo="Sim, está feito"');
  });
});

describe("«Mais opções»: o ajuste do valor (depois de «Cheguei»), o histórico e arquivar", () => {
  it("o histórico e arquivar saem do corpo do ecrã para «Mais opções», fechado de início", () => {
    expect(D).toContain("<MaisOpcoes");
    expect(D).toContain("const [aberto, setAberto] = useState(false);");
    const mais = D.slice(D.indexOf("<MaisOpcoes"), D.indexOf("</MaisOpcoes>"));
    expect(mais).toContain("<Historico t={t} />");
    expect(mais).toContain("<Arrumar t={t} />");
    expect(mais).toContain('<AjusteNoLocal t={t} modo="pedir" />');
  });

  it("pedir ajuste do valor só depois de «Cheguei»; um ajuste a decorrer fica à vista em cima", () => {
    expect(C).toContain("return !!t.chegouEm;");
    expect(C).toContain('if (modo === "pedir" && !podePedirAjusteAgora(t)) return null;');
    expect(C).toContain('if (modo === "estado" && !aPedir) return null;');
    expect(C).toContain('if (situacao === "pendente" && modo === "pedir") return null;');
  });
});

describe("a versão nova pergunta antes (como a app de cliente)", () => {
  it("«Atualizar agora» recarrega logo; «Mais tarde» não volta a perguntar enquanto a app estiver aberta", () => {
    const a = ler("app-pro/src/componentes/ActualizacaoAutomatica.tsx");
    expect(a).toContain("Há uma versão nova da app");
    expect(a).toContain("Atualizar agora");
    expect(a).toContain("Mais tarde");
    expect(a).toContain("adiadaNestaSessao = true;");
    expect(a).toContain("setAPerguntar(true);");
  });
});
